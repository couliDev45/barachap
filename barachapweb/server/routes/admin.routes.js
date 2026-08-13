/**
 * admin.routes.js
 * Routes réservées à l'administration de la plateforme BaraChap.
 * Toutes les routes exigent un JWT valide ET le rôle "admin".
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken, verifierAdmin } from "../middleware/auth.js";

const router = Router();

// Applique la vérification à toutes les routes de ce fichier
router.use(verifierToken, verifierAdmin);

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
    console.error("Erreur Admin Pending :", err);
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
    console.error("Erreur Admin Validate :", err);
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
    console.error("Erreur Admin Users :", err);
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
    console.error("Erreur Admin Category :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création de la catégorie." });
  }
});

/**
 * GET /api/admin/categories
 * Liste toutes les catégories existantes.
 * (Route ajoutée — absente du backend d'origine, nécessaire pour que le
 * frontend affiche les vraies catégories au lieu d'une liste locale qui
 * repart de zéro à chaque rechargement de page.)
 */
router.get("/categories", async (req, res) => {
  try {
    const result = await query(
      `SELECT c.id, c.nom, c.description,
              (SELECT COUNT(*) FROM services s WHERE s.categorie_id = c.id) AS nombre_prestataires
       FROM categories c
       ORDER BY c.nom ASC`
    );

    res.json({ categories: result.rows });
  } catch (err) {
    console.error("Erreur Admin Liste Categories :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des catégories." });
  }
});

/**
 * DELETE /api/admin/categories/:id
 * Supprime une catégorie.
 * (Route ajoutée — absente du backend d'origine.)
 */
router.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM categories WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Catégorie non trouvée." });
    }

    res.json({ message: "Catégorie supprimée avec succès." });
  } catch (err) {
    console.error("Erreur Admin Suppression Categorie :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression de la catégorie." });
  }
});

/**
 * PUT /api/admin/users/:id/suspend
 * Suspend ou réactive un utilisateur.
 * (Route ajoutée — absente du backend d'origine. Réutilise la colonne
 * statut_validation existante avec la valeur 'Suspendu' plutôt que
 * d'ajouter une colonne, pour rester compatible avec le schéma actuel.)
 */
router.put("/users/:id/suspend", async (req, res) => {
  const { id } = req.params;

  try {
    const userActuel = await query("SELECT statut_validation FROM users WHERE id = $1", [id]);

    if (userActuel.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    const nouveauStatut = userActuel.rows[0].statut_validation === "Suspendu" ? "Validé" : "Suspendu";

    const result = await query(
      "UPDATE users SET statut_validation = $1 WHERE id = $2 RETURNING id, nom_complet, statut_validation",
      [nouveauStatut, id]
    );

    res.json({
      message: `${result.rows[0].nom_complet} est maintenant "${nouveauStatut}".`,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Erreur Admin Suspension Utilisateur :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suspension." });
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
    console.error("Erreur Admin Stats :", err);
    res.status(500).json({ message: "Erreur serveur lors du calcul des statistiques." });
  }
});

export default router;
