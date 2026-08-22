/**
 * sw.js
 * Service worker BaraChap — permet l'installation sur l'écran d'accueil et
 * accélère les visites répétées en mettant en cache les fichiers statiques
 * du site (pages, CSS, JS, images).
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
