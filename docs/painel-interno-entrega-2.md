# Entrega 2 — documentação e operação

Implementação iniciada por autorização do usuário em 26/10/2026. Login continua somente com e-mail e senha.

## Decisões operacionais desta versão

- O funil deriva dos fatos persistidos: draft, cadastro concluído, checkout, pagamento confirmado e processo encaminhado. Não permite confirmar pagamento arrastando um card.
- Encaminhamento manual, idempotente por lead, exige cadastro concluído, pagamento confirmado e responsável. Nenhum processo é criado automaticamente no rollout ou pelo webhook. Isso adota provisoriamente a proposta do manual; a consulta ao responsável sobre triagem anterior ao pagamento continua pendente.
- O operador escolhe MEI ou SP/JUCESP ao encaminhar. A API confere plano e UF. A rota JUCESP deve ser confirmada na triagem (EI/LTDA e aplicabilidade); rotas especiais ficam fora dessa esteira.
- Fluxos versão 1: 16 etapas JUCESP e 7 MEI, com retorno documentado. Não há relógio de SLA nem cálculo de prazo legal nesta entrega.
- Operadores com acesso a documentos dos cadastros atribuídos podem revisar e operar suas etapas. Não recebem administração de equipe por isso. Vitória Mariano foi cadastrada em 26/10/2026 após confirmação do endereço `vitoria.mariano@oscpaulistana.com.br`. Perfil ASSISTANT ativo, documentos dos cadastros atribuídos, sem readAll/canAssign/admin. Login real validado e sessão de verificação encerrada. Credenciais entregues somente em arquivo local privado, fora do Git. Nenhum cadastro existente foi atribuído automaticamente.

## Implementado

Versões imutáveis capturadas no upload, mantendo object keys anteriores; backfill dos arquivos existentes como recebidos, sem aprovação automática. A revisão é append-only e pertence à versão atual. Rejeição exige motivo visível no portal. Reenvio recebe nova revisão. Mudança dos sócios invalida a correspondência da versão e bloqueia aprovação/avanço até novo envio. O snapshot evita atribuir silenciosamente um arquivo a outro sócio após reordenação.

Ficha permite consultar histórico de versões/revisões e baixar versões antigas mediante autorização e auditoria. Links temporários de 60 segundos; nenhum bucket público.

Funil paginado com etapas derivadas, quadro operacional com rolagem contida, navegação mobile, escolha de fluxo e histórico. Arrastar abre a mesma confirmação usada pelo botão; card só muda após sucesso da API. Transições verificam versão otimista, ordem/retorno permitido e checklist declarado pela equipe. Alterações da mesma etapa também ficam no histórico.

Documentos atuais aprovados são exigidos na saída da triagem JUCESP e na saída da validação MEI. Cinco documentos para MEI, sem IPTU. Cada sócio de pequena empresa tem quatro documentos pessoais, além de IPTU e endereço empresarial.

Protocolo obrigatório nas etapas JUCESP 3, 5, 7 e 12; retorno de análise externa exige referência/protocolo e motivo. Etapa 11 exige DARE e contrato assinado anexados. Conferência do CNPJ valida formato/dígitos com o validador existente, sem declarar situação cadastral externa. CNPJ/CCMEI e comprovante de entrega são exigidos nos respectivos passos. Um contrato assinado anterior a um retorno não libera novo protocolo.

Comprovantes internos PDF/PNG/JPG, até 2 MB, upload privado e downloads auditados. Tarefas persistidas com responsável do cadastro, prazo interno opcional, conclusão e versão; impedem encerramento enquanto abertas. O vencimento informado é operacional, sem interpretação legal.

## Critérios e evidências de verificação

- Entrada bloqueada sem pagamento; reenvio do encaminhamento não duplica processo.
- MEI e JUCESP separados; avanço não pula etapas e retornos 4→2, 6→5, 8→7, 10→9, 13→10 preservados.
- Documento substituído não herda aprovação; revisão rejeitada aparece na consulta do próprio cliente e não em outro usuário.
- Cadastro/documentos fora de escopo não aparecem; eventos e versões não permitem alteração pelo runtime.
- Tarefas e transições rejeitam versões antigas; travas da etapa 11 ensaiadas em banco descartável.
- Testes PGlite executam a cadeia completa e role sem bypass. Smoke desktop/celular usa somente fixtures interceptadas localmente: funil, quadro, erro de bloqueio sem movimento e confirmação de transição.
- Builds e TypeScript dos dois projetos; lint do portal. Nenhum documento real foi aberto e nenhum processo real foi movimentado na homologação.

## Publicação e limites

Migrations canônicas apenas no portal: `20261026204842_opening_document_reviews` e `20261026205102_opening_operations`. Aplicar antes dos consumidores. Preservar schema aditivo em rollback; não apagar versões, histórico ou arquivos. Versões não registradas antes do rollout não podem ser reconstruídas automaticamente.

Limites: listas de processos 50 por página, funil 50, seleção de encaminhamento 100 cadastros pagos recentes; histórico/tarefas/comprovantes e versões exibem até 100 registros. Não são métricas globais. Gestão visual de novos funcionários, solicitações documentais adicionais além de correções, filtros avançados, catálogo configurável de regras, revisão por pessoa diferente e pacotes de entrega vinculados à Company permanecem evoluções. Formalização e conferências em órgãos são manuais. Não há envio automático de mensagens.

Advisors prévios: seis funções legadas ConCloud sem search_path fixo; nenhuma criada por esta entrega. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable. As novas funções definem search_path e ficam fora da Data API.

Contrato: `docs/internal-api.openapi.yaml`, versão 1.1.0. Autoridade de regras: `apps/web/src/lib/opening-workflow.ts` e `internal-operations.ts`. APIs de documentos do cliente incluem reviews com motivo público; observações de processo permanecem internas.

## Registro de validação — 26/10/2026

Migrations aplicadas e conferidas no projeto `peuqfdgkxkiaszrvpgmq`: 4 cadastros e 12 documentos preservados, 12 versões iniciais, zero aprovações fabricadas e zero processos criados automaticamente. A política de processos inclui `opening_access` explicitamente. Advisors após a alteração mantêm somente os seis avisos legados já encontrados antes.

43 testes aprovados, 13 dependentes de PostgreSQL nativo ignorados; a suite PGlite roda efetivamente. Builds e TypeScript dos dois repositórios aprovados. Smoke de navegador cobre desktop e celular com dados sintéticos locais, sem movimentação de clientes reais.
