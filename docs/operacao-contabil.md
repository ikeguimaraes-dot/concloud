# Manual curto da operação contábil

1. Entre com o administrador inicial, valide MFA e cadastre a empresa, CNPJ e regime. Registre o código interno usado no Domínio.
2. Em **Configurações e equipe**, gere convites para cliente, responsável e revisor. Entregue cada link ao e-mail indicado pelo seu canal habitual. A aplicação não dispara convites automaticamente. O destinatário cria/confirma sua identidade Supabase, entra e aceita o link.
3. Conclua os itens de onboarding. Registre mudanças tributárias como nova vigência, sem apagar a anterior.
4. O cliente registra contas e contatos, cadastra contas bancárias e envia documentos. Para extratos, selecione a conta, mapeie o CSV ou envie OFX, confira a prévia/rejeições e confirme. Prefira identificador bancário estável no CSV.
5. Baixe contas total ou parcialmente. Registre juros, multa e desconto separadamente. Confirme alocações de conciliação; uma transação pode se relacionar a várias liquidações. Para corrigir, desfaça a conciliação antes de estornar a liquidação, sempre justificando.
6. Abra **Fechamento mensal** com competência, prazo e pessoas diferentes para responsável/revisor. Solicite documentos e vincule os recebidos. Complete tarefas com comentário de evidência. Passe de aguardando informações para conferência e depois pronto para processar.
7. Solicite o pacote. O worker cria um ZIP imutável, CSVs genéricos, documentos de entrada e manifesto com revisão, versão e SHA-256. Retire o pacote e registre início do processamento externo.
8. Confira e processe manualmente no Domínio. Os CSVs **não são anunciados como layout de importação homologado pelo Domínio**. Não há transmissão ao governo nem apuração de impostos pelo ConCloud.
9. Anexe o resultado real com classificação Resultado, na mesma competência. O responsável registra protocolo e documento de resultado, e encaminha para revisão de qualidade.
10. O revisor designado confere, registra parecer, publica o documento em **Documentos**, entrega e encerra o fechamento. Cliente passa a ter acesso ao resultado publicado.
11. Guias reais: anexe/publique o arquivo e cadastre a obrigação, valor e vencimento em **Impostos**. O cliente pode informar pagamento e anexar comprovante. A equipe registra a conferência; não existe confirmação bancária automática.
12. Alterações em entradas exportadas geram divergência. O revisor reabre com justificativa; a equipe confere e cria um novo lote. Lotes antigos permanecem preservados.

O financeiro exibido é gerencial provisório por competência. Não é demonstração contábil oficial. Guias, relatórios e protocolos são produzidos/revisados pela equipe, não inventados pela plataforma.
