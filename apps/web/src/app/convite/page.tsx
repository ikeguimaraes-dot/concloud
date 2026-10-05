import { ActionForm } from '@/components/forms';
import { Field, Hidden, Panel } from '@/components/fields';
import { currentActor } from '@/lib/auth';
import { register } from '@/lib/actions';
export default async function Invite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const actor = await currentActor();
  return (
    <main className="standalone">
      <h1>Seu convite para o ConCloud</h1>
      <p>O convite é pessoal, expira em 7 dias e só pode ser usado uma vez.</p>
      {actor ? (
        <Panel title="Aceitar acesso">
          <p>Você está entrando como {actor.email}.</p>
          <ActionForm operation="acceptInvitation" label="Aceitar convite">
            <Hidden name="token" value={token ?? ''} />
          </ActionForm>
        </Panel>
      ) : (
        <>
          <a href="/login">Já tenho conta → Entrar</a>
          <Panel
            title="Criar meu acesso"
            description="Use o mesmo e-mail que recebeu o convite. Nenhum privilégio é concedido pelo cadastro."
          >
            <ActionForm action={register} label="Criar acesso">
              <Field name="email" label="E-mail" type="email" />
              <Field name="password" label="Senha (pelo menos 12 caracteres)" type="password" />
            </ActionForm>
          </Panel>
        </>
      )}
    </main>
  );
}
