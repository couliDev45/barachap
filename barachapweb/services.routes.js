/**
 * services.routes.js
 * Routes pour la création et la suppression des services proposés par un
 * prestataire. La lecture reste gérée par GET /api/users/prestataires/:id.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();

router.use(verifierToken);

/**
 * POST /api/services
 * Crée un nouveau service pour le prestataire connecté.
 * prestataire_id est TOUJOURS déduit du token, jamais du corps de la requête.
 */
router.post("/", async (req, res) => {
  const { titre, description, tarifIndicatif } = req.body;
  const prestataireId = req.user.id;

  if (!titre || !titre.trim()) {
    return res.status(400).json({ message: "Le titre du service est obligatoire." });
  }

  try {
    const result = await query(
      `INSERT INTO services (prestataire_id, titre, description, tarif_indicatif)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [prestataireId, titre.trim(), description || null, tarifIndicatif || null]
    );

    res.status(201).json({ message: "Service ajouté avec succès.", service: result.rows[0] });
  } catch (err) {
    console.error("Erreur Création Service :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création du service." });
  }
});

/**
 * DELETE /api/services/:id
 * Réservé au prestataire propriétaire du service, ou à un admin.
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { id: userId, role } = req.user;

  try {
    const existant = await query("SELECT prestataire_id FROM services WHERE id = $1", [id]);

    if (existant.rows.length === 0) {
      return res.status(404).json({ message: "Service non trouvé." });
    }

    const estProprietaire = Number(existant.rows[0].prestataire_id) === Number(userId);
    if (role !== "admin" && !estProprietaire) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer ce service." });
    }

    await query("DELETE FROM services WHERE id = $1", [id]);
    res.json({ message: "Service supprimé avec succès." });
  } catch (err) {
    console.error("Erreur Suppression Service :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression du service." });
  }
});

export default router;
