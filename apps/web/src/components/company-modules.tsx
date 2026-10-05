import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock3,
  Files,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Download,
} from 'lucide-react';
import type { CompanyData } from '@/lib/service';
import { ActionForm, ImportForm } from './forms';
import { Field, Select, Hidden, Panel, Empty } from './fields';
import { brl, fmtDate, balance, reports, today, bankBalance } from '@/lib/reports';
import { internal } from '@domain/permissions';
import { labels, states } from '@domain/closing';
import { suggestMatches } from '@domain/imports';
import type { ReactNode } from 'react';
const options = (
  rows: { id: string; name?: string; title?: string; description?: string; competence?: string }[],
) =>
  rows.map((r) => ({ id: r.id, name: r.name ?? r.title ?? r.description ?? r.competence ?? r.id }));
const kinds = [
  { id: 'RECEIVABLE', name: 'A receber' },
  { id: 'PAYABLE', name: 'A pagar' },
];
const monthNow = () => today().slice(0, 7);
export function Module({
  d,
  section,
  actorId,
  query,
}: {
  d: CompanyData;
  section: string;
  actorId: string;
  query: { month?: string; category?: string; status?: string };
}) {
  const companyId = d.company.id;
  const staff = internal(d.scope.role);
  const admin = ['ORG_ADMIN', 'SUPER_ADMIN'].includes(d.scope.role);
  const canReview = ['ORG_ADMIN', 'SUPER_ADMIN', 'ACCOUNTANT'].includes(d.scope.role);
  const link = (path: string) => `/empresas/${companyId}/${path}`;
  const form = (operation: string, label: string, children: ReactNode, compact = false) => (
    <ActionForm companyId={companyId} operation={operation} label={label} compact={compact}>
      {children}
    </ActionForm>
  );
  if (!section) {
    const r = reports(d, monthNow());
    const pending = d.requests.filter((x) => !x.fulfilledByDocumentId);
    const recent = d.periods[0];
    return (
      <>
        <div className="overview-banner">
          <div>
            <span className="eyebrow">TUDO NO SEU TEMPO. TUDO NO SEU LUGAR.</span>
            <h2>Mais clareza para suas decisões.</h2>
            <p>Veja o que precisa de atenção e siga com tranquilidade.</p>
            <Link href={link('financeiro')}>
              Organizar meu financeiro <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="banner-art">
            <Wallet size={54} strokeWidth={1.2} />
            <span>
              <CheckCircle2 size={22} />
            </span>
          </div>
        </div>
        <div className="stats-grid">
          {[
            {
              label: 'A receber',
              value: brl(r.receivable.toFixed(2)),
              icon: ArrowDownLeft,
              tone: 'green',
              note: 'Saldo em aberto no mês',
            },
            {
              label: 'A pagar',
              value: brl(r.payable.toFixed(2)),
              icon: ArrowUpRight,
              tone: 'orange',
              note: 'Saldo em aberto no mês',
            },
            {
              label: 'Pendências',
              value: String(pending.length),
              icon: Clock3,
              tone: 'purple',
              note: 'Documentos solicitados',
            },
            {
              label: 'Documentos',
              value: String(d.documents.length),
              icon: Files,
              tone: 'blue',
              note: 'Disponíveis para seu acesso',
            },
          ].map(({ label, value, icon: Icon, tone, note }) => (
            <div className="stat-card" key={label}>
              <div>
                <span>{label}</span>
                <span className={`stat-icon ${tone}`}>
                  <Icon size={18} />
                </span>
              </div>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>
        <div className="two-columns">
          <Panel
            title="O que precisa da sua atenção"
            description="Prioridades para manter sua empresa em dia."
          >
            {pending.length ? (
              pending.map((p) => (
                <Link className="list-row" href={link('documentos')} key={p.id}>
                  <span className="row-icon orange">
                    <AlertCircle size={18} />
                  </span>
                  <span>
                    <strong>{p.title}</strong>
                    <small>
                      Prazo: {fmtDate(p.dueDate)} · {p.competence}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </Link>
              ))
            ) : (
              <Empty
                title="Tudo organizado por aqui"
                description="Nenhuma solicitação de documento em aberto."
              />
            )}
          </Panel>
          <Panel
            title="Seu fechamento mensal"
            description="Acompanhe cada etapa do trabalho contábil."
          >
            {recent ? (
              <>
                <div className="closing-summary">
                  <span className="eyebrow">COMPETÊNCIA {recent.competence}</span>
                  <h3>{labels[recent.state]}</h3>
                  <p>Prazo interno: {fmtDate(recent.dueDate)}</p>
                </div>
                <div className="steps-mini">
                  {states.map((s) => (
                    <span
                      className={states.indexOf(s) <= states.indexOf(recent.state) ? 'done' : ''}
                      key={s}
                    />
                  ))}
                </div>
                <Link className="text-link" href={link('fechamento')}>
                  Ver andamento <ArrowUpRight size={16} />
                </Link>
              </>
            ) : (
              <Empty
                title="Seu primeiro fechamento começa aqui"
                description="A equipe abrirá a competência e definirá os responsáveis."
              />
            )}
          </Panel>
        </div>
        <Panel
          title="Documentos recentes"
          description="Os últimos arquivos disponíveis para sua empresa."
        >
          {d.documents.length ? (
            <div className="document-grid">
              {d.documents.slice(0, 3).map((doc) => (
                <a
                  key={doc.id}
                  className="document-tile"
                  href={`/api/documents/${companyId}/${doc.id}`}
                >
                  <Files size={26} />
                  <strong>{doc.title}</strong>
                  <small>
                    {doc.competence} ·{' '}
                    {doc.visibility === 'PUBLISHED' ? 'Publicado' : 'Interno / enviado por você'}
                  </small>
                  <Download size={16} />
                </a>
              ))}
            </div>
          ) : (
            <Empty
              title="Seus documentos, em um só lugar"
              description="Envie seus primeiros arquivos na área de documentos."
            />
          )}
        </Panel>
        <p className="report-note">
          Financeiro gerencial provisório · Competência {monthNow()} · Atualizado em{' '}
          {fmtDate(new Date())}. Não é demonstração contábil oficial.
        </p>
      </>
    );
  }
  if (section === 'empresa')
    return (
      <>
        <Panel title="Dados cadastrais">
          <dl className="details-grid">
            <div>
              <dt>Razão social</dt>
              <dd>{d.company.name}</dd>
            </div>
            <div>
              <dt>CNPJ</dt>
              <dd>{d.company.cnpj}</dd>
            </div>
            <div>
              <dt>Código no Domínio</dt>
              <dd>{d.company.accountingSystemId ?? 'Não informado'}</dd>
            </div>
            <div>
              <dt>Processamento contábil</dt>
              <dd>Manual, com conferência da equipe</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Onboarding" description="Etapas para começar a operação.">
          {d.onboarding.map((item) => (
            <div className="list-row" key={item.id}>
              <CheckCircle2 size={18} className={item.completedAt ? 'green-text' : 'muted'} />
              <strong>{item.label}</strong>
              {item.completedAt ? (
                <span className="badge green">Concluído</span>
              ) : staff ? (
                form('onboarding', 'Concluir', <Hidden name="id" value={item.id} />, true)
              ) : (
                <span className="badge">Pendente</span>
              )}
            </div>
          ))}
        </Panel>
        {admin && (
          <Panel
            title="Histórico tributário"
            description="Registre a vigência. O sistema não apura tributos nem trata anexo e Fator R como valores fixos."
          >
            {form(
              'taxProfile',
              'Registrar nova vigência',
              <div className="form-grid">
                <Select
                  name="regime"
                  label="Regime"
                  options={[
                    { id: 'SIMPLES_NACIONAL', name: 'Simples Nacional' },
                    { id: 'LUCRO_PRESUMIDO', name: 'Lucro Presumido' },
                  ]}
                />
                <Field name="validFrom" label="Início da vigência" type="date" />
                <Field name="notes" label="Justificativa e evidências" />
              </div>,
            )}
          </Panel>
        )}
      </>
    );
  if (section === 'financeiro') {
    const period = query.month ?? monthNow();
    const r = reports(d, period, query.category);
    return (
      <>
        <form method="get" className="filter-bar">
          <Field name="month" label="Competência / mês do fluxo" type="month" value={period} />
          <Select name="category" label="Categoria" optional options={options(d.categories)} />
          <Select
            name="status"
            label="Status das parcelas"
            options={[
              { id: 'ALL', name: 'Todos' },
              { id: 'OPEN', name: 'Em aberto' },
              { id: 'PAID', name: 'Liquidadas' },
            ]}
          />
          <button className="button button-outline">Filtrar</button>
        </form>
        <div className="stats-grid">
          {[
            ['Recebido no mês', r.received],
            ['Pago no mês', r.paid],
            ['Resultado por competência', r.result],
            ['Fluxo previsto (saldo)', r.receivable.minus(r.payable)],
          ].map(([label, value]) => (
            <div className="stat-card" key={String(label)}>
              <span>{String(label)}</span>
              <strong>{brl(String(value))}</strong>
              <small>Gerencial provisório · {period}</small>
            </div>
          ))}
        </div>
        <Panel
          title="Contas a pagar e receber"
          description="Parcelas e saldos preservados após liquidações parciais."
        >
          {d.installments.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Descrição / parcela</th>
                    <th>Tipo</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Em aberto</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.installments
                    .filter((i) => i.dueDate.toISOString().startsWith(period))
                    .filter((i) => {
                      const t = d.titles.find((t) => t.id === i.titleId);
                      return (
                        (!query.category || t?.categoryId === query.category) &&
                        (query.status === 'PAID'
                          ? balance(d, i.id).eq(0)
                          : query.status === 'OPEN'
                            ? balance(d, i.id).gt(0)
                            : true)
                      );
                    })
                    .map((i) => {
                      const title = d.titles.find((t) => t.id === i.titleId);
                      const open = balance(d, i.id);
                      return (
                        <tr key={i.id}>
                          <td>
                            <strong>{title?.description}</strong>
                            <small>Parcela {i.number}</small>
                          </td>
                          <td>{title?.kind === 'PAYABLE' ? 'A pagar' : 'A receber'}</td>
                          <td>{fmtDate(i.dueDate)}</td>
                          <td>{brl(i.amount.toString())}</td>
                          <td>{brl(open.toFixed(2))}</td>
                          <td>
                            <span className={`badge ${open.eq(0) ? 'green' : 'orange'}`}>
                              {open.eq(0)
                                ? 'Liquidada'
                                : open.lt(i.amount.toString())
                                  ? 'Parcial'
                                  : 'Em aberto'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Comece pelo seu primeiro lançamento"
              description="Registre contas a pagar e receber para acompanhar seu financeiro."
            />
          )}
        </Panel>
        <Panel title="Novo lançamento">
          {form(
            'title',
            'Criar lançamento',
            <>
              <div className="form-grid">
                <Field name="description" label="Descrição" />
                <Select name="kind" label="Tipo" options={kinds} />
                <Field name="amount" label="Valor total (R$)" type="number" />
                <Field name="count" label="Parcelas" type="number" value="1" />
                <Field name="issueDate" label="Emissão" type="date" value={today()} />
                <Field name="competence" label="Competência" type="month" value={monthNow()} />
                <Field name="dueDate" label="Primeiro vencimento" type="date" />
                <Select
                  name="contactId"
                  label="Cliente / fornecedor"
                  optional
                  options={options(d.contacts)}
                />
                <Select
                  name="categoryId"
                  label="Categoria"
                  optional
                  options={options(d.categories)}
                />
                <Select
                  name="costCenterId"
                  label="Centro de custo"
                  optional
                  options={options(d.costCenters)}
                />
              </div>
            </>,
          )}
        </Panel>
        <div className="two-columns">
          <Panel
            title="Registrar liquidação"
            description="Registre o principal liquidado e os encargos separadamente."
          >
            {form(
              'settle',
              'Registrar liquidação',
              <>
                <Hidden name="idempotencyKey" value={crypto.randomUUID()} />
                <Select
                  name="installmentId"
                  label="Parcela"
                  options={d.installments
                    .filter((i) => balance(d, i.id).gt(0))
                    .map((i) => ({
                      id: i.id,
                      name: `${d.titles.find((t) => t.id === i.titleId)?.description} · ${i.number} · ${brl(balance(d, i.id).toFixed(2))}`,
                    }))}
                />
                <Select name="bankAccountId" label="Conta" options={options(d.accounts)} />
                <div className="form-grid">
                  <Field name="principal" label="Principal (R$)" type="number" />
                  <Field name="paidAt" label="Data da liquidação" type="date" value={today()} />
                  {[
                    ['interest', 'Juros'],
                    ['fine', 'Multa'],
                    ['discount', 'Desconto'],
                  ].map(([name, label]) => (
                    <Field key={name} name={name} label={`${label} (R$)`} type="number" value="0" />
                  ))}
                </div>
              </>,
            )}
          </Panel>
          <Panel
            title="Transferência entre contas"
            description="Movimente saldo sem gerar receita ou despesa."
          >
            {form(
              'transfer',
              'Registrar transferência',
              <>
                <Hidden name="idempotencyKey" value={crypto.randomUUID()} />
                <Select name="sourceId" label="Conta de origem" options={options(d.accounts)} />
                <Select name="targetId" label="Conta de destino" options={options(d.accounts)} />
                <Field name="amount" label="Valor (R$)" type="number" />
                <Field name="date" label="Data" type="date" value={today()} />
              </>,
            )}
          </Panel>
        </div>
        <Panel title="Liquidações e estornos">
          {d.settlements.length ? (
            d.settlements.map((s) => (
              <div className="list-row wrap" key={s.id}>
                <span>
                  <strong>
                    {brl(s.principal.toString())} · {fmtDate(s.paidAt)}
                  </strong>
                  <small>
                    {s.reversedAt ? 'Estornada: ' + s.reversalReason : 'Principal liquidado'}
                  </small>
                </span>
                {!s.reversedAt &&
                  form(
                    'reverseSettlement',
                    'Estornar',
                    <>
                      <Hidden name="id" value={s.id} />
                      <Field name="reason" label="Justificativa do estorno" />
                    </>,
                    true,
                  )}
              </div>
            ))
          ) : (
            <Empty />
          )}
        </Panel>
        <div className="two-columns">
          <Panel title="Recorrências mensais">
            {form(
              'recurrence',
              'Salvar recorrência',
              <>
                <Field name="description" label="Descrição" />
                <Select name="kind" label="Tipo" options={kinds} />
                <Field name="amount" label="Valor (R$)" type="number" />
                <Field
                  name="startMonth"
                  label="Competência inicial"
                  type="month"
                  value={monthNow()}
                />
                <Field name="day" label="Dia do vencimento (1–28)" type="number" value="10" />
              </>,
            )}
            {form(
              'generateRecurrence',
              'Gerar competência',
              <Field name="month" label="Mês a gerar" type="month" value={monthNow()} />,
            )}
          </Panel>
          <Panel title="Clientes e fornecedores">
            {d.contacts.map((c) => (
              <div className="list-row" key={c.id}>
                <strong>{c.name}</strong>
                <span className="badge">
                  {c.kind === 'BOTH' ? 'Ambos' : c.kind === 'CUSTOMER' ? 'Cliente' : 'Fornecedor'}
                </span>
              </div>
            ))}
            {form(
              'contact',
              'Cadastrar contato',
              <>
                <Field name="name" label="Nome" />
                <Field name="email" label="E-mail" type="email" required={false} />
                <Select
                  name="kind"
                  label="Tipo"
                  options={[
                    { id: 'CUSTOMER', name: 'Cliente' },
                    { id: 'SUPPLIER', name: 'Fornecedor' },
                    { id: 'BOTH', name: 'Ambos' },
                  ]}
                />
              </>,
            )}
          </Panel>
        </div>
        <div className="two-columns">
          <Panel title="Categorias">
            {form(
              'category',
              'Criar categoria',
              <>
                <Field name="name" label="Nome" />
                <Select name="kind" label="Tipo" options={kinds} />
              </>,
            )}
          </Panel>
          <Panel title="Centros de custo">
            {form('costCenter', 'Criar centro de custo', <Field name="name" label="Nome" />)}
          </Panel>
        </div>
        <p className="report-note">
          Relatório gerencial provisório por competência, não é demonstração contábil oficial.
          Atualizado em {fmtDate(new Date())}. Transferências não compõem resultado.
        </p>
      </>
    );
  }
  if (section === 'bancos')
    return (
      <>
        <div className="two-columns">
          <Panel title="Contas bancárias">
            {d.accounts.map((a) => (
              <div className="list-row" key={a.id}>
                <Wallet size={19} />
                <strong>{a.name}</strong>
                <small>Saldo realizado: {brl(bankBalance(d, a.id).toFixed(2))}</small>
              </div>
            ))}
            {form(
              'account',
              'Cadastrar conta',
              <>
                <Field name="name" label="Nome da conta" />
                <Field name="openingBalance" label="Saldo inicial (R$)" type="number" value="0" />
              </>,
            )}
          </Panel>
          <Panel
            title="Importar extrato"
            description="CSV ou OFX. A importação registra movimentos bancários; não cria títulos financeiros."
          >
            <ImportForm companyId={companyId} accounts={options(d.accounts)} />
          </Panel>
        </div>
        <Panel
          title="Movimentações para conciliar"
          description="Sugestões precisam de confirmação humana. Uma transação pode ser alocada em várias liquidações."
        >
          {d.transactions.length ? (
            d.transactions.map((t) => {
              const suggestions = suggestMatches(
                {
                  date: t.date.toISOString(),
                  description: t.description,
                  amount: t.amount.toString(),
                  externalId: t.externalId,
                },
                d.settlements
                  .filter((s) => !s.reversedAt && s.bankAccountId === t.bankAccountId)
                  .map((s) => ({
                    id: s.id,
                    amount: s.principal.toString(),
                    date: s.paidAt.toISOString(),
                    description:
                      d.titles.find(
                        (x) =>
                          x.id === d.installments.find((i) => i.id === s.installmentId)?.titleId,
                      )?.description ?? '',
                  })),
              );
              return (
                <div className="bank-row" key={t.id}>
                  <div className="list-row">
                    <span>
                      <strong>{t.description}</strong>
                      <small>{fmtDate(t.date)} · Origem preservada</small>
                    </span>
                    <strong>{brl(t.amount.toString())}</strong>
                  </div>
                  {form(
                    'reconcile',
                    'Confirmar alocação',
                    <>
                      <Hidden name="transactionId" value={t.id} />
                      <Select
                        name="settlementId"
                        label="Liquidação"
                        options={d.settlements
                          .filter((s) => !s.reversedAt)
                          .map((s) => ({
                            id: s.id,
                            name: `${suggestions.some((x) => x.id === s.id) ? 'Sugestão · ' : ''}${d.titles.find((x) => x.id === d.installments.find((i) => i.id === s.installmentId)?.titleId)?.description} · ${brl(s.principal.toString())} · ${fmtDate(s.paidAt)}`,
                          }))}
                      />
                      <Field name="amount" label="Valor a alocar (R$)" type="number" />
                    </>,
                    true,
                  )}
                </div>
              );
            })
          ) : (
            <Empty
              title="Importe seu primeiro extrato"
              description="Confira o arquivo na prévia antes de gravar as movimentações."
            />
          )}
        </Panel>
        <Panel title="Conciliações registradas">
          {d.reconciliations.map((r) => (
            <div className="list-row wrap" key={r.id}>
              <span>
                {brl(r.amount.toString())} · {r.reversedAt ? 'Desfeita' : 'Confirmada'}
              </span>
              {!r.reversedAt &&
                form(
                  'undoReconciliation',
                  'Desfazer',
                  <>
                    <Hidden name="id" value={r.id} />
                    <Field name="reason" label="Justificativa" />
                  </>,
                  true,
                )}
            </div>
          ))}
        </Panel>
        <Panel title="Histórico de importação">
          {d.imports.map((i) => (
            <div className="list-row" key={i.id}>
              <strong>{i.filename}</strong>
              <small>{fmtDate(i.createdAt)}</small>
              <span className="badge">
                {d.transactions.filter((t) => t.importId === i.id).length} movimentos
              </span>
            </div>
          ))}
        </Panel>
      </>
    );
  if (section === 'documentos')
    return (
      <>
        <Panel
          title="Biblioteca de documentos"
          description="Armazenamento privado. Downloads autorizados têm validade de 60 segundos."
        >
          {d.documents.length ? (
            d.documents.map((doc) => (
              <div className="list-row wrap" key={doc.id}>
                <Files size={22} />
                <span>
                  <strong>{doc.title}</strong>
                  <small>
                    {doc.competence} · {doc.classification}
                  </small>
                </span>
                <span className="badge">
                  {doc.visibility === 'PUBLISHED' ? 'Publicado' : 'Interno'}
                </span>
                <a
                  className="button button-outline button-small"
                  href={`/api/documents/${companyId}/${doc.id}`}
                >
                  <Download size={14} />
                  Baixar
                </a>
                {canReview &&
                  doc.visibility !== 'PUBLISHED' &&
                  form('publish', 'Publicar', <Hidden name="id" value={doc.id} />, true)}
              </div>
            ))
          ) : (
            <Empty
              title="Documentação organizada desde o início"
              description="Envie notas, extratos e os arquivos solicitados pela equipe."
            />
          )}
        </Panel>
        <div className="two-columns">
          <Panel
            title="Enviar documento"
            description="PDF, PNG, JPEG ou CSV. Limite de 10 MB por arquivo."
          >
            {form(
              'upload',
              'Enviar documento',
              <>
                <Field name="title" label="Título" />
                <Field name="competence" label="Competência" type="month" value={monthNow()} />
                <Select
                  name="classification"
                  label="Classificação"
                  options={(staff
                    ? [
                        ['INPUT', 'Documento de entrada'],
                        ['RESULT', 'Resultado do processamento'],
                        ['GUIDE', 'Guia'],
                        ['PROOF', 'Comprovante'],
                        ['RECEIPT', 'Protocolo'],
                      ]
                    : [
                        ['INPUT', 'Documento de entrada'],
                        ['PROOF', 'Comprovante'],
                      ]
                  ).map(([id, name]) => ({ id, name }))}
                />
                <Select
                  name="documentId"
                  label="Nova versão de documento existente"
                  optional
                  options={options(d.documents)}
                />
                <label>
                  Arquivo
                  <input name="file" type="file" required accept=".pdf,.png,.jpg,.jpeg,.csv" />
                </label>
              </>,
            )}
          </Panel>
          <Panel title="Solicitações de documentos">
            {d.requests.map((r) => (
              <div className="request-row" key={r.id}>
                <strong>{r.title}</strong>
                <p>
                  {r.competence} · Até {fmtDate(r.dueDate)}
                </p>
                {r.fulfilledByDocumentId ? (
                  <span className="badge green">Atendida</span>
                ) : (
                  form(
                    'fulfill',
                    'Vincular documento',
                    <>
                      <Hidden name="id" value={r.id} />
                      <Select
                        name="documentId"
                        label="Documento enviado"
                        options={options(d.documents.filter((d) => d.competence === r.competence))}
                      />
                    </>,
                  )
                )}
              </div>
            ))}
            {staff &&
              form(
                'request',
                'Solicitar documento',
                <>
                  <Field name="title" label="O que precisamos?" />
                  <Field name="competence" label="Competência" type="month" value={monthNow()} />
                  <Field name="dueDate" label="Prazo" type="date" />
                </>,
              )}
          </Panel>
        </div>
      </>
    );
  if (section === 'fechamento')
    return (
      <>
        {admin && (
          <Panel
            title="Abrir competência"
            description="Defina responsáveis distintos para processamento e revisão."
          >
            {form(
              'period',
              'Abrir fechamento',
              <div className="form-grid">
                <Field name="competence" label="Competência" type="month" value={monthNow()} />
                <Select
                  name="responsibleId"
                  label="Responsável"
                  options={[
                    { id: actorId, name: 'Você' },
                    ...d.members
                      .filter((m) => m.userId !== actorId && internal(m.role))
                      .map((m) => ({ id: m.userId, name: m.displayName || m.role })),
                  ]}
                />
                <Select
                  name="reviewerId"
                  label="Revisor"
                  options={d.members
                    .filter(
                      (m) =>
                        m.userId !== actorId &&
                        ['ACCOUNTANT', 'ORG_ADMIN', 'SUPER_ADMIN'].includes(m.role),
                    )
                    .map((m) => ({ id: m.userId, name: m.displayName || 'Contador atribuído' }))}
                />
                <Field name="dueDate" label="Prazo interno" type="date" />
              </div>,
            )}
          </Panel>
        )}
        {!d.periods.length && (
          <Empty
            title="Nenhum fechamento aberto"
            description="A equipe criará a competência e organizará as etapas."
          />
        )}
        {d.periods.map((p) => {
          const batches = d.batches.filter((b) => b.periodId === p.id);
          return (
            <Panel
              key={p.id}
              title={`Competência ${p.competence}`}
              description={`Prazo: ${fmtDate(p.dueDate)} · Responsável: ${p.responsibleId} · Revisor: ${p.reviewerId}`}
            >
              <div className="closing-timeline">
                {states.map((state, i) => (
                  <div key={state} className={i <= states.indexOf(p.state) ? 'complete' : ''}>
                    <span>{i < states.indexOf(p.state) ? '✓' : i + 1}</span>
                    <small>{labels[state]}</small>
                  </div>
                ))}
              </div>
              {p.exportedRevision !== null && p.exportedRevision !== p.revision && (
                <div className="notice error">
                  Informações alteradas após exportação. Reabra a conferência e gere um novo lote.
                </div>
              )}
              <div className="task-list">
                {d.tasks
                  .filter((t) => t.periodId === p.id)
                  .map((t) => (
                    <div className="list-row wrap" key={t.id}>
                      <strong>{t.label}</strong>
                      {t.completedAt ? (
                        <span className="badge green">Concluída</span>
                      ) : (
                        staff &&
                        form(
                          'completeTask',
                          'Concluir tarefa',
                          <>
                            <Hidden name="id" value={t.id} />
                            <Field name="comment" label="Evidência / comentário" />
                          </>,
                          true,
                        )
                      )}
                    </div>
                  ))}
              </div>
              {staff && (
                <>
                  <details>
                    <summary>Adicionar tarefa obrigatória</summary>
                    {form(
                      'task',
                      'Adicionar',
                      <>
                        <Hidden name="periodId" value={p.id} />
                        <Field name="label" label="Tarefa" />
                      </>,
                    )}
                  </details>
                  <div className="two-columns">
                    <div>
                      {form(
                        'transition',
                        'Registrar transição',
                        <>
                          <Hidden name="periodId" value={p.id} />
                          <Select
                            name="to"
                            label="Próxima etapa / reabertura"
                            options={states
                              .filter(
                                (s, i) =>
                                  i === states.indexOf(p.state) + 1 ||
                                  (s === 'UNDER_REVIEW' && states.indexOf(p.state) > 1),
                              )
                              .map((id) => ({ id, name: labels[id] }))}
                          />
                          <Field name="reason" label="Justificativa e evidência" />
                        </>,
                      )}
                    </div>
                    <div>
                      <h3>Processamento no Domínio</h3>
                      <p className="muted">
                        Exportações genéricas ConCloud. A equipe processa e confere manualmente no
                        sistema contábil.
                      </p>
                      {form(
                        'export',
                        'Gerar pacote versionado',
                        <Hidden name="periodId" value={p.id} />,
                      )}
                    </div>
                  </div>
                  {batches.map((b) => (
                    <div className="batch" key={b.id}>
                      <div className="list-row">
                        <strong>
                          Lote v{b.version} · revisão {b.revision}
                        </strong>
                        <span className={`badge ${b.status === 'READY' ? 'green' : ''}`}>
                          {b.status === 'READY' ? 'Pronto para retirada' : 'Aguardando worker'}
                        </span>
                        {b.status === 'READY' &&
                          form(
                            'downloadBatch',
                            'Retirar pacote',
                            <Hidden name="id" value={b.id} />,
                            true,
                          )}
                      </div>
                      {b.status === 'READY' && (
                        <div className="two-columns">
                          <div>
                            {d.processing.some((x) => x.exportBatchId === b.id) ? (
                              <span className="badge green">Processamento registrado</span>
                            ) : (
                              form(
                                'processed',
                                'Registrar processamento',
                                <>
                                  <Hidden name="exportBatchId" value={b.id} />
                                  <Field name="protocol" label="Protocolo / evidência no Domínio" />
                                  <Select
                                    name="resultDocumentId"
                                    label="Documento de resultado anexado"
                                    options={options(
                                      d.documents.filter(
                                        (x) =>
                                          x.competence === p.competence &&
                                          x.classification === 'RESULT',
                                      ),
                                    )}
                                  />
                                </>,
                              )
                            )}
                          </div>
                          <div>
                            {d.reviews.some((x) => x.exportBatchId === b.id) ? (
                              <span className="badge green">Revisão aprovada</span>
                            ) : (
                              canReview &&
                              form(
                                'review',
                                'Aprovar revisão',
                                <>
                                  <Hidden name="exportBatchId" value={b.id} />
                                  <Field name="notes" label="Parecer e evidências da revisão" />
                                </>,
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </Panel>
          );
        })}
        <Panel title="Trilha de execução">
          {d.events
            .filter((e) =>
              [
                'transition',
                'export',
                'processed',
                'review',
                'document.version',
                'publish',
              ].includes(e.action),
            )
            .map((e) => (
              <div className="list-row" key={e.id}>
                <strong>{e.action}</strong>
                <small>
                  {fmtDate(e.createdAt)} · {e.actorId}
                </small>
              </div>
            ))}
        </Panel>
      </>
    );
  if (section === 'impostos')
    return (
      <>
        <div className="notice">
          As guias são anexadas pela equipe. Pagamento informado pelo cliente não é confirmação
          bancária.
        </div>
        <Panel title="Guias e obrigações">
          {d.guides.length ? (
            d.guides.map((g) => (
              <div className="guide-row" key={g.id}>
                <div className="list-row">
                  <span>
                    <strong>{d.obligations.find((o) => o.id === g.obligationId)?.name}</strong>
                    <small>Vencimento {fmtDate(g.dueDate)}</small>
                  </span>
                  <strong>{brl(g.amount.toString())}</strong>
                  <a
                    href={`/api/documents/${companyId}/${g.documentId}`}
                    className="button button-outline"
                  >
                    Baixar guia
                  </a>
                </div>
                {form(
                  'reportPayment',
                  'Informar pagamento',
                  <>
                    <Hidden name="guideId" value={g.id} />
                    <div className="form-grid">
                      <Field
                        name="amount"
                        label="Valor pago (R$)"
                        type="number"
                        value={g.amount.toFixed(2)}
                      />
                      <Field name="paidAt" label="Data do pagamento" type="date" />
                      <Select
                        name="proofDocumentId"
                        label="Comprovante enviado"
                        optional
                        options={options(d.documents.filter((x) => x.classification === 'PROOF'))}
                      />
                    </div>
                  </>,
                )}
                {d.payments
                  .filter((p) => p.guideId === g.id)
                  .map((p) => (
                    <div className="list-row" key={p.id}>
                      <span className="badge">
                        {p.status === 'VERIFIED'
                          ? 'Conferido pela equipe'
                          : p.status === 'PROOF_ATTACHED'
                            ? 'Comprovante anexado'
                            : 'Pagamento informado'}
                      </span>
                      <span>{brl(p.amount.toString())}</span>
                      {p.status === 'REPORTED' &&
                        form(
                          'attachProof',
                          'Anexar comprovante',
                          <>
                            <Hidden name="id" value={p.id} />
                            <Select
                              name="documentId"
                              label="Comprovante"
                              options={options(
                                d.documents.filter((x) => x.classification === 'PROOF'),
                              )}
                            />
                          </>,
                          true,
                        )}
                      {canReview &&
                        p.status !== 'VERIFIED' &&
                        form(
                          'verifyPayment',
                          'Conferir pagamento',
                          <Hidden name="id" value={p.id} />,
                          true,
                        )}
                    </div>
                  ))}
              </div>
            ))
          ) : (
            <Empty
              title="Nenhuma guia publicada"
              description="Quando a equipe publicar suas guias, elas estarão disponíveis aqui."
            />
          )}
        </Panel>
        {staff && (
          <Panel
            title="Publicar guia anexada"
            description="Envie o arquivo real em Documentos e publique-o antes de vincular à obrigação."
          >
            {form(
              'guide',
              'Disponibilizar guia',
              <div className="form-grid">
                <Field name="name" label="Obrigação / tributo" />
                <Field name="competence" label="Competência" type="month" value={monthNow()} />
                <Select
                  name="documentId"
                  label="Documento publicado"
                  options={options(
                    d.documents.filter(
                      (d) => d.visibility === 'PUBLISHED' && d.classification === 'GUIDE',
                    ),
                  )}
                />
                <Field name="amount" label="Valor (R$)" type="number" />
                <Field name="dueDate" label="Vencimento" type="date" />
              </div>,
            )}
          </Panel>
        )}
      </>
    );
  if (section === 'atendimento')
    return (
      <>
        <Panel title="Como podemos ajudar?">
          {form(
            'ticket',
            'Abrir atendimento',
            <>
              <Field name="subject" label="Assunto" />
              <label>
                Mensagem
                <textarea name="body" required rows={4} />
              </label>
            </>,
          )}
        </Panel>
        {d.tickets.map((t) => (
          <Panel
            key={t.id}
            title={t.subject}
            description={t.status === 'OPEN' ? 'Atendimento aberto' : 'Atendimento encerrado'}
          >
            {d.messages
              .filter((m) => m.ticketId === t.id)
              .map((m) => (
                <div className={m.authorId === actorId ? 'message own' : 'message'} key={m.id}>
                  <small>
                    {m.authorId === actorId ? 'Você' : m.authorId} · {fmtDate(m.createdAt)}
                  </small>
                  <p>{m.body}</p>
                </div>
              ))}
            {t.status === 'OPEN' && (
              <>
                {form(
                  'reply',
                  'Enviar resposta',
                  <>
                    <Hidden name="ticketId" value={t.id} />
                    <label>
                      Resposta
                      <textarea name="body" required rows={3} />
                    </label>
                  </>,
                )}
                {form(
                  'closeTicket',
                  'Encerrar atendimento',
                  <Hidden name="id" value={t.id} />,
                  true,
                )}
              </>
            )}
          </Panel>
        ))}
      </>
    );
  if (section === 'equipe')
    return (
      <>
        <Panel
          title="Acesso à empresa"
          description="Cada pessoa tem permissões específicas nesta empresa."
        >
          {d.members.map((m) => (
            <div className="list-row wrap" key={m.id}>
              <span>
                <strong>
                  {m.userId === actorId ? 'Você' : m.displayName || 'Pessoa atribuída'}
                </strong>
                <small>{m.role}</small>
              </span>
              <span className="badge green">{m.active ? 'Ativo' : 'Inativo'}</span>
              {admin &&
                form(
                  'assign',
                  'Atualizar papel',
                  <>
                    <Hidden name="userId" value={m.userId} />
                    <Select
                      name="role"
                      label="Papel"
                      options={['ACCOUNTANT', 'ASSISTANT', 'CLIENT_OWNER', 'CLIENT_MEMBER'].map(
                        (id) => ({ id, name: id }),
                      )}
                    />
                  </>,
                  true,
                )}
            </div>
          ))}
        </Panel>
        {admin && (
          <Panel
            title="Convidar pessoa"
            description="O convite expira em 7 dias. Copie o link e compartilhe pelo seu canal de preferência."
          >
            {form(
              'invite',
              'Gerar convite',
              <>
                <Field name="email" label="E-mail do destinatário" type="email" />
                <Select
                  name="role"
                  label="Papel nesta empresa"
                  options={[
                    { id: 'CLIENT_OWNER', name: 'Responsável do cliente' },
                    { id: 'CLIENT_MEMBER', name: 'Colaborador do cliente' },
                    { id: 'ACCOUNTANT', name: 'Contador' },
                    { id: 'ASSISTANT', name: 'Assistente do escritório' },
                  ]}
                />
              </>,
            )}
          </Panel>
        )}
        <Panel title="Integrações">
          <div className="integration-grid">
            {[
              ['Domínio', 'Operação manual disponível'],
              ['Pluggy', 'Não configurado — utilize OFX / CSV'],
              ['Focus NFe', 'Emissão fiscal fora desta versão'],
              ['Inteligência artificial', 'Opcional — não configurada'],
            ].map(([name, note]) => (
              <div className="integration" key={name}>
                <strong>{name}</strong>
                <p>{note}</p>
                <span className="badge">{name === 'Domínio' ? 'Manual' : 'Desativado'}</span>
              </div>
            ))}
          </div>
        </Panel>
      </>
    );
  return <Empty title="Área não encontrada" />;
}
