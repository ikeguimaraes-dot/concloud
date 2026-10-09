import Link from 'next/link';
import { ArrowRight, Check, Cloud, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';

const plans: Record<string, { name: string; price: string }> = {
  essencial: { name: 'Essencial', price: 'R$ 99/mês' },
  gestao: { name: 'Gestão', price: 'R$ 149/mês' },
  proximo: { name: 'Próximo', price: 'R$ 199/mês' },
};

export default async function Payment({
  searchParams,
}: {
  searchParams: Promise<{ cadastro?: string; plano?: string }>;
}) {
  const { cadastro = '', plano = 'essencial' } = await searchParams;
  const selected = plans[plano] ?? plans.essencial;
  const checkoutUrl = process.env.NEXT_PUBLIC_PAGSEGURO_CHECKOUT_URL;
  const returnUrl = `/documentos-abertura?cadastro=${encodeURIComponent(cadastro)}`;

  return (
    <main className="opening-page checkout-page">
      <header className="opening-header">
        <Link className="marketing-brand" href="/">
          <span>
            <Cloud />
          </span>
          ConCloud<i>.</i>
        </Link>
        <span>Checkout seguro</span>
      </header>
      <div className="opening-shell checkout-shell">
        <div className="step-icon">
          <CreditCard />
        </div>
        <span className="marketing-kicker">PAGAMENTO</span>
        <h1>Você está a um passo de começar</h1>
        <p>Confirme seu plano no ambiente protegido do PagSeguro.</p>
        <div className="checkout-plan">
          <div>
            <small>PLANO SELECIONADO</small>
            <b>{selected.name}</b>
            <span>Contabilidade digital + acesso ConCloud</span>
          </div>
          <strong>{selected.price}</strong>
        </div>
        <div className="checkout-benefits">
          <span>
            <Check /> Cadastro salvo com sucesso
          </span>
          <span>
            <Check /> Checkout criptografado
          </span>
          <span>
            <Check /> Documentos enviados somente após o pagamento
          </span>
        </div>
        {checkoutUrl ? (
          <a className="marketing-cta payment-cta full" href={checkoutUrl}>
            Pagar com PagSeguro <ArrowRight />
          </a>
        ) : (
          <Link className="marketing-cta payment-cta full" href={returnUrl}>
            Continuar para o ambiente de pagamento <ArrowRight />
          </Link>
        )}
        {!checkoutUrl && (
          <p className="integration-note">
            Ambiente de demonstração: defina <code>NEXT_PUBLIC_PAGSEGURO_CHECKOUT_URL</code> para
            conectar o checkout real. O retorno deve apontar para <b>{returnUrl}</b>.
          </p>
        )}
        <div className="payment-trust">
          <ShieldCheck /> Pagamento processado pelo PagSeguro <span>·</span> <LockKeyhole /> A
          ConCloud não armazena dados do cartão
        </div>
      </div>
    </main>
  );
}
