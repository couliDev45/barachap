/**
 * pwa.js
 * Enregistre le service worker (voir sw.js) — active l'installation du
 * site sur l'écran d'accueil et le chargement accéléré des fichiers
 * statiques. Le service worker vit à la racine du site (/sw.js), donc sa
 * portée couvre automatiquement tout le site quelle que soit la page
 * (racine ou dossier pages/) qui déclenche cet enregistrement.
 */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const prefixe = window.location.pathname.includes("/pages/") ? "../" : "";
    navigator.serviceWorker.register(`${prefixe}sw.js`).catch((erreur) => {
      console.warn("Échec de l'enregistrement du service worker :", erreur.message);
    });
  });
}
