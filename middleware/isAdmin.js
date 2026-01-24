module.exports = (req, res, next) => {
  // Vérifie si l'utilisateur est authentifié et a un rôle "admin"
  const role = req.user?.role;

  // Si l'utilisateur n'est pas authentifié ou n'a pas le rôle "admin"
  if (!role || role !== "admin") {
    return res.status(403).json({
      ok: false,
      error: "Access denied: Admin only or user is not authenticated."
    });
  }

  // Passe à la suite de la requête si l'utilisateur est un admin
  next();
};
