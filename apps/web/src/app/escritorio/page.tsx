import Link from 'next/link';
import { Building2, ArrowUpRight, Plus, FolderCheck } from 'lucide-react';
import { requireActor } from '@/lib/auth';
import { companies, officeOperations } from '@/lib/service';
import { Shell } from '@/components/shell';
import { ActionForm } from '@/components/forms';
import { Field, Select, Panel, Empty } from '@/components/fields';
export const dynamic = 'force-dynamic';
export default async function Office() {
  const actor = await requireActor();
  const data = await companies(actor);
  const operations = await officeOperations(actor);
  const adminOrgs = data.organizations.filter((m) => ['ORG_ADMIN', 'SUPER_ADMIN'].includes(m.role));
  return (
    <Shell email={actor.email} staff={operations.length > 0}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEU ESPAÇO DE TRABALHO</span>
          <h1>
            Carteira de empresas<span className="title-dot">.</span>
          </h1>
          <p>Organize a operação. Acompanhe cada empresa de perto.</p>
        </div>
        <span className="badge">
          <Building2 size={14} />
          {data.companies.length} empresas autorizadas
        </span>
      </div>
      <div className="welcome-strip">
        <div className="welcome-icon">
          <FolderCheck size={28} />
        </div>
        <div>
          <h2>O próximo passo começa por aqui.</h2>
          <p>
            Selecione uma empresa para conferir pendências, organizar o financeiro e acompanhar o
            fechamento.
          </p>
        </div>
      </div>
      {operations.length > 0 && (
        <>
          <div className="stats-grid">
            {[
              ['Pendências', operations.reduce((n, o) => n + o.requests.length, 0)],
              [
                'Em processamento',
                operations.reduce(
                  (n, o) => n + o.periods.filter((p) => p.state === 'PROCESSING_EXTERNALLY').length,
                  0,
                ),
              ],
              [
                'Aguardando revisão',
                operations.reduce(
                  (n, o) => n + o.periods.filter((p) => p.state === 'QUALITY_REVIEW').length,
                  0,
                ),
              ],
              ['Atendimentos abertos', operations.reduce((n, o) => n + o.tickets, 0)],
            ].map(([name, count]) => (
              <div className="stat-card" key={name}>
                <span>{name}</span>
                <strong>{count}</strong>
                <small>Empresas autorizadas</small>
              </div>
            ))}
          </div>
          <details>
            <summary>Operação do escritório · Onboarding, pendências, fila e revisões</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Onboarding pendente</th>
                    <th>Documentos pendentes</th>
                    <th>Fechamento / fila</th>
                    <th>Jobs com falha</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((o) => (
                    <tr key={o.company.id}>
                      <td>
                        <Link href={`/empresas/${o.company.id}`}>{o.company.name}</Link>
                      </td>
                      <td>
                        <Link href={`/empresas/${o.company.id}/empresa`}>{o.onboarding}</Link>
                      </td>
                      <td>
                        <Link href={`/empresas/${o.company.id}/documentos`}>
                          {o.requests.length}
                        </Link>
                      </td>
                      <td>
                        {o.periods.length
                          ? o.periods.map((p) => (
                              <div key={p.id}>
                                <Link href={`/empresas/${o.company.id}/fechamento`}>
                                  {p.competence} · {p.state}
                                </Link>
                              </div>
                            ))
                          : 'Nenhuma competência'}
                      </td>
                      <td>{o.jobs.filter((j) => j.lastError).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <div className="company-grid">
        {data.companies.map((c, i) => (
          <Link className="company-card" href={`/empresas/${c.id}`} key={c.id}>
            <div className="company-card-top">
              <span className={`company-avatar tone-${i % 3}`}>
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <ArrowUpRight size={21} />
            </div>
            <h2>{c.name}</h2>
            <p>CNPJ {c.cnpj}</p>
            <div className="company-card-bottom">
              <span className="status-dot" />
              Acessar empresa<span>→</span>
            </div>
          </Link>
        ))}
      </div>
      {!data.companies.length && (
        <Empty
          title="Seu espaço está pronto para começar"
          description="Aceite o convite da equipe ou cadastre a primeira empresa se você é administrador."
        />
      )}
      {adminOrgs.length > 0 && (
        <Panel
          title="Cadastrar empresa"
          description="O cadastro fica restrito à organização selecionada."
        >
          <ActionForm operation="createCompany" label="Cadastrar empresa">
            <div className="form-grid">
              <Select
                name="organizationId"
                label="Organização"
                options={adminOrgs.map((m) => ({
                  id: m.organizationId,
                  name: m.organization.name,
                }))}
              />
              <Field name="name" label="Razão social" />
              <Field name="cnpj" label="CNPJ (numérico ou alfanumérico)" />
              <Select
                name="regime"
                label="Regime tributário"
                options={[
                  { id: 'SIMPLES_NACIONAL', name: 'Simples Nacional' },
                  { id: 'LUCRO_PRESUMIDO', name: 'Lucro Presumido' },
                ]}
              />
              <Field
                name="accountingSystemId"
                label="Código da empresa no Domínio"
                required={false}
              />
            </div>
            <span className="form-hint">
              <Plus size={14} />
              Depois do cadastro, convide os responsáveis na área de equipe.
            </span>
          </ActionForm>
        </Panel>
      )}
    </Shell>
  );
}
