/**
 * realisations.routes.js
 * Routes pour la publication et la suppression des réalisations (portfolio)
 * d'un prestataire. La lecture reste gérée par GET /api/users/prestataires/:id.
 *
 * photo_url est une URL déjà hébergée (ex: Cloudinary) — cette route n'accepte
 * pas de fichier binaire, l'upload se fait côté navigateur avant l'appel.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();

router.use(verifierToken);

/**
 * POST /api/realisations
 * Publie une nouvelle réalisation pour le prestataire connecté.
 */
router.post("/", async (req, res) => {
  const { titre, photoUrl } = req.body;
  const prestataireId = req.user.id;

  if (!titre || !titre.trim()) {
    return res.status(400).json({ message: "Le titre de la réalisation est obligatoire." });
  }

  try {
    const result = await query(
      `INSERT INTO realisations (prestataire_id, titre, photo_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [prestataireId, titre.trim(), photoUrl || null]
    );

    res.status(201).json({ message: "Réalisation publiée avec succès.", realisation: result.rows[0] });
  } catch (err) {
    console.error("Erreur Création Réalisation :", err);
    res.status(500).json({ message: "Erreur serveur lors de la publication de la réalisation." });
  }
});

/**
 * DELETE /api/realisations/:id
 * Réservé au prestataire propriétaire de la réalisation, ou à un admin.
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { id: userId, role } = req.user;

  try {
    const existante = await query("SELECT prestataire_id FROM realisations WHERE id = $1", [id]);

    if (existante.rows.length === 0) {
      return res.status(404).json({ message: "Réalisation non trouvée." });
    }

    const estProprietaire = Number(existante.rows[0].prestataire_id) === Number(userId);
    if (role !== "admin" && !estProprietaire) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer cette réalisation." });
    }

    await query("DELETE FROM realisations WHERE id = $1", [id]);
    res.json({ message: "Réalisation supprimée avec succès." });
  } catch (err) {
    console.error("Erreur Suppression Réalisation :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

export default router;
