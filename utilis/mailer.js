// utils/mailer.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const host = process.env.EMAIL_HOST;
const port = Number(process.env.EMAIL_PORT || 587);
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const secure = String(process.env.EMAIL_SECURE || "false") === "true";
const from = process.env.EMAIL_FROM || `CBI Tunisia <${user}>`;

console.log("[MAIL] ENV CHECK", {
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
    secure, // false pour 587 (STARTTLS)
    auth: { user, pass },

    // ✅ Très important pour certains serveurs SMTP (dont Hostinger)
    requireTLS: port === 587,
    tls: {
      // ✅ évite certains soucis de handshake TLS selon env
      // (laisser true en prod strict si tout marche)
      rejectUnauthorized: false,
    },
  });

  // ✅ Vérification à l'initialisation pour détecter erreurs SMTP immédiatement
  transporter
    .verify()
    .then(() => console.log("[MAIL] SMTP verify ✅ OK"))
    .catch((e) => console.error("[MAIL] SMTP verify ❌ FAIL:", e?.message || e));

  console.log("[MAIL] Transporter configured for", host, "user:", user);
} else {
  console.warn(
    "[MAIL] Transporter not configured. Missing EMAIL_HOST / EMAIL_USER / EMAIL_PASS"
  );
}

async function sendEmailVerification(to, code) {
  if (!transporter) {
    console.warn("[MAIL] Transporter not configured, skipping send.");
    return false;
  }

  const mailOptions = {
    from,
    to,
    subject: "CBI Tunisia - Vérification de votre adresse email",

    // ✅ optionnel: utile pour suivi / éviter spam dans certains cas
    headers: {
      "X-Entity-Ref-ID": `otp-${Date.now()}`,
    },

    text: `Bonjour,

Voici votre code de vérification CBI Tunisia : ${code}

Ce code est valable 60 secondes.

Cordialement,
CBI Tunisia`,

    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <p>Bonjour,</p>
        <p>Voici votre code de vérification <b>CBI Tunisia</b> :</p>
        <div style="font-size: 26px; font-weight: 700; letter-spacing: 6px; margin: 12px 0;">
          ${code}
        </div>
        <p>Ce code est valable <b>60 secondes</b>.</p>
        <p>Cordialement,<br/>CBI Tunisia</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("[MAIL] Verification email sent to", to, "messageId:", info.messageId);
    return true;
  } catch (err) {
    console.error("[MAIL] Error sending verification:", {
      message: err?.message,
      code: err?.code,
      response: err?.response,
      responseCode: err?.responseCode,
      command: err?.command,
    });
    return false;
  }
}

module.exports = { sendEmailVerification };
