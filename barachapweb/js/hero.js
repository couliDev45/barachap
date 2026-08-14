/**
 * hero.js
 * Applique l'image de la section hero de l'accueil configurée par l'admin
 * (voir admin.js, onglet "Apparence"), via GET /api/parametres/hero_image_url.
 * Si aucune image n'a été définie, l'image par défaut du HTML reste inchangée.
 */

import { requeteAPI } from "./api.js";

const heroImage = document.querySelector("#heroImage");

if (heroImage) {
  requeteAPI("/parametres/hero_image_url").then((reponse) => {
    if (reponse?.valeur) {
      heroImage.src = reponse.valeur;
    }
  });
}
