import nodemailer from 'nodemailer'

function transporter() {
  const host = process.env.SMTP_HOST
  if (!host) throw Object.assign(new Error('Email notifications are not configured.'), { status: 503 })
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } : undefined,
  })
}

export async function sendDocumentNotification({ userId, recipient, documentName }) {
  if (typeof recipient !== 'string' || !/^\S+@\S+\.\S+$/.test(recipient.trim())) throw Object.assign(new Error('Enter a valid recipient email address.'), { status: 400 })
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  if (!from) throw Object.assign(new Error('SMTP_FROM or SMTP_USER must be configured.'), { status: 503 })
  await transporter().sendMail({
    from,
    to: recipient.trim(),
    subject: `Figdoc document: ${documentName || 'Untitled'}`,
    text: `A Figdoc content document is ready: ${documentName || 'Untitled'}`,
  })
  return { sent: true, userId }
}
