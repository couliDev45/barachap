/**
 * auth.routes.js
 * Routes d'inscription, de connexion et de réinitialisation de mot de passe
 * pour les utilisateurs BaraChap.
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";
import { envoyerMessageTelegram, echapperTelegram } from "../utils/telegram.js";
import { envoyerEmailReinitialisation } from "../utils/email.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "barachap_super_secret_key_2026";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://barachap.vercel.app";

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur (Client ou Prestataire).
 * Envoie une alerte Telegram à l'admin à chaque nouvelle inscription
 * (best-effort, jamais bloquant pour la réponse envoyée à l'utilisateur).
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
       RETURNING id, nom_complet, telephone, email, role, metier, ville, quartier, bio, photo_url, statut_validation, created_at`,
      [nomComplet, telephone, email || null, passwordHash, userRole, metier || null, ville || "Abidjan", quartier || null, statutValidation]
    );

    const user = newUser.rows[0];

    // Génération du token JWT
    const token = jwt.sign(
      { id: user.id, telephone: user.telephone, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Alerte Telegram : nouvelle inscription. Ne bloque jamais la réponse
    // au client, et n'empêche jamais l'inscription en cas d'échec d'envoi.
    const labelRole =
      userRole === "prestataire" ? `Prestataire (${echapperTelegram(metier || "métier non précisé")})` : "Client";

    envoyerMessageTelegram(
      `🆕 <b>Nouvelle inscription</b>\n\n👤 ${echapperTelegram(nomComplet)}\n📱 ${echapperTelegram(telephone)}\n🏷️ ${labelRole}\n📍 ${echapperTelegram(ville || "Abidjan")}`,
    ).catch(() => {});

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
 * Récupère le profil de l'utilisateur connecté via JWT.
 */
router.get("/me", verifierToken, async (req, res) => {
  try {
    const result = await query(
      "SELECT id, nom_complet, telephone, email, role, metier, ville, quartier, bio, photo_url, statut_validation, disponible, created_at FROM users WHERE id = $1",
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

/**
 * POST /api/auth/mot-de-passe-oublie
 * Démarre une réinitialisation de mot de passe. Ne révèle JAMAIS si le
 * compte existe ou s'il a un email renseigné — répond toujours le même
 * message générique, que l'envoi ait réellement eu lieu ou non. C'est une
 * protection standard contre l'énumération de comptes.
 */
router.post("/mot-de-passe-oublie", async (req, res) => {
  const { identifiant } = req.body;

  const messageGenerique = {
    message:
      "Si un compte associé existe avec un email renseigné, un lien de réinitialisation vient de lui être envoyé.",
  };

  if (!identifiant) {
    return res.status(400).json({ message: "Veuillez indiquer votre téléphone ou votre email." });
  }

  try {
    const result = await query(
      "SELECT id, nom_complet, email FROM users WHERE telephone = $1 OR email = $1",
      [identifiant],
    );

    // Toujours la même réponse, que l'utilisateur existe ou non, et qu'il
    // ait un email ou non — voir commentaire ci-dessus.
    if (result.rows.length === 0 || !result.rows[0].email) {
      return res.json(messageGenerique);
    }

    const user = result.rows[0];

    // Jeton aléatoire, jamais stocké en clair : on garde son empreinte SHA-256
    // en base et on n'envoie que la version en clair par email. Même en cas
    // de fuite de la base, un attaquant ne peut pas reconstituer le jeton.
    const jetonClair = crypto.randomBytes(32).toString("hex");
    const jetonHache = crypto.createHash("sha256").update(jetonClair).digest("hex");
    const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await query("UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3", [
      jetonHache,
      expiration,
      user.id,
    ]);

    const lien = `${FRONTEND_URL}/pages/reinitialiser-mot-de-passe.html?token=${jetonClair}`;
    envoyerEmailReinitialisation(user.email, user.nom_complet, lien).catch(() => {});

    res.json(messageGenerique);
  } catch (err) {
    console.error("Erreur Mot De Passe Oublié :", err);
    res.status(500).json({ message: "Erreur serveur lors de la demande de réinitialisation." });
  }
});

/**
 * POST /api/auth/reinitialiser-mot-de-passe
 * Termine la réinitialisation : vérifie le jeton (non expiré, correspond à
 * un utilisateur), enregistre le nouveau mot de passe, et invalide le jeton
 * immédiatement pour qu'il ne puisse pas être réutilisé.
 */
router.post("/reinitialiser-mot-de-passe", async (req, res) => {
  const { token, nouveauMotDePasse } = req.body;

  if (!token || !nouveauMotDePasse) {
    return res.status(400).json({ message: "Requête invalide." });
  }

  if (nouveauMotDePasse.length < 6) {
    return res.status(400).json({ message: "Le mot de passe doit contenir au moins 6 caractères." });
  }

  try {
    const jetonHache = crypto.createHash("sha256").update(token).digest("hex");

    const result = await query(
      "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [jetonHache],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Ce lien de réinitialisation est invalide ou a expiré." });
    }

    const userId = result.rows[0].id;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(nouveauMotDePasse, salt);

    await query(
      "UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [passwordHash, userId],
    );

    res.json({ message: "Votre mot de passe a été réinitialisé avec succès." });
  } catch (err) {
    console.error("Erreur Réinitialisation Mot De Passe :", err);
    res.status(500).json({ message: "Erreur serveur lors de la réinitialisation." });
  }
});

/**
 * POST /api/auth/changer-mot-de-passe
 * Change le mot de passe de l'utilisateur connecté. Exige le mot de passe
 * actuel (pas seulement le JWT) pour éviter qu'une session volée/laissée
 * ouverte sur un appareil partagé permette de changer le mot de passe sans
 * le connaître.
 */
router.post("/changer-mot-de-passe", verifierToken, async (req, res) => {
  const { motDePasseActuel, nouveauMotDePasse } = req.body;
  const userId = req.user.id;

  if (!motDePasseActuel || !nouveauMotDePasse) {
    return res.status(400).json({ message: "Veuillez remplir tous les champs." });
  }

  if (nouveauMotDePasse.length < 6) {
    return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 6 caractères." });
  }

  try {
    const result = await query("SELECT password_hash FROM users WHERE id = $1", [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    const motDePasseValide = await bcrypt.compare(motDePasseActuel, result.rows[0].password_hash);
    if (!motDePasseValide) {
      return res.status(400).json({ message: "Le mot de passe actuel est incorrect." });
    }

    const salt = await bcrypt.genSalt(10);
    const nouveauHash = await bcrypt.hash(nouveauMotDePasse, salt);

    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [nouveauHash, userId]);

    res.json({ message: "Mot de passe modifié avec succès." });
  } catch (err) {
    console.error("Erreur Changement Mot De Passe :", err);
    res.status(500).json({ message: "Erreur serveur lors du changement de mot de passe." });
  }
});

export default router;
