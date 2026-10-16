'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileUp,
  Info,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

const personalDocuments = [
  {
    id: 'identidade',
    label: 'CNH ou RG',
    hint: 'Frente e verso, legível e dentro da validade.',
  },
  { id: 'titulo', label: 'Título de Eleitor', hint: 'Envie uma foto ou arquivo digital.' },
  {
    id: 'estado-civil',
    label: 'Comprovante de estado civil',
    hint: 'Certidão de nascimento, casamento, divórcio ou óbito.',
  },
  {
    id: 'endereco-socio',
    label: 'Comprovante de endereço residencial',
    hint: 'Preferencialmente emitido nos últimos 90 dias.',
  },
];
const companyDocuments = [
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
type Partner = { name: string; cpf: string; percentage: number };
const maxFileBytes = 4 * 1024 * 1024;

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      response.status === 413 || body.startsWith('Request Ent')
        ? 'Um dos arquivos é muito grande. Envie arquivos de até 4 MB cada.'
        : 'O servidor não conseguiu processar o envio. Tente novamente.',
    );
  }
}

export default function OpeningDocuments() {
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [partners, setPartners] = useState<Partner[]>([
    { name: 'Sócio responsável', cpf: '', percentage: 100 },
  ]);
  const [legacyDocuments, setLegacyDocuments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [payment, setPayment] = useState<'checking' | 'paid' | 'pending' | 'invalid'>('checking');
  const cadastro =
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('cadastro') ?? '');
  const documents = useMemo(
    () => [
      ...partners.flatMap((partner, index) =>
        personalDocuments.map((document) => ({
          ...document,
          id: legacyDocuments ? document.id : `socio-${index + 1}-${document.id}`,
          label: `${document.label} — ${partner.name}`,
        })),
      ),
      ...companyDocuments,
    ],
    [legacyDocuments, partners],
  );
  const complete = useMemo(() => {
    const ready = new Set(uploaded);
    documents.forEach((document) => {
      if (files[document.id]) ready.add(document.id);
    });
    return documents.filter((document) => ready.has(document.id)).length;
  }, [documents, files, uploaded]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('cadastro') ?? '';
    const endpoint = id
      ? `/api/opening-leads/${encodeURIComponent(id)}/payment-status`
      : '/api/opening-leads/invalid/payment-status';
    fetch(endpoint, { cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json()) as { paid?: boolean };
        const next = response.ok && result.paid ? 'paid' : response.ok ? 'pending' : 'invalid';
        setPayment(next);
        if (next === 'paid' && id) {
          fetch(`/api/opening-leads/${encodeURIComponent(id)}/documents`, { cache: 'no-store' })
            .then(async (documentsResponse) => {
              const documentsResult = (await documentsResponse.json()) as {
                uploaded?: string[];
                submitted?: boolean;
                partners?: Partner[];
                legacy?: boolean;
              };
              if (documentsResponse.ok) {
                setUploaded(documentsResult.uploaded ?? []);
                setSubmitted(Boolean(documentsResult.submitted));
                setPartners(
                  documentsResult.partners?.length
                    ? documentsResult.partners
                    : [{ name: 'Sócio responsável', cpf: '', percentage: 100 }],
                );
                setLegacyDocuments(documentsResult.legacy ?? true);
              }
            })
            .catch(() => undefined);
        }
      })
      .catch(() => setPayment('invalid'));
  }, []);

  async function finalizeDocuments() {
    if (!cadastro || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const oversized = Object.values(files).find((file) => file && file.size > maxFileBytes);
      if (oversized) throw new Error(`${oversized.name}: envie um arquivo de até 4 MB.`);
      let uploadedNow = uploaded;
      for (const document of documents) {
        const file = files[document.id];
        if (!file) continue;
        const form = new FormData();
        form.append(document.id, file);
        const uploadResponse = await fetch(
          `/api/opening-leads/${encodeURIComponent(cadastro)}/documents`,
          { method: 'POST', body: form },
        );
        const uploadResult = await responseJson<{
          error?: string;
          uploaded?: string[];
        }>(uploadResponse);
        if (uploadResult.uploaded) {
          uploadedNow = uploadResult.uploaded;
          setUploaded(uploadResult.uploaded);
        }
        if (!uploadResponse.ok)
          throw new Error(uploadResult.error ?? `Não foi possível enviar ${document.label}.`);
      }
      const form = new FormData();
      form.append('finalize', 'true');
      const response = await fetch(`/api/opening-leads/${encodeURIComponent(cadastro)}/documents`, {
        method: 'POST',
        body: form,
      });
      const result = await responseJson<{
        error?: string;
        uploaded?: string[];
        submitted?: boolean;
      }>(response);
      if (result.uploaded) setUploaded(result.uploaded);
      else setUploaded(uploadedNow);
      if (!response.ok) throw new Error(result.error ?? 'Não foi possível enviar os documentos.');
      setSubmitted(Boolean(result.submitted));
      setFiles({});
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Não foi possível enviar os documentos.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (payment !== 'paid')
    return (
      <main className="opening-page checkout-page">
        <header className="opening-header">
          <Link className="marketing-brand" href="/">
            <BrandLogo />
          </Link>
          <span>
            <ShieldCheck /> Ambiente seguro
          </span>
        </header>
        <div className="opening-shell checkout-shell">
          <div className="step-icon">
            {payment === 'checking' ? <Loader2 className="spin" /> : <Clock3 />}
          </div>
          <span className="marketing-kicker">CONFIRMAÇÃO DO PAGAMENTO</span>
          <h1>
            {payment === 'checking'
              ? 'Verificando seu pagamento'
              : payment === 'pending'
                ? 'Pagamento ainda não confirmado'
                : 'Não encontramos este cadastro'}
          </h1>
          <p>
            {payment === 'pending'
              ? 'Aguarde a aprovação do PagBank. Assim que recebermos a confirmação, seus documentos serão liberados.'
              : payment === 'invalid'
                ? 'Volte ao fluxo de abertura e confira o link utilizado.'
                : 'Isso pode levar alguns segundos.'}
          </p>
          {payment === 'pending' && (
            <button
              className="marketing-cta payment-cta full"
              type="button"
              onClick={() => window.location.reload()}
            >
              Verificar novamente
            </button>
          )}
          {payment === 'invalid' && (
            <Link className="marketing-cta full" href="/abrir-empresa">
              Voltar para abertura
            </Link>
          )}
          {payment === 'pending' && cadastro && (
            <Link
              className="marketing-secondary full"
              href={`/pagamento?cadastro=${encodeURIComponent(cadastro)}`}
            >
              Voltar ao pagamento
            </Link>
          )}
        </div>
      </main>
    );
  if (submitted)
    return (
      <main className="opening-page checkout-page">
        <header className="opening-header">
          <Link className="marketing-brand" href="/">
            <BrandLogo />
          </Link>
          <span>
            <ShieldCheck /> Ambiente seguro
          </span>
        </header>
        <div className="opening-shell checkout-shell">
          <div className="step-icon">
            <FileCheck2 />
          </div>
          <span className="marketing-kicker">DOCUMENTOS RECEBIDOS</span>
          <h1>Envio finalizado com sucesso</h1>
          <p>
            Recebemos seus documentos. Nossa equipe vai analisá-los e acompanhar os próximos passos
            da abertura da sua empresa.
          </p>
          <Link className="marketing-cta full" href="/escritorio">
            Acessar sua empresa
          </Link>
        </div>
      </main>
    );
  return (
    <main className="documents-page">
      <header className="opening-header">
        <Link className="marketing-brand" href="/">
          <BrandLogo />
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
                <small>Formatos aceitos: PDF, JPG ou PNG · até 4 MB cada</small>
              </span>
            </div>
            <em>OBRIGATÓRIO</em>
          </div>
          <div className="document-list">
            {documents.map((document) => {
              const isReady = Boolean(files[document.id]) || uploaded.includes(document.id);
              return (
                <label
                  className={isReady ? 'document-row complete' : 'document-row'}
                  key={document.id}
                >
                  <span className="document-status">{isReady ? <Check /> : <FileUp />}</span>
                  <span>
                    <b>{document.label}</b>
                    <small>
                      {files[document.id]?.name ??
                        (uploaded.includes(document.id) ? 'Enviado anteriormente' : document.hint)}
                    </small>
                  </span>
                  <strong>{isReady ? 'Trocar' : 'Enviar'}</strong>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={submitting}
                    onChange={(event) => {
                      setSubmitError('');
                      const file = event.target.files?.[0];
                      if (file && file.size > maxFileBytes) {
                        setSubmitError(`${file.name}: envie um arquivo de até 4 MB.`);
                        event.target.value = '';
                        setFiles((current) => ({ ...current, [document.id]: undefined }));
                        return;
                      }
                      setFiles((current) => ({
                        ...current,
                        [document.id]: file,
                      }));
                    }}
                  />
                </label>
              );
            })}
          </div>
          {submitError && <p className="form-error">{submitError}</p>}
          <button
            className="marketing-cta full"
            type="button"
            disabled={complete !== documents.length || submitting}
            onClick={finalizeDocuments}
          >
            {submitting ? (
              <>
                <Loader2 className="spin" /> Enviando documentos...
              </>
            ) : (
              <>
                Finalizar envio <Check />
              </>
            )}
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
              <b>{partners.length > 1 ? `${partners.length} sócios cadastrados` : 'Sócio único'}</b>
              <p>A documentação pessoal está separada para cada sócio informado no cadastro.</p>
              {partners.map((partner) => (
                <small className="registered-partner" key={partner.cpf}>
                  {partner.name} · {partner.percentage}%
                </small>
              ))}
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
