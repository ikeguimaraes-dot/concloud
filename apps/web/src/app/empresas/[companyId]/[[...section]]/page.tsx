import { notFound } from 'next/navigation';
import { requireActor } from '@/lib/auth';
import { readCompany } from '@/lib/service';
import { Shell } from '@/components/shell';
import { Module } from '@/components/company-modules';
import { internal } from '@domain/permissions';
export const dynamic = 'force-dynamic';
const titles: Record<string, [string, string]> = {
  '': ['Visão geral', 'Sua empresa, vista de perto. Tudo o que importa para hoje.'],
  empresa: ['Minha empresa', 'Cadastro, responsabilidades e preparação para a operação.'],
  financeiro: ['Financeiro', 'Organize suas contas e acompanhe cada movimento.'],
  bancos: ['Bancos e conciliação', 'Conecte seu extrato à realidade do seu financeiro.'],
  documentos: ['Documentos', 'Tudo organizado, protegido e fácil de encontrar.'],
  impostos: ['Impostos e obrigações', 'Guias, prazos e comprovantes, com status claros.'],
  fechamento: ['Fechamento mensal', 'Da primeira informação à entrega revisada.'],
  atendimento: ['Atendimento', 'Converse com a equipe e acompanhe cada solicitação.'],
  equipe: ['Configurações e equipe', 'As pessoas certas, com os acessos certos.'],
};
export default async function Company({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; section?: string[] }>;
  searchParams: Promise<{ month?: string; category?: string; status?: string }>;
}) {
  const actor = await requireActor();
  const { companyId, section } = await params;
  const path = section?.join('/') ?? '';
  if (!titles[path]) notFound();
  const d = await readCompany(actor, companyId);
  const [title, subtitle] = titles[path];
  return (
    <Shell
      companyId={companyId}
      companyName={d.company.name}
      email={actor.email}
      section={path}
      staff={internal(d.scope.role)}
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">{d.company.name}</span>
          <h1>
            {title}
            <span className="title-dot">.</span>
          </h1>
          <p>{subtitle}</p>
        </div>
        <span className="badge">
          <span className="status-dot" />
          {internal(d.scope.role) ? 'Visão do escritório' : 'Portal do cliente'}
        </span>
      </div>
      <Module d={d} section={path} actorId={actor.id} query={await searchParams} />
    </Shell>
  );
}
