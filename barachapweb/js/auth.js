/**
 * auth.js
 * Gère l'authentification et l'inscription sur la plateforme BaraChap :
 * - basculement dynamique entre profil Client et Prestataire sur inscription.html
 * - enregistrement du compte dans le localStorage
 * - connexion et redirection selon le rôle (client, prestataire, admin)
 */

import { afficherNotification, lireStockage, ecrireStockage } from "./utils.js";

// Gestion du formulaire d'inscription
const inscriptionForm = document.querySelector("#inscriptionForm");
const optClient = document.querySelector("#optClient");
const optPrestataire = document.querySelector("#optPrestataire");
const champsPrestataire = document.querySelector("#champsPrestataire");

if (optClient && optPrestataire && champsPrestataire) {
  // Pré-sélection par URL param (ex: ?role=prestataire)
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get("role");

  if (roleParam === "prestataire") {
    optPrestataire.classList.add("selected");
    optClient.classList.remove("selected");
    const radPrest = optPrestataire.querySelector("input[type='radio']");
    if (radPrest) radPrest.checked = true;
    champsPrestataire.style.display = "flex";
  }

  optClient.addEventListener("click", () => {
    optClient.classList.add("selected");
    optPrestataire.classList.remove("selected");
    champsPrestataire.style.display = "none";
  });

  optPrestataire.addEventListener("click", () => {
    optPrestataire.classList.add("selected");
    optClient.classList.remove("selected");
    champsPrestataire.style.display = "flex";
  });
}

if (inscriptionForm) {
  inscriptionForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const nomComplet = document.querySelector("#nomComplet")?.value.trim();
    const telephone = document.querySelector("#telephone")?.value.trim();
    const motdepasse = document.querySelector("#motdepasse")?.value;
    const confirmerMotdepasse = document.querySelector("#confirmerMotdepasse")?.value;
    const roleRadio = document.querySelector("input[name='role']:checked")?.value || "client";

    if (!nomComplet || !telephone || !motdepasse) {
      afficherNotification("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }

    if (motdepasse !== confirmerMotdepasse) {
      afficherNotification("Les mots de passe ne correspondent pas.", "error");
      return;
    }

    let extraData = {};
    if (roleRadio === "prestataire") {
      const metier = document.querySelector("#metier")?.value;
      const villeQuartier = document.querySelector("#villeQuartier")?.value.trim();

      if (!metier) {
        afficherNotification("Veuillez sélectionner votre métier.", "warning");
        return;
      }
      extraData = { metier, villeQuartier, statutValidation: "En attente" };
    }

    const utilisateur = {
      nomComplet,
      telephone,
      role: roleRadio,
      ...extraData,
      dateCreation: new Date().toISOString(),
    };

    let utilisateurs = lireStockage("utilisateurs", []);
    utilisateurs.push(utilisateur);
    ecrireStockage("utilisateurs", utilisateurs);

    // Enregistre l'utilisateur connecté
    ecrireStockage("utilisateurConnecte", utilisateur);

    afficherNotification("Compte créé avec succès ! Redirection...", "success");

    setTimeout(() => {
      if (roleRadio === "prestataire") {
        window.location.href = "dashboard-prestataire.html";
      } else {
        window.location.href = "dashboard-client.html";
      }
    }, 1200);
  });
}

// Gestion du formulaire de connexion
const connexionForm = document.querySelector("#connexionForm");

if (connexionForm) {
  connexionForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const identifiant = document.querySelector("#identifiant")?.value.trim();
    const motdepasse = document.querySelector("#motdepasse")?.value;
    const typeCompte = document.querySelector("#typeCompte")?.value || "client";

    if (!identifiant || !motdepasse) {
      afficherNotification("Veuillez saisir votre identifiant et mot de passe.", "error");
      return;
    }

    // Simulation de connexion réussie
    const session = {
      identifiant,
      role: typeCompte,
      dateConnexion: new Date().toISOString(),
    };

    ecrireStockage("utilisateurConnecte", session);

    afficherNotification("Connexion réussie ! Redirection en cours...", "success");

    setTimeout(() => {
      if (typeCompte === "admin") {
        window.location.href = "dashboard-admin.html";
      } else if (typeCompte === "prestataire") {
        window.location.href = "dashboard-prestataire.html";
      } else {
        window.location.href = "dashboard-client.html";
      }
    }, 1200);
  });
}
