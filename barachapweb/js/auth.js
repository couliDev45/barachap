/**
 * auth.js
 * Gère l'authentification et l'inscription sur la plateforme BaraChap :
 * - basculement dynamique entre profil Client et Prestataire sur inscription.html
 * - inscription et connexion via l'API Backend (POST /api/auth/register, /api/auth/login)
 * - stockage du token JWT et de l'utilisateur reçus du serveur
 * - connexion et redirection selon le rôle renvoyé par le serveur
 *
 * Note : inscription.html n'a pas de champ #email, donc email est toujours
 * null à l'inscription — c'est prévu et géré côté backend (email || null).
 */

import { afficherNotification, ecrireStockage } from "./utils.js";
import { requeteAPI } from "./api.js";

// Préserve ?retour= en changeant de page entre connexion et inscription,
// pour ne pas perdre le fil si quelqu'un se trompe de formulaire en venant
// de la barrière de connexion sur demande.html (voir demande.js).
const retourActuel = new URLSearchParams(window.location.search).get("retour");
if (retourActuel) {
  const lienVersInscription = document.querySelector("#lienVersInscription");
  const lienVersConnexion = document.querySelector("#lienVersConnexion");
  if (lienVersInscription) lienVersInscription.href += `?retour=${retourActuel}`;
  if (lienVersConnexion) lienVersConnexion.href += `?retour=${retourActuel}`;
}

// Gestion du formulaire d'inscription
const inscriptionForm = document.querySelector("#inscriptionForm");
const optClient = document.querySelector("#optClient");
const optPrestataire = document.querySelector("#optPrestataire");
const champsPrestataire = document.querySelector("#champsPrestataire");

if (optClient && optPrestataire && champsPrestataire) {
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
  inscriptionForm.addEventListener("submit", async (e) => {
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
      const ville = document.querySelector("#inscriptionVille")?.value.trim();
      const quartier = document.querySelector("#inscriptionQuartier")?.value.trim();

      if (!metier) {
        afficherNotification("Veuillez sélectionner votre métier.", "warning");
        return;
      }
      if (!ville) {
        afficherNotification("Veuillez indiquer votre ville.", "warning");
        return;
      }
      extraData = { metier, ville, quartier: quartier || null };
    }

    const submitButton = inscriptionForm.querySelector("button[type='submit']");
    const texteOriginalBouton = submitButton?.textContent;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Création de compte en cours...`;
    }

    const reponse = await requeteAPI("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        nomComplet,
        telephone,
        email: null,
        password: motdepasse,
        role: roleRadio,
        ...extraData,
      }),
    });

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = texteOriginalBouton;
    }

    if (!reponse || !reponse.token) {
      afficherNotification(
        "Impossible de créer le compte pour le moment. Veuillez réessayer.",
        "error",
      );
      return;
    }

    ecrireStockage("jwt_token", reponse.token);
    ecrireStockage("utilisateurConnecte", reponse.user);

    afficherNotification("Compte créé avec succès ! Redirection...", "success");

    const retour = new URLSearchParams(window.location.search).get("retour");

    setTimeout(() => {
      if (retour) {
        window.location.href = decodeURIComponent(retour);
      } else {
        window.location.href =
          roleRadio === "prestataire" ? "dashboard-prestataire.html" : "dashboard-client.html";
      }
    }, 1200);
  });
}

// Gestion du formulaire de connexion
const connexionForm = document.querySelector("#connexionForm");

if (connexionForm) {
  connexionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifiant = document.querySelector("#identifiant")?.value.trim();
    const motdepasse = document.querySelector("#motdepasse")?.value;
    const typeCompte = document.querySelector("#typeCompte")?.value || "client";

    if (!identifiant || !motdepasse) {
      afficherNotification("Veuillez saisir votre identifiant et mot de passe.", "error");
      return;
    }

    const submitButton = connexionForm.querySelector("button[type='submit']");
    const texteOriginalBouton = submitButton?.textContent;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span>Connexion en cours...`;
    }

    const reponse = await requeteAPI("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifiant, password: motdepasse, typeCompte }),
    });

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = texteOriginalBouton;
    }

    if (!reponse || !reponse.token) {
      afficherNotification("Identifiant ou mot de passe incorrect.", "error");
      return;
    }

    ecrireStockage("jwt_token", reponse.token);
    ecrireStockage("utilisateurConnecte", reponse.user);

    afficherNotification("Connexion réussie ! Redirection en cours...", "success");

    const retour = new URLSearchParams(window.location.search).get("retour");

    setTimeout(() => {
      if (retour) {
        window.location.href = decodeURIComponent(retour);
        return;
      }
      // Le rôle renvoyé par le serveur fait foi (plus fiable que le select,
      // au cas où l'utilisateur se trompe de type de compte)
      const roleServeur = reponse.user?.role || typeCompte;
      if (roleServeur === "admin") {
        window.location.href = "dashboard-admin.html";
      } else if (roleServeur === "prestataire") {
        window.location.href = "dashboard-prestataire.html";
      } else {
        window.location.href = "dashboard-client.html";
      }
    }, 1200);
  });
}
