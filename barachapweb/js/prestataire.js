/**
 * prestataire.js
 * Gère les fonctionnalités du tableau de bord Prestataire :
 * - message de bienvenue et statistiques réelles (demandes reçues, publications)
 * - chargement des demandes reçues (GET /api/demandes)
 * - acceptation et refus des demandes (PUT /api/demandes/:id)
 * - chargement des services déjà publiés (GET /api/users/prestataires/:id)
 * Dépend de utils.js (afficherNotification, lireStockage) et api.js (requeteAPI).
 *
 * ⚠️ "Ajouter un service" / "Publier une réalisation" restent locaux
 * (prompt()) : le backend n'a pas encore de route POST pour créer un
 * service ou une réalisation.
 */

import { afficherNotification, lireStockage } from "./utils.js";
import { requeteAPI } from "./api.js";

function echapperHTML(texte) {
  const div = document.createElement("div");
  div.textContent = texte ?? "";
  return div.innerHTML;
}

const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

// Message de bienvenue avec le vrai prénom
const prestataireGreeting = document.querySelector("#prestataireGreeting");
if (prestataireGreeting && utilisateurConnecte?.nom_complet) {
  prestataireGreeting.textContent = `Bonjour, ${utilisateurConnecte.nom_complet.split(" ")[0]}`;
}

// --- Demandes reçues ---

const tableDemandesRecues = document.querySelector("#tableDemandesRecues");
const statDemandesRecues = document.querySelector("#prestataireDemandesRecues");

function construireLigneDemande(demande) {
  const statutBrut = (demande.statut || "").toLowerCase();
  const estAcceptee = statutBrut.includes("accept");
  const estRefusee = statutBrut.includes("refus");
  const classeStatut = estAcceptee ? "acceptee" : estRefusee ? "refusee" : "attente";
  const labelStatut = estAcceptee ? "Acceptée" : estRefusee ? "Refusée" : "En attente";

  const actionsHTML = estAcceptee
    ? `<button class="btn-secondary">Contacter</button>`
    : estRefusee
      ? `<span style="font-size: 13px; color: #999;">Refusée</span>`
      : `<button class="btn-success btn-accepter">Accepter</button>
         <button class="btn-danger btn-refuser">Refuser</button>`;

  const dateSouhaitee = demande.date_souhaitee ? String(demande.date_souhaitee).slice(0, 10) : "";

  return `
    <tr data-id="${demande.id}">
      <td><strong>${echapperHTML(demande.nom_client)} ${echapperHTML(demande.prenom_client)}</strong><br /><small>${echapperHTML(demande.telephone_client)}</small></td>
      <td>${echapperHTML(demande.prestation)}</td>
      <td>${echapperHTML(demande.ville)}</td>
      <td>${dateSouhaitee}</td>
      <td><span class="status ${classeStatut}">${labelStatut}</span></td>
      <td><div class="action-buttons">${actionsHTML}</div></td>
    </tr>
  `;
}

async function chargerDemandesRecues() {
  if (!tableDemandesRecues || !utilisateurConnecte) return;

  const reponse = await requeteAPI("/demandes");
  const demandes = reponse?.demandes || [];

  tableDemandesRecues.innerHTML = demandes.length
    ? demandes.map(construireLigneDemande).join("")
    : `<tr><td colspan="6">Aucune demande reçue pour le moment.</td></tr>`;

  if (statDemandesRecues) statDemandesRecues.textContent = demandes.length;
}

if (tableDemandesRecues) {
  chargerDemandesRecues();

  tableDemandesRecues.addEventListener("click", async (e) => {
    const btnAccepter = e.target.closest(".btn-accepter");
    const btnRefuser = e.target.closest(".btn-refuser");
    if (!btnAccepter && !btnRefuser) return;

    const row = (btnAccepter || btnRefuser).closest("tr");
    const id = row?.dataset.id;
    if (!id) return;

    const nouveauStatut = btnAccepter ? "Acceptée" : "Refusée";

    const reponse = await requeteAPI(`/demandes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ statut: nouveauStatut }),
    });

    if (!reponse) {
      afficherNotification("Impossible de mettre à jour la demande pour le moment.", "error");
      return;
    }

    afficherNotification(
      btnAccepter ? "Demande acceptée avec succès." : "Demande refusée.",
      btnAccepter ? "success" : "warning",
    );

    chargerDemandesRecues();
  });
}

// --- Services publiés (lecture seule pour l'instant) ---

const mesServicesActifs = document.querySelector("#mesServicesActifs");
const statPublications = document.querySelector("#prestatairePublications");

async function chargerServicesEtRealisations() {
  if (!utilisateurConnecte?.id) return;

  const reponse = await requeteAPI(`/users/prestataires/${utilisateurConnecte.id}`);
  const services = reponse?.services || [];
  const realisations = reponse?.realisations || [];

  if (statPublications) statPublications.textContent = services.length + realisations.length;

  if (mesServicesActifs) {
    mesServicesActifs.innerHTML = services.length
      ? services
          .map(
            (s) => `
        <div class="service-card">
          <h3>${echapperHTML(s.titre)}</h3>
          <p>${echapperHTML(s.description || "")}</p>
        </div>
      `,
          )
          .join("")
      : `<p>Aucun service publié pour le moment. Utilisez "Ajouter un service" pour commencer.</p>`;
  }
}

chargerServicesEtRealisations();

// Ajout rapide de service
// ⚠️ Aucune route backend (POST /api/services) n'est disponible pour le
// moment : l'ajout reste local à l'affichage (non persisté en base).
const btnAddService = document.querySelector("#btnAddService");
if (btnAddService) {
  btnAddService.addEventListener("click", () => {
    const nomService = prompt("Entrez le titre du nouveau service (ex: Débouchage évier) :");
    if (nomService && nomService.trim()) {
      afficherNotification(`Le service "${nomService.trim()}" a bien été ajouté à votre profil.`, "success");
    }
  });
}

// Publication de réalisation
// ⚠️ Même limitation : aucune route backend (POST /api/realisations) fournie.
const btnAddRealisation = document.querySelector("#btnAddRealisation");
if (btnAddRealisation) {
  btnAddRealisation.addEventListener("click", () => {
    const nomRealisation = prompt("Entrez le titre de votre réalisation :");
    if (nomRealisation && nomRealisation.trim()) {
      afficherNotification(`La réalisation "${nomRealisation.trim()}" a été publiée avec succès.`, "success");
    }
  });
}
