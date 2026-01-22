// utils/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const host   = process.env.EMAIL_HOST;
const port   = Number(process.env.EMAIL_PORT || 587);
const user   = process.env.EMAIL_USER;
const pass   = process.env.EMAIL_PASS;
const secure = String(process.env.EMAIL_SECURE || 'false') === 'true';
const from   = process.env.EMAIL_FROM || user;

console.log('[MAIL] ENV CHECK', {
  host,
  port,
  user,
  hasPass: !!pass,
  secure,
  from,
});

let transporter = null;

if (host && user && pass) {
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  console.log('[MAIL] Transporter configured for', host, 'user:', user);
} else {
  console.warn('[MAIL] Transporter not configured. Missing EMAIL_HOST / EMAIL_USER / EMAIL_PASS');
}

async function sendEmailVerification(to, code) {
  if (!transporter) {
    console.warn('[MAIL] Transporter not configured, skipping send.');
    return false;
  }

  const mailOptions = {
    from,
    to,
    subject: 'CBI Tunisia - Vérification de votre adresse email',
    text: `Bonjour,

Voici votre code de vérification CBI Tunisia : ${code}

Ce code est valable 60 secondes.

Cordialement,
CBI Tunisia`,
    html: `
      <p>Bonjour,</p>
      <p>Voici votre code de vérification <b>CBI Tunisia</b> :</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>Ce code est valable <b>60 secondes</b>.</p>
      <p>Cordialement,<br/>CBI Tunisia</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[MAIL] Verification email sent to', to);
    return true;
  } catch (err) {
    console.error('[MAIL] Error sending verification:', err);
    return false;
  }
}

module.exports = { sendEmailVerification };
