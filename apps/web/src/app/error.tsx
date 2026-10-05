'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>Não foi possível abrir este espaço</h1>
      <p>Confira sua sessão, a conexão com o banco e a autenticação em duas etapas.</p>
      <button className="button button-primary" onClick={reset}>
        Tentar novamente
      </button>{' '}
      <a href="/mfa">Configurar MFA</a> · <a href="/login">Entrar novamente</a>
    </main>
  );
}
