# Verificação executada — 05/10/2026

Ambiente: macOS/arm64, Node 26.9.0, PostgreSQL nativo isolado, Redis dedicado em 6387 e Chromium Playwright. Não foram usados dados nem serviços de envio externos nos testes.

| Verificação                                            | Resultado                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Prisma validate/generate                               | Schema válido, client gerado                                 |
| Prisma migrate deploy                                  | 5 migrations aplicadas localmente; reexecução sem pendências |
| Migrations sobre banco com tabela pública preexistente | Passou; tabela preservada e histórico em concloud            |
| TypeScript strict                                      | Passou                                                       |
| ESLint TypeScript/React Hooks                          | Passou, sem avisos                                           |
| Vitest                                                 | 35 testes passaram, nenhum ignorado no ambiente local        |
| Next.js build                                          | Build de produção passou                                     |
| npm audit                                              | 0 vulnerabilidades no lockfile verificado                    |
| Playwright                                             | 3 jornadas passaram em Chromium                              |
| Web /api/health                                        | 200, banco e Redis disponíveis                               |
| Worker /health                                         | 200, zero jobs ativos/aguardando/falhos ao final             |
| Busca por JWT nos arquivos do projeto                  | Nenhum token encontrado; .env fora do Git                    |

## Riscos exercitados

- Duas organizações, múltiplas empresas e cliente sem acesso à outra empresa da mesma organização.
- RLS sob role NOBYPASSRLS, recusa de privilégios, FKs compostas e auditoria append-only.
- Contexto LOCAL sem vazamento, inclusive pool real do Prisma.
- Liquidação parcial, encargos separados, estorno, transferência fora do resultado e concorrência sem excesso de principal.
- Importação CSV duplicada, FITID OFX, datas inválidas, linhas rejeitadas e proteção de CSV contra fórmulas.
- Alocação parcial de conciliação, rejeição de sobrealocação e desfazimento obrigatório antes do estorno.
- Concorrência/reexecução de recorrências e lotes sem duplicação.
- Snapshot imutável, mudança após exportação, divergência e reabertura justificada.
- Documentos internos invisíveis ao cliente, publicação autorizada e download privado.
- Guia publicada, pagamento informado, comprovante e conferência como estados distintos.
- Dinheiro grande exibido sem perda de centavos; data de negócio sem recuar um dia no fuso.

## Jornadas no navegador

1. Escopo do cliente e layout móvel em 390×844, sem rolagem horizontal.
2. Título de R$ 100, liquidação de R$ 30 mantendo R$ 70, upload e atendimento.
3. Nova empresa, convites aceitos por revisor/cliente, solicitação atendida com upload, fechamento, ZIP real gerado pelo worker e retirado, protocolo manual, resultado anexado, revisão por outra pessoa, publicação, entrega, encerramento e download pelo cliente.

Falhas intermediárias foram corrigidas antes da rodada final: associação acessível dos seletores, redirecionamento de download local e permissão estritamente limitada para revisão de origem avançar quando o cliente altera entradas. O teste reproduzível permanece no repositório.

## Não executado / não alegado

Supabase Auth, MFA, envio de confirmação de e-mail e Storage remotos **não foram homologados**. Os testes E2E usam o modo local explicitamente identificado. Nenhuma migration foi aplicada ao banco compartilhado remoto: falta a conexão PostgreSQL de migrations. Não houve processamento real no Domínio, transmissão fiscal, pagamento, integração Pluggy/Focus/IA nem envio de comunicação a terceiros. Restore remoto, carga e escala ainda dependem do ambiente de homologação.

A CI foi escrita para executar os mesmos comandos em PostgreSQL/Redis de containers. Sua execução no GitHub deve ser conferida após o push; não é substituída pela execução local.
