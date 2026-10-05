import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from './generated/client';
import { AppError } from '../domain/src/errors';
import type { Role, Permission } from '../domain/src/permissions';
import { authorize, internal } from '../domain/src/permissions';
export type Tx = Prisma.TransactionClient;
export type Actor = { id: string; email: string; aal: string };
export type Scope = { organizationId: string; companyId: string; role: Role };
const globalDb = globalThis as unknown as { concloudDb?: PrismaClient };
export function database() {
  if (!process.env.DATABASE_URL)
    throw new AppError('CONFIG', 'Configure a conexão de runtime do banco.', 503);
  return (globalDb.concloudDb ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  }));
}
export async function transaction<T>(actor: Actor, fn: (tx: Tx) => Promise<T>, inviteHash = '') {
  return database().$transaction(
    async (tx) => {
      const role = await tx.$queryRaw<
        { rolbypassrls: boolean; rolsuper: boolean }[]
      >`SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user`;
      if (role[0]?.rolbypassrls || role[0]?.rolsuper)
        throw new AppError('CONFIG', 'Runtime exige usuário sem SUPERUSER/BYPASSRLS.', 503);
      await tx.$queryRaw`SELECT set_config('app.user_id',${actor.id},true),set_config('app.email',${actor.email.toLowerCase()},true),set_config('app.invite_hash',${inviteHash},true)`;
      return fn(tx);
    },
    { isolationLevel: 'Serializable', timeout: 20000 },
  );
}
export async function scoped<T>(
  actor: Actor,
  companyId: string,
  permission: Permission,
  fn: (tx: Tx, scope: Scope) => Promise<T>,
) {
  return transaction(actor, async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError('NOT_FOUND', 'Empresa não encontrada.', 404);
    const org = await tx.organizationMembership.findFirst({
      where: { organizationId: company.organizationId, userId: actor.id, active: true },
    });
    const member = await tx.companyMembership.findFirst({
      where: { companyId, userId: actor.id, active: true },
    });
    const role = (
      org && ['ORG_ADMIN', 'SUPER_ADMIN'].includes(org.role) ? org.role : member?.role
    ) as Role | undefined;
    if (!role) throw new AppError('FORBIDDEN', 'Acesso à empresa não autorizado.', 403);
    authorize(role, permission);
    if (internal(role) && process.env.REQUIRE_STAFF_MFA !== 'false' && actor.aal !== 'aal2')
      throw new AppError('MFA_REQUIRED', 'Ative e valide a autenticação em duas etapas.', 403);
    const scope = { organizationId: company.organizationId, companyId, role };
    await tx.$queryRaw`SELECT set_config('app.organization_id',${scope.organizationId},true),set_config('app.company_id',${companyId},true)`;
    return fn(tx, scope);
  });
}
export const tenant = (scope: Scope) => ({
  organizationId: scope.organizationId,
  companyId: scope.companyId,
});
export async function audit(
  tx: Tx,
  actor: Actor,
  scope: Scope,
  action: string,
  resourceId: string,
  metadata: Prisma.InputJsonValue = {},
) {
  return tx.auditEvent.create({
    data: {
      ...tenant(scope),
      actorId: actor.id,
      action,
      resourceId,
      metadata,
      correlationId: crypto.randomUUID(),
    },
  });
}
export async function dirty(tx: Tx, scope: Scope, competence: string) {
  await tx.accountingPeriod.updateMany({
    where: { ...tenant(scope), competence },
    data: { revision: { increment: 1 } },
  });
}
