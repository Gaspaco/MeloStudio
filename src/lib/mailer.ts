// Server-only — never import from client code.
import nodemailer from "nodemailer";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required for email`);
  return v;
}

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: (process.env.SMTP_PORT ?? "587") === "465",
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  });
  return _transporter;
}

const FROM = () =>
  process.env.SMTP_FROM ?? `MeloStudio <${process.env.SMTP_USER}>`;

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await getTransporter().sendMail({
    from: FROM(),
    to,
    subject: "Reset your MeloStudio password",
    text: `Hi,\n\nClick the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;color:#e5e5e5">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 24px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#111;border:1px solid rgba(255,255,255,0.07);border-radius:16px;overflow:hidden">
        <!-- header -->
        <tr>
          <td style="padding:32px 36px 24px;border-bottom:1px solid rgba(255,255,255,0.06)">
            <span style="font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#b066ff">MELO</span>
            <span style="font-size:16px;font-weight:400;color:#fff;margin-left:4px">Studio</span>
          </td>
        </tr>
        <!-- body -->
        <tr>
          <td style="padding:36px 36px 28px">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.02em">Reset your password</h1>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:rgba(255,255,255,0.55)">
              We received a request to reset the password for your account.<br>
              This link expires in <strong style="color:rgba(255,255,255,0.75)">1 hour</strong>.
            </p>
            <a href="${resetUrl}"
               style="display:inline-block;padding:13px 28px;background:#b066ff;color:#fff;text-decoration:none;border-radius:100px;font-size:13px;font-weight:600;letter-spacing:0.04em">
              Reset password
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6">
              Or copy this link into your browser:<br>
              <span style="color:rgba(255,255,255,0.45);word-break:break-all">${resetUrl}</span>
            </p>
          </td>
        </tr>
        <!-- footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06)">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25)">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
