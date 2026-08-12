/**
 * admin.routes.js
 * Routes réservées à l'administration de la plateforme BaraChap.
 */

import { Router } from "express";
import logger from "../utils/logger.js";
import { query } from "../config/db.js";

const router = Router();

/**
 * GET /api/admin/pending
 * Récupère les prestataires en attente de validation
 */
router.get("/pending", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, nom_complet, telephone, email, metier, ville, quartier, created_at FROM users WHERE role = 'prestataire' AND statut_validation = 'En attente' ORDER BY created_at DESC"
    );

    res.json({ pendingPrestataires: result.rows });
  } catch (err) {
    logger.error("Erreur Admin Pending :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des validations." });
  }
});

/**
 * PUT /api/admin/validate/:id
 * Valide ou rejette l'inscription d'un prestataire
 */
router.put("/validate/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'Valider' ou 'Rejeter'

  const nvtStatut = action === "Rejeter" ? "Rejeté" : "Validé";

  try {
    const result = await query(
      "UPDATE users SET statut_validation = $1 WHERE id = $2 AND role = 'prestataire' RETURNING id, nom_complet, statut_validation",
      [nvtStatut, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Prestataire non trouvé." });
    }

    res.json({
      message: `Le prestataire ${result.rows[0].nom_complet} a été ${nvtStatut.toLowerCase()}.`,
      prestataire: result.rows[0],
    });
  } catch (err) {
    logger.error("Erreur Admin Validate :", err);
    res.status(500).json({ message: "Erreur serveur lors de la validation." });
  }
});

/**
 * GET /api/admin/users
 * Récupère la liste globale des utilisateurs (Clients et Prestataires)
 */
router.get("/users", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, nom_complet, telephone, email, role, metier, ville, statut_validation, created_at FROM users ORDER BY created_at DESC"
    );

    res.json({ users: result.rows });
  } catch (err) {
    logger.error("Erreur Admin Users :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des utilisateurs." });
  }
});

/**
 * POST /api/admin/categories
 * Ajouter une nouvelle catégorie de service
 */
router.post("/categories", async (req, res) => {
  const { nom, description } = req.body;

  if (!nom) {
    return res.status(400).json({ message: "Le nom de la catégorie est obligatoire." });
  }

  try {
    const result = await query(
      "INSERT INTO categories (nom, description) VALUES ($1, $2) RETURNING *",
      [nom, description || null]
    );

    res.status(201).json({
      message: `Catégorie "${nom}" créée avec succès.`,
      categorie: result.rows[0],
    });
  } catch (err) {
    logger.error("Erreur Admin Category :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création de la catégorie." });
  }
});

/**
 * GET /api/admin/stats
 * Récupère les statistiques globales de la plateforme
 */
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await query("SELECT COUNT(*) FROM users");
    const totalPrestataires = await query("SELECT COUNT(*) FROM users WHERE role = 'prestataire' AND statut_validation = 'Validé'");
    const totalEnAttente = await query("SELECT COUNT(*) FROM users WHERE role = 'prestataire' AND statut_validation = 'En attente'");
    const totalDemandes = await query("SELECT COUNT(*) FROM demandes");

    res.json({
      stats: {
        totalUsers: parseInt(totalUsers.rows[0].count, 10),
        totalPrestataires: parseInt(totalPrestataires.rows[0].count, 10),
        totalEnAttente: parseInt(totalEnAttente.rows[0].count, 10),
        totalDemandes: parseInt(totalDemandes.rows[0].count, 10),
      },
    });
  } catch (err) {
    logger.error("Erreur Admin Stats :", err);
    res.status(500).json({ message: "Erreur serveur lors du calcul des statistiques." });
  }
});

export default router;
