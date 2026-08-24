/**
 * telegram.js
 * Envoi de messages vers un bot Telegram (alertes d'erreurs serveur,
 * erreurs côté navigateur, nouvelles inscriptions...). Utilise l'API HTTP
 * Telegram directement (fetch natif de Node 18+), aucune dépendance npm
 * nécessaire.
 *
 * Nécessite les variables d'environnement TELEGRAM_BOT_TOKEN et
 * TELEGRAM_CHAT_ID (voir LISEZ-MOI.md pour la marche à suivre complète).
 */

import dotenv from "dotenv";
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : null;

/**
 * Échappe les caractères spéciaux pour le mode HTML de Telegram — nécessaire
 * dès qu'un message inclut du texte fourni par un utilisateur (nom, ville...).
 */
export function echapperTelegram(texte) {
  return String(texte ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Envoie un message texte au chat Telegram configuré (ou à chatId si fourni,
 * utile pour répondre à une commande venant d'un autre chat).
 * Silencieux si les variables d'environnement ne sont pas configurées —
 * ne doit jamais faire planter le site si Telegram n'est pas branché.
 */
export async function envoyerMessageTelegram(texte, chatId = null) {
  if (!TELEGRAM_API || !TELEGRAM_CHAT_ID) return;

  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId || TELEGRAM_CHAT_ID,
        text: texte,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    // On utilise console.warn (pas console.error) volontairement ici :
    // console.error est intercepté globalement pour justement alerter sur
    // Telegram (voir server.js) — l'utiliser ici créerait une boucle
    // infinie si Telegram lui-même est indisponible.
    console.warn("Échec de l'envoi du message Telegram :", err.message);
  }
}

const DELAI_ANTI_SPAM_MS = 10000;
let dernierEnvoiErreurServeur = 0;

/**
 * Signale une erreur SERVEUR (backend) sur Telegram. Anti-spam intégré :
 * au plus une alerte toutes les 10 secondes, pour ne pas saturer le chat
 * si une même erreur se répète en boucle (ex. base de données injoignable).
 */
export async function signalerErreurServeur(details) {
  const maintenant = Date.now();
  if (maintenant - dernierEnvoiErreurServeur < DELAI_ANTI_SPAM_MS) return;
  dernierEnvoiErreurServeur = maintenant;

  const texte = `🔴 <b>Erreur serveur BaraChap</b>\n\n<code>${echapperTelegram(details).slice(0, 3500)}</code>`;
  await envoyerMessageTelegram(texte);
}

const DELAI_ANTI_SPAM_CLIENT_MS = 15000;
let dernierEnvoiErreurClient = 0;

/**
 * Signale une erreur CÔTÉ NAVIGATEUR (JS cassé chez un client/chauffeur) sur
 * Telegram. Limiteur séparé de signalerErreurServeur : une vague d'erreurs
 * frontend (ex. un bug affectant plusieurs visiteurs en même temps) ne doit
 * jamais masquer une vraie panne serveur, et inversement. Ce endpoint étant
 * public (pas de JWT — une erreur peut survenir avant connexion), l'anti-spam
 * est aussi la seule protection contre un flot de requêtes.
 */
export async function signalerErreurClient(details) {
  const maintenant = Date.now();
  if (maintenant - dernierEnvoiErreurClient < DELAI_ANTI_SPAM_CLIENT_MS) return;
  dernierEnvoiErreurClient = maintenant;

  const texte = `🟠 <b>Erreur côté navigateur</b>\n\n${details}`;
  await envoyerMessageTelegram(texte);
}
