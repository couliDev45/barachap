/**
 * auth.routes.js
 * Routes d'inscription et de connexion pour les utilisateurs BaraChap.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur (Client ou Prestataire)
 */
router.post("/register", async (req, res) => {
  const { nomComplet, telephone, email, password, role, metier, ville, quartier } = req.body;

  if (!nomComplet || !telephone || !password) {
    return res.status(400).json({ message: "Veuillez fournir le nom complet, le téléphone et le mot de passe." });
  }

  try {
    // Vérification de l'existence du téléphone
    const userExist = await query("SELECT id FROM users WHERE telephone = $1", [telephone]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ message: "Un compte existe déjà avec ce numéro de téléphone." });
    }

    // Hachage du mot de passe
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRole = role === "prestataire" ? "prestataire" : "client";
    const statutValidation = userRole === "prestataire" ? "En attente" : "Validé";

    const newUser = await query(
      `INSERT INTO users (nom_complet, telephone, email, password_hash, role, metier, ville, quartier, statut_validation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, nom_complet, telephone, email, role, metier, ville, quartier, statut_validation, created_at`,
      [nomComplet, telephone, email || null, passwordHash, userRole, metier || null, ville || "Abidjan", quartier || null, statutValidation]
    );

    const user = newUser.rows[0];

    // Génération du token JWT
    const token = jwt.sign(
      { id: user.id, telephone: user.telephone, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Inscription réussie.",
      token,
      user,
    });
  } catch (err) {
    console.error("Erreur Inscription :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'inscription." });
  }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur (Client, Prestataire ou Admin)
 */
router.post("/login", async (req, res) => {
  const { identifiant, password, typeCompte } = req.body;

  if (!identifiant || !password) {
    return res.status(400).json({ message: "Veuillez saisir l'identifiant et le mot de passe." });
  }

  try {
    // Recherche par téléphone ou par email
    const result = await query(
      "SELECT * FROM users WHERE telephone = $1 OR email = $1",
      [identifiant]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Identifiant ou mot de passe incorrect." });
    }

    const user = result.rows[0];

    // Vérification du mot de passe
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiant ou mot de passe incorrect." });
    }

    // Génération du token JWT
    const token = jwt.sign(
      { id: user.id, telephone: user.telephone, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete user.password_hash;

    res.json({
      message: "Connexion réussie.",
      token,
      user,
    });
  } catch (err) {
    console.error("Erreur Connexion :", err);
    res.status(500).json({ message: "Erreur serveur lors de la connexion." });
  }
});

/**
 * GET /api/auth/me
 * Récupère le profil de l'utilisateur connecté via JWT
 */
router.get("/me", verifierToken, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, nom_complet, telephone, email, role, metier, ville, quartier, statut_validation, created_at FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(444).json({ message: "Utilisateur non trouvé." });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Erreur Me :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération du profil." });
  }
});

export default router;
