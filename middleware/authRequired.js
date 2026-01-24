// middleware/authRequired.js
require("dotenv").config(); // ✅ IMPORTANT: charger .env ici

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// ✅ Chemin robuste (relatif au ROOT du projet = process.cwd())
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

    // ✅ bloque refresh token dans Authorization
    if (decoded?.typ === "refresh") {
      return res.status(401).json({ ok: false, error: "Refresh token not allowed" });
    }

    const userId =
      decoded?.sub ?? decoded?.id ?? decoded?.userId ?? decoded?.user?.id ?? null;

    if (!userId) {
      return res
        .status(401)
        .json({ ok: false, error: "Unauthorized (no user id in token)" });
    }

    req.user = decoded;
    req.userId = String(userId);
    next();
  } catch (e) {
    console.log("[AUTH] JWT verify failed:", e.name, e.message);
    return res.status(401).json({ ok: false, error: `${e.name}: ${e.message}` });
  }
};
