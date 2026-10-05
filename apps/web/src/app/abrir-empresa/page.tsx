'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Cloud,
  Loader2,
  MapPin,
  UserRound,
} from 'lucide-react';

type Lead = {
  name: string;
  email: string;
  phone: string;
  activity: string;
  zipCode: string;
  addressType: string;
  city: string;
  state: string;
  plan: string;
};
const initial: Lead = {
  name: '',
  email: '',
  phone: '',
  activity: '',
  zipCode: '',
  addressType: '',
  city: '',
  state: '',
  plan: '',
};
const plans = [
  { id: 'essencial', name: 'Essencial', description: 'Contabilidade e rotina organizada.' },
  { id: 'gestao', name: 'Gestão', description: 'Contabilidade com ERP financeiro.' },
  { id: 'proximo', name: 'Próximo', description: 'Acompanhamento mais dedicado.' },
];

export default function OpenCompany() {
  const [step, setStep] = useState(1),
    [lead, setLead] = useState(initial),
    [sending, setSending] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  const change = (key: keyof Lead, value: string) => setLead((v) => ({ ...v, [key]: value }));
  const valid =
    step === 1
      ? !!(lead.name && lead.email && lead.phone)
      : step === 2
        ? !!(lead.activity && lead.zipCode && lead.addressType && lead.city && lead.state)
        : step === 3
          ? !!lead.plan
          : true;
  async function submit() {
    setSending(true);
    setError('');
    const response = await fetch('/api/opening-leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(lead),
    });
    setSending(false);
    if (response.ok) setDone(true);
    else setError('Não foi possível enviar agora. Revise os dados e tente novamente.');
  }
  if (done)
    return (
      <main className="opening-page">
        <div className="opening-shell success">
          <div className="success-icon">
            <Check />
          </div>
          <span>ANÁLISE SOLICITADA</span>
          <h1>Obrigado, {lead.name.split(' ')[0]}!</h1>
          <p>
            Recebemos suas informações. A equipe ConCloud vai analisar o cenário e entrar em contato
            pelos dados informados.
          </p>
          <Link className="marketing-cta" href="/">
            Voltar ao início
          </Link>
        </div>
      </main>
    );
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
            <span>Abrir empresa</span>
            <b>
              {step}/4 · {['Dados pessoais', 'Sua empresa', 'Plano', 'Revisão'][step - 1]}
            </b>
          </div>
          <i>
            <b style={{ width: `${step * 25}%` }} />
          </i>
        </div>
        {step === 1 && (
          <section className="opening-step">
            <div className="step-icon">
              <UserRound />
            </div>
            <h1>Vamos começar por você</h1>
            <p>Preencha seus dados para continuarmos a análise.</p>
            <label>
              Nome completo
              <input
                value={lead.name}
                onChange={(e) => change('name', e.target.value)}
                placeholder="Como podemos chamar você?"
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={lead.email}
                onChange={(e) => change('email', e.target.value)}
                placeholder="voce@empresa.com.br"
              />
            </label>
            <label>
              Celular
              <input
                value={lead.phone}
                onChange={(e) => change('phone', e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </label>
          </section>
        )}
        {step === 2 && (
          <section className="opening-step">
            <div className="step-icon">
              <Building2 />
            </div>
            <h1>Conte sobre sua empresa</h1>
            <p>Essas informações ajudam a equipe a entender seu cenário.</p>
            <label>
              Qual atividade você pretende exercer?
              <select value={lead.activity} onChange={(e) => change('activity', e.target.value)}>
                <option value="">Selecione uma atividade</option>
                <option>Consultoria e serviços profissionais</option>
                <option>Tecnologia e desenvolvimento</option>
                <option>Marketing e comunicação</option>
                <option>Saúde e bem-estar</option>
                <option>Comércio eletrônico</option>
                <option>Outra atividade</option>
              </select>
            </label>
            <div className="field-pair">
              <label>
                CEP
                <input
                  value={lead.zipCode}
                  onChange={(e) => change('zipCode', e.target.value)}
                  placeholder="00000-000"
                />
              </label>
              <label>
                Cidade
                <input value={lead.city} onChange={(e) => change('city', e.target.value)} />
              </label>
            </div>
            <label>
              Estado
              <select value={lead.state} onChange={(e) => change('state', e.target.value)}>
                <option value="">Selecione</option>
                {[
                  'SP',
                  'RJ',
                  'MG',
                  'PR',
                  'SC',
                  'RS',
                  'ES',
                  'BA',
                  'PE',
                  'CE',
                  'DF',
                  'GO',
                  'Outro',
                ].map((s) => (
                  <option key={s}>{s}</option>
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
                  <small>Quero entender as opções disponíveis.</small>
                </span>
              </button>
            </fieldset>
          </section>
        )}
        {step === 3 && (
          <section className="opening-step">
            <span className="marketing-kicker">ESCOLHA INICIAL</span>
            <h1>Qual solução combina com você?</h1>
            <p>A equipe ainda confirmará a indicação depois da análise.</p>
            <div className="opening-plans">
              {plans.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={lead.plan === p.id ? 'active' : ''}
                  onClick={() => change('plan', p.id)}
                >
                  <span>{lead.plan === p.id && <Check />}</span>
                  <b>{p.name}</b>
                  <small>{p.description}</small>
                </button>
              ))}
            </div>
            <div className="opening-note">
              Nenhuma cobrança será feita agora. Valores e condições são apresentados somente após a
              análise do seu caso.
            </div>
          </section>
        )}
        {step === 4 && (
          <section className="opening-step review">
            <span className="marketing-kicker">CONFIRA OS DADOS</span>
            <h1>Tudo certo para a análise?</h1>
            <p>Você poderá complementar as informações quando nossa equipe entrar em contato.</p>
            <dl>
              <div>
                <dt>Responsável</dt>
                <dd>{lead.name}</dd>
              </div>
              <div>
                <dt>Contato</dt>
                <dd>
                  {lead.email}
                  <br />
                  {lead.phone}
                </dd>
              </div>
              <div>
                <dt>Atividade</dt>
                <dd>{lead.activity}</dd>
              </div>
              <div>
                <dt>Localização</dt>
                <dd>
                  {lead.city} · {lead.state} · {lead.zipCode}
                </dd>
              </div>
              <div>
                <dt>Interesse</dt>
                <dd>Plano {plans.find((p) => p.id === lead.plan)?.name}</dd>
              </div>
            </dl>
            {error && <p className="form-error">{error}</p>}
          </section>
        )}
        <div className="opening-nav">
          {step > 1 ? (
            <button type="button" className="back" onClick={() => setStep((s) => s - 1)}>
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
              onClick={() => setStep((s) => s + 1)}
            >
              Avançar <ArrowRight />
            </button>
          ) : (
            <button type="button" className="marketing-cta" disabled={sending} onClick={submit}>
              {sending ? <Loader2 className="spin" /> : <Check />} Solicitar análise
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
