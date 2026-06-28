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
    // Port 465 = implicit TLS (secure:true); 587 = STARTTLS (secure:false) — auto-detected from port
    secure: (process.env.SMTP_PORT ?? "587") === "465",
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
    disableFileAccess: true,
    disableUrlAccess: true,
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
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Great+Vibes&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#080808;font-family:system-ui,sans-serif;color:#e5e5e5">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:56px 24px">
    <tr><td align="left" style="max-width:520px;margin:0 auto;display:block">

      <!-- logo -->
      <div style="margin-bottom:40px">
        <span style="font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#e05297">MELO</span><span style="font-family:'Great Vibes',cursive;font-size:20px;color:#fff;margin-left:6px;vertical-align:middle">Studio</span>
      </div>

      <!-- hero -->
      <div style="margin-bottom:6px">
        <span style="font-family:'Great Vibes',cursive;font-size:62px;line-height:1;color:#e05297;display:block">Reset</span>
      </div>
      <div style="margin-bottom:36px">
        <span style="font-family:'Syne',sans-serif;font-size:72px;font-weight:800;letter-spacing:-0.04em;text-transform:uppercase;color:#fff;line-height:0.88;display:block">Password</span>
      </div>

      <!-- divider -->
      <div style="height:1px;background:rgba(255,255,255,0.07);margin-bottom:32px"></div>

      <!-- body text -->
      <p style="margin:0 0 32px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.45)">
        We received a request to reset the password for your account.<br>
        This link expires in <span style="color:#e05297;font-weight:600">1 hour</span>.
      </p>

      <!-- button -->
      <div style="margin-bottom:36px">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;background:#e05297;color:#fff;text-decoration:none;border-radius:100px;font-family:'Syne',sans-serif;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">
          Reset Password
        </a>
      </div>

      <!-- divider -->
      <div style="height:1px;background:rgba(255,255,255,0.07);margin-bottom:24px"></div>

      <!-- link fallback -->
      <p style="margin:0 0 24px;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.7">
        Or copy this link into your browser:<br>
        <span style="color:rgba(255,255,255,0.35);word-break:break-all">${resetUrl}</span>
      </p>

      <!-- footer -->
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.18)">
        If you didn't request this, you can safely ignore it.
      </p>

    </td></tr>
  </table>
</body>
</html>`,
  });
}
