/**
 * parametres.routes.js
 * Lecture publique des paramètres généraux du site (ex: l'image de la
 * section hero de l'accueil). La modification est réservée aux admins,
 * voir PUT /api/admin/parametres/:cle dans admin.routes.js.
 */

import { Router } from "express";
import { query } from "../config/db.js";

const router = Router();

/**
 * GET /api/parametres/:cle
 * Retourne { cle, valeur } — valeur est null si le paramètre n'existe pas
 * ou n'a jamais été renseigné (le frontend doit alors garder son image par
 * défaut plutôt que d'afficher un espace vide).
 */
router.get("/:cle", async (req, res) => {
  const { cle } = req.params;

  try {
    const result = await query("SELECT valeur FROM parametres WHERE cle = $1", [cle]);
    res.json({ cle, valeur: result.rows[0]?.valeur || null });
  } catch (err) {
    console.error("Erreur Lecture Paramètre :", err);
    res.status(500).json({ message: "Erreur serveur lors de la lecture du paramètre." });
  }
});

export default router;
