/**
 * mon-compte.js
 * Gère la page unifiée de gestion de compte (client ET prestataire) :
 * - affichage des infos réelles (GET /api/auth/me)
 * - changement de photo de profil (Cloudinary + PUT /api/users/me)
 * - édition email / ville / quartier / bio (PUT /api/users/me)
 * - changement de mot de passe (POST /api/auth/changer-mot-de-passe), avec
 *   indicateur de force et affichage/masquage des champs
 */

import { lireStockage, ecrireStockage, afficherNotification } from "./utils.js";
import { requeteAPI } from "./api.js";
import { uploaderImage } from "./cloudinary.js";

const compteNomComplet = document.querySelector("#compteNomComplet");

// Cette page ne s'exécute que si elle est réellement chargée
if (compteNomComplet) {
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  if (!utilisateurConnecte) {
    window.location.href = "connexion.html?retour=mon-compte.html";
  } else {
    initialiserPageCompte(utilisateurConnecte);
  }
}

function initialiserPageCompte(utilisateurInitial) {
  const avatarCercle = document.querySelector("#avatarCercle");
  const avatarInput = document.querySelector("#avatarInput");
  const avatarApercu = document.querySelector("#avatarApercu");
  const avatarStatut = document.querySelector("#avatarStatut");
  const compteRoleBadge = document.querySelector("#compteRoleBadge");

  const compteTelephoneInput = document.querySelector("#compteTelephoneInput");
  const compteEmailInput = document.querySelector("#compteEmailInput");
  const blocChampsPrestataire = document.querySelector("#blocChampsPrestataire");
  const compteMetierInput = document.querySelector("#compteMetierInput");
  const compteBioInput = document.querySelector("#compteBioInput");
  const compteVilleInput = document.querySelector("#compteVilleInput");
  const compteQuartierInput = document.querySelector("#compteQuartierInput");
  const compteProfilMessage = document.querySelector("#compteProfilMessage");
  const btnSauverCompteProfil = document.querySelector("#btnSauverCompteProfil");

  const lienRetourDashboard = document.querySelector("#lienRetourDashboard");

  // Lien "retour" adapté au rôle réel de l'utilisateur
  if (lienRetourDashboard) {
    lienRetourDashboard.href =
      utilisateurInitial.role === "prestataire" ? "dashboard-prestataire.html" : "dashboard-client.html";
  }

  let photoSelectionnee = null;

  function remplirFormulaire(user) {
    compteNomComplet.textContent = user.nom_complet || "—";
    if (compteRoleBadge) {
      compteRoleBadge.textContent = user.role === "prestataire" ? user.metier || "Prestataire" : "Client";
    }
    if (compteTelephoneInput) compteTelephoneInput.value = user.telephone || "";
    if (compteEmailInput) compteEmailInput.value = user.email || "";
    if (compteVilleInput) compteVilleInput.value = user.ville || "";
    if (compteQuartierInput) compteQuartierInput.value = user.quartier || "";
    if (avatarApercu && user.photo_url) avatarApercu.src = user.photo_url;

    if (user.role === "prestataire" && blocChampsPrestataire) {
      blocChampsPrestataire.style.display = "block";
      if (compteMetierInput) compteMetierInput.value = user.metier || "";
      if (compteBioInput) compteBioInput.value = user.bio || "";
    }
  }

  remplirFormulaire(utilisateurInitial);

  // Recharge les données réelles depuis le serveur (le localStorage peut
  // être légèrement périmé, ex. après une modification faite ailleurs)
  requeteAPI("/auth/me").then((reponse) => {
    if (reponse?.user) remplirFormulaire(reponse.user);
  });

  // --- Changement de photo ---

  if (avatarCercle && avatarInput) {
    avatarCercle.addEventListener("click", () => avatarInput.click());

    avatarInput.addEventListener("change", () => {
      photoSelectionnee = avatarInput.files[0] || null;
      if (photoSelectionnee && avatarApercu) {
        avatarApercu.src = URL.createObjectURL(photoSelectionnee);
        if (avatarStatut) avatarStatut.textContent = "Nouvelle photo sélectionnée — cliquez sur Enregistrer pour confirmer.";
      }
    });
  }

  // --- Sauvegarde des infos du profil (email, ville, quartier, bio, photo) ---

  if (btnSauverCompteProfil) {
    btnSauverCompteProfil.addEventListener("click", async () => {
      btnSauverCompteProfil.disabled = true;
      if (compteProfilMessage) compteProfilMessage.textContent = "";

      let photoUrl = null;
      if (photoSelectionnee) {
        if (avatarStatut) avatarStatut.textContent = "Envoi de la photo...";
        photoUrl = await uploaderImage(photoSelectionnee);
        if (!photoUrl && avatarStatut) {
          avatarStatut.textContent = "Photo non envoyée (service indisponible) — le reste sera quand même enregistré.";
        } else if (avatarStatut) {
          avatarStatut.textContent = "";
        }
      }

      const corps = {
        email: compteEmailInput?.value.trim() || null,
        ville: compteVilleInput?.value.trim() || null,
        quartier: compteQuartierInput?.value.trim() || null,
        photoUrl,
      };

      if (blocChampsPrestataire?.style.display === "block") {
        corps.bio = compteBioInput?.value.trim() || "";
      }

      const reponse = await requeteAPI("/users/me", {
        method: "PUT",
        body: JSON.stringify(corps),
      });

      btnSauverCompteProfil.disabled = false;

      if (!reponse?.user) {
        if (compteProfilMessage) {
          compteProfilMessage.textContent = reponse?.message || "Erreur lors de l'enregistrement.";
        }
        afficherNotification(reponse?.message || "Impossible d'enregistrer le profil pour le moment.", "error");
        return;
      }

      ecrireStockage("utilisateurConnecte", reponse.user);
      photoSelectionnee = null;
      remplirFormulaire(reponse.user);

      afficherNotification("Profil mis à jour avec succès.", "success");
    });
  }

  // --- Afficher / masquer les mots de passe ---

  document.querySelectorAll(".btn-toggle-mdp").forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const cible = document.querySelector(`#${bouton.dataset.cible}`);
      if (!cible) return;
      const estMasque = cible.type === "password";
      cible.type = estMasque ? "text" : "password";
      bouton.textContent = estMasque ? "🙈" : "👁";
    });
  });

  // --- Indicateur de force du mot de passe ---

  const mdpNouveauInput = document.querySelector("#mdpNouveauInput");
  const forceMdpRemplissage = document.querySelector("#forceMdpRemplissage");
  const forceMdpLabel = document.querySelector("#forceMdpLabel");

  function evaluerForceMotDePasse(motDePasse) {
    if (!motDePasse) return { score: 0, label: "", couleur: "transparent" };

    let score = 0;
    if (motDePasse.length >= 6) score++;
    if (motDePasse.length >= 10) score++;
    if (/[A-Z]/.test(motDePasse) && /[a-z]/.test(motDePasse)) score++;
    if (/[0-9]/.test(motDePasse) && /[^A-Za-z0-9]/.test(motDePasse)) score++;

    const niveaux = [
      { label: "Très faible", couleur: "#e74c3c" },
      { label: "Faible", couleur: "#e67e22" },
      { label: "Moyen", couleur: "#f39c12" },
      { label: "Fort", couleur: "#2ecc71" },
      { label: "Très fort", couleur: "#27ae60" },
    ];

    return { score, ...niveaux[Math.min(score, niveaux.length - 1)] };
  }

  if (mdpNouveauInput && forceMdpRemplissage && forceMdpLabel) {
    mdpNouveauInput.addEventListener("input", () => {
      const { score, label, couleur } = evaluerForceMotDePasse(mdpNouveauInput.value);
      forceMdpRemplissage.style.width = `${(score / 4) * 100}%`;
      forceMdpRemplissage.style.backgroundColor = couleur;
      forceMdpLabel.textContent = label;
      forceMdpLabel.style.color = couleur;
    });
  }

  // --- Changement de mot de passe ---

  const btnChangerMdp = document.querySelector("#btnChangerMdp");
  const mdpActuelInput = document.querySelector("#mdpActuelInput");
  const mdpConfirmerInput = document.querySelector("#mdpConfirmerInput");
  const compteMdpMessage = document.querySelector("#compteMdpMessage");

  if (btnChangerMdp) {
    btnChangerMdp.addEventListener("click", async () => {
      const motDePasseActuel = mdpActuelInput?.value;
      const nouveauMotDePasse = mdpNouveauInput?.value;
      const confirmation = mdpConfirmerInput?.value;

      if (compteMdpMessage) compteMdpMessage.textContent = "";

      if (!motDePasseActuel || !nouveauMotDePasse) {
        if (compteMdpMessage) compteMdpMessage.textContent = "Veuillez remplir tous les champs.";
        return;
      }

      if (nouveauMotDePasse.length < 6) {
        if (compteMdpMessage) compteMdpMessage.textContent = "Le nouveau mot de passe doit contenir au moins 6 caractères.";
        return;
      }

      if (nouveauMotDePasse !== confirmation) {
        if (compteMdpMessage) compteMdpMessage.textContent = "Les mots de passe ne correspondent pas.";
        return;
      }

      btnChangerMdp.disabled = true;

      const reponse = await requeteAPI("/auth/changer-mot-de-passe", {
        method: "POST",
        body: JSON.stringify({ motDePasseActuel, nouveauMotDePasse }),
      });

      btnChangerMdp.disabled = false;

      if (!reponse || reponse.message?.toLowerCase().includes("incorrect") || reponse.message?.toLowerCase().includes("erreur")) {
        if (compteMdpMessage) {
          compteMdpMessage.textContent = reponse?.message || "Impossible de changer le mot de passe pour le moment.";
        }
        return;
      }

      if (mdpActuelInput) mdpActuelInput.value = "";
      if (mdpNouveauInput) mdpNouveauInput.value = "";
      if (mdpConfirmerInput) mdpConfirmerInput.value = "";
      if (forceMdpRemplissage) forceMdpRemplissage.style.width = "0%";
      if (forceMdpLabel) forceMdpLabel.textContent = "";

      afficherNotification("Mot de passe changé avec succès.", "success");
    });
  }
}
