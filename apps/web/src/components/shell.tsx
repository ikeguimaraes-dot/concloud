import Link from 'next/link';
import {
  Cloud,
  LayoutDashboard,
  Building2,
  Wallet,
  Landmark,
  Files,
  CalendarCheck,
  ReceiptText,
  MessagesSquare,
  Settings,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { logout, demoPersona } from '@/lib/actions';
import { demoEnabled } from '@/lib/auth';
const nav = [
  ['', 'Visão geral', LayoutDashboard],
  ['empresa', 'Minha empresa', Building2],
  ['financeiro', 'Financeiro', Wallet],
  ['bancos', 'Bancos e conciliação', Landmark],
  ['documentos', 'Documentos', Files],
  ['impostos', 'Impostos e obrigações', ReceiptText],
  ['fechamento', 'Fechamento mensal', CalendarCheck],
  ['atendimento', 'Atendimento', MessagesSquare],
  ['equipe', 'Configurações e equipe', Settings],
] as const;
export function Shell({
  children,
  companyId,
  companyName,
  section = '',
  email,
  staff = false,
}: {
  children: ReactNode;
  companyId?: string;
  companyName?: string;
  section?: string;
  email: string;
  staff?: boolean;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/escritorio">
          <span className="brand-mark">
            <Cloud size={25} />
          </span>
          concloud<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          {staff ? 'AMBIENTE DO ESCRITÓRIO' : 'PORTAL DO CLIENTE'}
        </div>
        <Link href="/escritorio" className="company-switch">
          <span className="company-icon">
            <Building2 size={18} />
          </span>
          <span>
            <strong>{companyName ?? 'Sua carteira'}</strong>
            <small>{companyId ? 'Trocar empresa' : 'Empresas e operação'}</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <nav aria-label="Menu principal">
          {companyId ? (
            nav.map(([path, label, Icon]) => (
              <Link
                key={path}
                href={`/empresas/${companyId}/${path}`}
                className={section === path ? 'nav-item active' : 'nav-item'}
              >
                <Icon size={19} />
                {label}
              </Link>
            ))
          ) : (
            <Link className="nav-item active" href="/escritorio">
              <Building2 size={19} />
              Carteira de empresas
            </Link>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-note">
            <ShieldCheck size={20} />
            <strong>Clareza para crescer.</strong>
            <p>Seu financeiro e sua contabilidade, no mesmo lugar.</p>
          </div>
          <Link className="nav-item" href="/mfa">
            <Settings size={18} />
            Segurança da conta
          </Link>
          <form action={logout}>
            <button className="nav-item logout">
              <LogOut size={18} />
              Sair da conta
            </button>
          </form>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            ConCloud <span>/</span> {companyName ?? 'Escritório'}
          </div>
          <div className="profile">
            <span className="online-dot" />
            <span>{email}</span>
            <span className="avatar">{email.slice(0, 2).toUpperCase()}</span>
          </div>
        </header>
        {demoEnabled() && (
          <div className="demo-banner">
            <span>DEMONSTRAÇÃO LOCAL · Dados sintéticos</span>
            <form action={demoPersona}>
              <select name="persona" aria-label="Perfil de demonstração">
                <option value="admin">Administrador</option>
                <option value="reviewer">Revisor</option>
                <option value="client">Cliente</option>
              </select>
              <button>
                Trocar perfil <ArrowUpRight size={12} />
              </button>
            </form>
          </div>
        )}
        <main className="page-content">{children}</main>
        <footer>
          ConCloud · Contabilidade digital com você.<span>Horários em Brasília</span>
        </footer>
      </div>
    </div>
  );
}
