# Painel interno — Entrega 1

Implementação de 26/10/2026. UI separada em `ikeguimaraes-dot/concloud-backend`; API autorizada aqui, em `/api/internal/v1`. Contrato: [OpenAPI](internal-api.openapi.yaml).

## Dados e acesso

Escritório exclusivo ConCloud, resolvido no servidor por OpeningOffice. OpeningLead recebe organizationId, ownerId e version. OpeningStaff exige vínculo organizacional e concessão explícita; administradores veem todos os cadastros e documentos do escritório. Outros operadores precisam de atribuição ou readAll; documents é independente. Clientes e AAL1 não entram. Runtime continua NOBYPASSRLS. API valida getUser e getClaims do token do operador, sem confiar em user_metadata.

OpeningAuditEvent registra atribuições e autorizações de download, append-only. Arquivos existentes preservam IDs/objectKeys. Atribuição usa expectedVersion; não há alteração manual de pagamento. API lista dados incompletos e não pagos. Envio documental não significa aprovação.

A nova migration permite partners vazio somente em DRAFT; titular legado é preenchido na submissão final. Endpoint de draft retorna 503 em falha, e o formulário exige persisted=true para avançar. Limite de upload de abertura continua 4 MB.

## Histórico remoto reconciliado

Inspeção remota encontrou histórico em `supabase_migrations.schema_migrations`, não em `concloud._prisma_migrations`. As migrations de sócios e MEI faltavam. Em vez de executar Prisma deploy sobre uma base já existente, foi aplicado o lote `concloud_opening_internal_rollout` usando exatamente as fontes versionadas:

- `20261016120000_opening_partners`
- `20261026120000_opening_mei`
- `20261026200458_opening_internal_panel`

A autoridade de arquivos continua `packages/database/migrations` neste repositório; o painel não possui migrations. Não executar Prisma deploy nesse remoto antes de baselining/reconciliação formal do histórico. Bases locais novas usam Prisma normalmente. Nenhuma migration do outro sistema foi reaplicada ou alterada.

Após rollout: 4 leads e 12 referências documentais preservados, hashes de IDs e objectKeys inalterados, nenhum lead sem organização. Provisionamento idempotente do administrador confirmado está em `scripts/sql/bootstrap-opening-admin.sql`; usa identidade Auth existente e confirmada, sem criar senha/usuário ou enviar mensagem. Login com e-mail e senha, sem exigir segundo fator (decisão do responsável em 26/10/2026).

## Verificação

Build e TypeScript aprovados. Suite local: 36 testes aprovados e 13 ignorados por ausência de PostgreSQL nativo de teste configurado. Os novos testes de migrations/RLS usam PGlite com a cadeia completa, role concloud_runtime, duas organizações, clientes, AAL1/AAL2, revogação, concorrência de versão e preservação de arquivos legados. Testes de autenticação cobrem token inválido e claims de outra identidade. Não equivalem a login humano real.

A conexão administrativa MCP não permite SET ROLE concloud_runtime; não foram ampliados privilégios para contornar isso. O teste direto dessa role no remoto permaneceu indisponível; RLS foi executada em banco isolado e a API publicada deve ser homologada com a sessão do administrador.

## Limites

Kanban, revisão por versão, SLAs, mensageria, recorrência conciliada e administração visual de novos funcionários ficam para as próximas entregas. O índice único CPF e o webhook legado permanecem; não automatizar múltiplos processos ou efeitos de pagamento sem tratar esses pontos. Não houve disparo deliberado de mensagens ou cobrança nesta implantação.

Rollback de aplicação preserva colunas e arquivos aditivos. Não remover migrations/dados; para voltar ao portal anterior, sua UI de documentos tem fallback por capacidades. Alterações de grants de atribuição devem ser preservadas. Cadastro/draft legados continuam passando pelas funções existentes.

## Dependências e busca

Next atualizado para 16.4.3 após alerta de audit no build; Zod atualizado para 4.6.7 e correções compatíveis de fast-uri/Vite no lockfile. Audit final sem vulnerabilidades reportadas. Build e testes repetidos após as atualizações. A busca por CPF aceita entrada com ou sem pontuação.
