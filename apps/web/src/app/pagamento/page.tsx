import Link from 'next/link';
import { Check, CreditCard, LockKeyhole, ShieldCheck } from 'lucide-react';
import { CheckoutButton } from './checkout-button';
import { BrandLogo } from '@/components/brand-logo';

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
  const testPaymentEnabled =
    !!cadastro &&
    (process.env.PAGBANK_ENV === 'sandbox' || cadastro === process.env.PAYMENT_TEST_LEAD_ID);

  return (
    <main className="opening-page checkout-page">
      <header className="opening-header">
        <Link className="marketing-brand" href="/">
          <BrandLogo />
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
        <CheckoutButton cadastro={cadastro} testPaymentEnabled={testPaymentEnabled} />
        <div className="payment-trust">
          <ShieldCheck /> Pagamento processado pelo PagSeguro <span>·</span> <LockKeyhole /> A
          ConCloud não armazena dados do cartão
        </div>
      </div>
    </main>
  );
}
