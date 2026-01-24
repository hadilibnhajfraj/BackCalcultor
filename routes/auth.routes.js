// routes/auth.routes.js
const express = require("express");
const { body, query } = require("express-validator");
const Auth = require("../controllers/auth.controller");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const { User } = require("../models");

const router = express.Router();

// Vérif d'unicité email (live)
router.get(
  "/check-email",
  [query("email").isEmail().withMessage("Email invalide")],
  Auth.checkEmail
);

router.post(
  "/signup",
  [
    body("username")
      .trim()
      .isLength({ min: 3 })
      .matches(/^[a-zA-Z0-9._-]+$/),
    body("firstname").trim().isLength({ min: 2 }),
    body("lastname").trim().isLength({ min: 2 }),
    body("email").isEmail(),

    body("tel")
      .trim()
      .matches(/^[0-9+()\s-]{6,20}$/),
    body("profession").trim().isLength({ min: 2 }),
    body("company").trim().isLength({ min: 2 }),
    body("country").trim().isLength({ min: 2 }),
    body("zip")
      .trim()
      .matches(/^[0-9A-Za-z-]{3,12}$/),

    body("adresse")
      .optional({ nullable: true, checkFalsy: true })
      .isLength({ max: 255 }),
    body("code_postal")
      .optional({ nullable: true, checkFalsy: true })
      .matches(/^[0-9A-Za-z-]{3,10}$/),

    body("password").isStrongPassword({
      minLength: 8,
      minNumbers: 1,
      minSymbols: 1,
    }),
    body("confirmPassword").custom((v, { req }) => {
      if (v !== req.body.password) throw new Error("Passwords mismatch");
      return true;
    }),

    body("recaptchaToken").isString().notEmpty(),
  ],
  Auth.signUp
);

// ✅ nouvel endpoint pour l’OTP
router.post(
  "/verify-email-code",
  [body("email").isEmail(), body("code").trim().isLength({ min: 4, max: 10 })],
  Auth.verifyEmailCode
);

router.get("/verify-email", Auth.verifyEmail); // fallback optionnel

router.post(
  "/signin",
  [body("login").notEmpty(), body("password").isString().notEmpty()],
  Auth.signIn
);

router.post("/refresh", Auth.refresh);
/* ------------------ JWT RESET (RS256) ------------------ */
const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH;
const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH;

if (!privateKeyPath || !publicKeyPath) {
  console.warn("[RESET] Missing JWT_PRIVATE_KEY_PATH or JWT_PUBLIC_KEY_PATH in .env");
}

const JWT_PRIVATE_KEY = privateKeyPath
  ? fs.readFileSync(path.resolve(privateKeyPath), "utf8")
  : null;

const JWT_PUBLIC_KEY = publicKeyPath
  ? fs.readFileSync(path.resolve(publicKeyPath), "utf8")
  : null;

const RESET_EXPIRES_IN = process.env.RESET_EXPIRES_IN || "1h";
const FRONT_URL = process.env.FRONT_URL || "http://localhost:5173";

/* ------------------ MAIL (Hostinger SMTP) ------------------ */
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: String(process.env.EMAIL_SECURE).toLowerCase() === "true", // false pour 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;

/* ====================== FORGOT PASSWORD ====================== */
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Email invalide")],
  async (req, res) => {
    try {
      if (!JWT_PRIVATE_KEY) {
        return res.status(500).json({
          ok: false,
          error: "JWT private key not configured (JWT_PRIVATE_KEY_PATH).",
        });
      }

      const email = String(req.body.email || "").toLowerCase().trim();
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.json({ ok: true, message: "Si l'email existe, un lien a été envoyé." });
      }

      const resetToken = jwt.sign(
        { sub: user.id, purpose: "reset-password" },
        JWT_PRIVATE_KEY,
        { algorithm: "RS256", expiresIn: RESET_EXPIRES_IN }
      );

      const resetUrl = `${FRONT_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

      await transporter.sendMail({
        from: EMAIL_FROM,
        to: email,
        subject: "Réinitialisation du mot de passe",
        html: `
          <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
            <p>Bonjour,</p>
            <p>Vous avez demandé une réinitialisation de mot de passe.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#ff5e14;color:#fff;text-decoration:none;border-radius:6px">
                Réinitialiser le mot de passe
              </a>
            </p>
            <p>Ce lien expirera dans ${RESET_EXPIRES_IN}.</p>
          </div>
        `,
      });

      return res.json({ ok: true, message: "Email envoyé." });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: e.message || "Erreur serveur" });
    }
  }
);

/* ====================== RESET PASSWORD ====================== */
router.post(
  "/reset-password",
  [
    body("token").isString().notEmpty(),
    body("newPassword")
      .isString()
      .isLength({ min: 8 })
      .withMessage("Mot de passe min 8 caractères"),
  ],
  async (req, res) => {
    try {
      if (!JWT_PUBLIC_KEY) {
        return res.status(500).json({
          ok: false,
          error: "JWT public key not configured (JWT_PUBLIC_KEY_PATH).",
        });
      }

      const { token, newPassword } = req.body;

      const decoded = jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ["RS256"] });

      if (decoded?.purpose !== "reset-password") {
        return res.status(400).json({ ok: false, error: "Token invalide (purpose)." });
      }

      const userId = decoded.sub;
      const user = await User.scope("withSecret").findByPk(userId);

      if (!user) {
        return res.status(404).json({ ok: false, error: "Utilisateur non trouvé" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      user.password_hash = hashed;
      await user.save();

      return res.json({ ok: true, message: "Mot de passe réinitialisé avec succès" });
    } catch (e) {
      console.error(e);
      return res.status(400).json({ ok: false, error: e.message || "Token invalide" });
    }
  }
);



module.exports = router;
