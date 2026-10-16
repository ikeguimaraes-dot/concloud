type EmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  idempotencyKey?: string;
};

export async function sendTransactionalEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { sent: false as const, reason: 'NOT_CONFIGURED' as const };
  const { idempotencyKey, ...message } = input;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ from, ...message }),
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
  return { sent: true as const };
}
