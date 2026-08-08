/**
 * dashboard.js
 * Gère le tableau de bord client :
 * - statistiques dynamiques (total, en attente, acceptées, refusées)
 * - affichage de la liste des demandes
 * - suppression d'une demande
 * - passage en mode modification (redirection vers demande.html)
 * Dépend de utils.js (lireStockage, ecrireStockage).
 */

import { lireStockage, ecrireStockage } from "./utils.js";

const listeDemandes = document.querySelector("#listeDemandes");

// Normalise un statut en une clé fiable pour les stats et le CSS,
// insensible à la casse et aux accents (ex: "Accepté" / "accepte" -> "acceptee")
function normaliserStatut(statut) {
  const texte = (statut || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // retire les accents

  if (texte.includes("accept")) return "acceptee";
  if (texte.includes("refus")) return "refusee";
  return "attente";
}

// Empêche l'injection HTML depuis les champs saisis par l'utilisateur (nom, ville, etc.)
function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

const STATUT_CONFIG = {
  attente: { label: "En attente", classe: "attente" },
  acceptee: { label: "Acceptée", classe: "acceptee" },
  refusee: { label: "Refusée", classe: "refusee" },
};

/**
 * Calcule les statistiques à partir de la liste des demandes
 * et les affiche dans #dashboardStats.
 */
function afficherStatistiques(demandes) {
  const total = demandes.length;
  const compteurs = { attente: 0, acceptee: 0, refusee: 0 };

  demandes.forEach((demande) => {
    const cle = normaliserStatut(demande.statut);
    compteurs[cle]++;
  });

  // Remplit le bloc de stats présent dans dashboard-client.html
  const totalEl = document.querySelector("#totalDemandes");
  const attenteEl = document.querySelector("#attenteDemandes");
  const accepteesEl = document.querySelector("#accepteesDemandes");
  const refuseesEl = document.querySelector("#refuseesDemandes");

  if (totalEl) totalEl.textContent = total;
  if (attenteEl) attenteEl.textContent = compteurs.attente;
  if (accepteesEl) accepteesEl.textContent = compteurs.acceptee;
  if (refuseesEl) refuseesEl.textContent = compteurs.refusee;
}

/**
 * Construit le HTML d'une carte de demande.
 */
function construireCarteDemande(demande, index) {
  const cleStatut = normaliserStatut(demande.statut);
  const config = STATUT_CONFIG[cleStatut];

  return `
    <div class="prestataire-card">
      <div class="card-header">
        <h3>Demande n°${index + 1}</h3>
        <span class="status ${config.classe}">${config.label}</span>
      </div>

      <p><strong>Service :</strong> ${echapperHTML(demande.prestation)}</p>
      <p><strong>Nom :</strong> ${echapperHTML(demande.nom)} ${echapperHTML(demande.prenom)}</p>
      <p><strong>Ville :</strong> ${echapperHTML(demande.ville)}</p>

      <div class="dashboard-actions">
        <button class="btn-primary" onclick="modifierDemande(${index})">
          Modifier
        </button>
        <button class="btn-delete" onclick="supprimerDemande(${index})">
          Supprimer
        </button>
      </div>
    </div>
  `;
}

/**
 * Recharge et affiche la liste des demandes + les statistiques.
 */
function actualiserDashboard() {
  const demandes = lireStockage("demandes", []);

  afficherStatistiques(demandes);

  if (!listeDemandes) return;

  if (demandes.length === 0) {
    listeDemandes.innerHTML = `
      <div class="etat-vide">
        <p>Aucune demande enregistrée pour le moment.</p>
      </div>
    `;
    return;
  }

  // Construit tout le HTML en une seule passe (une seule écriture DOM,
  // au lieu de innerHTML += dans la boucle qui reparse à chaque itération)
  const html = demandes
    .map((demande, index) => construireCarteDemande(demande, index))
    .join("");

  listeDemandes.innerHTML = html;
}

// actualiserDashboard() gère elle-même l'absence de #listeDemandes ou des
// IDs de stats individuels — on l'appelle systématiquement.
actualiserDashboard();

window.supprimerDemande = function supprimerDemande(index) {
  if (confirm("Voulez-vous vraiment supprimer cette demande ?")) {
    let demandes = lireStockage("demandes", []);

    demandes.splice(index, 1);

    ecrireStockage("demandes", demandes);

    // Réaffiche sans recharger la page entière
    actualiserDashboard();
  }
};

window.modifierDemande = function modifierDemande(index) {
  // Récupère toutes les demandes
  const demandes = lireStockage("demandes", []);

  // Enregistre la demande sélectionnée
  ecrireStockage("demandeEnCours", demandes[index]);

  // Enregistre également son index
  localStorage.setItem("indexModification", index);

  // Redirection vers le formulaire
  window.location.href = "demande.html";
};
// Barre de progression du profil (statique pour le moment)
const progressFill = document.querySelector(".progress-fill");
const progressValue = document.querySelector("#progressValue");

if (progressFill && progressValue) {
  const progression = 80;
  progressFill.style.width = progression + "%";
  progressValue.textContent = progression + "%";
}

// Bascule thème clair/sombre, seulement si le bouton existe sur la page
const boutonTheme = document.querySelector("#themeToggle");

if (boutonTheme) {
  boutonTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    localStorage.setItem(
      "theme",
      document.body.classList.contains("dark-mode") ? "dark" : "light",
    );
  });

  const theme = localStorage.getItem("theme");

  if (theme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

// Masque l'écran de chargement, seulement si le loader existe sur la page
window.addEventListener("load", () => {
  const loader = document.querySelector("#loader");

  if (!loader) return;

  loader.style.opacity = "0";
  loader.style.transition = ".5s";

  setTimeout(() => {
    loader.remove();
  }, 500);
});
