// routes/auth.routes.js
const express = require("express");
const { body, query } = require("express-validator");
const Auth = require("../controllers/auth.controller");

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

module.exports = router;
