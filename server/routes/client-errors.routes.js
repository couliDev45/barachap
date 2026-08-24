/**
 * client-errors.routes.js
 * Reçoit les erreurs JavaScript survenues côté navigateur (voir
 * js/erreurs-client.js) et les relaie sur Telegram.
 *
 * Route volontairement PUBLIQUE (pas de verifierToken) : une erreur peut
 * survenir avant même que la personne soit connectée (ex. sur la page
 * d'accueil ou d'inscription). La protection contre l'abus repose sur :
 * - la validation stricte du corps de la requête
 * - la troncature de tous les champs texte
 * - l'anti-spam intégré à signalerErreurClient (1 alerte / 15s max)
 */

import { Router } from "express";
import { signalerErreurClient, echapperTelegram } from "../utils/telegram.js";

const router = Router();

function tronquer(texte, max) {
  const t = String(texte ?? "").slice(0, max);
  return echapperTelegram(t);
}

router.post("/", (req, res) => {
  const { message, stack, url, userAgent, userId, userRole } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ message: "Champ 'message' manquant ou invalide." });
  }

  // Répond immédiatement — le client n'a pas besoin d'attendre l'envoi
  // Telegram, et une lenteur/échec Telegram ne doit jamais se répercuter
  // sur l'expérience de l'utilisateur qui vient de rencontrer un bug.
  res.status(202).json({ message: "Signalement reçu." });

  const lignesContexte = [
    `📄 <b>Page :</b> ${tronquer(url, 200)}`,
    userId ? `👤 <b>Utilisateur :</b> #${tronquer(userId, 20)} (${tronquer(userRole || "rôle inconnu", 30)})` : "👤 <b>Utilisateur :</b> non connecté",
    `🌐 <b>Navigateur :</b> ${tronquer(userAgent, 150)}`,
    `\n💬 <b>Message :</b> ${tronquer(message, 500)}`,
  ];

  if (stack) {
    lignesContexte.push(`\n<code>${tronquer(stack, 1200)}</code>`);
  }

  signalerErreurClient(lignesContexte.join("\n")).catch(() => {});
});

export default router;
