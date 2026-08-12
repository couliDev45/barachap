/**
 * auth.js
 * Middleware de vérification des jetons JWT pour sécuriser les routes privées.
 */

import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Aborting.");
  process.exit(1);
}

/**
 * Vérifie qu'un jeton JWT valide est présent dans l'en-tête Authorization.
 */
export function verifierToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Accès refusé. Aucun jeton fourni." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Jeton invalide ou expiré." });
  }
}

/**
 * Middleware pour restreindre l'accès aux administrateurs uniquement.
 */
export function verifierAdmin(req, res, next) {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ message: "Accès réservé aux administrateurs." });
  }
}
