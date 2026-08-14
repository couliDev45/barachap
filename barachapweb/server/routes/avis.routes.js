/**
 * avis.routes.js
 * Routes pour le système d'avis clients sur les prestataires.
 * Un avis est toujours rattaché à une demande acceptée réellement passée
 * entre ce client et ce prestataire — impossible de noter sans interaction
 * réelle, et un seul avis par demande.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();

/**
 * GET /api/avis/prestataire/:id
 * Liste des avis d'un prestataire + note moyenne. Public (affiché sur le
 * profil), pas de JWT requis.
 */
router.get("/prestataire/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT avis.id, avis.note, avis.commentaire, avis.created_at, users.nom_complet AS nom_client
       FROM avis
       JOIN users ON users.id = avis.client_id
       WHERE avis.prestataire_id = $1
       ORDER BY avis.created_at DESC`,
      [id],
    );

    const total = result.rows.length;
    const moyenne = total
      ? Math.round((result.rows.reduce((somme, a) => somme + a.note, 0) / total) * 10) / 10
      : null;

    res.json({ avis: result.rows, moyenne, total });
  } catch (err) {
    console.error("Erreur Lecture Avis :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des avis." });
  }
});

/**
 * POST /api/avis
 * Le client connecté laisse un avis sur une de ses propres demandes,
 * uniquement si elle est acceptée et n'a pas déjà été notée.
 */
router.post("/", verifierToken, async (req, res) => {
  const { demandeId, note, commentaire } = req.body;
  const clientId = req.user.id;

  if (!demandeId || !note || note < 1 || note > 5) {
    return res.status(400).json({ message: "Veuillez fournir une note entre 1 et 5." });
  }

  try {
    const demandeResult = await query(
      "SELECT client_id, prestataire_id, statut FROM demandes WHERE id = $1",
      [demandeId],
    );

    if (demandeResult.rows.length === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    const demande = demandeResult.rows[0];

    if (Number(demande.client_id) !== Number(clientId)) {
      return res.status(403).json({ message: "Vous ne pouvez laisser un avis que sur vos propres demandes." });
    }

    if (!demande.prestataire_id) {
      return res.status(400).json({ message: "Cette demande n'est associée à aucun prestataire." });
    }

    if (demande.statut !== "Acceptée") {
      return res.status(400).json({ message: "Vous ne pouvez laisser un avis que sur une demande acceptée." });
    }

    const dejaExistant = await query("SELECT id FROM avis WHERE demande_id = $1", [demandeId]);
    if (dejaExistant.rows.length > 0) {
      return res.status(400).json({ message: "Vous avez déjà laissé un avis pour cette demande." });
    }

    const result = await query(
      `INSERT INTO avis (demande_id, client_id, prestataire_id, note, commentaire)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [demandeId, clientId, demande.prestataire_id, note, commentaire || null],
    );

    res.status(201).json({ message: "Merci pour votre avis !", avis: result.rows[0] });
  } catch (err) {
    console.error("Erreur Création Avis :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'enregistrement de l'avis." });
  }
});

export default router;
