import Link from 'next/link';
import { Clock3, Cloud, ShieldCheck } from 'lucide-react';

export default async function PaymentReturn({
  searchParams,
}: {
  searchParams: Promise<{ cadastro?: string }>;
}) {
  const { cadastro = '' } = await searchParams;
  return (
    <main className="opening-page checkout-page">
      <header className="opening-header">
        <Link className="marketing-brand" href="/">
          <span>
            <Cloud />
          </span>
          ConCloud<i>.</i>
        </Link>
        <span>Retorno do pagamento</span>
      </header>
      <div className="opening-shell checkout-shell">
        <div className="step-icon">
          <Clock3 />
        </div>
        <span className="marketing-kicker">CONFIRMAÇÃO SEGURA</span>
        <h1>Estamos confirmando seu pagamento</h1>
        <p>
          O PagBank enviará a confirmação diretamente para a ConCloud. Isso costuma levar poucos
          segundos.
        </p>
        <Link
          className="marketing-cta payment-cta full"
          href={`/documentos-abertura?cadastro=${encodeURIComponent(cadastro)}`}
        >
          Verificar pagamento
        </Link>
        <div className="payment-trust">
          <ShieldCheck /> Os documentos serão liberados automaticamente após a aprovação.
        </div>
      </div>
    </main>
  );
}
