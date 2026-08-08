/**
 * users.routes.js
 * Routes pour la gestion des profils et le catalogue des prestataires.
 */

import { Router } from "express";
import { query } from "../config/db.js";

const router = Router();

/**
 * GET /api/users/prestataires
 * Récupère la liste des prestataires filtrables par catégorie, ville et quartier
 */
router.get("/prestataires", async (req, res) => {
  const { category, ville, quartier, search } = req.query;

  try {
    let sql = `
      SELECT id, nom_complet, telephone, email, metier, ville, quartier, statut_validation, created_at
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
      "SELECT id, nom_complet, telephone, email, metier, ville, quartier, created_at FROM users WHERE id = $1 AND role = 'prestataire'",
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

export default router;
