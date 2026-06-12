import { Resend } from 'resend';

function getResend(): Resend {
  const apiKey = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');
  return new Resend(apiKey);
}

export async function sendMagicLinkEmail(params: { email: string; url: string }): Promise<void> {
  const { email, url } = params;

  const fromEmail = import.meta.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'noreply@miguel-anay.nom.pe';

  try {
    const resend = getResend();
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Tu enlace de acceso — Miguel Anay',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <p style="font-size: 16px; color: #111;">Hacé click en el siguiente link para acceder:</p>
          <p style="margin: 24px 0;">
            <a href="${url}" style="background: #111; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              Acceder ahora
            </a>
          </p>
          <p style="font-size: 13px; color: #666; word-break: break-all;">
            O copiá este link en tu navegador:<br/>${url}
          </p>
          <p style="font-size: 12px; color: #999; margin-top: 32px;">El link expira en 30 minutos. Si no solicitaste acceso, ignorá este email.</p>
        </div>
      `,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'RESEND_API_KEY is not set') {
      throw err;
    }
    console.error('[email] Failed to send magic link email:', err);
    throw new Error('Failed to send magic link email');
  }
}
