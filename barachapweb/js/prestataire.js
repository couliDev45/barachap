/**
 * prestataire.js
 * Gère les fonctionnalités du tableau de bord Prestataire :
 * - message de bienvenue et statistiques réelles (demandes reçues, publications)
 * - chargement des demandes reçues (GET /api/demandes)
 * - acceptation et refus des demandes (PUT /api/demandes/:id)
 * - édition du profil : bio, photo, ville, quartier (PUT /api/users/me)
 * - services : création (POST /api/services) et suppression (DELETE /api/services/:id)
 * - réalisations : publication (POST /api/realisations) et suppression (DELETE /api/realisations/:id)
 * Dépend de utils.js, api.js (requeteAPI) et cloudinary.js (uploaderImage).
 */

import { afficherNotification, lireStockage, ecrireStockage } from "./utils.js";
import { requeteAPI } from "./api.js";
import { uploaderImage } from "./cloudinary.js";

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

// --- Services et réalisations : chargement commun ---

const mesServicesActifs = document.querySelector("#mesServicesActifs");
const mesRealisations = document.querySelector("#mesRealisations");
const statPublications = document.querySelector("#prestatairePublications");

function construireCarteService(service) {
  return `
    <div class="service-card" data-id="${service.id}">
      <h3>${echapperHTML(service.titre)}</h3>
      <p>${echapperHTML(service.description || "")}</p>
      ${service.tarif_indicatif ? `<p><strong>${echapperHTML(service.tarif_indicatif)}</strong></p>` : ""}
      <button class="btn-delete btn-supprimer-service" style="margin-top: 10px;">Supprimer</button>
    </div>
  `;
}

function construireRealisation(realisation) {
  const image = realisation.photo_url
    ? `<img src="${realisation.photo_url}" alt="${echapperHTML(realisation.titre)}" />`
    : "";
  return `
    <div data-id="${realisation.id}" style="position: relative;">
      ${image}
      <p style="margin-top: 6px; font-size: 14px;">${echapperHTML(realisation.titre)}</p>
      <button class="btn-delete btn-supprimer-realisation" style="font-size: 12px;">Supprimer</button>
    </div>
  `;
}

async function chargerServicesEtRealisations() {
  if (!utilisateurConnecte?.id) return;

  const reponse = await requeteAPI(`/users/prestataires/${utilisateurConnecte.id}`);
  const services = reponse?.services || [];
  const realisations = reponse?.realisations || [];

  if (statPublications) statPublications.textContent = services.length + realisations.length;

  if (mesServicesActifs) {
    mesServicesActifs.innerHTML = services.length
      ? services.map(construireCarteService).join("")
      : `<p>Aucun service publié pour le moment. Utilisez "Ajouter un service" pour commencer.</p>`;
  }

  if (mesRealisations) {
    mesRealisations.innerHTML = realisations.length
      ? realisations.map(construireRealisation).join("")
      : `<p>Aucune réalisation publiée pour le moment.</p>`;
  }
}

if (mesServicesActifs || mesRealisations) {
  chargerServicesEtRealisations();
}

// Suppression d'un service ou d'une réalisation (délégation sur tout le document,
// puisque les cartes sont regénérées à chaque chargement)
document.addEventListener("click", async (e) => {
  const btnService = e.target.closest(".btn-supprimer-service");
  const btnRealisation = e.target.closest(".btn-supprimer-realisation");
  if (!btnService && !btnRealisation) return;

  const carte = (btnService || btnRealisation).closest("[data-id]");
  const id = carte?.dataset.id;
  if (!id) return;

  if (!confirm("Voulez-vous vraiment supprimer cet élément ?")) return;

  const endpoint = btnService ? `/services/${id}` : `/realisations/${id}`;
  const reponse = await requeteAPI(endpoint, { method: "DELETE" });

  if (!reponse) {
    afficherNotification("Impossible de supprimer pour le moment.", "error");
    return;
  }

  afficherNotification("Supprimé avec succès.", "success");
  chargerServicesEtRealisations();
});

// --- Bascule d'affichage des 3 formulaires (profil / service / réalisation) ---
// Un seul formulaire ouvert à la fois pour ne pas surcharger la page.

const sections = {
  profil: document.querySelector("#editProfilSection"),
  service: document.querySelector("#formAddService"),
  realisation: document.querySelector("#formAddRealisation"),
};

function basculerSection(cle) {
  const cible = sections[cle];
  if (!cible) return;
  const estOuvert = cible.style.display === "block";

  Object.values(sections).forEach((el) => {
    if (el) el.style.display = "none";
  });

  if (!estOuvert) cible.style.display = "block";
}

// --- Édition du profil ---

const btnToggleProfil = document.querySelector("#btnToggleProfil");
const profilPhotoInput = document.querySelector("#profilPhotoInput");
const profilPhotoApercu = document.querySelector("#profilPhotoApercu");
const profilPhotoStatut = document.querySelector("#profilPhotoStatut");
const profilBioInput = document.querySelector("#profilBioInput");
const profilVilleInput = document.querySelector("#profilVilleInput");
const profilQuartierInput = document.querySelector("#profilQuartierInput");
const profilEditMessage = document.querySelector("#profilEditMessage");
const btnSauverProfil = document.querySelector("#btnSauverProfil");

let photoSelectionnee = null;

if (btnToggleProfil) {
  btnToggleProfil.addEventListener("click", async () => {
    basculerSection("profil");

    // Pré-remplit avec les données actuelles à l'ouverture
    if (sections.profil?.style.display === "block") {
      const reponse = await requeteAPI("/auth/me");
      const user = reponse?.user;
      if (user) {
        if (profilBioInput) profilBioInput.value = user.bio || "";
        if (profilVilleInput) profilVilleInput.value = user.ville || "";
        if (profilQuartierInput) profilQuartierInput.value = user.quartier || "";
        if (profilPhotoApercu && user.photo_url) profilPhotoApercu.src = user.photo_url;
      }
    }
  });
}

if (profilPhotoInput) {
  profilPhotoInput.addEventListener("change", () => {
    photoSelectionnee = profilPhotoInput.files[0] || null;
    if (photoSelectionnee && profilPhotoApercu) {
      profilPhotoApercu.src = URL.createObjectURL(photoSelectionnee);
    }
  });
}

if (btnSauverProfil) {
  btnSauverProfil.addEventListener("click", async () => {
    btnSauverProfil.disabled = true;

    let photoUrl = null;
    if (photoSelectionnee) {
      if (profilPhotoStatut) profilPhotoStatut.textContent = "Envoi de la photo...";
      photoUrl = await uploaderImage(photoSelectionnee);
      if (profilPhotoStatut) {
        profilPhotoStatut.textContent = photoUrl
          ? ""
          : "Photo non envoyée (Cloudinary non configuré) — le reste du profil sera quand même enregistré.";
      }
    }

    const reponse = await requeteAPI("/users/me", {
      method: "PUT",
      body: JSON.stringify({
        bio: profilBioInput?.value.trim() || "",
        photoUrl,
        ville: profilVilleInput?.value.trim() || null,
        quartier: profilQuartierInput?.value.trim() || null,
      }),
    });

    btnSauverProfil.disabled = false;

    if (!reponse?.user) {
      if (profilEditMessage) profilEditMessage.textContent = "Erreur lors de l'enregistrement.";
      afficherNotification("Impossible d'enregistrer le profil pour le moment.", "error");
      return;
    }

    // Met à jour l'utilisateur stocké localement (greeting, etc.)
    ecrireStockage("utilisateurConnecte", reponse.user);
    photoSelectionnee = null;

    afficherNotification("Profil mis à jour avec succès.", "success");
    basculerSection("profil");
  });
}

// --- Ajout de service ---

const btnAddService = document.querySelector("#btnAddService");
const serviceTitreInput = document.querySelector("#serviceTitreInput");
const serviceDescriptionInput = document.querySelector("#serviceDescriptionInput");
const serviceTarifInput = document.querySelector("#serviceTarifInput");
const serviceFormMessage = document.querySelector("#serviceFormMessage");
const btnValiderService = document.querySelector("#btnValiderService");

if (btnAddService) {
  btnAddService.addEventListener("click", () => basculerSection("service"));
}

if (btnValiderService) {
  btnValiderService.addEventListener("click", async () => {
    const titre = serviceTitreInput?.value.trim();
    if (!titre) {
      if (serviceFormMessage) serviceFormMessage.textContent = "Le titre est obligatoire.";
      return;
    }

    btnValiderService.disabled = true;

    const reponse = await requeteAPI("/services", {
      method: "POST",
      body: JSON.stringify({
        titre,
        description: serviceDescriptionInput?.value.trim() || null,
        tarifIndicatif: serviceTarifInput?.value.trim() || null,
      }),
    });

    btnValiderService.disabled = false;

    if (!reponse?.service) {
      if (serviceFormMessage) serviceFormMessage.textContent = "Erreur lors de la publication.";
      return;
    }

    if (serviceTitreInput) serviceTitreInput.value = "";
    if (serviceDescriptionInput) serviceDescriptionInput.value = "";
    if (serviceTarifInput) serviceTarifInput.value = "";
    if (serviceFormMessage) serviceFormMessage.textContent = "";

    afficherNotification(`Le service "${titre}" a bien été ajouté à votre profil.`, "success");
    basculerSection("service");
    chargerServicesEtRealisations();
  });
}

// --- Publication de réalisation ---

const btnAddRealisation = document.querySelector("#btnAddRealisation");
const realisationTitreInput = document.querySelector("#realisationTitreInput");
const realisationPhotoInput = document.querySelector("#realisationPhotoInput");
const realisationFormMessage = document.querySelector("#realisationFormMessage");
const btnValiderRealisation = document.querySelector("#btnValiderRealisation");

if (btnAddRealisation) {
  btnAddRealisation.addEventListener("click", () => basculerSection("realisation"));
}

if (btnValiderRealisation) {
  btnValiderRealisation.addEventListener("click", async () => {
    const titre = realisationTitreInput?.value.trim();
    if (!titre) {
      if (realisationFormMessage) realisationFormMessage.textContent = "Le titre est obligatoire.";
      return;
    }

    btnValiderRealisation.disabled = true;

    let photoUrl = null;
    const fichier = realisationPhotoInput?.files[0];
    if (fichier) {
      if (realisationFormMessage) realisationFormMessage.textContent = "Envoi de la photo...";
      photoUrl = await uploaderImage(fichier);
    }

    const reponse = await requeteAPI("/realisations", {
      method: "POST",
      body: JSON.stringify({ titre, photoUrl }),
    });

    btnValiderRealisation.disabled = false;

    if (!reponse?.realisation) {
      if (realisationFormMessage) realisationFormMessage.textContent = "Erreur lors de la publication.";
      return;
    }

    if (realisationTitreInput) realisationTitreInput.value = "";
    if (realisationPhotoInput) realisationPhotoInput.value = "";
    if (realisationFormMessage) realisationFormMessage.textContent = "";

    afficherNotification(`La réalisation "${titre}" a été publiée avec succès.`, "success");
    basculerSection("realisation");
    chargerServicesEtRealisations();
  });
}
