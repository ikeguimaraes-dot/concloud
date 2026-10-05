import { assert } from './errors';
export const states = [
  'AWAITING_INFORMATION',
  'UNDER_REVIEW',
  'READY_FOR_PROCESSING',
  'PROCESSING_EXTERNALLY',
  'QUALITY_REVIEW',
  'DELIVERED',
  'CLOSED',
] as const;
export type ClosingState = (typeof states)[number];
export const labels: Record<ClosingState, string> = {
  AWAITING_INFORMATION: 'Aguardando informações',
  UNDER_REVIEW: 'Em conferência',
  READY_FOR_PROCESSING: 'Pronto para processar',
  PROCESSING_EXTERNALLY: 'Em processamento externo',
  QUALITY_REVIEW: 'Revisão de qualidade',
  DELIVERED: 'Entregue',
  CLOSED: 'Encerrado',
};
export type Evidence = {
  pending: number;
  tasksPending: number;
  exportReady: boolean;
  processed: boolean;
  approved: boolean;
  published: boolean;
  dirty: boolean;
  reviewer: boolean;
};
export function transition(from: ClosingState, to: ClosingState, e: Evidence, reason: string) {
  assert(reason.trim().length >= 8, 'Descreva a justificativa (mínimo 8 caracteres).');
  if (
    to === 'UNDER_REVIEW' &&
    [
      'READY_FOR_PROCESSING',
      'PROCESSING_EXTERNALLY',
      'QUALITY_REVIEW',
      'DELIVERED',
      'CLOSED',
    ].includes(from)
  ) {
    assert(e.reviewer, 'Reabertura exige revisor.');
    return;
  }
  assert(states.indexOf(to) === states.indexOf(from) + 1, 'Transição de fechamento não permitida.');
  if (to === 'READY_FOR_PROCESSING')
    assert(
      e.pending === 0 && e.tasksPending === 0,
      'Resolva as pendências e tarefas obrigatórias.',
    );
  if (to === 'PROCESSING_EXTERNALLY')
    assert(e.exportReady && !e.dirty, 'Gere um lote atualizado antes do processamento.');
  if (to === 'QUALITY_REVIEW')
    assert(
      e.processed && !e.dirty,
      'Registre processamento, resultado e protocolo de um lote atualizado.',
    );
  if (to === 'DELIVERED')
    assert(
      e.reviewer && e.approved && e.published && !e.dirty,
      'Exige aprovação do revisor e documentos publicados, sem divergências.',
    );
  if (to === 'CLOSED')
    assert(e.reviewer && !e.dirty, 'Encerramento exige revisor e informações sem divergências.');
}
