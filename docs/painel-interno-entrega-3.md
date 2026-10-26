# Entrega 3 — gestão de pendências

Autorizada pelo administrador em 26/10/2026, após proposta de filtros por responsável, documentos faltantes e tarefas vencidas.

## Comportamento

Nova seção Pendências no menu desktop e celular. Lista clientes com documentos necessários ainda não enviados, plano/sócios indefinidos ou tarefas abertas vencidas. Combina responsável atual do cadastro (todos no acesso, pessoa ou sem responsável), tipo de pendência e busca por nome/e-mail/CPF. Tarefas vencidas são priorizadas, ordenadas pelo vencimento mais antigo. Exibe contagem total do filtro e até 50 clientes por página.

Cada cliente mostra responsável, documentos faltantes/necessários, quantidade de tarefas vencidas e vencimento mais antigo em horário de Brasília. Pagamentos TEST_BYPASS continuam identificados. Botões abrem a ficha/documentos ou o processo/tarefas; criação e conclusão usam os contratos persistidos e versionados da Entrega 2. Atualizar recarrega os dados; alterações realizadas na ficha e tarefas também recarregam a lista.

Uma tarefa vencida tem dueAt anterior ao horário do banco e completed=false. Tarefas sem prazo, futuras e concluídas não contam. Processos DONE/CANCELED ficam fora da fila. O responsável do filtro é o atual responsável do cadastro, mesmo que uma tarefa tenha sido criada antes da reatribuição. Não são SLAs legais.

Documentos contam categorias atuais vinculadas aos dados atuais dos sócios: quatro pessoais por sócio, endereço da empresa e IPTU para pequena empresa; cinco no MEI. Não confunde envio com aprovação. Rejeições documentais continuam na ficha; esta entrega não adiciona um filtro de revisão. Cadastros sem plano/sócios suficientes são separados como dados indefinidos, sem número inventado de documentos faltantes.

## Arquitetura e acesso

GET /api/internal/v1/pending no portal compartilhado; BFF do painel permite somente GET /api/internal/pending. Parâmetros ownerId, kind (ALL/DOCUMENTS/OVERDUE/DETAILS), search até 120 caracteres e offset. Os filtros são aplicados no banco antes da paginação; SQL parametrizado, RLS das tabelas existentes e permissão documental obrigatória. Busca literal, sem interpretação de curingas. Nenhum arquivo é aberto para produzir a fila.

Sem novas tabelas, migrations, pagamentos, cadastros paralelos, mensagens ou automações de movimentação. Os dados continuam no schema privado concloud. O endpoint é somente leitura e não modifica dados de outros sistemas.

## Aceite e validação

- Filtros combinados e escopo do operador preservados; cliente externo não vê pendências da equipe e perfil sem documentos recebe 403.
- Documento enviado reduz faltantes; concluir tarefa remove seu atraso. Um cliente sem nenhuma pendência sai da fila.
- Cadastro sem responsável pode ser localizado pelo filtro específico e atribuído pela ficha por administrador autorizado.
- Paginação validada com 52 cadastros sintéticos: 50 + 2, sem repetição, total 52.
- Tarefas futuras, concluídas e sem prazo excluídas da contagem; processos encerrados excluídos da fila.
- PGlite roda migrations completas com role runtime; browser smoke desktop e celular cobre filtros, vazio e abertura de processo/tarefas. Não há alterações em clientes reais durante testes.

A confirmação real de pagamento PagBank segue pendente de validação operacional; esta entrega não declara um teste de pagamento real como concluído.

Validação de 26/10/2026: 55 testes do portal aprovados, 13 dependentes de PostgreSQL nativo ignorados; PGlite efetivamente executado. TypeScript, lint e builds aprovados; smoke desktop/celular cobre a fila.
