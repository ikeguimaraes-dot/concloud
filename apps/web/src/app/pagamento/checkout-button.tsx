'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export function CheckoutButton({ cadastro }: { cadastro: string }) {
  const [loading, setLoading] = useState(false);
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

  return (
    <>
      <button
        className="marketing-cta payment-cta full"
        type="button"
        disabled={loading || !cadastro}
        onClick={checkout}
      >
        {loading ? <Loader2 className="spin" /> : 'Pagar com PagBank'} <ArrowRight />
      </button>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
