// controllers/auth.controller.js
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
require("dotenv").config();

const db = require("../models");
const { User, Sequelize } = db;
const { Op, fn, col, where } = Sequelize;

const { verifyRecaptcha } = require("../utilis/recaptcha");
const { sendEmailVerification } = require("../utilis/mailer");

const privKeyPath = process.env.JWT_PRIVATE_KEY_PATH || "./keys/jwtRS256.key";
const pubKeyPath = process.env.JWT_PUBLIC_KEY_PATH || "./keys/jwtRS256.key.pub";
const privateKey = fs.readFileSync(path.resolve(privKeyPath), "utf8");
const publicKey = fs.readFileSync(path.resolve(pubKeyPath), "utf8");

const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES_IN || "7d";

const signAccessToken = (p) =>
  jwt.sign(p, privateKey, {
    algorithm: "RS256",
    expiresIn: ACCESS_EXPIRES,
  });

const signRefreshToken = (p) =>
  jwt.sign(
    { ...p, typ: "refresh" },
    privateKey,
    { algorithm: "RS256", expiresIn: REFRESH_EXPIRES }
  );

/** GET /auth/check-email?email=... */
exports.checkEmail = async (req, res) => {
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ ok:false, error: 'Missing email' });
  const exists = await User.findOne({ where: where(fn('lower', col('email')), email) });
  return res.json({ ok:true, exists: !!exists });
};


/** POST /auth/signup */
exports.signUp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const {
    username, firstname, lastname,
    email, tel, adresse, code_postal,
    profession, company, country, zip,
    password, confirmPassword,
    recaptchaToken
  } = req.body;

  try {
    // (en dev tu as le log [reCAPTCHA] No SECRET configured, c'est OK)

    // unicité email / username
    const exists = await User.findOne({
      where: {
        [Op.or]: [
          where(fn('lower', col('email')), email.toLowerCase()),
          { username }
        ]
      }
    });
    if (exists) {
      return res.status(409).json({
        error: exists.username === username ? 'username already exists' : 'email already exists'
      });
    }

    if (!password || password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // hash du mot de passe
    const password_hash = await bcrypt.hash(password, 10);

    // code OTP 6 chiffres – validité 10 minutes (plus confortable)
    const code    = String(Math.floor(100000 + Math.random() * 900000)); // ex: "834291"
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('[AUTH] Generated OTP', code, 'for', email, 'valid until', expires.toISOString());

    const user = await User.create({
      username,
      firstname,
      lastname,
      email: email.toLowerCase(),
      tel,
      adresse: adresse || null,
      code_postal: code_postal || null,
      profession,
      company,
      country,
      zip,
      password_hash,
      email_verified: false,
      email_verification_token: code,
      email_verification_expires: expires,
    });

    const mailOk = await sendEmailVerification(user.email, code);
    if (!mailOk) {
      console.warn('[AUTH] User created, but verification email could not be sent (check SMTP config).');
    }

    return res.status(201).json({
      ok: true,
      message: 'Account created. We sent you a verification code by email.',
      email: user.email,
    });
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Already exists', fields: e.errors?.map(x => x.path) });
    }
    console.error(e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
};

/** POST /auth/verify-email-code { email, code } */
/** POST /auth/verify-email-code { email, code } */
exports.verifyEmailCode = async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'Missing email or code' });
  }

  try {
    const emailNorm = String(email).toLowerCase().trim();
    const codeNorm  = String(code).trim();

    const user = await User.findOne({
      where: where(fn('lower', col('email')), emailNorm),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.email_verified) {
      return res.json({ ok: true, message: 'Email already verified' });
    }

    if (!user.email_verification_token || !user.email_verification_expires) {
      return res.status(400).json({ error: 'No verification code, please register again' });
    }

    const now = new Date();
    if (user.email_verification_expires < now) {
      return res.status(400).json({ error: 'Code expired' });
    }

    console.log('[AUTH] Checking OTP', {
      email: user.email,
      stored: String(user.email_verification_token),
      received: codeNorm,
    });

    if (codeNorm !== String(user.email_verification_token)) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    await user.save();

    return res.json({ ok: true, message: 'Email verified successfully' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Ancien endpoint par lien (optionnel)
exports.verifyEmail = async (req, res) => {
  return res
    .status(410)
    .json({ error: "Deprecated. Use /auth/verify-email-code." });
};

/** POST /auth/signin */
exports.signIn = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { login, password } = req.body;

  try {
    let user = await User.scope("withSecret").findOne({
      where: where(fn("lower", col("email")), login.toLowerCase()),
    });
    if (!user)
      user = await User.scope("withSecret").findOne({ where: { username: login } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.email_verified) {
      return res.status(403).json({ error: "Email not verified" });
    }

    const ok = await user.checkPassword(password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const payload = {
      sub: user.id,
      email: user.email,
      role: "user",
      name: `${user.firstname} ${user.lastname}`,
      username: user.username,
    };

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        tel: user.tel,
        profession: user.profession,
        company: user.company,
        country: user.country,
        zip: user.zip,
        adresse: user.adresse,
        role: "user",
        created_at: user.createdAt,
      },
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken({ sub: user.id }),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", details: e.message });
  }
};

/** POST /auth/refresh */
exports.refresh = async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "Missing refresh token" });
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    if (decoded.typ !== "refresh")
      return res.status(400).json({ error: "Not a refresh token" });

    const user = await User.findByPk(decoded.sub);
    if (!user) return res.status(401).json({ error: "User not found" });

    const payload = {
      sub: user.id,
      email: user.email,
      role: "user",
      name: `${user.firstname} ${user.lastname}`,
      username: user.username,
    };
    return res.json({ accessToken: signAccessToken(payload) });
  } catch {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};
