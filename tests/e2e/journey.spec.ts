import { test, expect, type Page } from '@playwright/test';
const company = '30000000-0000-4000-8000-000000000001';
async function form(page: Page, operation: string) {
  return page
    .locator('form')
    .filter({ has: page.locator(`input[name="operation"][value="${operation}"]`) })
    .first();
}
async function persona(page: Page, name: string) {
  await page.goto('/escritorio');
  await page.getByLabel('Perfil de demonstração').selectOption(name);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/escritorio')),
    page.getByRole('button', { name: 'Trocar perfil' }).click(),
  ]);
  await page.goto('/escritorio');
  await expect(page.getByRole('heading', { name: 'Carteira de empresas.' })).toBeVisible();
}
test('cliente tem escopo restrito e layout funciona no celular', async ({ page }) => {
  await persona(page, 'client');
  await expect(page.getByRole('heading', { name: 'Aurora Studio · Demonstração' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Horizonte Consultoria · Demonstração' }),
  ).toHaveCount(0);
  await page.goto(`/empresas/${company}`);
  await expect(page.getByRole('heading', { name: 'Visão geral.' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Visão geral.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/mobile-overview.png', fullPage: true });
});
test('cadastro financeiro, liquidação parcial, upload e atendimento', async ({ page }) => {
  await persona(page, 'admin');
  await page.goto(`/empresas/${company}/financeiro?month=2026-10`);
  const title = await form(page, 'title');
  const unique = `Serviço E2E ${Date.now()}`;
  await title.getByLabel('Descrição', { exact: true }).fill(unique);
  await title.getByLabel('Tipo', { exact: true }).selectOption('RECEIVABLE');
  await title.getByLabel('Valor total (R$)').fill('100.00');
  await title.getByLabel('Competência', { exact: true }).fill('2026-10');
  await title.getByLabel('Primeiro vencimento').fill('2026-10-10');
  await title.getByRole('button', { name: 'Criar lançamento' }).click();
  await expect(title.getByRole('status')).toContainText('Alteração registrada');
  await expect(page.getByRole('cell', { name: unique })).toBeVisible();
  const settle = await form(page, 'settle');
  const option = settle.locator('select[name=installmentId] option').filter({ hasText: unique });
  await settle
    .locator('select[name=installmentId]')
    .selectOption((await option.getAttribute('value')) ?? '');
  await settle.getByLabel('Principal (R$)').fill('30.00');
  await settle.getByRole('button', { name: 'Registrar liquidação' }).click();
  await expect(settle.getByRole('status')).toContainText('Alteração registrada');
  const row = page.getByRole('row').filter({ hasText: unique });
  await expect(row).toContainText('70,00');
  await expect(row).toContainText('Parcial');
  await page.goto(`/empresas/${company}/documentos`);
  const upload = await form(page, 'upload');
  await upload.getByLabel('Título', { exact: true }).fill(`Documento ${unique}`);
  await upload.getByLabel('Arquivo', { exact: true }).setInputFiles({
    name: 'fixture.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nDocumento sintético E2E\n%%EOF'),
  });
  await upload.getByRole('button', { name: 'Enviar documento' }).click();
  await expect(upload.getByRole('status')).toContainText('armazenado');
  await expect(page.locator('strong').filter({ hasText: `Documento ${unique}` })).toBeVisible();
  await page.goto(`/empresas/${company}/atendimento`);
  const ticket = await form(page, 'ticket');
  await ticket.getByLabel('Assunto').fill(unique);
  await ticket
    .getByLabel('Mensagem', { exact: true })
    .fill('Solicitação sintética de teste, sem envio externo.');
  await ticket.getByRole('button', { name: 'Abrir atendimento' }).click();
  await expect(ticket.getByRole('status')).toContainText('Alteração registrada');
  await expect(page.getByRole('heading', { name: unique })).toBeVisible();
  await page.goto(`/empresas/${company}`);
  await page.screenshot({ path: 'test-results/desktop-overview.png', fullPage: true });
});
test('jornada operacional: empresa, convites, fechamento, pacote, revisão e entrega', async ({
  page,
}) => {
  await persona(page, 'admin');
  const base = String(Date.now()).slice(-12);
  const dv = (s: string) => {
    const w =
      s.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rem = [...s].reduce((a, c, i) => a + Number(c) * w[i], 0) % 11;
    return String(rem < 2 ? 0 : 11 - rem);
  };
  const cnpj = base + dv(base) + dv(base + dv(base));
  const create = await form(page, 'createCompany');
  await create.getByLabel('Razão social').fill(`Jornada sintética ${Date.now()}`);
  await create.getByLabel('CNPJ (numérico ou alfanumérico)').fill(cnpj);
  await create.getByRole('button', { name: 'Cadastrar empresa' }).click();
  await expect(create.getByRole('status')).toContainText('Empresa cadastrada');
  const href = await create.getByRole('link', { name: 'Abrir →' }).getAttribute('href');
  const co = href!.split('/')[2];
  async function invite(who: string, role: string) {
    await page.goto(`/empresas/${co}/equipe`);
    const f = await form(page, 'invite');
    await f.getByLabel('E-mail do destinatário').fill(`${who}@example.invalid`);
    await f.getByLabel('Papel nesta empresa').selectOption(role);
    await f.getByRole('button', { name: 'Gerar convite' }).click();
    await expect(f.getByRole('status')).toContainText('Convite criado');
    const link = await f.getByRole('link').getAttribute('href');
    await persona(page, who);
    await page.goto(link!);
    const accept = await form(page, 'acceptInvitation');
    await accept.getByRole('button', { name: 'Aceitar convite' }).click();
    await expect(accept.getByRole('status')).toContainText('Convite aceito');
    await persona(page, 'admin');
  }
  await invite('reviewer', 'ACCOUNTANT');
  await invite('client', 'CLIENT_OWNER');
  await page.goto(`/empresas/${co}/documentos`);
  const request = await form(page, 'request');
  await request.getByLabel('O que precisamos?').fill('Extrato mensal sintético');
  await request.getByLabel('Prazo', { exact: true }).fill('2026-10-15');
  await request.getByRole('button', { name: 'Solicitar documento' }).click();
  await expect(request.getByRole('status')).toContainText('Alteração registrada');
  await persona(page, 'client');
  await page.goto(`/empresas/${co}/documentos`);
  const upload = await form(page, 'upload');
  await upload.getByLabel('Título', { exact: true }).fill('Extrato sintético');
  await upload.getByLabel('Arquivo', { exact: true }).setInputFiles({
    name: 'entrada.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nExtrato sintético\n%%EOF'),
  });
  await upload.getByRole('button', { name: 'Enviar documento' }).click();
  await expect(upload.getByRole('status')).toContainText('armazenado');
  const fulfill = await form(page, 'fulfill');
  await fulfill.getByRole('button', { name: 'Vincular documento' }).click();
  await expect(page.getByText('Atendida', { exact: true })).toBeVisible();
  await persona(page, 'admin');
  await page.goto(`/empresas/${co}/fechamento`);
  const period = await form(page, 'period');
  await period
    .getByLabel('Revisor', { exact: true })
    .selectOption('10000000-0000-4000-8000-000000000002');
  await period.getByLabel('Prazo interno', { exact: true }).fill('2026-10-20');
  await period.getByRole('button', { name: 'Abrir fechamento' }).click();
  await expect(period.getByRole('status')).toContainText('Alteração registrada');
  async function advance(to: string) {
    const f = await form(page, 'transition');
    await f.getByLabel('Próxima etapa / reabertura').selectOption(to);
    await f
      .getByLabel('Justificativa e evidência')
      .fill('Conferência sintética concluída para teste');
    await f.getByRole('button', { name: 'Registrar transição' }).click();
    await expect(f.getByRole('status')).toContainText('Alteração registrada');
  }
  await advance('UNDER_REVIEW');
  await advance('READY_FOR_PROCESSING');
  const exp = await form(page, 'export');
  await exp.getByRole('button', { name: 'Gerar pacote versionado' }).click();
  await expect(exp.getByRole('status')).toContainText('Lote versionado');
  await expect(async () => {
    await page.reload();
    await expect(page.getByText('Pronto para retirada', { exact: true })).toBeVisible();
  }).toPass({ timeout: 30000 });
  const batch = await form(page, 'downloadBatch');
  await batch.getByRole('button', { name: 'Retirar pacote' }).click();
  await expect(batch.getByRole('status')).toContainText('60 segundos');
  const download = await batch.getByRole('link').getAttribute('href');
  const response = await page.request.get(download!);
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
  await advance('PROCESSING_EXTERNALLY');
  await page.goto(`/empresas/${co}/documentos`);
  const result = await form(page, 'upload');
  await result.getByLabel('Título', { exact: true }).fill('Resultado contábil sintético');
  await result.getByLabel('Classificação', { exact: true }).selectOption('RESULT');
  await result.getByLabel('Arquivo', { exact: true }).setInputFiles({
    name: 'resultado.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nResultado sintético de teste\n%%EOF'),
  });
  await result.getByRole('button', { name: 'Enviar documento' }).click();
  await expect(result.getByRole('status')).toContainText('armazenado');
  await page.goto(`/empresas/${co}/fechamento`);
  const processed = await form(page, 'processed');
  await processed.getByLabel('Protocolo / evidência no Domínio').fill('DEMO-PROTOCOLO-001');
  await processed.getByRole('button', { name: 'Registrar processamento' }).click();
  await expect(page.getByText('Processamento registrado', { exact: true })).toBeVisible();
  await advance('QUALITY_REVIEW');
  await persona(page, 'reviewer');
  await page.goto(`/empresas/${co}/fechamento`);
  const review = await form(page, 'review');
  await review
    .getByLabel('Parecer e evidências da revisão')
    .fill('Resultado sintético conferido; evidências anexadas.');
  await review.getByRole('button', { name: 'Aprovar revisão' }).click();
  await expect(page.getByText('Revisão aprovada', { exact: true })).toBeVisible();
  await page.goto(`/empresas/${co}/documentos`);
  const resultRow = page
    .locator('.list-row')
    .filter({ has: page.locator('strong').filter({ hasText: 'Resultado contábil sintético' }) });
  await resultRow.getByRole('button', { name: 'Publicar' }).click();
  await expect(resultRow.getByText('Publicado', { exact: true })).toBeVisible();
  await page.goto(`/empresas/${co}/fechamento`);
  await advance('DELIVERED');
  await advance('CLOSED');
  await persona(page, 'client');
  await page.goto(`/empresas/${co}/documentos`);
  await expect(
    page.locator('strong').filter({ hasText: 'Resultado contábil sintético' }),
  ).toBeVisible();
  const clientDoc = page
    .locator('.list-row')
    .filter({ has: page.locator('strong').filter({ hasText: 'Resultado contábil sintético' }) });
  const docUrl = await clientDoc.getByRole('link', { name: 'Baixar' }).getAttribute('href');
  expect((await page.request.get(docUrl!)).ok()).toBe(true);
  await page.goto(`/empresas/${co}/fechamento`);
  await expect(page.getByText('Encerrado', { exact: true })).toBeVisible();
});
