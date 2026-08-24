/**
 * erreurs-client.js
 * Capture les erreurs JavaScript non gérées et les rejets de promesses côté
 * navigateur, puis les signale au backend (voir server/routes/client-errors.routes.js)
 * qui les relaie sur Telegram.
 *
 * Volontairement indépendant de api.js/requeteAPI pour les listeners
 * globaux ci-dessous : ce module doit pouvoir fonctionner même si d'autres
 * modules du site sont cassés (c'est justement pour capter ce genre de
 * casse qu'il existe), donc il fait son propre fetch minimal plutôt que de
 * dépendre du reste du code.
 *
 * signalerErreurClient() est exportée pour être réutilisée par api.js, qui
 * l'appelle pour signaler les échecs d'appels API (backend injoignable ou
 * erreur 5xx) — un autre type d'anomalie côté navigateur, mais qui ne
 * passe pas par window.onerror puisque requeteAPI intercepte déjà ses
 * propres erreurs pour afficher un message propre à l'utilisateur.
 */

const ENDPOINT_ERREURS = "https://barachap-web.onrender.com/api/erreurs-client";

function utilisateurConnecteActuel() {
  try {
    return JSON.parse(localStorage.getItem("utilisateurConnecte") || "null");
  } catch {
    return null;
  }
}

export function signalerErreurClient(message, stack) {
  const utilisateur = utilisateurConnecteActuel();

  const payload = {
    message: String(message ?? "Erreur inconnue").slice(0, 500),
    stack: stack ? String(stack).slice(0, 1200) : null,
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: utilisateur?.id ?? null,
    userRole: utilisateur?.role ?? null,
  };

  // keepalive: true permet à la requête de partir même si la page se
  // décharge juste après (ex. l'erreur provoque une redirection).
  fetch(ENDPOINT_ERREURS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Volontairement silencieux : si ce signalement échoue lui-même,
    // il ne faut surtout pas créer une boucle d'erreurs qui se signalent
    // les unes les autres.
  });
}

window.addEventListener("error", (event) => {
  // Ignore les erreurs de chargement de ressources (image cassée, etc.)
  // qui ne sont pas des erreurs JS et n'ont pas de message exploitable.
  if (!event.message) return;
  signalerErreurClient(event.message, event.error?.stack);
});

window.addEventListener("unhandledrejection", (event) => {
  const raison = event.reason;
  const message = raison instanceof Error ? raison.message : String(raison);
  const stack = raison instanceof Error ? raison.stack : null;
  signalerErreurClient(`Promesse rejetée : ${message}`, stack);
});
