'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Button } from '@ui/button';
export default function Mfa() {
  const router = useRouter();
  const [factor, setFactor] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function begin() {
    setBusy(true);
    try {
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: factors } = await client.auth.mfa.listFactors();
      const existing = factors?.totp.find((f) => f.status === 'verified');
      if (existing) {
        setFactor(existing.id);
        setMessage('Informe o código do seu aplicativo autenticador.');
        return;
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ConCloud',
      });
      if (error || !data) {
        setMessage('Não foi possível ativar MFA. Confira sua sessão.');
        return;
      }
      setFactor(data.id);
      setSecret(data.totp.secret);
      setMessage('Adicione esta chave ao seu aplicativo autenticador e confirme o código.');
    } catch {
      setMessage('Configure Supabase Auth e entre antes de ativar MFA.');
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    try {
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor, code });
      if (error) setMessage('Código inválido ou expirado.');
      else router.push('/escritorio');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="standalone">
      <span className="eyebrow">SEGURANÇA DA CONTA</span>
      <h1>Autenticação em duas etapas</h1>
      <p>Obrigatória para os perfis internos do escritório. Use um aplicativo autenticador TOTP.</p>
      {!factor ? (
        <Button onClick={begin} disabled={busy}>
          Configurar ou validar MFA
        </Button>
      ) : (
        <div className="action-form">
          {secret && (
            <label>
              Chave do autenticador<code className="mfa-secret">{secret}</code>
            </label>
          )}
          <label>
            Código de seis dígitos
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />
          </label>
          <Button onClick={verify} disabled={busy || code.length !== 6}>
            Validar código
          </Button>
        </div>
      )}
      <p role="status">{message}</p>
      <a href="/escritorio">Voltar à plataforma</a>
    </main>
  );
}
