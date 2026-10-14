'use client';

import { useState } from 'react';
import { ArrowRight, BadgeCheck, Loader2 } from 'lucide-react';

export function CheckoutButton({
  cadastro,
  testPaymentEnabled,
}: {
  cadastro: string;
  testPaymentEnabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkout() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/pagbank/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cadastro }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        redirect?: string;
        error?: string;
      };
      const destination = result.checkoutUrl ?? result.redirect;
      if (!response.ok || !destination) throw new Error(result.error);
      window.location.assign(destination);
    } catch {
      setLoading(false);
      setError('Não foi possível abrir o checkout. Tente novamente em instantes.');
    }
  }

  async function confirmTestPayment() {
    setTestLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/opening-leads/${encodeURIComponent(cadastro)}/test-payment`,
        { method: 'POST' },
      );
      const result = (await response.json()) as { redirect?: string; error?: string };
      if (!response.ok || !result.redirect)
        throw new Error(result.error || 'Não foi possível confirmar o pagamento de teste.');
      window.location.assign(result.redirect);
    } catch (error) {
      setTestLoading(false);
      setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar o pagamento de teste.',
      );
    }
  }

  return (
    <>
      <div className={`checkout-actions${testPaymentEnabled ? ' with-test' : ''}`}>
        <button
          className="marketing-cta payment-cta full"
          type="button"
          disabled={loading || testLoading || !cadastro}
          onClick={checkout}
        >
          {loading ? <Loader2 className="spin" /> : 'Pagar com PagBank'} <ArrowRight />
        </button>
        {testPaymentEnabled && (
          <button
            className="marketing-cta test-payment-cta full"
            type="button"
            disabled={loading || testLoading}
            onClick={confirmTestPayment}
          >
            {testLoading ? <Loader2 className="spin" /> : <BadgeCheck />} Marcar como pago
          </button>
        )}
      </div>
      {testPaymentEnabled && (
        <small className="test-payment-note">Atalho temporário de homologação — sem cobrança.</small>
      )}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
