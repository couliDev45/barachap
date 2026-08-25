/**
 * dashboard.js
 * Gère le tableau de bord client :
 * - message de bienvenue avec le vrai prénom de l'utilisateur connecté
 * - statistiques dynamiques (total, en attente, acceptées, refusées)
 * - affichage de la liste des demandes (GET /api/demandes)
 * - suppression d'une demande (DELETE /api/demandes/:id)
 * - passage en mode modification (redirection vers demande.html)
 * - email de secours (PUT /api/users/me), pour permettre la récupération du
 *   compte en cas de mot de passe oublié (l'inscription se fait uniquement
 *   par téléphone, sans email)
 * Dépend de utils.js (lireStockage, ecrireStockage) et api.js (requeteAPI).
 *
 * Note : le serveur filtre automatiquement les demandes du client connecté
 * à partir du token JWT — pas besoin d'envoyer son id en paramètre.
 */

import { lireStockage, ecrireStockage, afficherNotification } from "./utils.js";
import { requeteAPI } from "./api.js";

const listeDemandes = document.querySelector("#listeDemandes");

// Garde en mémoire les demandes affichées pour que modifierDemande()
// retrouve l'objet complet à partir de son id
let demandesActuelles = [];

function normaliserStatut(statut) {
  const texte = (statut || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (texte.includes("accept")) return "acceptee";
  if (texte.includes("refus")) return "refusee";
  return "attente";
}

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

function afficherStatistiques(demandes) {
  const total = demandes.length;
  const compteurs = { attente: 0, acceptee: 0, refusee: 0 };

  demandes.forEach((demande) => {
    compteurs[normaliserStatut(demande.statut)]++;
  });

  const totalEl = document.querySelector("#totalDemandes");
  const attenteEl = document.querySelector("#attenteDemandes");
  const accepteesEl = document.querySelector("#accepteesDemandes");
  const refuseesEl = document.querySelector("#refuseesDemandes");

  if (totalEl) totalEl.textContent = total;
  if (attenteEl) attenteEl.textContent = compteurs.attente;
  if (accepteesEl) accepteesEl.textContent = compteurs.acceptee;
  if (refuseesEl) refuseesEl.textContent = compteurs.refusee;
}

// Les champs viennent tels quels de la base (nom_client, prenom_client,
// date_souhaitee...) car l'API renvoie directement les colonnes SQL.
function construireCarteDemande(demande) {
  const cleStatut = normaliserStatut(demande.statut);
  const config = STATUT_CONFIG[cleStatut];

  const boutonAvis =
    cleStatut === "acceptee" && !demande.a_avis
      ? `<button class="btn-primary" onclick="ouvrirFormAvis(${demande.id})">Laisser un avis</button>`
      : "";

  return `
    <div class="prestataire-card">
      <div class="card-header">
        <h3>${echapperHTML(demande.prestation)}</h3>
        <span class="status ${config.classe}">${config.label}</span>
      </div>

      <p><strong>Nom :</strong> ${echapperHTML(demande.nom_client)} ${echapperHTML(demande.prenom_client)}</p>
      <p><strong>Ville :</strong> ${echapperHTML(demande.ville)}</p>

      <div class="dashboard-actions">
        <button class="btn-primary" onclick="modifierDemande(${demande.id})">
          Modifier
        </button>
        <button class="btn-delete" onclick="supprimerDemande(${demande.id})">
          Supprimer
        </button>
        ${boutonAvis}
      </div>
    </div>
  `;
}

async function actualiserDashboard() {
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  if (!utilisateurConnecte) {
    if (listeDemandes) {
      listeDemandes.innerHTML = `<div class="etat-vide"><p>Veuillez vous connecter pour voir vos demandes.</p></div>`;
    }
    return;
  }

  const reponse = await requeteAPI("/demandes");
  demandesActuelles = reponse?.demandes || [];

  afficherStatistiques(demandesActuelles);

  if (!listeDemandes) return;

  if (demandesActuelles.length === 0) {
    listeDemandes.innerHTML = `
      <div class="etat-vide">
        <p>Aucune demande enregistrée pour le moment.</p>
      </div>
    `;
    return;
  }

  listeDemandes.innerHTML = demandesActuelles.map(construireCarteDemande).join("");
}

// Message de bienvenue avec le vrai prénom de l'utilisateur connecté
const clientGreeting = document.querySelector("#clientGreeting");
if (clientGreeting) {
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);
  if (utilisateurConnecte?.nom_complet) {
    const prenom = utilisateurConnecte.nom_complet.split(" ")[0];
    clientGreeting.textContent = `Bonjour, ${prenom}`;
  }
}

actualiserDashboard();

window.supprimerDemande = async function supprimerDemande(id) {
  if (confirm("Voulez-vous vraiment supprimer cette demande ?")) {
    await requeteAPI(`/demandes/${id}`, { method: "DELETE" });
    actualiserDashboard();
  }
};

window.modifierDemande = function modifierDemande(id) {
  const demande = demandesActuelles.find((d) => d.id === id);
  if (!demande) return;

  // Normalise les noms de colonnes SQL vers les noms de champs attendus
  // par le formulaire de demande.js. L'id réel est conservé pour l'appel
  // à PUT /api/demandes/:id/modifier lors de la resoumission.
  ecrireStockage("demandeEnCours", {
    id: demande.id,
    prestation: demande.prestation,
    nom: demande.nom_client,
    prenom: demande.prenom_client,
    telephone: demande.telephone_client,
    besoin: demande.besoin,
    date: demande.date_souhaitee ? String(demande.date_souhaitee).slice(0, 10) : "",
    ville: demande.ville,
  });

  window.location.href = "demande.html";
};

// --- Avis client ---

const formAvis = document.querySelector("#formAvis");
const avisNoteInput = document.querySelector("#avisNoteInput");
const avisCommentaireInput = document.querySelector("#avisCommentaireInput");
const avisFormMessage = document.querySelector("#avisFormMessage");
const btnValiderAvis = document.querySelector("#btnValiderAvis");

let demandeIdPourAvis = null;

window.ouvrirFormAvis = function ouvrirFormAvis(id) {
  demandeIdPourAvis = id;
  if (avisFormMessage) avisFormMessage.textContent = "";
  if (formAvis) {
    formAvis.style.display = "block";
    formAvis.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

if (btnValiderAvis) {
  btnValiderAvis.addEventListener("click", async () => {
    if (!demandeIdPourAvis) return;

    btnValiderAvis.disabled = true;

    const reponse = await requeteAPI("/avis", {
      method: "POST",
      body: JSON.stringify({
        demandeId: demandeIdPourAvis,
        note: parseInt(avisNoteInput?.value, 10),
        commentaire: avisCommentaireInput?.value.trim() || null,
      }),
    });

    btnValiderAvis.disabled = false;

    if (!reponse?.avis) {
      if (avisFormMessage) {
        avisFormMessage.textContent = reponse?.message || "Impossible d'enregistrer l'avis pour le moment.";
      }
      return;
    }

    if (avisCommentaireInput) avisCommentaireInput.value = "";
    if (formAvis) formAvis.style.display = "none";
    demandeIdPourAvis = null;

    actualiserDashboard();
  });
}

// La gestion de l'email de secours, de la photo et du mot de passe est
// désormais centralisée sur pages/mon-compte.html (voir js/mon-compte.js) —
// le lien "Gérer mon compte" du dashboard y renvoie directement.

// Barre de progression du profil (statique pour le moment)
const progressFill = document.querySelector(".progress-fill");
const progressValue = document.querySelector("#progressValue");

if (progressFill && progressValue) {
  const progression = 80;
  progressFill.style.width = progression + "%";
  progressValue.textContent = progression + "%";
}

// Bascule thème clair/sombre
const boutonTheme = document.querySelector("#themeToggle");

if (boutonTheme) {
  boutonTheme.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem("theme", document.body.classList.contains("dark-mode") ? "dark" : "light");
  });

  const theme = localStorage.getItem("theme");
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
  }
}

window.addEventListener("load", () => {
  const loader = document.querySelector("#loader");
  if (!loader) return;
  loader.style.opacity = "0";
  loader.style.transition = ".5s";
  setTimeout(() => loader.remove(), 500);
});
