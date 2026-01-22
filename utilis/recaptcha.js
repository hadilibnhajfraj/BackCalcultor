// utils/recaptcha.js
require("dotenv").config();

const SECRET = process.env.RECAPTCHA_SECRET_KEY;

/**
 * Vérifie le token reCAPTCHA envoyé par le frontend.
 * @param {string} token
 * @param {string} remoteIp
 * @returns {Promise<boolean>}
 */
async function verifyRecaptcha(token, remoteIp) {
  if (!token) {
    console.warn("[reCAPTCHA] Missing token");
    return false;
  }

  if (!SECRET) {
    console.warn(
      "[reCAPTCHA] No SECRET configured. Skipping verification (DEV ONLY)."
    );
    return true; // ⚠️ à désactiver en prod
  }

  try {
    const params = new URLSearchParams();
    params.append("secret", SECRET);
    params.append("response", token);
    if (remoteIp) params.append("remoteip", remoteIp);

    const res = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        body: params,
      }
    );

    const data = await res.json();
    console.log("[reCAPTCHA] response:", data);
    return !!data.success;
  } catch (err) {
    console.error("[reCAPTCHA] Error:", err);
    return false;
  }
}

module.exports = { verifyRecaptcha };
