// middleware/authRequired.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Vérifie le token dans le header Authorization

  if (!token) {
    return res.status(403).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Ajoute l'utilisateur décodé à la requête
    next(); // Continue vers le prochain middleware ou route
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide' });
  }
};
