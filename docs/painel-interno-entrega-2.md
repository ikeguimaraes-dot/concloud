# Entrega 2 — documentação e operação

Implementação iniciada por autorização do usuário em 26/10/2026. Login continua somente com e-mail e senha.

## Decisões operacionais desta versão

- O funil deriva dos fatos persistidos: draft, cadastro concluído, checkout, pagamento confirmado e processo encaminhado. Não permite confirmar pagamento arrastando um card.
- Decisão confirmada em 26/10/2026: pagamento PAID encaminha automaticamente à operação e cria um único processo em Recepção e triagem, mesmo sem responsável ou cadastro completo. O trigger executa na mesma transação do pagamento; reentregas não duplicam nem reiniciam etapas. Backfill inclui pagamentos anteriores. A atribuição continua na ficha e não é automática. Isso substitui a proposta provisória de encaminhamento manual.
- Plano MEI entra no fluxo MEI; planos Essencial/Gestão/Próximo em SP entram em JUCESP. Plano/UF indefinidos ou outra UF ficam em uma fila de Recepção e triagem (TRIAGE, rota a definir), sem permitir avanço ou encerramento até definição operacional. A natureza e aplicabilidade da rota JUCESP continuam sujeitas à conferência na triagem. A fila de rota a definir não simula um procedimento de outra UF; sua classificação será uma evolução específica.
- Fluxos versão 1: 16 etapas JUCESP e 7 MEI, com retorno documentado. Não há relógio de SLA nem cálculo de prazo legal nesta entrega.
- Operadores com acesso a documentos dos cadastros atribuídos podem revisar e operar suas etapas. Não recebem administração de equipe por isso. Vitória Mariano foi cadastrada em 26/10/2026 após confirmação do endereço `vitoria.mariano@oscpaulistana.com.br`. Perfil ASSISTANT ativo, documentos dos cadastros atribuídos, sem readAll/canAssign/admin. Login real validado e sessão de verificação encerrada. Credenciais entregues somente em arquivo local privado, fora do Git. Nenhum cadastro existente foi atribuído automaticamente.

## Implementado

Versões imutáveis capturadas no upload, mantendo object keys anteriores; backfill dos arquivos existentes como recebidos, sem aprovação automática. A revisão é append-only e pertence à versão atual. Rejeição exige motivo visível no portal. Reenvio recebe nova revisão. Mudança dos sócios invalida a correspondência da versão e bloqueia aprovação/avanço até novo envio. O snapshot evita atribuir silenciosamente um arquivo a outro sócio após reordenação.

Ficha permite consultar histórico de versões/revisões e baixar versões antigas mediante autorização e auditoria. Links temporários de 60 segundos; nenhum bucket público.

Funil paginado com etapas derivadas: um pagamento cria o processo e o cadastro aparece em Encaminhado à operação. Quadro com Todos os fluxos por padrão, grupos MEI/JUCESP/rota a definir, rolagem contida, navegação mobile e histórico. Busca no servidor por nome, e-mail, CPF ou ID de processo antes da paginação; resultado mostra a etapa e localiza o card. Painéis atualizam a cada 15 segundos enquanto visíveis e possuem botão Atualizar. Arrastar tenta salvar a transição no servidor; reaproveita somente um checklist explicitamente salvo na versão atual da mesma etapa. Se faltarem requisitos, abre o formulário para completá-los; o card só muda após sucesso da API. Transições verificam versão otimista, ordem/retorno permitido e checklist declarado pela equipe. Alterações da mesma etapa também ficam no histórico.

Documentos atuais aprovados são exigidos na saída da triagem JUCESP e na saída da validação MEI. Cinco documentos para MEI, sem IPTU. Cada sócio de pequena empresa tem quatro documentos pessoais, além de IPTU e endereço empresarial.

Protocolo obrigatório nas etapas JUCESP 3, 5, 7 e 12; retorno de análise externa exige referência/protocolo e motivo. Etapa 11 exige DARE e contrato assinado anexados. Conferência do CNPJ valida formato/dígitos com o validador existente, sem declarar situação cadastral externa. CNPJ/CCMEI e comprovante de entrega são exigidos nos respectivos passos. Um contrato assinado anterior a um retorno não libera novo protocolo.

Comprovantes internos PDF/PNG/JPG, até 2 MB, upload privado e downloads auditados. Tarefas persistidas com responsável do cadastro, prazo interno opcional, conclusão e versão; impedem encerramento enquanto abertas. O vencimento informado é operacional, sem interpretação legal.

## Critérios e evidências de verificação

- Cadastro pendente não entra no Kanban; PAID cria processo mesmo sem responsável; notificações repetidas preservam etapa, versão e histórico.
- Backfill idempotente; pagamentos TEST_BYPASS claramente identificados nos cards de Aberturas e funil.
- Busca antes da paginação, curingas tratados literalmente e permissões preservadas. Arrastar não reutiliza checklist antigo após retorno.
- MEI e JUCESP separados; avanço não pula etapas e retornos 4→2, 6→5, 8→7, 10→9, 13→10 preservados.
- Documento substituído não herda aprovação; revisão rejeitada aparece na consulta do próprio cliente e não em outro usuário.
- Cadastro/documentos fora de escopo não aparecem; eventos e versões não permitem alteração pelo runtime.
- Tarefas e transições rejeitam versões antigas; travas da etapa 11 ensaiadas em banco descartável.
- Testes PGlite executam a cadeia completa e role sem bypass. Smoke desktop/celular usa somente fixtures interceptadas localmente: funil, quadro, erro de bloqueio sem movimento e confirmação de transição.
- Builds e TypeScript dos dois projetos; lint do portal. Nenhum documento real foi aberto e nenhum processo real foi movimentado na homologação.

## Publicação e limites

Migrations canônicas apenas no portal: `20261026204842_opening_document_reviews` e `20261026205102_opening_operations` e `20261026212320_opening_automatic_dispatch`. Aplicar antes dos consumidores. Preservar schema aditivo em rollback; não apagar versões, histórico ou arquivos. Versões não registradas antes do rollout não podem ser reconstruídas automaticamente.

Limites: listas de processos 50 por página, funil 50, busca em todos os processos autorizados; histórico/tarefas/comprovantes e versões exibem até 100 registros. Não são métricas globais. Gestão visual de novos funcionários, solicitações documentais adicionais além de correções, filtros avançados, catálogo configurável de regras, revisão por pessoa diferente e pacotes de entrega vinculados à Company permanecem evoluções. Formalização e conferências em órgãos são manuais. Não há envio automático de mensagens.

Advisors prévios: seis funções legadas ConCloud sem search_path fixo; nenhuma criada por esta entrega. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable. As novas funções definem search_path e ficam fora da Data API.

## Registro da publicação inicial — 26/10/2026

Migrations aplicadas e conferidas no projeto `peuqfdgkxkiaszrvpgmq`: 4 cadastros e 12 documentos preservados, 12 versões iniciais, zero aprovações fabricadas e zero processos criados automaticamente. A política de processos inclui `opening_access` explicitamente. Advisors após a alteração mantêm somente os seis avisos legados já encontrados antes.

43 testes aprovados, 13 dependentes de PostgreSQL nativo ignorados; a suite PGlite roda efetivamente. Builds e TypeScript dos dois repositórios aprovados. Smoke de navegador cobre desktop e celular com dados sintéticos locais, sem movimentação de clientes reais.

## Equipe — atualização de acesso

Vitória Mariano e Igor Borges (`igor.borges@oscpaulistana.com.br`) possuem vínculo ativo de operador ASSISTANT, com documentos dos cadastros atribuídos e sem privilégios administrativos, readAll ou canAssign. As contas Auth existentes foram reutilizadas. Senhas definidas pelo administrador não são registradas no Git.

## Atualização — encaminhamento automático e busca

Migration aditiva restrita ao schema concloud: evento automático tem actorId nulo e source payment/payment_backfill; nenhuma identidade humana é simulada. RLS e concessões dos operadores são preservados. Trigger SECURITY INVOKER, search_path fixo e execução revogada para clientes. O webhook salva pagamento/processo antes da notificação já existente; falha de e-mail deixa o pagamento confirmado. Testes não enviam mensagens.

49 testes aprovados, 13 ignorados dependentes de PostgreSQL nativo; PGlite executado com migrations completas e role runtime, incluindo autoentrada sem responsável, retries, backfill e drag com checklist versionado. Webhook validado com assinatura sintética, falha de banco e de notificação.

Migration aplicada e verificada: 4 cadastros e 12 documentos preservados; 3 processos JUCESP criados em Recepção e triagem, todos com pagamento de teste explicitado no evento. Zero cadastros PAID sem processo. Nenhum cliente foi movido além da entrada solicitada. Advisors mantêm os seis avisos legados de search_path, sem novo alerta.

Smoke aprovado em 1440 e 390 px: Todos os fluxos, busca com e sem resultados, etapa localizada, drag desktop persistido após recarga e bloqueio sem movimento. No celular, a mesma transição é acessível pelo botão Abrir processo. Builds, TypeScript e lint aprovados. Referência técnica do trigger: https://supabase.com/docs/guides/database/postgres/triggers.

## 26/10/2026 — resumo documental na listagem

Cadastros passa a exibir a coluna Documentos: enviados/necessários, barra de progresso e quantidade faltante. São cinco documentos por titular MEI; pequenas empresas usam quatro por sócio mais IPTU e endereço empresarial. O cálculo usa as mesmas categorias do fluxo operacional. Plano ou sócios ainda indefinidos mostram Aguardando plano e sócios, sem total fictício. Contagem de envio não significa aprovação: arquivo rejeitado continua enviado e a revisão permanece na ficha.

A API retorna documentProgress por cadastro: available (required/uploaded/missing), pending_details ou restricted. Consulta somente metadados atuais, vinculados à configuração atual dos sócios, em lote para a página autorizada; não abre arquivos nem gera URLs. Mantém RLS e permissão documental. Reenvios/versões não duplicam contagens, anexos extras não reduzem faltantes. Nenhuma migration necessária.

Aceite: MEI com três categorias atuais mostra 3 de 5 enviados e Faltam 2; pequena empresa com dois sócios exige dez; sem dados não simula total; sem acesso não revela contagem; alteração dos sócios invalida os arquivos correspondentes. Testes unitários e PGlite cobrem esses casos. 53 testes do portal aprovados e 13 dependentes de PostgreSQL nativo ignorados; builds, TypeScript, lint e smoke desktop/celular concluídos.
