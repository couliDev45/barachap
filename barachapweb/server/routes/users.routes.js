/**
 * users.routes.js
 * Routes pour la gestion des profils et le catalogue des prestataires.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/users/prestataires
 * Récupère la liste des prestataires filtrables par catégorie, ville et quartier
 */
router.get("/prestataires", async (req, res) => {
  const { category, ville, quartier, search } = req.query;

  try {
    let sql = `
      SELECT id, nom_complet, telephone, email, metier, ville, quartier, bio, photo_url, statut_validation, created_at,
        (SELECT ROUND(AVG(note), 1) FROM avis WHERE avis.prestataire_id = users.id) AS note_moyenne,
        (SELECT COUNT(*) FROM avis WHERE avis.prestataire_id = users.id) AS total_avis
      FROM users
      WHERE role = 'prestataire' AND statut_validation = 'Validé'
    `;
    const params = [];

    if (category && category !== "all") {
      params.push(`%${category}%`);
      sql += ` AND LOWER(metier) LIKE LOWER($${params.length})`;
    }

    if (ville && ville !== "all") {
      params.push(`%${ville}%`);
      sql += ` AND LOWER(ville) LIKE LOWER($${params.length})`;
    }

    if (quartier && quartier !== "all") {
      params.push(`%${quartier}%`);
      sql += ` AND LOWER(quartier) LIKE LOWER($${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (LOWER(nom_complet) LIKE LOWER($${params.length}) OR LOWER(metier) LIKE LOWER($${params.length}) OR LOWER(ville) LIKE LOWER($${params.length}))`;
    }

    sql += " ORDER BY created_at DESC";

    const result = await query(sql, params);
    res.json({ prestataires: result.rows });
  } catch (err) {
    console.error("Erreur Récupération Prestataires :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des prestataires." });
  }
});

/**
 * GET /api/users/prestataires/:id
 * Récupère le profil d'un prestataire par son ID
 */
router.get("/prestataires/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await query(
      "SELECT id, nom_complet, telephone, email, metier, ville, quartier, bio, photo_url, created_at FROM users WHERE id = $1 AND role = 'prestataire'",
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Prestataire non trouvé." });
    }

    const servicesResult = await query(
      "SELECT * FROM services WHERE prestataire_id = $1 ORDER BY created_at DESC",
      [id]
    );

    const realisationsResult = await query(
      "SELECT * FROM realisations WHERE prestataire_id = $1 ORDER BY created_at DESC",
      [id]
    );

    res.json({
      prestataire: userResult.rows[0],
      services: servicesResult.rows,
      realisations: realisationsResult.rows,
    });
  } catch (err) {
    console.error("Erreur Profil Prestataire :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération du profil." });
  }
});

/**
 * PUT /api/users/me
 * Met à jour le profil de l'utilisateur connecté (bio, photo, ville, quartier).
 * Seuls les champs fournis sont modifiés — envoyer un champ vide ("") l'efface
 * explicitement, ne pas l'envoyer du tout laisse la valeur actuelle inchangée.
 */
router.put("/me", verifierToken, async (req, res) => {
  const { bio, photoUrl, ville, quartier } = req.body;
  const userId = req.user.id;

  try {
    const result = await query(
      `UPDATE users SET
        bio = COALESCE($1, bio),
        photo_url = COALESCE($2, photo_url),
        ville = COALESCE($3, ville),
        quartier = COALESCE($4, quartier),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, nom_complet, telephone, email, role, metier, ville, quartier, bio, photo_url, statut_validation, created_at`,
      [bio ?? null, photoUrl ?? null, ville ?? null, quartier ?? null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    res.json({ message: "Profil mis à jour avec succès.", user: result.rows[0] });
  } catch (err) {
    console.error("Erreur Maj Profil :", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour du profil." });
  }
});

export default router;
