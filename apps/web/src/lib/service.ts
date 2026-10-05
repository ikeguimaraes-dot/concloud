import 'server-only';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import {
  scoped,
  transaction,
  tenant,
  audit,
  dirty,
  type Actor,
  type Scope,
  type Tx,
} from '@database/client';
import { assert, AppError } from '@domain/errors';
import { internal, authorize, type Permission } from '@domain/permissions';
import { id, text, date, amount, month, cnpj, kind } from '@domain/validation';
import { money, positive, splitInstallments, outstanding, settlementCash } from '@domain/money';
import { transition, states } from '@domain/closing';
import { parseCsv, type ImportRow } from '@domain/imports';
import { readOfx } from '@integrations/ofx';
import { putObject, validateUpload, bucket, signedDownload } from '@integrations/storage';
import type { Snapshot } from '@integrations/accounting';
import type { Prisma } from '@database/generated/client';
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const optionalId = z.preprocess((v) => (v === '' ? undefined : v), id.optional());
const reason = z.string().trim().min(8).max(2000);
function atMonth(value: Date) {
  return value.toISOString().slice(0, 7);
}
async function lock(tx: Tx, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
}
async function assigned(tx: Tx, s: Scope, userId: string, review = false) {
  const company = await tx.companyMembership.findFirst({
    where: {
      ...tenant(s),
      userId,
      active: true,
      role: {
        in: review
          ? ['ACCOUNTANT', 'ORG_ADMIN', 'SUPER_ADMIN']
          : ['ACCOUNTANT', 'ASSISTANT', 'ORG_ADMIN', 'SUPER_ADMIN'],
      },
    },
  });
  const org = await tx.organizationMembership.findFirst({
    where: {
      organizationId: s.organizationId,
      userId,
      active: true,
      role: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] },
    },
  });
  assert(company || org, 'Responsável/revisor precisa estar atribuído à empresa.');
}
export async function companies(actor: Actor) {
  return transaction(actor, async (tx) => ({
    companies: await tx.company.findMany({ orderBy: { name: 'asc' } }),
    organizations: await tx.organizationMembership.findMany({
      where: { userId: actor.id, active: true },
      include: { organization: true },
    }),
  }));
}
export async function createCompany(actor: Actor, input: unknown) {
  const p = z
    .object({
      organizationId: id,
      name: text,
      cnpj,
      regime: z.enum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO']),
      accountingSystemId: z.string().max(50).optional(),
    })
    .parse(input);
  return transaction(actor, async (tx) => {
    const member = await tx.organizationMembership.findFirst({
      where: { organizationId: p.organizationId, userId: actor.id, active: true },
    });
    assert(member, 'Organização não autorizada.');
    authorize(member.role, 'admin');
    assert(process.env.REQUIRE_STAFF_MFA === 'false' || actor.aal === 'aal2', 'MFA obrigatório.');
    const company = await tx.company.create({
      data: {
        organizationId: member.organizationId,
        name: p.name,
        cnpj: p.cnpj,
        accountingSystemId: p.accountingSystemId || null,
      },
    });
    const s = { organizationId: member.organizationId, companyId: company.id, role: member.role };
    await tx.companyTaxProfileHistory.create({
      data: { ...tenant(s), regime: p.regime, validFrom: new Date() },
    });
    await tx.onboardingItem.createMany({
      data: [
        'Contrato de serviços',
        'Cadastro e responsáveis',
        'Documentos societários',
        'Configuração financeira',
      ].map((label) => ({ ...tenant(s), label })),
    });
    await audit(tx, actor, s, 'company.create', company.id);
    return company.id;
  });
}
export async function acceptInvitation(actor: Actor, token: string) {
  assert(/^[a-f0-9]{64}$/.test(token), 'Convite inválido.');
  return transaction(
    actor,
    async (tx) => {
      const invite = await tx.invitation.findUnique({ where: { tokenHash: hash(token) } });
      assert(
        invite &&
          !invite.acceptedAt &&
          invite.expiresAt > new Date() &&
          invite.email === actor.email.toLowerCase(),
        'Convite inválido, expirado ou já utilizado.',
      );
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${invite.id}))::text`;
      await tx.profile.upsert({
        where: { id: actor.id },
        create: { id: actor.id, email: actor.email, name: actor.email.split('@')[0] },
        update: {},
      });
      await tx.companyMembership.create({
        data: {
          organizationId: invite.organizationId,
          companyId: invite.companyId,
          userId: actor.id,
          role: invite.role,
          displayName: actor.email,
        },
      });
      await tx.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      await audit(
        tx,
        actor,
        { organizationId: invite.organizationId, companyId: invite.companyId, role: invite.role },
        'invitation.accept',
        invite.id,
      );
      return invite.companyId;
    },
    hash(token),
  );
}
export async function readCompany(actor: Actor, companyId: string) {
  return scoped(actor, companyId, 'read', async (tx, s) => {
    const filter = tenant(s);
    const [
      company,
      contacts,
      accounts,
      categories,
      costCenters,
      titles,
      installments,
      settlements,
      transfers,
      transactions,
      reconciliations,
      imports,
      documents,
      requests,
      periods,
      tasks,
      guides,
      payments,
      obligations,
      tickets,
      messages,
      onboarding,
      members,
      events,
    ] = await Promise.all([
      tx.company.findUniqueOrThrow({ where: { id: companyId } }),
      tx.contact.findMany({ where: filter }),
      tx.bankAccount.findMany({ where: filter }),
      tx.financialCategory.findMany({ where: filter }),
      tx.costCenter.findMany({ where: filter }),
      tx.financialTitle.findMany({ where: filter, orderBy: { createdAt: 'desc' } }),
      tx.installment.findMany({ where: filter, orderBy: { dueDate: 'asc' } }),
      tx.settlement.findMany({ where: filter }),
      tx.transfer.findMany({ where: filter }),
      tx.bankTransaction.findMany({ where: filter, orderBy: { date: 'desc' } }),
      tx.reconciliation.findMany({ where: filter }),
      tx.bankImport.findMany({ where: filter }),
      tx.document.findMany({ where: filter, orderBy: { createdAt: 'desc' } }),
      tx.documentRequest.findMany({ where: filter }),
      tx.accountingPeriod.findMany({ where: filter, orderBy: { competence: 'desc' } }),
      tx.closingTask.findMany({ where: filter }),
      tx.taxGuide.findMany({
        where: { ...filter, ...(!internal(s.role) ? { publishedAt: { not: null } } : {}) },
      }),
      tx.taxPayment.findMany({ where: filter }),
      tx.taxObligation.findMany({ where: filter }),
      tx.ticket.findMany({ where: filter, orderBy: { createdAt: 'desc' } }),
      tx.ticketMessage.findMany({ where: filter, orderBy: { createdAt: 'asc' } }),
      tx.onboardingItem.findMany({ where: filter }),
      tx.companyMembership.findMany({ where: filter }),
      tx.auditEvent.findMany({ where: filter, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const batches = internal(s.role)
      ? await tx.exportBatch.findMany({
          where: filter,
          orderBy: { createdAt: 'desc' },
          omit: { snapshot: true },
        })
      : [];
    const reviews = internal(s.role) ? await tx.review.findMany({ where: filter }) : [];
    const processing = internal(s.role) ? await tx.processingBatch.findMany({ where: filter }) : [];
    return {
      scope: s,
      company,
      contacts,
      accounts,
      categories,
      costCenters,
      titles,
      installments,
      settlements,
      transfers,
      transactions,
      reconciliations,
      imports,
      documents,
      requests,
      periods,
      tasks,
      guides,
      payments,
      obligations,
      tickets,
      messages,
      onboarding,
      members,
      events,
      batches,
      reviews,
      processing,
    };
  });
}
export type CompanyData = Awaited<ReturnType<typeof readCompany>>;
const permissions: Record<string, Permission> = {
  invite: 'admin',
  assign: 'admin',
  onboarding: 'staff',
  taxProfile: 'admin',
  request: 'staff',
  fulfill: 'upload',
  publish: 'review',
  period: 'admin',
  task: 'staff',
  completeTask: 'staff',
  transition: 'staff',
  export: 'staff',
  processed: 'staff',
  review: 'review',
  guide: 'staff',
  verifyPayment: 'review',
  receipt: 'staff',
  downloadBatch: 'staff',
};
export async function command(
  actor: Actor,
  companyId: string,
  commandName: string,
  input: Record<string, unknown>,
): Promise<{
  message: string;
  link?: string;
  previewHash?: string;
  preview?: { accepted: ImportRow[]; rejected: { line: number; reason: string }[] };
}> {
  return scoped(
    actor,
    id.parse(companyId),
    permissions[commandName] ?? 'finance',
    async (tx, s) => {
      const base = tenant(s);
      let resourceId = companyId;
      let link: string | undefined;
      let message = 'Alteração registrada.';
      switch (commandName) {
        case 'invite': {
          const p = z
            .object({
              email: z
                .string()
                .email()
                .transform((v) => v.toLowerCase()),
              role: z.enum(['ACCOUNTANT', 'ASSISTANT', 'CLIENT_OWNER', 'CLIENT_MEMBER']),
            })
            .parse(input);
          const token = randomBytes(32).toString('hex');
          const row = await tx.invitation.create({
            data: {
              ...base,
              ...p,
              tokenHash: hash(token),
              expiresAt: new Date(Date.now() + 7 * 86400000),
              createdBy: actor.id,
            },
          });
          resourceId = row.id;
          link = `/convite?token=${token}`;
          message =
            'Convite criado. Copie o link e compartilhe com o destinatário. Nenhum e-mail foi enviado.';
          break;
        }
        case 'assign': {
          const p = z
            .object({
              userId: id,
              role: z.enum(['ACCOUNTANT', 'ASSISTANT', 'CLIENT_OWNER', 'CLIENT_MEMBER']),
            })
            .parse(input);
          const existing = await tx.companyMembership.findFirst({
            where: { ...base, userId: p.userId },
          });
          assert(existing, 'Para novos usuários, crie um convite.');
          await tx.companyMembership.update({ where: { id: existing.id }, data: { role: p.role } });
          resourceId = existing.id;
          break;
        }
        case 'onboarding': {
          const row = await tx.onboardingItem.update({
            where: { organizationId_companyId_id: { ...base, id: id.parse(input.id) } },
            data: { completedAt: new Date(), completedBy: actor.id },
          });
          resourceId = row.id;
          break;
        }
        case 'taxProfile': {
          const p = z
            .object({
              regime: z.enum(['SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO']),
              validFrom: date,
              notes: text,
            })
            .parse(input);
          await lock(tx, companyId);
          const previous = await tx.companyTaxProfileHistory.findFirst({
            where: base,
            orderBy: { validFrom: 'desc' },
          });
          assert(
            !previous || p.validFrom > previous.validFrom,
            'A nova vigência deve ser posterior à anterior.',
          );
          if (previous)
            await tx.companyTaxProfileHistory.update({
              where: { id: previous.id },
              data: { validTo: new Date(p.validFrom.getTime() - 86400000) },
            });
          resourceId = (await tx.companyTaxProfileHistory.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'contact': {
          const p = z
            .object({
              name: text,
              kind: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']),
              email: z.union([z.literal(''), z.string().email()]).optional(),
            })
            .parse(input);
          resourceId = (await tx.contact.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'account': {
          const p = z.object({ name: text, openingBalance: amount.default('0') }).parse(input);
          resourceId = (await tx.bankAccount.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'category': {
          const p = z.object({ name: text, kind }).parse(input);
          resourceId = (await tx.financialCategory.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'costCenter': {
          resourceId = (
            await tx.costCenter.create({ data: { ...base, name: text.parse(input.name) } })
          ).id;
          break;
        }
        case 'title': {
          const p = z
            .object({
              description: text,
              kind,
              amount,
              issueDate: date,
              competence: month,
              dueDate: date,
              count: z.coerce.number().int().min(1).max(120),
              contactId: optionalId,
              categoryId: optionalId,
              costCenterId: optionalId,
            })
            .parse(input);
          if (p.categoryId)
            await tx.financialCategory.findFirstOrThrow({
              where: { ...base, id: p.categoryId, kind: p.kind },
            });
          const values = splitInstallments(p.amount, p.count);
          const row = await tx.financialTitle.create({
            data: {
              ...base,
              description: p.description,
              kind: p.kind,
              amount: p.amount,
              issueDate: p.issueDate,
              competence: new Date(p.competence + '-01T12:00:00Z'),
              contactId: p.contactId,
              categoryId: p.categoryId,
              costCenterId: p.costCenterId,
            },
          });
          for (let i = 0; i < values.length; i++) {
            const due = new Date(p.dueDate);
            const day = due.getUTCDate();
            due.setUTCDate(1);
            due.setUTCMonth(due.getUTCMonth() + i);
            const last = new Date(
              Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0),
            ).getUTCDate();
            due.setUTCDate(Math.min(day, last));
            await tx.installment.create({
              data: { ...base, titleId: row.id, number: i + 1, dueDate: due, amount: values[i] },
            });
          }
          resourceId = row.id;
          await dirty(tx, s, p.competence);
          break;
        }
        case 'recurrence': {
          const p = z
            .object({
              description: text,
              kind,
              amount,
              startMonth: month,
              day: z.coerce.number().int().min(1).max(28),
            })
            .parse(input);
          positive(p.amount);
          resourceId = (await tx.recurrenceRule.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'generateRecurrence': {
          const p = z.object({ month }).parse(input);
          const rules = await tx.recurrenceRule.findMany({
            where: {
              ...base,
              active: true,
              startMonth: { lte: p.month },
              OR: [{ endMonth: null }, { endMonth: { gte: p.month } }],
            },
          });
          let generated = 0;
          for (const rule of rules) {
            const key = `${rule.id}:${p.month}`;
            await lock(tx, key);
            const existing = await tx.financialTitle.findUnique({
              where: { companyId_recurrenceKey: { companyId, recurrenceKey: key } },
            });
            if (existing) continue;
            generated++;
            const title = await tx.financialTitle.create({
              data: {
                ...base,
                description: rule.description,
                kind: rule.kind,
                amount: rule.amount,
                recurrenceKey: key,
                issueDate: new Date(),
                competence: new Date(p.month + '-01T12:00:00Z'),
              },
            });
            await tx.installment.create({
              data: {
                ...base,
                titleId: title.id,
                number: 1,
                dueDate: new Date(`${p.month}-${String(rule.day).padStart(2, '0')}T12:00:00Z`),
                amount: rule.amount,
              },
            });
          }
          if (generated > 0) await dirty(tx, s, p.month);
          break;
        }
        case 'settle': {
          const p = z
            .object({
              installmentId: id,
              bankAccountId: id,
              principal: amount,
              interest: amount.default('0'),
              fine: amount.default('0'),
              discount: amount.default('0'),
              paidAt: date,
              idempotencyKey: id,
            })
            .parse(input);
          await lock(tx, p.installmentId);
          const previous = await tx.settlement.findUnique({
            where: { companyId_idempotencyKey: { companyId, idempotencyKey: p.idempotencyKey } },
          });
          if (previous) {
            resourceId = previous.id;
            break;
          }
          const installment = await tx.installment.findFirstOrThrow({
            where: { ...base, id: p.installmentId },
          });
          const paid = await tx.settlement.findMany({
            where: { ...base, installmentId: p.installmentId },
          });
          assert(
            positive(p.principal).lte(
              outstanding(
                installment.amount.toString(),
                paid.map((x) => ({ principal: x.principal.toString(), reversedAt: x.reversedAt })),
              ),
            ),
            'Liquidação excede o saldo em aberto.',
          );
          settlementCash(p.principal, p.interest, p.fine, p.discount);
          resourceId = (await tx.settlement.create({ data: { ...base, ...p } })).id;
          const title = await tx.financialTitle.findUniqueOrThrow({
            where: { id: installment.titleId },
          });
          await dirty(tx, s, atMonth(title.competence));
          break;
        }
        case 'reverseSettlement': {
          const p = z.object({ id, reason }).parse(input);
          await lock(tx, p.id);
          const row = await tx.settlement.findFirstOrThrow({
            where: { ...base, id: p.id, reversedAt: null },
          });
          assert(
            (await tx.reconciliation.count({
              where: { ...base, settlementId: p.id, reversedAt: null },
            })) === 0,
            'Desfaça as conciliações antes de estornar.',
          );
          await tx.settlement.update({
            where: { id: row.id },
            data: { reversedAt: new Date(), reversalReason: p.reason },
          });
          const installment = await tx.installment.findUniqueOrThrow({
            where: { id: row.installmentId },
          });
          const title = await tx.financialTitle.findUniqueOrThrow({
            where: { id: installment.titleId },
          });
          await dirty(tx, s, atMonth(title.competence));
          resourceId = row.id;
          break;
        }
        case 'transfer': {
          const p = z
            .object({ sourceId: id, targetId: id, amount, date, idempotencyKey: id })
            .parse(input);
          await lock(tx, p.idempotencyKey);
          const existing = await tx.transfer.findUnique({
            where: { companyId_idempotencyKey: { companyId, idempotencyKey: p.idempotencyKey } },
          });
          if (existing) {
            resourceId = existing.id;
            break;
          }
          assert(p.sourceId !== p.targetId, 'Escolha contas diferentes.');
          positive(p.amount);
          resourceId = (
            await tx.transfer.upsert({
              where: { companyId_idempotencyKey: { companyId, idempotencyKey: p.idempotencyKey } },
              create: { ...base, ...p },
              update: {},
            })
          ).id;
          await dirty(tx, s, atMonth(p.date));
          break;
        }
        case 'previewImport':
        case 'import': {
          const p = z
            .object({
              bankAccountId: id,
              filename: text,
              source: z.string().max(5_000_000),
              format: z.enum(['CSV', 'OFX']),
              dateColumn: text.default('data'),
              descriptionColumn: text.default('descricao'),
              amountColumn: text.default('valor'),
              idColumn: z.string().optional(),
              delimiter: z.enum([';', ',']).default(';'),
              confirm: z.string().optional(),
              previewHash: z.string().optional(),
            })
            .parse(input);
          await tx.bankAccount.findFirstOrThrow({ where: { ...base, id: p.bankAccountId } });
          const preview =
            p.format === 'CSV'
              ? parseCsv(
                  p.source,
                  {
                    date: p.dateColumn,
                    description: p.descriptionColumn,
                    amount: p.amountColumn,
                    id: p.idColumn || undefined,
                  },
                  p.delimiter,
                )
              : { accepted: await readOfx(p.source), rejected: [] };
          const previewHash = hash(
            JSON.stringify([
              p.source,
              p.bankAccountId,
              p.format,
              p.dateColumn,
              p.descriptionColumn,
              p.amountColumn,
              p.idColumn,
              p.delimiter,
            ]),
          );
          if (commandName === 'previewImport')
            return {
              previewHash,
              message: `${preview.accepted.length} linhas válidas; ${preview.rejected.length} rejeitadas. Confira antes de confirmar.`,
              preview,
            };
          assert(
            p.confirm === 'yes' && p.previewHash === previewHash,
            'O arquivo ou mapeamento mudou. Faça uma nova pré-visualização e confirme.',
          );
          assert(preview.accepted.length > 0, 'Nenhuma linha válida.');
          const checksum = hash(p.source);
          await lock(tx, `${companyId}:${p.bankAccountId}:${checksum}`);
          const existing = await tx.bankImport.findUnique({
            where: {
              companyId_bankAccountId_checksum: {
                companyId,
                bankAccountId: p.bankAccountId,
                checksum,
              },
            },
          });
          if (existing) return { message: 'Este arquivo já foi importado.' };
          const batch = await tx.bankImport.create({
            data: { ...base, bankAccountId: p.bankAccountId, filename: p.filename, checksum },
          });
          const created = await tx.bankTransaction.createMany({
            data: preview.accepted.map((row) => ({
              ...base,
              ...row,
              date: new Date(row.date + 'T12:00:00Z'),
              bankAccountId: p.bankAccountId,
              importId: batch.id,
            })),
            skipDuplicates: true,
          });
          if (created.count > 0)
            for (const competence of new Set(preview.accepted.map((r) => r.date.slice(0, 7))))
              await dirty(tx, s, competence);
          resourceId = batch.id;
          message = `${created.count} transações importadas. ${preview.rejected.length} linhas rejeitadas; nenhum título financeiro foi criado.`;
          break;
        }
        case 'reconcile': {
          const p = z.object({ transactionId: id, settlementId: id, amount }).parse(input);
          for (const k of [p.transactionId, p.settlementId].sort()) await lock(tx, k);
          const movement = await tx.bankTransaction.findFirstOrThrow({
            where: { ...base, id: p.transactionId },
          });
          const settlement = await tx.settlement.findFirstOrThrow({
            where: { ...base, id: p.settlementId, reversedAt: null },
          });
          const installment = await tx.installment.findUniqueOrThrow({
            where: { id: settlement.installmentId },
          });
          const title = await tx.financialTitle.findUniqueOrThrow({
            where: { id: installment.titleId },
          });
          assert(
            movement.bankAccountId === settlement.bankAccountId,
            'A conta bancária deve ser a mesma.',
          );
          assert(
            money(movement.amount.toString()).gt(0) === (title.kind === 'RECEIVABLE'),
            'Sentido da movimentação incompatível.',
          );
          const allocated = await tx.reconciliation.findMany({
            where: {
              ...base,
              reversedAt: null,
              OR: [{ transactionId: p.transactionId }, { settlementId: p.settlementId }],
            },
          });
          const usedMovement = allocated
            .filter((r) => r.transactionId === p.transactionId)
            .reduce((sum, r) => sum.plus(r.amount.toString()), money('0'));
          const usedSettlement = allocated
            .filter((r) => r.settlementId === p.settlementId)
            .reduce((sum, r) => sum.plus(r.amount.toString()), money('0'));
          const cash = settlementCash(
            settlement.principal.toString(),
            settlement.interest.toString(),
            settlement.fine.toString(),
            settlement.discount.toString(),
          );
          assert(
            positive(p.amount).lte(money(movement.amount.toString()).abs().minus(usedMovement)) &&
              money(p.amount).lte(money(cash).minus(usedSettlement)),
            'Alocação excede o saldo da transação ou liquidação.',
          );
          resourceId = (await tx.reconciliation.create({ data: { ...base, ...p } })).id;
          await dirty(tx, s, atMonth(title.competence));
          break;
        }
        case 'undoReconciliation': {
          const p = z.object({ id, reason }).parse(input);
          const row = await tx.reconciliation.update({
            where: { organizationId_companyId_id: { ...base, id: p.id }, reversedAt: null },
            data: { reversedAt: new Date(), reversalReason: p.reason },
          });
          resourceId = row.id;
          await tx.accountingPeriod.updateMany({
            where: base,
            data: { revision: { increment: 1 } },
          });
          break;
        }
        case 'request': {
          const p = z.object({ title: text, competence: month, dueDate: date }).parse(input);
          resourceId = (await tx.documentRequest.create({ data: { ...base, ...p } })).id;
          await dirty(tx, s, p.competence);
          break;
        }
        case 'fulfill': {
          const p = z.object({ id, documentId: id }).parse(input);
          const doc = await tx.document.findFirstOrThrow({ where: { ...base, id: p.documentId } });
          const request = await tx.documentRequest.findFirstOrThrow({
            where: { ...base, id: p.id },
          });
          assert(
            doc.competence === request.competence,
            'Documento deve corresponder à competência solicitada.',
          );
          await tx.documentRequest.update({
            where: { id: request.id },
            data: { fulfilledByDocumentId: doc.id },
          });
          resourceId = request.id;
          await dirty(tx, s, doc.competence);
          break;
        }
        case 'publish': {
          const doc = await tx.document.update({
            where: { organizationId_companyId_id: { ...base, id: id.parse(input.id) } },
            data: { visibility: 'PUBLISHED' },
          });
          resourceId = doc.id;
          break;
        }
        case 'period': {
          const p = z
            .object({ competence: month, responsibleId: id, reviewerId: id, dueDate: date })
            .parse(input);
          assert(
            p.responsibleId !== p.reviewerId,
            'Responsável e revisor devem ser pessoas diferentes.',
          );
          await assigned(tx, s, p.responsibleId);
          await assigned(tx, s, p.reviewerId, true);
          resourceId = (await tx.accountingPeriod.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'task': {
          const p = z.object({ periodId: id, label: text }).parse(input);
          resourceId = (await tx.closingTask.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'completeTask': {
          resourceId = (
            await tx.closingTask.update({
              where: { organizationId_companyId_id: { ...base, id: id.parse(input.id) } },
              data: { completedAt: new Date(), comment: text.parse(input.comment) },
            })
          ).id;
          break;
        }
        case 'transition': {
          const p = z.object({ periodId: id, to: z.enum(states), reason }).parse(input);
          await lock(tx, p.periodId);
          const period = await tx.accountingPeriod.findFirstOrThrow({
            where: { ...base, id: p.periodId },
          });
          const batch = await tx.exportBatch.findFirst({
            where: { ...base, periodId: period.id },
            orderBy: { version: 'desc' },
          });
          const approved = batch
            ? await tx.review.findFirst({
                where: { ...base, exportBatchId: batch.id, approved: true },
              })
            : null;
          const processed = batch
            ? await tx.processingBatch.findFirst({ where: { ...base, exportBatchId: batch.id } })
            : null;
          const pending = await tx.documentRequest.count({
            where: { ...base, competence: period.competence, fulfilledByDocumentId: null },
          });
          const tasksPending = await tx.closingTask.count({
            where: { ...base, periodId: period.id, required: true, completedAt: null },
          });
          const published =
            !!processed &&
            !!(await tx.document.findFirst({
              where: { ...base, id: processed.resultDocumentId, visibility: 'PUBLISHED' },
            }));
          transition(
            period.state,
            p.to,
            {
              pending,
              tasksPending,
              exportReady: batch?.status === 'READY',
              processed: !!processed,
              approved: !!approved,
              published,
              dirty: period.exportedRevision !== period.revision,
              reviewer: actor.id === period.reviewerId,
            },
            p.reason,
          );
          if (
            p.to === 'DELIVERED' ||
            p.to === 'CLOSED' ||
            states.indexOf(p.to) < states.indexOf(period.state)
          )
            authorize(s.role, 'review');
          await tx.accountingPeriod.update({
            where: { id: period.id },
            data: {
              state: p.to,
              ...(p.to === 'UNDER_REVIEW' && states.indexOf(period.state) > 1
                ? { revision: { increment: 1 } }
                : {}),
            },
          });
          await tx.closingTransition.create({
            data: {
              ...base,
              periodId: period.id,
              fromState: period.state,
              toState: p.to,
              reason: p.reason,
              actorId: actor.id,
            },
          });
          resourceId = period.id;
          break;
        }
        case 'export': {
          const periodId = id.parse(input.periodId);
          await lock(tx, periodId);
          const period = await tx.accountingPeriod.findFirstOrThrow({
            where: { ...base, id: periodId },
          });
          assert(
            ['READY_FOR_PROCESSING', 'PROCESSING_EXTERNALLY', 'QUALITY_REVIEW'].includes(
              period.state,
            ),
            'Conclua a conferência antes de exportar.',
          );
          const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
          const titles = await tx.financialTitle.findMany({
            where: {
              ...base,
              competence: {
                gte: new Date(period.competence + '-01'),
                lt: new Date(
                  new Date(period.competence + '-01').setUTCMonth(
                    new Date(period.competence + '-01').getUTCMonth() + 1,
                  ),
                ),
              },
            },
          });
          const docs = await tx.document.findMany({
            where: { ...base, competence: period.competence, classification: 'INPUT' },
          });
          const documents: Snapshot['documents'] = [];
          for (const doc of docs) {
            const version = await tx.documentVersion.findFirst({
              where: { ...base, documentId: doc.id },
              orderBy: { version: 'desc' },
            });
            if (version)
              documents.push({
                id: doc.id,
                title: doc.title,
                version: version.version,
                objectKey: version.objectKey,
                checksum: version.checksum,
              });
          }
          const snapshot: Snapshot = {
            company: {
              name: company.name,
              cnpj: company.cnpj,
              accountingSystemId: company.accountingSystemId,
            },
            competence: period.competence,
            revision: period.revision,
            titles: titles.map((t) => ({
              description: t.description,
              kind: t.kind,
              amount: t.amount.toFixed(2),
              issueDate: t.issueDate.toISOString().slice(0, 10),
              competence: t.competence.toISOString().slice(0, 7),
            })),
            documents,
          };
          const titleIds = titles.map((t) => t.id);
          const installmentRows = await tx.installment.findMany({
            where: { ...base, titleId: { in: titleIds } },
          });
          const settlementRows = await tx.settlement.findMany({
            where: { ...base, installmentId: { in: installmentRows.map((i) => i.id) } },
          });
          const from = new Date(period.competence + '-01');
          const until = new Date(from);
          until.setUTCMonth(until.getUTCMonth() + 1);
          const movementRows = await tx.bankTransaction.findMany({
            where: { ...base, date: { gte: from, lt: until } },
          });
          const transferRows = await tx.transfer.findMany({
            where: { ...base, date: { gte: from, lt: until } },
          });
          const allocations = await tx.reconciliation.findMany({
            where: { ...base, transactionId: { in: movementRows.map((t) => t.id) } },
          });
          snapshot.tables = {
            parcelas: [
              ['id', 'titulo_id', 'numero', 'vencimento', 'valor'],
              ...installmentRows.map((i) => [
                i.id,
                i.titleId,
                String(i.number),
                i.dueDate.toISOString().slice(0, 10),
                i.amount.toFixed(2),
              ]),
            ],
            liquidacoes: [
              [
                'id',
                'parcela_id',
                'conta_id',
                'principal',
                'juros',
                'multa',
                'desconto',
                'data',
                'estornada_em',
                'motivo_estorno',
              ],
              ...settlementRows.map((x) => [
                x.id,
                x.installmentId,
                x.bankAccountId,
                x.principal.toFixed(2),
                x.interest.toFixed(2),
                x.fine.toFixed(2),
                x.discount.toFixed(2),
                x.paidAt.toISOString().slice(0, 10),
                x.reversedAt?.toISOString() ?? '',
                x.reversalReason ?? '',
              ]),
            ],
            movimentos_bancarios: [
              ['id', 'origem_importacao', 'fitid', 'conta_id', 'data', 'descricao', 'valor'],
              ...movementRows.map((x) => [
                x.id,
                x.importId,
                x.externalId,
                x.bankAccountId,
                x.date.toISOString().slice(0, 10),
                x.description,
                x.amount.toFixed(2),
              ]),
            ],
            transferencias: [
              ['id', 'origem', 'destino', 'valor', 'data'],
              ...transferRows.map((x) => [
                x.id,
                x.sourceId,
                x.targetId,
                x.amount.toFixed(2),
                x.date.toISOString().slice(0, 10),
              ]),
            ],
            conciliacoes: [
              ['id', 'movimento_id', 'liquidacao_id', 'valor', 'desfeita_em'],
              ...allocations.map((x) => [
                x.id,
                x.transactionId,
                x.settlementId,
                x.amount.toFixed(2),
                x.reversedAt?.toISOString() ?? '',
              ]),
            ],
          };
          const last = await tx.exportBatch.findFirst({
            where: { ...base, periodId },
            orderBy: { version: 'desc' },
          });
          if (last?.revision === period.revision) {
            resourceId = last.id;
            message = 'Já existe um lote para esta revisão.';
            break;
          }
          const batch = await tx.exportBatch.create({
            data: {
              ...base,
              periodId,
              version: (last?.version ?? 0) + 1,
              revision: period.revision,
              snapshot: json(snapshot),
            },
          });
          await tx.outboxEvent.create({
            data: {
              ...base,
              type: 'EXPORT',
              resourceId: batch.id,
              payload: { actorId: actor.id, email: actor.email },
            },
          });
          await tx.accountingPeriod.update({
            where: { id: periodId },
            data: { exportedRevision: period.revision },
          });
          resourceId = batch.id;
          message = 'Lote versionado solicitado. O worker gerará o pacote.';
          break;
        }
        case 'processed': {
          const p = z
            .object({ exportBatchId: id, protocol: text, resultDocumentId: id })
            .parse(input);
          const batch = await tx.exportBatch.findFirstOrThrow({
            where: { ...base, id: p.exportBatchId, status: 'READY' },
          });
          const period = await tx.accountingPeriod.findUniqueOrThrow({
            where: { id: batch.periodId },
          });
          assert(
            period.state === 'PROCESSING_EXTERNALLY' && period.revision === batch.revision,
            'Fechamento precisa estar em processamento, sem divergências.',
          );
          assert(
            actor.id === period.responsibleId,
            'Somente o responsável registra o processamento.',
          );
          const doc = await tx.document.findFirstOrThrow({
            where: { ...base, id: p.resultDocumentId },
          });
          assert(
            doc.competence === period.competence && doc.classification === 'RESULT',
            'Anexe um documento de resultado da mesma competência.',
          );
          resourceId = (
            await tx.processingBatch.create({ data: { ...base, ...p, operatorId: actor.id } })
          ).id;
          break;
        }
        case 'review': {
          const p = z.object({ exportBatchId: id, notes: reason }).parse(input);
          const batch = await tx.exportBatch.findFirstOrThrow({
            where: { ...base, id: p.exportBatchId },
          });
          const period = await tx.accountingPeriod.findUniqueOrThrow({
            where: { id: batch.periodId },
          });
          assert(
            actor.id === period.reviewerId && actor.id !== period.responsibleId,
            'A aprovação cabe ao revisor designado.',
          );
          assert(
            period.state === 'QUALITY_REVIEW' && period.revision === batch.revision,
            'Revisão exige lote atual na etapa de qualidade.',
          );
          assert(
            (await tx.processingBatch.count({ where: { ...base, exportBatchId: batch.id } })) === 1,
            'Registre o processamento primeiro.',
          );
          resourceId = (
            await tx.review.create({
              data: {
                ...base,
                periodId: period.id,
                exportBatchId: batch.id,
                reviewerId: actor.id,
                approved: true,
                notes: p.notes,
              },
            })
          ).id;
          break;
        }
        case 'guide': {
          const p = z
            .object({ name: text, competence: month, documentId: id, amount, dueDate: date })
            .parse(input);
          positive(p.amount);
          const doc = await tx.document.findFirstOrThrow({
            where: { ...base, id: p.documentId, competence: p.competence, classification: 'GUIDE' },
          });
          assert(
            doc.visibility === 'PUBLISHED',
            'Publique o documento antes de disponibilizar a guia.',
          );
          const obligation = await tx.taxObligation.create({
            data: { ...base, name: p.name, competence: p.competence, dueDate: p.dueDate },
          });
          resourceId = (
            await tx.taxGuide.create({
              data: {
                ...base,
                obligationId: obligation.id,
                documentId: doc.id,
                amount: p.amount,
                dueDate: p.dueDate,
                publishedAt: new Date(),
              },
            })
          ).id;
          break;
        }
        case 'attachProof': {
          const p = z.object({ id, documentId: id }).parse(input);
          await tx.document.findFirstOrThrow({
            where: { ...base, id: p.documentId, classification: 'PROOF' },
          });
          resourceId = (
            await tx.taxPayment.update({
              where: {
                organizationId_companyId_id: { ...base, id: p.id },
                status: { not: 'VERIFIED' },
              },
              data: { proofDocumentId: p.documentId, status: 'PROOF_ATTACHED' },
            })
          ).id;
          break;
        }
        case 'reportPayment': {
          const p = z
            .object({ guideId: id, amount, paidAt: date, proofDocumentId: optionalId })
            .parse(input);
          positive(p.amount);
          if (p.proofDocumentId)
            await tx.document.findFirstOrThrow({
              where: { ...base, id: p.proofDocumentId, classification: 'PROOF' },
            });
          await tx.taxGuide.findFirstOrThrow({
            where: { ...base, id: p.guideId, publishedAt: { not: null } },
          });
          resourceId = (
            await tx.taxPayment.create({
              data: { ...base, ...p, status: p.proofDocumentId ? 'PROOF_ATTACHED' : 'REPORTED' },
            })
          ).id;
          message = 'Pagamento informado; ainda não conferido pela equipe.';
          break;
        }
        case 'verifyPayment': {
          const row = await tx.taxPayment.findFirstOrThrow({
            where: { ...base, id: id.parse(input.id) },
          });
          assert(row.proofDocumentId, 'Anexe comprovante antes da conferência.');
          resourceId = (
            await tx.taxPayment.update({
              where: { id: row.id },
              data: { status: 'VERIFIED', verifiedBy: actor.id, verifiedAt: new Date() },
            })
          ).id;
          break;
        }
        case 'receipt': {
          const p = z.object({ obligationId: id, documentId: id, protocol: text }).parse(input);
          resourceId = (await tx.filingReceipt.create({ data: { ...base, ...p } })).id;
          break;
        }
        case 'ticket': {
          const p = z
            .object({ subject: text, body: z.string().trim().min(1).max(5000) })
            .parse(input);
          const ticket = await tx.ticket.create({
            data: { ...base, subject: p.subject, createdBy: actor.id },
          });
          await tx.ticketMessage.create({
            data: { ...base, ticketId: ticket.id, authorId: actor.id, body: p.body },
          });
          resourceId = ticket.id;
          break;
        }
        case 'reply': {
          const p = z
            .object({ ticketId: id, body: z.string().trim().min(1).max(5000) })
            .parse(input);
          resourceId = (
            await tx.ticketMessage.create({ data: { ...base, ...p, authorId: actor.id } })
          ).id;
          break;
        }
        case 'closeTicket': {
          resourceId = (
            await tx.ticket.update({
              where: { organizationId_companyId_id: { ...base, id: id.parse(input.id) } },
              data: { status: 'CLOSED' },
            })
          ).id;
          break;
        }
        case 'downloadBatch': {
          const batch = await tx.exportBatch.findFirstOrThrow({
            where: { ...base, id: id.parse(input.id), status: 'READY' },
          });
          assert(batch.objectKey, 'Pacote indisponível.');
          link = await signedDownload(batch.objectKey);
          resourceId = batch.id;
          message = 'Link válido por 60 segundos.';
          break;
        }
        default:
          throw new AppError('COMMAND', 'Operação desconhecida.');
      }
      await audit(tx, actor, s, commandName, resourceId, {
        ...(typeof input.reason === 'string' ? { reason: input.reason } : {}),
      });
      return { message, ...(link ? { link } : {}) };
    },
  );
}
export async function uploadDocument(
  actor: Actor,
  companyId: string,
  input: Record<string, unknown>,
  file: File,
) {
  const p = z
    .object({
      title: text,
      competence: month,
      classification: z.enum(['INPUT', 'RESULT', 'GUIDE', 'PROOF', 'RECEIPT']),
      documentId: optionalId,
    })
    .parse(input);
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateUpload(bytes, file.type);
  return scoped(actor, id.parse(companyId), 'upload', async (tx, s) => {
    assert(
      internal(s.role) || ['INPUT', 'PROOF'].includes(p.classification),
      'Somente a equipe pode anexar resultados oficiais.',
    );
    const base = tenant(s);
    let doc = p.documentId
      ? await tx.document.findFirstOrThrow({ where: { ...base, id: p.documentId } })
      : null;
    if (doc) {
      assert(
        doc.competence === p.competence && doc.classification === p.classification,
        'Versão deve manter competência e classificação.',
      );
      assert(
        internal(s.role) || doc.visibility === 'INTERNAL',
        'Somente a equipe altera documentos publicados.',
      );
      await lock(tx, doc.id);
    } else {
      doc = await tx.document.create({
        data: {
          ...base,
          title: p.title,
          competence: p.competence,
          classification: p.classification,
          uploadedBy: actor.id,
        },
      });
      await audit(tx, actor, s, 'document.upload', doc.id);
    }
    const last = await tx.documentVersion.findFirst({
      where: { ...base, documentId: doc.id },
      orderBy: { version: 'desc' },
    });
    const version = (last?.version ?? 0) + 1;
    const objectKey = `${s.organizationId}/${companyId}/${doc.id}/${version}-${crypto.randomUUID()}`;
    await putObject(objectKey, bytes, file.type);
    await tx.documentVersion.create({
      data: {
        ...base,
        documentId: doc.id,
        version,
        bucket: bucket(),
        objectKey,
        checksum: hash(bytes),
        mime: file.type,
        size: bytes.length,
      },
    });
    if (p.classification === 'INPUT') await dirty(tx, s, p.competence);
    else if (last) await dirty(tx, s, p.competence);
    await audit(tx, actor, s, 'document.version', doc.id, { version });
    return doc.id;
  });
}
export async function downloadDocument(actor: Actor, companyId: string, documentId: string) {
  return scoped(actor, id.parse(companyId), 'read', async (tx, s) => {
    const doc = await tx.document.findFirstOrThrow({
      where: { ...tenant(s), id: id.parse(documentId) },
    });
    const version = await tx.documentVersion.findFirstOrThrow({
      where: { ...tenant(s), documentId: doc.id },
      orderBy: { version: 'desc' },
    });
    await audit(tx, actor, s, 'document.download', doc.id, { version: version.version });
    return signedDownload(version.objectKey);
  });
}
export async function officeOperations(actor: Actor) {
  const visible = await companies(actor);
  const data = [];
  for (const company of visible.companies) {
    const result = await scoped(actor, company.id, 'read', async (tx, s) => {
      if (!internal(s.role)) return null;
      const base = tenant(s);
      return {
        company,
        periods: await tx.accountingPeriod.findMany({ where: base }),
        requests: await tx.documentRequest.findMany({
          where: { ...base, fulfilledByDocumentId: null },
        }),
        onboarding: await tx.onboardingItem.count({ where: { ...base, completedAt: null } }),
        exports: await tx.exportBatch.findMany({ where: base, omit: { snapshot: true } }),
        jobs: await tx.outboxEvent.findMany({ where: { ...base, completedAt: null } }),
        tickets: await tx.ticket.count({ where: { ...base, status: 'OPEN' } }),
      };
    });
    if (result) data.push(result);
  }
  return data;
}
