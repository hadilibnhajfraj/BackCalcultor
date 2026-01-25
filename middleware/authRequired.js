// middleware/verifyToken.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// ✅ Charger la clé publique RS256
const pubKeyPath = process.env.JWT_PUBLIC_KEY_PATH || "./keys/jwtRS256.key.pub";
const absPubKeyPath = path.isAbsolute(pubKeyPath)
  ? pubKeyPath
  : path.join(process.cwd(), pubKeyPath);

let publicKey = null;
try {
  publicKey = fs.readFileSync(absPubKeyPath, "utf8");
  console.log("[AUTH] Public key loaded from:", absPubKeyPath);
} catch (e) {
  console.error("[AUTH] Cannot read public key:", absPubKeyPath, e.message);
}

module.exports = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!token) {
    return res.status(403).json({ ok: false, error: "Token manquant" });
  }

  if (!publicKey) {
    return res.status(500).json({ ok: false, error: "JWT public key not loaded" });
  }

  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });

    // ✅ Bloquer refresh tokens dans Authorization
    if (decoded?.typ === "refresh") {
      return res.status(401).json({ ok: false, error: "Refresh token not allowed" });
    }

    // ✅ Extraire userId (doit être INTEGER)
    const rawUserId =
      decoded?.sub ?? decoded?.id ?? decoded?.userId ?? decoded?.user?.id ?? null;

    const userId = Number(rawUserId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res
        .status(401)
        .json({ ok: false, error: "Unauthorized (invalid user id in token)" });
    }

    req.user = decoded;
    req.userId = userId; // ✅ number (IMPORTANT)
    next();
  } catch (e) {
    console.error("[AUTH] JWT verify failed:", e.name, e.message);
    return res.status(401).json({ ok: false, error: `${e.name}: ${e.message}` });
  }
};
