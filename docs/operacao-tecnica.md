# Operação técnica

## Ambientes e implantação

Use projetos/credenciais distintos para desenvolvimento, homologação e produção. No banco compartilhado já informado, o deploy é aditivo, somente no schema `concloud`. Não executar `migrate reset` ou `db push` e não expor o schema pela Data API. Backup antes das migrations; execute `prisma migrate deploy` com credencial de migration. O runtime exige role concloud_runtime NOBYPASSRLS/NOSUPERUSER. Configure senha forte fora do histórico versionado. O dispatcher tem credencial própria e grants limitados à outbox.

A credencial service_role só entra no servidor web/worker para Storage e nos scripts administrativos de setup/bootstrap. Nunca use NEXT_PUBLIC_ para essa chave. `.env` é ignorado pelo Git. Rotação de credenciais deve ser coordenada com o outro sistema que compartilha o projeto.

Auth: configure Site URL e URLs permitidas para seu domínio; confirmação de e-mail e TOTP habilitados. O primeiro administrador deve ser uma identidade Supabase confirmada, vinculada pelo script `bootstrap`. Nenhum formulário aceita escolha de papel administrativo.

## Health e incidentes

- Web: `GET /api/health`, 200 só se banco e Redis respondem, sem revelar connection strings.
- Worker: `GET http://127.0.0.1:3001/health`, heartbeat da outbox e contagem waiting/active/failed.
- Logs JSON têm evento e identificador, sem conteúdo de documentos, senhas ou dados pessoais. Detalhes sensíveis não vão ao navegador.
- Falhas de fila: consultar jobs failed usando BullMQ com o mesmo Redis, corrigir a causa e chamar `job.retry()` pelo script `npm run jobs:retry -- <id>`. O job conserva o ID da outbox. Monitorar lastError na carteira operacional.
- A revogação da atribuição impede novos trabalhos do worker em nome daquele ator; um administrador deve revisar/reemitir o lote com responsabilidade válida.
- Banco: conflitos serializáveis retornam orientação de repetição. Não contornar mudando runtime para postgres/service_role.

## Backup e restauração

Defina RPO/RTO com a operação antes de produção. Habilite backups/PITR do Supabase conforme o plano e mantenha uma cópia independente dos arquivos de Storage. Backup SQL sozinho não contém os objetos.

Para dump dedicado (com cliente PostgreSQL instalado): `pg_dump "$MIGRATION_DATABASE_URL" --schema=concloud --format=custom --file=concloud.dump`. Registre também grants/roles em procedimento seguro, sem versionar senhas. Em banco compartilhado, uma restauração global afeta o outro sistema: restaure primeiro em projeto isolado, confira versão/schema e combine a janela de recuperação.

Procedimento de ensaio: (1) banco vazio em ambiente isolado; (2) roles e migrations; (3) restaurar dados respeitando constraints; (4) copiar os objetos do bucket privado mantendo object keys; (5) verificar hashes de DocumentVersion e manifestos dos lotes; (6) executar smoke test de acessos e documentos com duas organizações; (7) registrar duração e evidência. Não restaurar fixtures em produção. O ensaio remoto de recuperação ainda precisa ser executado pelo operador com credenciais e backup disponíveis.

## Retenção

Organization.retentionDays é configurável pelo administrador de infraestrutura; padrão 1825 dias é um valor técnico inicial, não aconselhamento jurídico de prazo legal. A v1 não apaga automaticamente documentos/financeiro/auditoria. Alterações/remoções exigem procedimento documentado, revisão dos requisitos aplicáveis e backup. Objetos órfãos após upload interrompido devem ser comparados às referências no banco e mantidos por uma janela de segurança antes de limpeza. Não apagar por prefixo sem inventário e revisão.

## Limites atuais

Uploads 10 MB, importações 5 MB/10 mil linhas. O worker monta o ZIP em memória; limite total 100 MB por pacote. Para volumes maiores, implementar streaming/multipart antes de ampliar o limite. Sem scanner antimalware nesta versão; há validação de assinatura/tipo/tamanho e downloads como anexos. Nenhum conteúdo é executado. Assinaturas de download são bearer links com duração de 60 segundos.
