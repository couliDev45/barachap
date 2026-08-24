/**
 * telegram.routes.js
 * Reçoit les messages envoyés au bot Telegram (webhook), et répond aux
 * commandes autorisées — pour l'instant uniquement /stats.
 *
 * Sécurité :
 * - Le header X-Telegram-Bot-Api-Secret-Token est vérifié contre
 *   TELEGRAM_WEBHOOK_SECRET (configuré au moment de l'appel à setWebhook,
 *   voir LISEZ-MOI.md) — empêche n'importe qui d'appeler cette route à la
 *   place de Telegram.
 * - Seul le chat_id configuré dans TELEGRAM_CHAT_ID (celui de
 *   l'administrateur) reçoit une réponse aux commandes — si quelqu'un
 *   d'autre écrit au bot, le message est ignoré silencieusement.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { envoyerMessageTelegram } from "../utils/telegram.js";

const router = Router();

const CHAT_ID_AUTORISE = process.env.TELEGRAM_CHAT_ID;
const SECRET_WEBHOOK = process.env.TELEGRAM_WEBHOOK_SECRET;

router.post("/webhook", async (req, res) => {
  if (SECRET_WEBHOOK && req.headers["x-telegram-bot-api-secret-token"] !== SECRET_WEBHOOK) {
    return res.sendStatus(401);
  }

  // Répond immédiatement à Telegram (qui n'attend pas de traitement long) ;
  // le traitement de la commande se fait ensuite, sans bloquer la réponse.
  res.sendStatus(200);

  const message = req.body?.message;
  if (!message?.text || !message?.chat?.id) return;
  if (String(message.chat.id) !== String(CHAT_ID_AUTORISE)) return;

  const texte = message.text.trim().toLowerCase();

  if (texte === "/stats") {
    await envoyerStats();
  } else if (texte === "/start" || texte === "/aide" || texte === "/help") {
    await envoyerMessageTelegram(
      "👋 Bot BaraChap connecté avec succès.\n\nCommandes disponibles :\n/stats — statistiques actuelles du site",
    );
  }
});

async function envoyerStats() {
  try {
    const [totalUsers, totalClients, totalPrestataires, enAttente, totalDemandes, totalCourses, coursesEnAttente, coursesTerminees] =
      await Promise.all([
        query("SELECT COUNT(*) FROM users"),
        query("SELECT COUNT(*) FROM users WHERE role = 'client'"),
        query("SELECT COUNT(*) FROM users WHERE role = 'prestataire' AND statut_validation = 'Validé'"),
        query("SELECT COUNT(*) FROM users WHERE role = 'prestataire' AND statut_validation = 'En attente'"),
        query("SELECT COUNT(*) FROM demandes"),
        query("SELECT COUNT(*) FROM courses"),
        query("SELECT COUNT(*) FROM courses WHERE statut = 'En attente'"),
        query("SELECT COUNT(*) FROM courses WHERE statut = 'Terminée'"),
      ]);

    const texte = `📊 <b>Statistiques BaraChap</b>

👥 <b>Utilisateurs</b> : ${totalUsers.rows[0].count}
   • Clients : ${totalClients.rows[0].count}
   • Prestataires validés : ${totalPrestataires.rows[0].count}
   • En attente de validation : ${enAttente.rows[0].count}

📋 Demandes de service : ${totalDemandes.rows[0].count}

🏍️ <b>Courses taxi-moto</b> : ${totalCourses.rows[0].count}
   • En attente : ${coursesEnAttente.rows[0].count}
   • Terminées : ${coursesTerminees.rows[0].count}`;

    await envoyerMessageTelegram(texte);
  } catch (err) {
    console.error("Erreur lors du calcul des statistiques Telegram :", err);
  }
}

export default router;
