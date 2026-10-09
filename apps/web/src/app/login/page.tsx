export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Cloud, ArrowUpRight, Check } from 'lucide-react';
import { ActionForm } from '@/components/forms';
import { Field } from '@/components/fields';
import { login } from '@/lib/actions';
import { authConfigured, demoEnabled } from '@/lib/auth';
export default function Login() {
  return (
    <div className="login-page">
      <section className="login-story">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Cloud />
          </span>
          concloud.
        </Link>
        <div className="login-copy">
          <span className="eyebrow">MAIS CLAREZA. NOVAS POSSIBILIDADES.</span>
          <h1>
            Sua empresa em dia.
            <br />
            <em>Você um passo à frente.</em>
          </h1>
          <p>
            Contabilidade e gestão financeira conectadas, para você focar no que faz sua empresa
            crescer.
          </p>
          <div className="login-benefits">
            {[
              'Seu financeiro em um só lugar',
              'Documentos seguros e organizados',
              'Uma equipe de verdade ao seu lado',
            ].map((s) => (
              <div key={s}>
                <Check size={18} />
                {s}
              </div>
            ))}
          </div>
        </div>
        <small>Contabilidade digital, com proximidade.</small>
      </section>
      <section className="login-form">
        <span className="eyebrow">BEM-VINDO AO CONCLOUD</span>
        <h2>Vamos cuidar da sua empresa?</h2>
        <p>Acesse seu espaço com seu CPF ou e-mail cadastrado.</p>
        {authConfigured() ? (
          <ActionForm action={login} label="Entrar na plataforma">
            <Field name="identifier" label="CPF ou e-mail" placeholder="000.000.000-00" />
            <Field name="password" label="Senha" type="password" />
          </ActionForm>
        ) : (
          <div className="notice">
            <strong>Ambiente em configuração</strong>
            <p>Configure Supabase Auth, banco e Redis seguindo o README para habilitar o acesso.</p>
          </div>
        )}
        {demoEnabled() && (
          <a className="button button-primary" href="/escritorio">
            Explorar demonstração local <ArrowUpRight size={17} />
          </a>
        )}
        <div className="login-help">
          Recebeu um convite? Abra o link enviado pela equipe para criar seu acesso.
        </div>
      </section>
    </div>
  );
}
