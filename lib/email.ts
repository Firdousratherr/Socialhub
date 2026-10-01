import nodemailer from "nodemailer";

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password || !Number.isFinite(port)) {
    throw new Error("SMTP is not configured.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (!from) throw new Error("SMTP_FROM or SMTP_USER is required.");

  const transporter = getTransporter();
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
