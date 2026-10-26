import { expect, it } from 'vitest';
import { documentProgress } from '../apps/web/src/lib/opening-document-progress';
it('conta os cinco documentos MEI sem duplicar versões ou incluir anexos extras', () => {
  expect(
    documentProgress('mei', 1, [
      'socio-1-identidade',
      'socio-1-identidade',
      'socio-1-titulo',
      'endereco-empresa',
      'iptu',
    ]),
  ).toEqual({ status: 'available', required: 5, uploaded: 3, missing: 2 });
});
it('calcula documentos por sócio e os dois da empresa', () => {
  expect(documentProgress('gestao', 2, ['socio-1-identidade', 'socio-2-identidade'])).toEqual({
    status: 'available',
    required: 10,
    uploaded: 2,
    missing: 8,
  });
  expect(documentProgress('essencial', 1, [])).toEqual({
    status: 'available',
    required: 6,
    uploaded: 0,
    missing: 6,
  });
});
it('não apresenta total fictício quando faltam os dados necessários', () => {
  expect(documentProgress(null, 1, [])).toEqual({ status: 'pending_details' });
  expect(documentProgress('mei', 0, [])).toEqual({ status: 'pending_details' });
});
