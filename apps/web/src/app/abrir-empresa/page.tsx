'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Cloud,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

type Lead = {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  password: string;
  passwordConfirmation: string;
  activity: string;
  zipCode: string;
  addressType: string;
  city: string;
  state: string;
  plan: string;
};
const initial: Lead = {
  name: '',
  cpf: '',
  email: '',
  phone: '',
  password: '',
  passwordConfirmation: '',
  activity: '',
  zipCode: '',
  addressType: '',
  city: '',
  state: '',
  plan: '',
};
const activities = [
  'Advocacia',
  'Arquitetura e urbanismo',
  'Comércio e loja física',
  'Comércio eletrônico (e-commerce)',
  'Consultoria e serviços profissionais',
  'Desenvolvimento de software (Dev/TI)',
  'Design e produção de conteúdo',
  'Dentista / Odontologia',
  'Educação e cursos',
  'Engenharia',
  'Estética e beleza',
  'Fisioterapia',
  'Marketing, publicidade e comunicação',
  'Médico / Serviços médicos',
  'Nutrição',
  'Psicologia',
  'Saúde e bem-estar',
  'Serviços administrativos',
  'Outra atividade',
];
const states = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];
const plans = [
  {
    id: 'essencial',
    name: 'Essencial',
    price: 'R$ 99',
    description: 'Contabilidade e rotina organizada.',
  },
  {
    id: 'gestao',
    name: 'Gestão',
    price: 'R$ 149',
    description: 'Contabilidade com ERP financeiro.',
    badge: 'MAIS ESCOLHIDO',
  },
  { id: 'proximo', name: 'Próximo', price: 'R$ 199', description: 'Acompanhamento mais dedicado.' },
];
const onlyDigits = (value: string) => value.replace(/\D/g, '');
const formatCpf = (value: string) =>
  onlyDigits(value)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

export default function OpenCompany() {
  const [step, setStep] = useState(1);
  const [lead, setLead] = useState(initial);
  const [sending, setSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const change = (key: keyof Lead, value: string) =>
    setLead((current) => ({ ...current, [key]: value }));
  const selectedPlan = plans.find((plan) => plan.id === lead.plan);
  const passwordIsValid = lead.password.length >= 12 && lead.password === lead.passwordConfirmation;
  const valid =
    step === 1
      ? !!(
          lead.name.trim().length >= 3 &&
          onlyDigits(lead.cpf).length === 11 &&
          lead.email.includes('@') &&
          onlyDigits(lead.phone).length >= 10 &&
          passwordIsValid
        )
      : step === 2
        ? !!(lead.activity && lead.zipCode && lead.addressType && lead.city && lead.state)
        : step === 3
          ? !!lead.plan
          : true;

  async function submit() {
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/opening-leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lead),
      });
      const result = (await response.json()) as { id?: string };
      if (!response.ok || !result.id) throw new Error();
      window.location.assign(
        `/pagamento?cadastro=${encodeURIComponent(result.id)}&plano=${lead.plan}`,
      );
    } catch {
      setSending(false);
      setError('Não foi possível criar seu cadastro agora. Revise os dados e tente novamente.');
    }
  }

  return (
    <main className="opening-page">
      <header className="opening-header">
        <Link className="marketing-brand" href="/">
          <span>
            <Cloud />
          </span>
          ConCloud<i>.</i>
        </Link>
        <Link href="/login">Já sou cliente</Link>
      </header>
      <div className="opening-shell">
        <div className="opening-progress">
          <div>
            <span>Abra sua empresa</span>
            <b>
              {step}/4 · {['Seu acesso', 'Sua atividade', 'Seu plano', 'Pagamento'][step - 1]}
            </b>
          </div>
          <i>
            <b style={{ width: `${step * 25}%` }} />
          </i>
          <small>Leva menos de 3 minutos</small>
        </div>

        {step === 1 && (
          <section className="opening-step">
            <div className="step-icon">
              <UserRound />
            </div>
            <span className="marketing-kicker">SEU ESPAÇO SEGURO</span>
            <h1>Vamos criar seu acesso</h1>
            <p>Seus dados ficam salvos para você acompanhar cada etapa da abertura.</p>
            <label>
              Nome completo
              <input
                autoComplete="name"
                value={lead.name}
                onChange={(e) => change('name', e.target.value)}
                placeholder="Como podemos chamar você?"
              />
            </label>
            <div className="field-pair equal">
              <label>
                CPF <small>Será o seu login</small>
                <input
                  inputMode="numeric"
                  autoComplete="username"
                  value={lead.cpf}
                  onChange={(e) => change('cpf', formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                Celular
                <input
                  inputMode="tel"
                  autoComplete="tel"
                  value={lead.phone}
                  onChange={(e) => change('phone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </label>
            </div>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={lead.email}
                onChange={(e) => change('email', e.target.value)}
                placeholder="voce@empresa.com.br"
              />
            </label>
            <div className="field-pair equal">
              <label>
                Crie uma senha <small>Mínimo de 12 caracteres</small>
                <span className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={lead.password}
                    onChange={(e) => change('password', e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </span>
              </label>
              <label>
                Confirme a senha
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={lead.passwordConfirmation}
                  onChange={(e) => change('passwordConfirmation', e.target.value)}
                />
              </label>
            </div>
            {lead.passwordConfirmation && !passwordIsValid && (
              <p className="field-hint error">
                Use 12 caracteres e digite a mesma senha nos dois campos.
              </p>
            )}
            <div className="trust-line">
              <LockKeyhole /> Seus dados são protegidos e a senha não é armazenada no cadastro
              comercial.
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="opening-step">
            <div className="step-icon">
              <Building2 />
            </div>
            <span className="marketing-kicker">PERSONALIZE SUA ABERTURA</span>
            <h1>Conte sobre seu negócio</h1>
            <p>Isso ajuda a preparar o cadastro certo para a sua atividade.</p>
            <label>
              Qual atividade você pretende exercer?
              <select value={lead.activity} onChange={(e) => change('activity', e.target.value)}>
                <option value="">Selecione uma atividade</option>
                {activities.map((activity) => (
                  <option key={activity}>{activity}</option>
                ))}
              </select>
            </label>
            <div className="field-pair">
              <label>
                CEP
                <input
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={lead.zipCode}
                  onChange={(e) => change('zipCode', e.target.value)}
                  placeholder="00000-000"
                />
              </label>
              <label>
                Cidade
                <input
                  autoComplete="address-level2"
                  value={lead.city}
                  onChange={(e) => change('city', e.target.value)}
                />
              </label>
            </div>
            <label>
              Estado
              <select value={lead.state} onChange={(e) => change('state', e.target.value)}>
                <option value="">Selecione</option>
                {states.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Onde será o endereço da empresa?</legend>
              <button
                type="button"
                className={lead.addressType === 'residencial' ? 'choice active' : 'choice'}
                onClick={() => change('addressType', 'residencial')}
              >
                <MapPin />
                <span>
                  <b>Endereço residencial ou comercial</b>
                  <small>Usarei um endereço que já possuo.</small>
                </span>
              </button>
              <button
                type="button"
                className={lead.addressType === 'orientacao' ? 'choice active' : 'choice'}
                onClick={() => change('addressType', 'orientacao')}
              >
                <Building2 />
                <span>
                  <b>Preciso de orientação</b>
                  <small>A equipe ajuda você a escolher a opção adequada.</small>
                </span>
              </button>
            </fieldset>
          </section>
        )}

        {step === 3 && (
          <section className="opening-step">
            <span className="marketing-kicker">ESCOLHA SEM SURPRESAS</span>
            <h1>O plano certo para começar</h1>
            <p>Preço mensal claro. Você acompanha tudo pela ConCloud.</p>
            <div className="opening-plans">
              {plans.map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  className={lead.plan === plan.id ? 'active' : ''}
                  onClick={() => change('plan', plan.id)}
                >
                  {plan.badge && <em>{plan.badge}</em>}
                  <span>{lead.plan === plan.id && <Check />}</span>
                  <b>{plan.name}</b>
                  <strong>
                    {plan.price}
                    <small>/mês</small>
                  </strong>
                  <small>{plan.description}</small>
                </button>
              ))}
            </div>
            <div className="opening-note">
              <ShieldCheck /> Pagamento seguro pelo PagSeguro. Você revisa tudo antes de pagar.
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="opening-step review purchase-review">
            <div className="step-icon">
              <CreditCard />
            </div>
            <span className="marketing-kicker">ÚLTIMO PASSO</span>
            <h1>Tudo pronto para continuar</h1>
            <p>Ao avançar, seu cadastro será criado e você seguirá para o pagamento seguro.</p>
            <div className="purchase-summary">
              <div>
                <span>Plano escolhido</span>
                <b>{selectedPlan?.name}</b>
              </div>
              <strong>
                {selectedPlan?.price}
                <small>/mês</small>
              </strong>
            </div>
            <dl>
              <div>
                <dt>Titular</dt>
                <dd>{lead.name}</dd>
              </div>
              <div>
                <dt>Login</dt>
                <dd>{lead.cpf}</dd>
              </div>
              <div>
                <dt>Atividade</dt>
                <dd>{lead.activity}</dd>
              </div>
              <div>
                <dt>Localização</dt>
                <dd>
                  {lead.city} · {lead.state}
                </dd>
              </div>
            </dl>
            <div className="next-steps">
              <b>O que acontece depois?</b>
              <span>
                <Check /> Pagamento protegido pelo PagSeguro
              </span>
              <span>
                <Check /> Envio dos documentos para abertura do CNPJ
              </span>
              <span>
                <Check /> Acompanhamento pelo seu acesso ConCloud
              </span>
            </div>
            {error && <p className="form-error">{error}</p>}
          </section>
        )}

        <div className="opening-nav">
          {step > 1 ? (
            <button
              type="button"
              className="back"
              onClick={() => setStep((current) => current - 1)}
            >
              <ArrowLeft /> Voltar
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button
              type="button"
              className="marketing-cta"
              disabled={!valid}
              onClick={() => setStep((current) => current + 1)}
            >
              Continuar <ArrowRight />
            </button>
          ) : (
            <button
              type="button"
              className="marketing-cta payment-cta"
              disabled={sending}
              onClick={submit}
            >
              {sending ? <Loader2 className="spin" /> : <CreditCard />} Ir para pagamento{' '}
              <ArrowRight />
            </button>
          )}
        </div>
        <div className="secure-footer">
          <ShieldCheck /> Ambiente seguro · Seus dados protegidos
        </div>
      </div>
    </main>
  );
}
