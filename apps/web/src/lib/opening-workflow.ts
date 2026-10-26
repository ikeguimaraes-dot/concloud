export const workflows = {
  TRIAGE: [
    [
      'Recepção e triagem',
      'Rota pendente de definição: conferir plano e UF antes de iniciar o fluxo operacional',
    ],
  ],
  JUCESP: [
    [
      'Recepção e triagem',
      'Natureza EI/LTDA, nomes, objeto/CNAEs, endereço/IPTU, sócios, capital e regime conferidos',
    ],
    ['Análise do negócio', 'Atividades, regime, licenças e rota SP/JUCESP validados'],
    ['Preenchimento da viabilidade', 'Protocolo Redesim registrado'],
    ['Análise de viabilidade', 'Viabilidade aprovada pelo órgão'],
    ['Preenchimento DBE', 'Recibo/protocolo DBE registrado'],
    ['Análise DBE', 'DBE deferido pela Receita'],
    ['Preenchimento VRE', 'Protocolo VRE registrado e DARE encaminhado ao financeiro'],
    ['Análise VRE', 'VRE aprovado pela Junta'],
    ['Confecção do contrato social', 'Contrato conferido com viabilidade, DBE e VRE'],
    [
      'Conferência pré-assinatura',
      'Nome, endereço, CNAEs, capital, quotas, administração e qualificação conferidos; parecer apto',
    ],
    ['Assinatura e pagamento DARE', 'Assinaturas conferidas e pagamento do DARE comprovado'],
    ['Protocolo do contrato na Junta', 'Protocolo e versão assinada apresentados à Junta'],
    ['Análise do contrato social', 'Contrato deferido pela Junta'],
    [
      'CNPJ — emissão e conferência',
      'QSA, endereço, CNAEs e capital conferidos com o contrato registrado',
    ],
    [
      'Inscrições e enquadramento',
      'Inscrições, licenças e opção tributária conferidas; justificar itens não aplicáveis',
    ],
    [
      'Envio ao cliente e encerramento',
      'Documentos finais entregues; canal, data e destinatário registrados',
    ],
  ],
  MEI: [
    ['Recepção e triagem', 'Titular e atividade do empreendimento conferidos'],
    [
      'Validação de dados e documentos',
      'Os cinco documentos do titular e empreendimento foram validados',
    ],
    ['Análise de enquadramento', 'Enquadramento e requisitos MEI confirmados pela equipe'],
    ['Formalização', 'Formalização realizada e comprovante registrado'],
    ['Conferência CNPJ/CCMEI', 'CNPJ e CCMEI conferidos com os dados do titular e atividade'],
    [
      'Entrega e orientações',
      'CNPJ/CCMEI e orientações entregues; canal, data e destinatário registrados',
    ],
    ['Encerrado', 'Entrega conferida e pendências encerradas'],
  ],
} as const;
export const returns: Record<number, number> = { 4: 2, 6: 5, 8: 7, 10: 9, 13: 10 };
export function requiredDocumentKinds(count: number, mei: boolean) {
  return [
    ...Array.from({ length: count }, (_, i) =>
      ['identidade', 'titulo', 'estado-civil', 'endereco-socio'].map((k) => `socio-${i + 1}-${k}`),
    ).flat(),
    ...(mei ? [] : ['iptu']),
    'endereco-empresa',
  ];
}
export function allowedTransition(workflow: keyof typeof workflows, from: number, to: number) {
  return (
    (to === from + 1 && to <= workflows[workflow].length) ||
    (workflow === 'JUCESP' ? returns[from] === to : from > 1 && to === from - 1)
  );
}
