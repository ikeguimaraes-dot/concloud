'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  Cloud,
  FileCheck2,
  FileUp,
  Info,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';

const documents = [
  {
    id: 'identidade',
    label: 'CNH ou RG do sócio',
    hint: 'Frente e verso, legível e dentro da validade.',
  },
  { id: 'titulo', label: 'Título de Eleitor do sócio', hint: 'Envie uma foto ou arquivo digital.' },
  {
    id: 'estado-civil',
    label: 'Comprovante de estado civil',
    hint: 'Certidão de nascimento, casamento, divórcio ou óbito.',
  },
  {
    id: 'endereco-socio',
    label: 'Comprovante de endereço residencial do sócio',
    hint: 'Preferencialmente emitido nos últimos 90 dias.',
  },
  {
    id: 'iptu',
    label: 'Capa do IPTU do imóvel do empreendimento',
    hint: 'Documento com a identificação do imóvel.',
  },
  {
    id: 'endereco-empresa',
    label: 'Comprovante de endereço do empreendimento',
    hint: 'Conta ou documento atual do imóvel.',
  },
];

export default function OpeningDocuments() {
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const complete = useMemo(
    () => documents.filter((document) => files[document.id]).length,
    [files],
  );
  return (
    <main className="documents-page">
      <header className="opening-header">
        <Link className="marketing-brand" href="/">
          <span>
            <Cloud />
          </span>
          ConCloud<i>.</i>
        </Link>
        <span>
          <ShieldCheck /> Ambiente seguro
        </span>
      </header>
      <div className="documents-hero">
        <span className="marketing-kicker">ABERTURA DE CNPJ</span>
        <h1>Agora vamos reunir seus documentos</h1>
        <p>Envie cada item com calma. Você pode acompanhar o que já está pronto.</p>
        <div className="document-progress">
          <span>
            <b>{complete}</b> de {documents.length} documentos enviados
          </span>
          <i>
            <b style={{ width: `${(complete / documents.length) * 100}%` }} />
          </i>
        </div>
      </div>
      <div className="documents-layout">
        <section className="upload-card">
          <div className="upload-heading">
            <div>
              <FileCheck2 />
              <span>
                <b>Documentos necessários</b>
                <small>Formatos aceitos: PDF, JPG ou PNG</small>
              </span>
            </div>
            <em>OBRIGATÓRIO</em>
          </div>
          <div className="document-list">
            {documents.map((document) => (
              <label
                className={files[document.id] ? 'document-row complete' : 'document-row'}
                key={document.id}
              >
                <span className="document-status">
                  {files[document.id] ? <Check /> : <FileUp />}
                </span>
                <span>
                  <b>{document.label}</b>
                  <small>{files[document.id]?.name ?? document.hint}</small>
                </span>
                <strong>{files[document.id] ? 'Trocar' : 'Enviar'}</strong>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) =>
                    setFiles((current) => ({ ...current, [document.id]: event.target.files?.[0] }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="marketing-cta full"
            type="button"
            disabled={complete !== documents.length}
          >
            Finalizar envio <Check />
          </button>
          <p className="upload-disclaimer">
            <ShieldCheck /> Seus arquivos serão vinculados ao seu cadastro e tratados apenas para a
            abertura do CNPJ.
          </p>
        </section>
        <aside className="opening-info">
          <div className="partner-note">
            <Users />
            <div>
              <b>Mais de um sócio?</b>
              <p>Adicione a documentação individual de cada sócio.</p>
              <button type="button">
                <Plus /> Adicionar outro sócio
              </button>
            </div>
          </div>
          <div className="info-card">
            <div>
              <Info />
              <b>Informações necessárias</b>
            </div>
            <p>Deixe estas respostas preparadas. A equipe irá confirmá-las durante o processo:</p>
            <ul>
              <li>Atividade do empreendimento</li>
              <li>Quem serão os sócios</li>
              <li>Capital social e percentual de participação</li>
              <li>Regime de tributação: Simples Nacional</li>
            </ul>
          </div>
          <details>
            <summary>
              Posso enviar depois? <ChevronDown />
            </summary>
            <p>Sim. Seu progresso fica vinculado ao cadastro para você continuar depois.</p>
          </details>
        </aside>
      </div>
    </main>
  );
}
