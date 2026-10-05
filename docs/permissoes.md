# Matriz de permissões

| Operação                                 | Admin da organização | Contador atribuído  | Assistente atribuído | Cliente autorizado       |
| ---------------------------------------- | -------------------- | ------------------- | -------------------- | ------------------------ |
| Cadastro de empresa                      | Sim                  | Não                 | Não                  | Não                      |
| Convites e atribuição                    | Sim                  | Não                 | Não                  | Não                      |
| Financeiro / importação / conciliação    | Sim                  | Sim                 | Sim                  | Sim                      |
| Upload de entrada / comprovante          | Sim                  | Sim                 | Sim                  | Sim                      |
| Upload de resultado / guia / protocolo   | Sim                  | Sim                 | Sim                  | Não                      |
| Ver documentos internos                  | Sim                  | Sim                 | Sim                  | Somente próprios uploads |
| Ver documentos publicados                | Sim                  | Sim                 | Sim                  | Sim                      |
| Abrir competência                        | Sim                  | Não                 | Não                  | Não                      |
| Solicitar documentos e operar fechamento | Sim                  | Sim                 | Sim                  | Não                      |
| Registrar processamento                  | Somente responsável  | Somente responsável | Somente responsável  | Não                      |
| Aprovar revisão / reabrir / encerrar     | Somente revisor      | Somente revisor     | Não                  | Não                      |
| Publicar documentos / conferir pagamento | Sim                  | Sim                 | Não                  | Não                      |
| Informar pagamento / atendimento         | Sim                  | Sim                 | Sim                  | Sim                      |

CLIENT_OWNER e CLIENT_MEMBER têm o mesmo conjunto financeiro na v1. A gestão de acesso fica com a administração do escritório. SUPER_ADMIN permanece limitado à organização à qual está vinculado; não existe um usuário com bypass entre todas as organizações. Convites não criam SUPER_ADMIN/ORG_ADMIN. Cadastro público não concede papel.

Papéis internos exigem MFA AAL2. Evite desabilitar REQUIRE_STAFF_MFA fora de testes controlados. IDs da UI não são autoridade; acesso é conferido em cada serviço e reforçado por RLS. Buckets privados não têm políticas diretas para anon/authenticated: acesso é via backend autorizado.
