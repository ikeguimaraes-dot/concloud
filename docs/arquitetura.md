# Arquitetura e decisões

## Monólito modular

`apps/web`: Next.js App Router, Server Components, formulários progressivos com Server Actions. As ações autenticam, limitam frequência e chamam `lib/service.ts`. Serviços de aplicação validam Zod, papel, escopo e estado. Regras puras em `packages/domain`. Prisma e transações em `packages/database`. Adaptadores de arquivos/contabilidade em `packages/integrations`. `apps/worker` é processo separado BullMQ. Componentes em `packages/ui` seguem o padrão shadcn (Radix Slot/CVA), com Tailwind e Lucide.

Uma aplicação e uma biblioteca de serviços são suficientes para a primeira versão; os módulos estão separados por entidades e operações, sem microserviços. OnboardingChecklist foi consolidado em OnboardingItem por empresa. Alocações de conciliação são linhas Reconciliation; estornos conservam a linha original. User corresponde a Profile vinculado ao UUID do Supabase Auth.

## Banco compartilhado

Todas as tabelas, enums, funções e o histórico `_prisma_migrations` ficam em `concloud`. `prisma.config.ts` força `schema=concloud` para a conexão de migrations. O projeto informado é `peuqfdgkxkiaszrvpgmq`, identificado como Pipou-cardoso; o usuário confirmou o compartilhamento. Não alterar tabelas, Auth policies, funções ou buckets do sistema existente. Não executar reset, db push, seeds ou DROP no ambiente remoto.

Prisma Migrate é a **única autoridade**. SQL de índices, constraints, políticas RLS e grants faz parte das mesmas migrations. Não criar um histórico Supabase concorrente. A role de migration provisiona schema e roles; não é usada pelo servidor web.

## Identidade e RLS

Supabase `auth.getUser()` valida a identidade no servidor. `getAuthenticatorAssuranceLevel()` exige AAL2 para funções internas. `user_metadata` nunca concede acesso. Cadastro não cria memberships nem papéis. Bootstrap exige UUID de identidade confirmada, credencial administrativa e banco vazio de administradores.

Cada transação Prisma SERIALIZABLE recebe `app.user_id` e e-mail da identidade validada via `set_config(..., true)`. `scoped()` carrega Company sob RLS, deriva organização do registro e busca a membership real. O ID enviado pelo navegador é apenas um seletor, nunca evidência de permissão. Um org admin administra somente sua organização; contador/assistente/cliente precisam de concessão na empresa. SUPER_ADMIN foi mantido como papel administrativo **com escopo de organização**, sem bypass global.

Runtime `concloud_runtime` é NOBYPASSRLS/NOSUPERUSER; a aplicação recusa credenciais privilegiadas. Todas as tabelas têm ENABLE e FORCE RLS. Funções auxiliares são SECURITY INVOKER; não existe SECURITY DEFINER. Tabelas ficam fora da Data API. Não há grant a anon/authenticated. Não adicionar `concloud` aos schemas expostos.

Convites têm token aleatório 256 bits, só hash no banco, expiração e uso único. A aceitação exige identidade com mesmo e-mail; a política permite inserir membership apenas com papel/empresa do convite ainda válido. Credenciais do runtime continuam sendo um limite de confiança: quem comprometer o servidor e sua conexão pode definir contexto. Não se afirma proteção contra administrador da infraestrutura.

FKs compostas `(organizationId, companyId, id)` impedem vínculos cruzados. Histórico financeiro/documental usa RESTRICT, sem exclusões em cascata. Eventos, transições, versões e revisões não podem ser atualizados/excluídos pelo runtime. Sessão transacional e ausência de vazamento no pool são testadas.

## Consistência financeira e fechamento

Decimal(18,2), `decimal.js`, arredondamento HALF_UP. JSON monetário usa strings. Parcelas distribuem os centavos do resto nas primeiras parcelas. Liquidação distingue principal, juros, multa e desconto. Saldos usam principal; caixa usa o desembolso efetivo. Transferências não entram em resultado. Datas de emissão, competência, vencimento e liquidação são separadas. Datas de negócio são PostgreSQL DATE; apresentação America/Sao_Paulo e eventos UTC.

SERIALIZABLE, locks transacionais e uniques protegem liquidações, recorrências e lotes. Conflitos concorrentes retornam pedido de atualização; reexecução com a mesma chave converge. Importação não cria títulos. FITID ou hash determinístico identifica movimento por conta. CSV sem identificador pode consolidar movimentos legítimos idênticos: prefira coluna de ID bancário; a prévia mostra rejeições.

Cada exportação armazena snapshot imutável e revisão de origem. Mudanças de entrada marcam divergência; resultados iniciais são saídas do processamento e não alteram a entrada. Revisão tem pessoa diferente do responsável. Pagamento de guia é um fluxo independente.

## Outbox, worker e arquivos

Criação do lote e OutboxEvent são atômicas. Dispatcher usa role separada com SELECT e UPDATE limitado na outbox. Enfileira por ID estável; worker revalida concessão do ator original, gera ZIP com datas fixas, checksums e manifesto. Reexecução não sobrescreve objeto diferente. Jobs têm tentativas, backoff, health e lista de falhas. Falha após armazenamento e antes de commit é recuperada comparando conteúdo na próxima execução.

Supabase bucket privado, somente servidor com service_role para operações de Storage após autorização. Nenhuma URL pública é persistida. Download assinado vale 60 segundos. Upload valida tamanho e assinatura de PDF/PNG/JPEG; CSV é tratado como texto. Não há execução de conteúdo. Versões nunca sobrescrevem objetos. Falha de transação após upload pode deixar objeto órfão: rotina de retenção deve identificá-lo antes de remover; não há exclusão automática nesta versão.

Demonstração local exige DEMO_MODE, NODE_ENV diferente de production e DB localhost. Usa perfis sintéticos, arquivos locais privados e assinatura HMAC, explicitamente identificados na interface. Esse adaptador permite testar a jornada sem enviar arquivos/comunicações ao Supabase compartilhado. Não equivale à homologação de Supabase Auth/Storage reais.

## Fontes e versões

Consultadas em 05/10/2026: [Next.js](https://nextjs.org/docs/app/getting-started/installation), documentação instalada `node_modules/next/dist/docs`, [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [changelog](https://supabase.com/changelog.md), [Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [BullMQ](https://docs.bullmq.io), [shadcn](https://ui.shadcn.com/docs), [CNPJ oficial](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).

Next 16.3.8, React 19.3.0, Prisma 7.10.0 (8 era RC), Supabase JS 2.117.2/SSR 0.12.7; versões completas no package-lock. Ferramenta opcional embedded-postgres tem etiqueta beta upstream, só usada em desenvolvimento; produção usa PostgreSQL/Supabase. Atualização recente do Postgres sobre ltree/pgcrypto não afeta esta modelagem, que não usa essas extensões.
