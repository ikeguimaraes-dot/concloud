'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ZodError } from 'zod';
import { AppError } from '@domain/errors';
import { command, createCompany, uploadDocument, acceptInvitation } from './service';
import { requireActor, supabase, demoEnabled } from './auth';
import { rateLimit } from './limits';
import type { ImportRow } from '@domain/imports';
import { database } from '@database/client';
export type ActionState = {
  message: string;
  error?: boolean;
  link?: string;
  previewHash?: string;
  preview?: { accepted: ImportRow[]; rejected: { line: number; reason: string }[] };
};
export async function perform(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requireActor();
  try {
    await rateLimit(actor.id);
    const companyId = String(form.get('companyId') ?? '');
    const operation = String(form.get('operation'));
    const input = Object.fromEntries(form.entries());
    let result: ActionState;
    if (operation === 'createCompany') {
      const id = await createCompany(actor, input);
      result = { message: 'Empresa cadastrada.', link: `/empresas/${id}` };
    } else if (operation === 'acceptInvitation') {
      const id = await acceptInvitation(actor, String(form.get('token')));
      result = { message: 'Convite aceito.', link: `/empresas/${id}` };
    } else if (operation === 'upload') {
      const file = form.get('file');
      if (!(file instanceof File)) throw new AppError('FILE', 'Selecione um arquivo.');
      await uploadDocument(actor, companyId, input, file);
      result = { message: 'Documento armazenado com segurança.' };
    } else {
      const file = form.get('importFile');
      if (file instanceof File && file.size) {
        if (file.size > 5_000_000) throw new AppError('FILE', 'Limite de 5 MB.');
        input.source = await file.text();
        input.filename = file.name;
      }
      result = await command(actor, companyId, operation, input);
    }
    revalidatePath('/', 'layout');
    return result;
  } catch (error) {
    if (error instanceof ZodError)
      return {
        message: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '),
        error: true,
      };
    if (error instanceof AppError) return { message: error.message, error: true };
    const code = (error as { code?: string }).code;
    if (code === 'P2002')
      return { message: 'Este registro já existe. Atualize a página para conferir.', error: true };
    if (code === 'P2034')
      return {
        message: 'Outra operação alterou estes dados. Atualize e tente novamente.',
        error: true,
      };
    if (code === 'P2025' || code === 'P2003')
      return {
        message: 'Registro indisponível ou vínculo inválido para esta empresa.',
        error: true,
      };
    console.error(
      JSON.stringify({
        event: 'action.failed',
        correlationId: crypto.randomUUID(),
        code: code ?? 'UNKNOWN',
      }),
    );
    return {
      message: 'Não foi possível concluir. Confira a configuração e tente novamente.',
      error: true,
    };
  }
}
export async function login(_previous: ActionState, form: FormData): Promise<ActionState> {
  const identifier = String(form.get('identifier') ?? form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(form.get('password') ?? '');
  try {
    await rateLimit(`login:${identifier}`, 5);
    let email = identifier;
    if (!identifier.includes('@')) {
      const cpf = identifier.replace(/\D/g, '');
      const rows = await database().$queryRaw<Array<{ email: string }>>`
        select email from concloud."OpeningLead" where cpf = ${cpf} limit 1`;
      email = rows[0]?.email ?? 'acesso-invalido@example.invalid';
    }
    const client = await supabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { message: 'E-mail ou senha inválidos.', error: true };
  } catch {
    return { message: 'Acesso indisponível. Confira a configuração de Auth e Redis.', error: true };
  }
  redirect('/escritorio');
}
export async function register(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    await rateLimit(`register:${email}`, 3);
    const password = String(form.get('password') ?? '');
    if (password.length < 12) return { message: 'Use pelo menos 12 caracteres.', error: true };
    const client = await supabase();
    const { error } = await client.auth.signUp({ email, password });
    if (error) return { message: 'Não foi possível cadastrar este acesso.', error: true };
    return {
      message: 'Se o cadastro estiver disponível, confirme seu e-mail, entre e aceite seu convite.',
    };
  } catch {
    return { message: 'Cadastro indisponível.', error: true };
  }
}
export async function logout() {
  if (demoEnabled()) {
    (await cookies()).delete('concloud_demo');
  } else {
    const client = await supabase();
    await client.auth.signOut();
  }
  redirect('/login');
}
export async function demoPersona(form: FormData) {
  if (!demoEnabled()) throw new Error('Modo demonstração desativado');
  const value = String(form.get('persona'));
  if (!['admin', 'reviewer', 'client'].includes(value)) throw new Error('Persona inválida');
  (await cookies()).set('concloud_demo', value, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/escritorio');
}
