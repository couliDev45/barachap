/**
 * push.js
 * Gère l'abonnement du navigateur du chauffeur aux notifications push
 * (voir sw.js pour la réception, server/routes/push.routes.js pour
 * l'enregistrement côté serveur).
 */

import { requeteAPI } from "./api.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Demande la permission de notification, crée (ou récupère) l'abonnement
 * push du navigateur, puis l'enregistre côté serveur.
 *
 * Toujours silencieux en cas d'échec (permission refusée, navigateur non
 * supporté, HTTPS absent en local...) : ne doit jamais bloquer l'activation
 * de la disponibilité — le sondage périodique reste un filet de sécurité.
 * @returns {Promise<{ok: boolean, raison?: string}>}
 */
export async function activerNotificationsPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, raison: "Notifications non supportées sur cet appareil." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, raison: "Permission de notification refusée." };
    }

    const reponseCle = await requeteAPI("/push/vapid-public-key");
    if (!reponseCle?.publicKey) {
      return { ok: false, raison: "Clé de notification indisponible." };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(reponseCle.publicKey),
      });
    }

    await requeteAPI("/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    });

    return { ok: true };
  } catch (erreur) {
    console.warn("Échec de l'activation des notifications push :", erreur.message);
    return { ok: false, raison: erreur.message };
  }
}
