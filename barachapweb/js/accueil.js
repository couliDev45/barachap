/**
 * accueil.js
 * Remplace le contenu codé en dur de la page d'accueil par des données
 * réelles :
 * - "Nos prestataires à la une" (#prestataires) : les prestataires les plus
 *   actifs, classés par nombre d'opérations effectuées (demandes acceptées
 *   pour les métiers classiques + courses terminées pour taxi-moto) — voir
 *   GET /api/users/prestataires/populaires
 * - "Ce que nos utilisateurs disent" (#temoignagesVedette) : de vrais avis
 *   clients récents et bien notés — voir GET /api/avis/populaires
 */

import { requeteAPI } from "./api.js";

function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

// --- Prestataires à la une ---

const prestatairesVedette = document.querySelector("#prestataires");

function construireCartePrestataireVedette(prestataire) {
  const villeAffichee = [prestataire.ville, prestataire.quartier].filter(Boolean).join(" - ");
  const photo = prestataire.photo_url
    ? `<img src="${prestataire.photo_url}" alt="${echapperHTML(prestataire.nom_complet)}" loading="lazy" />`
    : "";
  const note = prestataire.note_moyenne
    ? `<div class="rating-badge">Note: ${prestataire.note_moyenne} / 5</div>`
    : "";

  return `
    <div class="prestataire-card">
      <div class="prestataire-photo">
        ${photo}
        <h3>${echapperHTML(prestataire.nom_complet)}</h3>
        <p>${echapperHTML(prestataire.metier)}</p>
        <span>${echapperHTML(villeAffichee)}</span>
        ${note}
        <a href="pages/profil.html?id=${prestataire.id}" class="btn-primary"> Voir plus </a>
      </div>
    </div>
  `;
}

async function chargerPrestatairesVedette() {
  if (!prestatairesVedette) return;

  const reponse = await requeteAPI("/users/prestataires/populaires");
  const prestataires = reponse?.prestataires || [];

  prestatairesVedette.innerHTML = prestataires.length
    ? prestataires.map(construireCartePrestataireVedette).join("")
    : `<p>Aucun prestataire à afficher pour le moment.</p>`;
}

chargerPrestatairesVedette();

// --- Témoignages ---

const temoignagesVedette = document.querySelector("#temoignagesVedette");

function construireTemoignage(avis) {
  return `
    <div class="temoignage-card">
      <div class="rating-badge">Note: ${Number(avis.note).toFixed(1)} / 5</div>
      <p class="testimonial-text">"${echapperHTML(avis.commentaire)}"</p>
      <h3>${echapperHTML(avis.nom_client)}</h3>
    </div>
  `;
}

async function chargerTemoignages() {
  if (!temoignagesVedette) return;

  const reponse = await requeteAPI("/avis/populaires");
  const avis = reponse?.avis || [];

  temoignagesVedette.innerHTML = avis.length
    ? avis.map(construireTemoignage).join("")
    : `<p>Aucun avis à afficher pour le moment.</p>`;
}

chargerTemoignages();
