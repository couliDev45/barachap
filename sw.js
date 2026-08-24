/**
 * sw.js
 * Service worker BaraChap — permet l'installation sur l'écran d'accueil et
 * accélère les visites répétées en mettant en cache les fichiers statiques
 * du site (pages, CSS, JS, images). Gère aussi la réception et l'affichage
 * des notifications push (voir js/push.js pour l'abonnement côté client et
 * server/utils/webpush.js pour l'envoi côté serveur).
 *
 * ⚠️ RÈGLE ABSOLUE : ne jamais mettre en cache /api/* ni aucun domaine
 * externe (Cloudinary, Nominatim, tuiles OpenStreetMap, Google Fonts). Ce
 * site affiche des données qui changent en permanence (courses disponibles,
 * statut des demandes) — les servir depuis un cache périmé serait pire
 * qu'utile, ça pourrait faire croire à un chauffeur qu'une course est
 * encore disponible alors qu'elle a déjà été prise. Seul le "coffrage"
 * statique du site est mis en cache, jamais son contenu dynamique.
 *
 * Stratégie : "cache d'abord, réseau en secours", avec mise à jour du
 * cache en arrière-plan à chaque requête réussie (stale-while-revalidate).
 */

const CACHE_NAME = "barachap-cache-v1";

self.addEventListener("install", () => {
  // Active la nouvelle version immédiatement, sans attendre la fermeture
  // des onglets ouverts sur l'ancienne — important vu le rythme des mises
  // à jour de ce projet.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((nom) => nom !== CACHE_NAME).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jamais les requêtes non-GET (POST/PUT/DELETE) — uniquement le cache
  // de fichiers statiques a du sens ici.
  if (event.request.method !== "GET") return;

  // Jamais l'API : toujours des données fraîches, sans exception.
  if (url.pathname.startsWith("/api/")) return;

  // Jamais les domaines externes (Cloudinary, Nominatim, tuiles OSM, polices).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((reponseEnCache) => {
      const recuperationReseau = fetch(event.request)
        .then((reponseReseau) => {
          if (reponseReseau && reponseReseau.status === 200) {
            const copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
          }
          return reponseReseau;
        })
        .catch(() => reponseEnCache);

      // Répond depuis le cache immédiatement si disponible (rapide), tout
      // en rafraîchissant le cache en arrière-plan pour la prochaine visite.
      return reponseEnCache || recuperationReseau;
    }),
  );
});

/**
 * Réception d'une notification push envoyée par le serveur (voir
 * POST /api/courses dans courses.routes.js, déclenché à chaque nouvelle
 * course). Fonctionne même si la PWA est fermée ou le téléphone verrouillé
 * — c'est tout l'intérêt du Service Worker par rapport au simple sondage.
 *
 * Aucune API web ne peut forcer l'allumage de l'écran (restriction
 * volontaire des OS/navigateurs) — mais on maximise les chances que le
 * chauffeur s'en rende compte immédiatement via :
 * - un motif de vibration long et répété (façon sonnerie d'appel), plutôt
 *   qu'un simple double-buzz
 * - renotify: true + un tag fixe, pour que CHAQUE nouvelle course déclenche
 *   à nouveau la vibration/le son, même si une notification précédente
 *   n'a pas encore été balayée par le chauffeur
 * - requireInteraction: true, pour que la notification reste affichée
 *   jusqu'à ce que le chauffeur interagisse avec elle
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "BaraChap", body: event.data ? event.data.text() : "" };
  }

  // Motif de vibration volontairement long et répété (en millisecondes :
  // vibre, pause, vibre...) pour maximiser les chances d'être perçu même
  // téléphone en poche ou sur une table, écran éteint.
  const motifVibration = [400, 200, 400, 200, 400, 200, 400, 400, 400];

  const options = {
    body: data.body || "",
    icon: "/assets/logo/favicon-192.png",
    badge: "/assets/logo/favicon-192.png",
    data: { url: data.url || "/" },
    vibrate: motifVibration,
    // Tag fixe partagé par toutes les notifications de nouvelle course :
    // combiné à renotify, ça garantit qu'une 2e course qui arrive pendant
    // que la 1re n'a pas été vue redéclenche quand même vibration + son,
    // au lieu d'être silencieusement fusionnée avec la précédente.
    tag: "barachap-nouvelle-course",
    renotify: true,
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "BaraChap", options));
});

/**
 * Clic sur une notification : ramène au premier plan un onglet déjà ouvert
 * sur la bonne page si possible, sinon en ouvre un nouveau.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
