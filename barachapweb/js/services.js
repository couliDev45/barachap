/**
 * services.js
 * Gère la page de recherche rapide de prestataires (services.html) :
 * - chargement des vrais prestataires (GET /api/users/prestataires)
 * - recherche par mot-clé (barre de recherche)
 * - filtrage par catégorie (boutons de filtre)
 *
 * Photo affichée uniquement si le prestataire l'a renseignée (voir
 * prestataire.js). Note affichée uniquement s'il a déjà reçu au moins un avis.
 */

import { requeteAPI } from "./api.js";

const searchInput = document.querySelector("input[type='search']");
const cardsContainer = document.querySelector("#prestatairesGrid");

function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

function construireCarte(prestataire) {
  const categorie = (prestataire.metier || "").toLowerCase();
  const ville = [prestataire.ville, prestataire.quartier].filter(Boolean).join(" - ");
  const photo = prestataire.photo_url
    ? `<img src="${prestataire.photo_url}" alt="${echapperHTML(prestataire.nom_complet)}" />`
    : "";
  const note = prestataire.note_moyenne
    ? `<div class="rating-badge">Note: ${prestataire.note_moyenne} / 5</div>`
    : "";

  return `
    <div class="advantage-card" data-category="${echapperHTML(categorie)}">
      ${photo}
      <h3>${echapperHTML(prestataire.nom_complet)}</h3>
      <p class="metier">${echapperHTML(prestataire.metier)}</p>
      <span>${echapperHTML(ville)}</span>
      ${note}
      <a href="profil.html?id=${prestataire.id}" class="btn-primary"> Voir le profil </a>
    </div>
  `;
}

function attacherFiltreEtRecherche() {
  const cards = document.querySelectorAll(".advantage-card");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      const recherche = searchInput.value.toLowerCase().trim();
      cards.forEach((card) => {
        const metierEl = card.querySelector(".metier");
        const metier = metierEl ? metierEl.textContent.toLowerCase() : "";
        card.style.display = metier.includes(recherche) ? "block" : "none";
      });
    });
  }

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      cards.forEach((card) => {
        const category = card.dataset.category;
        card.style.display = filter === "all" || category === filter ? "block" : "none";
      });
    });
  });
}

async function chargerPrestataires() {
  const reponse = await requeteAPI("/users/prestataires");
  const prestataires = reponse?.prestataires || [];

  if (cardsContainer) {
    cardsContainer.innerHTML = prestataires.length
      ? prestataires.map(construireCarte).join("")
      : `<p>Aucun prestataire disponible pour le moment.</p>`;
  }

  attacherFiltreEtRecherche();
}

if (cardsContainer) {
  chargerPrestataires();
}
