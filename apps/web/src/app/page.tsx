import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Cloud,
  FileCheck2,
  HeartHandshake,
  LayoutDashboard,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const benefits = [
  {
    icon: MessageCircle,
    title: 'Atendimento próximo',
    text: 'Fale com uma equipe que conhece a sua empresa e acompanha cada etapa.',
  },
  {
    icon: LayoutDashboard,
    title: 'Plataforma completa',
    text: 'Financeiro, documentos, guias e solicitações reunidos em um só lugar.',
  },
  {
    icon: FileCheck2,
    title: 'Rotina organizada',
    text: 'Prazos e pendências visíveis para você saber o que está acontecendo.',
  },
];
const faqs = [
  [
    'O que a ConCloud faz?',
    'Cuidamos da rotina contábil da sua empresa e oferecemos uma plataforma para organizar financeiro, documentos, guias e atendimento.',
  ],
  [
    'Posso abrir minha empresa com a ConCloud?',
    'Sim. Você preenche uma análise inicial e nossa equipe confirma enquadramento, cidade atendida, documentação e próximos passos.',
  ],
  [
    'A ConCloud atende empresas que já possuem CNPJ?',
    'Sim. Analisamos a situação atual e orientamos a troca de contador para que a transição seja segura.',
  ],
  [
    'Quais empresas podem ser atendidas?',
    'O atendimento inicial é voltado a prestadores de serviços no Simples Nacional e Lucro Presumido. A equipe valida cada caso antes da contratação.',
  ],
  [
    'O sistema calcula e transmite impostos sozinho?',
    'Não. A plataforma organiza informações e o trabalho contábil. A apuração e as obrigações são conferidas pela equipe responsável.',
  ],
];

export default function Home() {
  return (
    <main className="marketing-page">
      <header className="marketing-header">
        <Link className="marketing-brand" href="/" aria-label="ConCloud, início">
          <span>
            <Cloud size={25} />
          </span>
          ConCloud<i>.</i>
        </Link>
        <nav aria-label="Navegação principal">
          <a href="#solucoes">Soluções</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <div className="marketing-actions">
          <Link className="marketing-login" href="/login">
            Acessar plataforma
          </Link>
          <Link className="marketing-cta small" href="/abrir-empresa">
            Abra sua empresa
          </Link>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="marketing-kicker">
            <Sparkles size={16} /> Contabilidade que acompanha você
          </span>
          <h1>
            Sua empresa em dia.
            <br />
            <em>Você um passo à frente.</em>
          </h1>
          <p>
            Contabilidade e gestão financeira conectadas em uma plataforma clara, com uma equipe de
            verdade ao seu lado.
          </p>
          <div className="hero-buttons">
            <Link className="marketing-cta" href="/abrir-empresa">
              Quero abrir minha empresa <ArrowRight size={18} />
            </Link>
            <a className="marketing-secondary" href="#como-funciona">
              Conhecer a ConCloud
            </a>
          </div>
          <div className="hero-trust">
            <span>
              <Check /> Atendimento humano
            </span>
            <span>
              <Check /> Dados protegidos
            </span>
            <span>
              <Check /> Tudo organizado
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Visão da plataforma ConCloud">
          <div className="hero-orbit one" />
          <div className="hero-orbit two" />
          <div className="hero-dashboard">
            <div className="mock-top">
              <span className="mock-logo">
                <Cloud /> ConCloud
              </span>
              <span>Olá, Ricardo</span>
            </div>
            <div className="mock-body">
              <aside>
                <i />
                <i />
                <i />
                <i />
              </aside>
              <div className="mock-content">
                <small>VISÃO GERAL</small>
                <h3>Bom dia! Sua empresa está em dia.</h3>
                <div className="mock-cards">
                  <b>
                    <ReceiptText /> Guias
                    <br />
                    <strong>Organizadas</strong>
                  </b>
                  <b>
                    <BarChart3 /> Financeiro
                    <br />
                    <strong>Acompanhe</strong>
                  </b>
                </div>
                <div className="mock-chart">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
          <div className="hero-float">
            <ShieldCheck />{' '}
            <span>
              <b>Ambiente seguro</b>
              <small>Seus dados protegidos</small>
            </span>
          </div>
        </div>
      </section>

      <section className="benefit-section" id="solucoes">
        <div className="section-heading">
          <span>UMA ROTINA MAIS LEVE</span>
          <h2>Tudo o que sua empresa precisa, conectado.</h2>
          <p>Menos planilhas soltas, menos dúvidas e mais clareza para tomar decisões.</p>
        </div>
        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <Icon />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="steps-section" id="como-funciona">
        <div className="steps-art">
          <div className="steps-cloud">
            <Cloud />
          </div>
          <div className="steps-card">
            <span>Fechamento mensal</span>
            <strong>4 de 5 etapas concluídas</strong>
            <i>
              <b />
            </i>
          </div>
        </div>
        <div className="steps-copy">
          <span className="marketing-kicker">COMO FUNCIONA</span>
          <h2>Contabilidade sem caixa-preta.</h2>
          <p>Você acompanha o trabalho e sabe exatamente quando precisa agir.</p>
          <ol>
            <li>
              <b>1</b>
              <span>
                <strong>Envie seus documentos</strong>
                <small>Arquivos protegidos e organizados por competência.</small>
              </span>
            </li>
            <li>
              <b>2</b>
              <span>
                <strong>Acompanhe a conferência</strong>
                <small>Pendências e responsáveis ficam visíveis na plataforma.</small>
              </span>
            </li>
            <li>
              <b>3</b>
              <span>
                <strong>Receba guias e resultados</strong>
                <small>Tudo publicado no lugar certo, com histórico.</small>
              </span>
            </li>
          </ol>
          <Link className="marketing-secondary" href="/abrir-empresa">
            Começar agora <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="opening-banner">
        <div>
          <span>ABRA SUA EMPRESA</span>
          <h2>Transforme sua ideia em um negócio bem cuidado.</h2>
          <p>
            Conte sobre o seu projeto. Nossa equipe analisa o cenário e orienta os próximos passos.
          </p>
          <Link className="marketing-cta light" href="/abrir-empresa">
            Iniciar análise gratuita <ArrowRight />
          </Link>
        </div>
        <Building2 />
      </section>

      <section className="plans-section" id="planos">
        <div className="section-heading">
          <span>PLANOS</span>
          <h2>Uma solução para cada momento da sua empresa.</h2>
          <p>A recomendação é feita depois de entendermos sua operação.</p>
        </div>
        <div className="plan-grid">
          <article>
            <small>ESSENCIAL</small>
            <h3>Para começar organizado</h3>
            <p>Rotina contábil, documentos, guias e atendimento digital.</p>
            <ul>
              <li>
                <Check /> Plataforma ConCloud
              </li>
              <li>
                <Check /> Agenda de obrigações
              </li>
              <li>
                <Check /> Atendimento da equipe
              </li>
            </ul>
            <Link href="/abrir-empresa">
              Solicitar análise <ArrowRight />
            </Link>
          </article>
          <article className="featured">
            <span>MAIS COMPLETO</span>
            <small>GESTÃO</small>
            <h3>Contabilidade e financeiro juntos</h3>
            <p>Mais visibilidade para acompanhar a operação e tomar decisões.</p>
            <ul>
              <li>
                <Check /> Tudo do Essencial
              </li>
              <li>
                <Check /> Contas a pagar e receber
              </li>
              <li>
                <Check /> Conciliação financeira
              </li>
            </ul>
            <Link href="/abrir-empresa">
              Solicitar análise <ArrowRight />
            </Link>
          </article>
          <article>
            <small>PRÓXIMO</small>
            <h3>Acompanhamento dedicado</h3>
            <p>Para empresas que precisam de uma rotina mais acompanhada.</p>
            <ul>
              <li>
                <Check /> Tudo do Gestão
              </li>
              <li>
                <Check /> Responsável de referência
              </li>
              <li>
                <Check /> Revisões periódicas
              </li>
            </ul>
            <Link href="/abrir-empresa">
              Falar com especialista <ArrowRight />
            </Link>
          </article>
        </div>
      </section>

      <section className="why-section">
        <div>
          <HeartHandshake />
          <span>MAIS QUE SOFTWARE</span>
          <h2>
            Tecnologia para organizar.
            <br />
            Pessoas para cuidar.
          </h2>
          <p>
            A ConCloud conecta empresário e equipe contábil em um fluxo transparente, com
            responsáveis, evidências e histórico.
          </p>
        </div>
        <div className="why-points">
          <article>
            <strong>01</strong>
            <h3>Clareza</h3>
            <p>Veja prazos, pendências e entregas.</p>
          </article>
          <article>
            <strong>02</strong>
            <h3>Proximidade</h3>
            <p>Converse com quem cuida da sua empresa.</p>
          </article>
          <article>
            <strong>03</strong>
            <h3>Controle</h3>
            <p>Financeiro e contabilidade no mesmo contexto.</p>
          </article>
        </div>
      </section>

      <section className="faq-section" id="duvidas">
        <div>
          <span className="marketing-kicker">PERGUNTAS FREQUENTES</span>
          <h2>Ainda ficou com alguma dúvida?</h2>
          <p>Veja as respostas principais ou inicie sua análise para falar com a equipe.</p>
          <Link className="marketing-cta" href="/abrir-empresa">
            Quero falar com a ConCloud
          </Link>
        </div>
        <div className="faq-list">
          {faqs.map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <ChevronDown />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="footer-main">
          <div>
            <Link className="marketing-brand inverse" href="/">
              <span>
                <Cloud />
              </span>
              ConCloud<i>.</i>
            </Link>
            <p>Contabilidade digital com proximidade, organização e tecnologia.</p>
          </div>
          <div>
            <b>ConCloud</b>
            <a href="#solucoes">Soluções</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
          </div>
          <div>
            <b>Comece agora</b>
            <Link href="/abrir-empresa">Abrir empresa</Link>
            <Link href="/login">Acessar plataforma</Link>
          </div>
          <div>
            <b>Segurança</b>
            <span>Ambiente privado</span>
            <span>Dados protegidos</span>
            <span>Histórico auditável</span>
          </div>
        </div>
        <div className="footer-bottom">© 2026 ConCloud. Todos os direitos reservados.</div>
      </footer>
    </main>
  );
}
