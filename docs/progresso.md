# Progresso e continuidade

## Implementado

- Monólito Next.js/TypeScript, interface cliente/escritório e worker separado.
- Prisma schema privado concloud, cinco migrations, RLS, runtime NOBYPASSRLS e grants isolados.
- Supabase Auth/Storage preparados; MFA e bootstrap seguro documentados.
- Empresas, convites pessoais, onboarding, equipe, documentos privados/versionados.
- ERP: contatos, categorias, centros de custo, parcelas, recorrências, liquidação parcial, estornos e transferências; relatórios gerenciais por competência e fluxo.
- CSV/OFX, prévia vinculada à confirmação, deduplicação, conciliação parcial e desfazimento.
- Fechamento completo, revisão distinta, outbox/BullMQ, pacote genérico com checksums, registro manual no Domínio, publicação e guias/pagamentos.
- Atendimento, auditoria, health checks, CI, infraestrutura e manuais.
- 35 testes Vitest e 3 jornadas Playwright aprovados localmente. Detalhes em verificacao.md.

## Decisões do usuário

O projeto Supabase peuqfdgkxkiaszrvpgmq compartilha banco com outro sistema (confirmado). Não alterar o schema público nem as políticas existentes. As novas tabelas e o histórico Prisma ficam no schema concloud.

## Próximo passo externo

Configurar MIGRATION_DATABASE_URL, senhas das roles dedicadas e credenciais Supabase no ambiente real. A chave anon/service_role não é uma conexão PostgreSQL para Prisma. A pergunta sobre a conexão de migrations foi enviada; a implementação e os testes locais foram concluídos enquanto isso.

Depois: aplicar as migrations aditivas, criar bucket dedicado, bootstrap do administrador, configurar domínio/Auth e homologar a jornada real. Sem seed sintético no banco compartilhado.
