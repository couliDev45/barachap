/**
 * push.routes.js
 * Routes pour la gestion des abonnements aux notifications push des
 * chauffeurs taxi-moto (voir utils/webpush.js pour l'envoi effectif).
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";
import { pushEstConfigure } from "../utils/webpush.js";

const router = Router();

/**
 * GET /api/push/vapid-public-key
 * Clé publique VAPID, nécessaire côté client avant de créer un abonnement
 * push (PushManager.subscribe). Publique, pas de JWT requis.
 */
router.get("/vapid-public-key", (req, res) => {
  if (!pushEstConfigure) {
    return res.status(503).json({ message: "Les notifications push ne sont pas configurées." });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.use(verifierToken);

/**
 * POST /api/push/subscribe
 * Enregistre (ou met à jour) l'abonnement push du navigateur de
 * l'utilisateur connecté. ON CONFLICT sur endpoint : un même navigateur qui
 * se réabonne (ex. après réinstallation) met simplement à jour ses clés au
 * lieu de créer un doublon.
 */
router.post("/subscribe", async (req, res) => {
  if (!pushEstConfigure) {
    return res.status(503).json({ message: "Les notifications push ne sont pas configurées." });
  }

  const { subscription } = req.body;
  const userId = req.user.id;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ message: "Abonnement push invalide." });
  }

  try {
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
    );

    res.status(201).json({ message: "Abonnement enregistré avec succès." });
  } catch (err) {
    console.error("Erreur Abonnement Push :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'abonnement." });
  }
});

/**
 * DELETE /api/push/subscribe
 * Supprime l'abonnement push du navigateur courant (ex. à la déconnexion).
 */
router.delete("/subscribe", async (req, res) => {
  const { endpoint } = req.body;
  const userId = req.user.id;

  if (!endpoint) {
    return res.status(400).json({ message: "Endpoint manquant." });
  }

  try {
    await query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, userId]);
    res.json({ message: "Abonnement supprimé." });
  } catch (err) {
    console.error("Erreur Suppression Abonnement Push :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

export default router;
