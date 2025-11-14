import { transporter } from "../config/mailer";

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendContactEmail(payload: {
  fullName: string;
  email: string;
  organisation?: string;
  phone?: string;
  message: string;
  city: string;
  country: string;
  address: string;
}) {
  const subject = `[HasakePlay] New contact from ${payload.fullName}`;
  const fromName = process.env.MAIL_FROM_NAME || "HasakePlay Website";
  const fromAddr = process.env.MAIL_FROM_ADDR || process.env.SMTP_USER!;
  const toAdmin = process.env.MAIL_TO_ADDR!;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body>
<div style="font-family: Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0; padding: 24px; background:#f6f7f9;">
  <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden;">
    <div style="padding:16px 20px;border-bottom:1px solid #eee;">
      <span style="font-size:18px;font-weight:600;color:#00466a;">HasakePlay — Contact Form</span>
    </div>
    <div style="padding:20px;">
      <p style="margin:0 0 12px;">You've received a new contact from the website.</p>
      <table cellspacing="0" cellpadding="8" style="width:100%;border-collapse:collapse;background:#fafbfc;">
        <tr><td style="width:180px;"><b>Full name</b></td><td>${escapeHtml(
          payload.fullName
        )}</td></tr>
        <tr><td><b>Email</b></td><td>${escapeHtml(payload.email)}</td></tr>
        ${
          payload.organisation
            ? `<tr><td><b>Organization</b></td><td>${escapeHtml(
                payload.organisation
              )}</td></tr>`
            : ""
        }
        ${
          payload.phone
            ? `<tr><td><b>Phone</b></td><td>${escapeHtml(
                payload.phone
              )}</td></tr>`
            : ""
        }
        <tr><td><b>City</b></td><td>${escapeHtml(payload.city)}</td></tr>
        <tr><td><b>Country</b></td><td>${escapeHtml(payload.country)}</td></tr>
        <tr><td><b>Address</b></td><td>${escapeHtml(payload.address)}</td></tr>
      </table>

      <h3 style="margin:16px 0 8px;font-size:16px;">Message</h3>
      <div style="white-space:pre-wrap;background:#fff;border:1px solid #eee;padding:12px;border-radius:6px;">
        ${escapeHtml(payload.message)}
      </div>
    </div>
    <div style="padding:14px 20px;border-top:1px solid #eee;color:#777;font-size:12px;">
      This email was sent automatically from HasakePlay.com.vn. Click Reply to respond directly to the sender.
    </div>
  </div>
</div>
</body></html>`;

  const text = `${subject}

Full name: ${payload.fullName}
Email: ${payload.email}
${payload.organisation ? `Organization: ${payload.organisation}\n` : ""}${
    payload.phone ? `Phone: ${payload.phone}\n` : ""
  }City: ${payload.city}
Country: ${payload.country}
Address: ${payload.address}

Message:
${payload.message}
`;

  const mailOptions = {
    from: `"${fromName}" <${fromAddr}>`,
    to: toAdmin,
    replyTo: payload.email,
    subject,
    html,
    text,
  };

  return transporter.sendMail(mailOptions);
}
