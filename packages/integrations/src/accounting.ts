import { assert } from '../../domain/src/errors';
import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { csv } from '../../domain/src/imports';
export type Snapshot = {
  company: { name: string; cnpj: string; accountingSystemId: string | null };
  competence: string;
  revision: number;
  titles: {
    description: string;
    kind: string;
    amount: string;
    competence: string;
    issueDate: string;
  }[];
  documents: { id: string; version: number; objectKey: string; checksum: string; title: string }[];
  tables?: Record<string, string[][]>;
};
export interface AccountingSystemAdapter {
  readonly mode: 'manual';
  buildPackage(
    snapshot: Snapshot,
    version: number,
    readDocument: (key: string) => Promise<Uint8Array>,
  ): Promise<{ bytes: Uint8Array; manifest: Manifest }>;
}
export type Manifest = {
  format: 'ConCloud generic export';
  version: number;
  competence: string;
  revision: number;
  files: { path: string; sha256: string; bytes: number; rows?: number }[];
};
export class ManualAccountingAdapter implements AccountingSystemAdapter {
  readonly mode = 'manual' as const;
  async buildPackage(
    snapshot: Snapshot,
    version: number,
    readDocument: (key: string) => Promise<Uint8Array>,
  ) {
    let totalBytes = 0;
    const zip = new JSZip();
    const manifest: Manifest = {
      format: 'ConCloud generic export',
      version,
      competence: snapshot.competence,
      revision: snapshot.revision,
      files: [],
    };
    function add(path: string, bytes: Uint8Array, rows?: number) {
      totalBytes += bytes.length;
      assert(
        totalBytes <= 100 * 1024 * 1024,
        'Pacote excede 100 MB. Separe os documentos antes de tentar novamente.',
      );
      zip.file(path, bytes, { date: new Date('2000-01-01T00:00:00Z') });
      manifest.files.push({
        path,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
        ...(rows === undefined ? {} : { rows }),
      });
    }
    add(
      'financeiro.csv',
      Buffer.from(
        csv([
          ['descricao', 'tipo', 'valor', 'competencia', 'emissao'],
          ...snapshot.titles.map((t) => [
            t.description,
            t.kind,
            t.amount,
            t.competence,
            t.issueDate,
          ]),
        ]),
      ),
      snapshot.titles.length,
    );
    for (const [name, rows] of Object.entries(snapshot.tables ?? {}))
      add(`${name}.csv`, Buffer.from(csv(rows)), Math.max(0, rows.length - 1));
    add('empresa.json', Buffer.from(JSON.stringify(snapshot.company, null, 2)));
    for (const doc of snapshot.documents) {
      const bytes = await readDocument(doc.objectKey);
      if (createHash('sha256').update(bytes).digest('hex') !== doc.checksum)
        throw new Error('Checksum de documento divergente.');
      add(`documentos/${doc.id}-v${doc.version}`, bytes);
    }
    zip.file('manifesto.json', JSON.stringify(manifest, null, 2), {
      date: new Date('2000-01-01T00:00:00Z'),
    });
    zip.file(
      'LEIA-ME.txt',
      'Exportação genérica ConCloud. Não é um layout certificado de importação do Domínio. Valores decimais em reais; datas ISO; CSV UTF-8 separado por ponto e vírgula. Conferir e processar manualmente.',
      { date: new Date('2000-01-01T00:00:00Z') },
    );
    return {
      bytes: await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
      manifest,
    };
  }
}
export const futureIntegrations = {
  focus: { enabled: false, reason: 'Emissão fiscal fora desta versão' },
  pluggy: { enabled: false, reason: 'Conexão bancária não configurada' },
  dominio: { enabled: false, reason: 'Processamento manual' },
  billing: { enabled: false, reason: 'Provedor não configurado' },
  ai: { enabled: false, reason: 'IA opcional, não configurada' },
};
