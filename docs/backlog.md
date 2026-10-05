# Backlog e limites explícitos

## Integrações futuras (desativadas)

- Domínio API: verificar contrato e layouts oficiais, credenciais, licenciamento e homologação antes do adaptador. Hoje somente ManualAccountingAdapter.
- Pluggy: consentimento, conexão por empresa, webhook assinado, idempotência e conciliação com confirmação humana.
- Focus NFe: contrato fiscal e homologação; emissão real não faz parte da versão inicial.
- Cobrança: escolher provedor; nenhum pagamento é executado.
- IA: fontes, versão/modelo, registro de dados utilizados e aprovação humana. Nunca apuração, pagamento ou alteração autônoma de dados.

## Antes de abrir produção

- Configurar conexões PostgreSQL de migration, runtime e dispatcher no Supabase compartilhado; aplicar migrations exclusivamente em concloud.
- Criar bucket privado dedicado; configurar Auth, e-mail e MFA, bootstrap de administrador e domínio de implantação.
- Homologar Supabase Auth/Storage reais e testar links, upload, convite e MFA. A jornada testada localmente usa perfis sintéticos e adaptador de arquivos de demonstração.
- Executar ensaio de backup/restauração com os provedores e definir retenção/RPO/RTO.
- Testes de carga/paginação para carteira grande. As listas atuais carregam os dados acessíveis da empresa e devem ser paginadas antes de alto volume.
- Definir monitoramento/alertas operacionais e scanner de conteúdo se requerido pela operação.

## Expansão de produto

Entidades AiInsight, IntegrationConnection, ExternalReference, WebhookEvent, SyncRun, ServicePlan e CompanyServiceAgreement estão modeladas; não há telas ou conectores falsos. Sócios e histórico tributário têm integridade no banco; a manutenção detalhada pode ser ampliada conforme a operação. Super admin global, revenda/white label, motor fiscal, escrituração e folha própria permanecem fora de escopo.
