require("dotenv").config(); // Charger les variables d'environnement

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// Charger la clé publique de manière robuste
const pubKeyPath = process.env.JWT_PUBLIC_KEY_PATH || "./keys/jwtRS256.key.pub";
const absPubKeyPath = path.isAbsolute(pubKeyPath) ? pubKeyPath : path.join(process.cwd(), pubKeyPath);

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

  // Vérifier si le token est présent
  if (!token) {
    return res.status(403).json({ ok: false, error: "Token manquant" });
  }

  // Si la clé publique n'est pas chargée, renvoyer une erreur serveur
  if (!publicKey) {
    return res.status(500).json({ ok: false, error: "JWT public key not loaded" });
  }

  try {
    // Vérifier la validité du token avec la clé publique
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });

    // Bloquer les refresh tokens dans Authorization
    if (decoded?.typ === "refresh") {
      return res.status(401).json({ ok: false, error: "Refresh token not allowed" });
    }

    // Extraire l'ID de l'utilisateur du token
    const userId =
      decoded?.sub ?? decoded?.id ?? decoded?.userId ?? decoded?.user?.id ?? null;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized (no user id in token)" });
    }

    // Attacher l'utilisateur à la requête pour les middlewares suivants
    req.user = decoded;
    req.userId = String(userId); // Utiliser une chaîne de caractères pour l'ID de l'utilisateur
    next();
  } catch (e) {
    // En cas d'échec de la validation du token
    console.error("[AUTH] JWT verify failed:", e.name, e.message);
    return res.status(401).json({ ok: false, error: `${e.name}: ${e.message}` });
  }
};
