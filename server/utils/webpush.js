/**
 * webpush.js
 * Configuration et envoi des notifications push (protocole Web Push / VAPID).
 * Nécessite les variables d'environnement VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 * et VAPID_SUBJECT (générées une seule fois avec `npx web-push generate-vapid-keys`).
 */

import webpush from "web-push";
import dotenv from "dotenv";
import { query } from "../config/db.js";
import logger from "./logger.js";

dotenv.config();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
export const pushEstConfigure = Boolean(vapidPublicKey && vapidPrivateKey);

if (pushEstConfigure) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contact@barachap.ci",
    vapidPublicKey,
    vapidPrivateKey,
  );
} else {
  logger.warn("Notifications push désactivées : clés VAPID absentes.");
}

/**
 * Envoie une notification push à tous les chauffeurs (role = 'prestataire')
 * actuellement disponibles. Supprime automatiquement les abonnements
 * expirés ou révoqués (statut HTTP 404 / 410 renvoyé par le service push).
 * @param {{title: string, body: string, url?: string}} payload
 */
export async function notifierChauffeursDisponibles(payload) {
  if (!pushEstConfigure) return;

  try {
    const result = await query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.disponible = true AND u.role = 'prestataire'`,
    );

    const donnees = JSON.stringify(payload);

    await Promise.all(
      result.rows.map(async (abo) => {
        const subscription = {
          endpoint: abo.endpoint,
          keys: { p256dh: abo.p256dh, auth: abo.auth },
        };
        try {
          await webpush.sendNotification(subscription, donnees);
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Abonnement expiré ou révoqué côté navigateur : on le retire
            // pour ne plus perdre de temps à réessayer dans le futur.
            await query("DELETE FROM push_subscriptions WHERE id = $1", [abo.id]);
          } else {
            logger.error("Erreur envoi push à un chauffeur : " + err.message);
          }
        }
      }),
    );
  } catch (err) {
    logger.error("Erreur notification chauffeurs disponibles : " + err.message);
  }
}
