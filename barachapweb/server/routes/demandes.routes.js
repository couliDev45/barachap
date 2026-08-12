/**
 * demandes.routes.js
 * Routes pour la création, la consultation et la gestion des demandes de services.
 */

import { Router } from "express";
import logger from "../utils/logger.js";
import { query } from "../config/db.js";

const router = Router();

/**
 * GET /api/demandes
 * Liste toutes les demandes (ou filtrées par client / prestataire)
 */
router.get("/", async (req, res) => {
  const { clientId, prestataireId } = req.query;

  try {
    let sql = "SELECT * FROM demandes";
    const params = [];

    if (clientId) {
      params.push(clientId);
      sql += ` WHERE client_id = $${params.length}`;
    } else if (prestataireId) {
      params.push(prestataireId);
      sql += ` WHERE prestataire_id = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC";

    const result = await query(sql, params);
    res.json({ demandes: result.rows });
  } catch (err) {
    logger.error("Erreur Liste Demandes :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des demandes." });
  }
});

/**
 * POST /api/demandes
 * Soumission d'une nouvelle demande de service par un client
 */
router.post("/", async (req, res) => {
  const { prestation, nom, prenom, telephone, besoin, date, ville, clientId, prestataireId } = req.body;

  if (!prestation || !nom || !telephone || !besoin || !date || !ville) {
    return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
  }

  try {
    const result = await query(
      `INSERT INTO demandes (client_id, prestataire_id, prestation, nom_client, prenom_client, telephone_client, besoin, date_souhaitee, ville, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'En attente')
       RETURNING *`,
      [clientId || null, prestataireId || null, prestation, nom, prenom || null, telephone, besoin, date, ville]
    );

    res.status(201).json({
      message: "Votre demande a bien été envoyée. Le prestataire vous contactera bientôt.",
      demande: result.rows[0],
    });
  } catch (err) {
    logger.error("Erreur Création Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création de la demande." });
  }
});

/**
 * PUT /api/demandes/:id
 * Mise à jour du statut d'une demande (Acceptée, Refusée, Terminée)
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;

  if (!statut) {
    return res.status(400).json({ message: "Veuillez fournir le statut." });
  }

  try {
    const result = await query(
      "UPDATE demandes SET statut = $1 WHERE id = $2 RETURNING *",
      [statut, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    res.json({
      message: "Statut de la demande mis à jour avec succès.",
      demande: result.rows[0],
    });
  } catch (err) {
    logger.error("Erreur Maj Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour de la demande." });
  }
});

/**
 * DELETE /api/demandes/:id
 * Suppression d'une demande par un client
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query("DELETE FROM demandes WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    res.json({ message: "Demande supprimée avec succès." });
  } catch (err) {
    logger.error("Erreur Suppression Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

export default router;
