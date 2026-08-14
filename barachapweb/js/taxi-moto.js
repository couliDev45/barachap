/**
 * taxi-moto.js
 * Gère la commande d'une course taxi-moto :
 * - deux cartes Leaflet/OpenStreetMap (gratuit, sans clé API), centrées sur
 *   Séguéla (Worodougou), pour choisir départ et destination
 * - trois façons de définir un point : cliquer sur la carte, taper une
 *   adresse (geocoding via Nominatim, biaisé sur la région), ou "Ma position
 *   actuelle" pour le départ
 * - reverse-geocoding léger via Nominatim (un seul appel par point posé, pas
 *   en continu) pour afficher une adresse lisible plutôt que des coordonnées
 * - soumission de la course (POST /api/courses) et suivi en direct par
 *   sondage (GET /api/courses) jusqu'à ce qu'un chauffeur accepte
 * - barrière de connexion propre à cette page
 */

import { lireStockage } from "./utils.js";
import { requeteAPI } from "./api.js";

const courseForm = document.querySelector("#courseForm");

// Cette page ne s'exécute que si elle contient réellement le formulaire de course
if (courseForm) {
  const courseFormTitre = document.querySelector("#courseFormTitre");
  const courseGateConnexion = document.querySelector("#courseGateConnexion");
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  // --- Barrière de connexion (même logique que demande.html, propre à cette page) ---
  if (!utilisateurConnecte && courseGateConnexion) {
    if (courseFormTitre) courseFormTitre.style.display = "none";
    courseForm.style.display = "none";
    courseGateConnexion.style.display = "block";

    const retour = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
    const lienConnexion = document.querySelector("#courseGateLienConnexion");
    const lienInscription = document.querySelector("#courseGateLienInscription");
    if (lienConnexion) lienConnexion.href = `connexion.html?retour=${retour}`;
    if (lienInscription) lienInscription.href = `inscription.html?retour=${retour}`;
  } else {
    initialiserFormulaireCourse();
  }
}

function initialiserFormulaireCourse() {
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  // Centre par défaut : Séguéla, région du Worodougou
  const CENTRE_DEFAUT = [7.9601, -6.6746];

  const courseNom = document.querySelector("#courseNom");
  const courseTelephone = document.querySelector("#courseTelephone");
  if (courseNom && utilisateurConnecte?.nom_complet) courseNom.value = utilisateurConnecte.nom_complet;
  if (courseTelephone && utilisateurConnecte?.telephone) courseTelephone.value = utilisateurConnecte.telephone;

  const carteDepart = L.map("carteDepart").setView(CENTRE_DEFAUT, 13);
  const carteDestination = L.map("carteDestination").setView(CENTRE_DEFAUT, 13);

  [carteDepart, carteDestination].forEach((carte) => {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(carte);
  });

  let marqueurDepart = null;
  let marqueurDestination = null;
  let pointDepart = null; // { lat, lng, adresse }
  let pointDestination = null;

  // Reverse-geocoding léger : un seul appel par point posé, jamais en continu
  // (respecte la politique d'usage de Nominatim, le service gratuit d'OpenStreetMap)
  async function adresseDepuisCoordonnees(lat, lng) {
    try {
      const reponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      if (!reponse.ok) throw new Error("Échec reverse-geocoding");
      const data = await reponse.json();
      return data.display_name || null;
    } catch {
      return null;
    }
  }

  // Geocoding direct (adresse tapée -> coordonnées), avec un biais géographique
  // sur la région du Worodougou/Séguéla plutôt qu'une restriction stricte : une
  // adresse ailleurs en Côte d'Ivoire reste trouvable, juste moins prioritaire.
  async function coordonneesDepuisAdresse(adresse) {
    const [lat, lng] = CENTRE_DEFAUT;
    const delta = 0.8;
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;

    try {
      const reponse = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(adresse)}&countrycodes=ci&viewbox=${viewbox}&limit=1`,
      );
      if (!reponse.ok) throw new Error("Échec du geocoding");
      const data = await reponse.json();
      if (!data.length) return null;
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), adresse: data[0].display_name };
    } catch {
      return null;
    }
  }

  async function definirPoint(type, lat, lng, adresseConnue) {
    const estDepart = type === "depart";
    const carte = estDepart ? carteDepart : carteDestination;
    const label = document.querySelector(estDepart ? "#departAdresseLabel" : "#destinationAdresseLabel");

    if (estDepart) {
      if (marqueurDepart) marqueurDepart.setLatLng([lat, lng]);
      else marqueurDepart = L.marker([lat, lng]).addTo(carte);
    } else {
      if (marqueurDestination) marqueurDestination.setLatLng([lat, lng]);
      else marqueurDestination = L.marker([lat, lng]).addTo(carte);
    }

    carte.setView([lat, lng], 15);
    if (label) label.textContent = "Localisation en cours...";

    const adresse = adresseConnue ?? (await adresseDepuisCoordonnees(lat, lng));
    const point = { lat, lng, adresse };

    if (estDepart) pointDepart = point;
    else pointDestination = point;

    if (label) label.textContent = adresse || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  carteDepart.on("click", (e) => definirPoint("depart", e.latlng.lat, e.latlng.lng));
  carteDestination.on("click", (e) => definirPoint("destination", e.latlng.lat, e.latlng.lng));

  // --- Recherche d'adresse tapée manuellement ---

  async function rechercherEtDefinir(type, input) {
    const adresse = input?.value.trim();
    if (!adresse) return;

    const label = document.querySelector(type === "depart" ? "#departAdresseLabel" : "#destinationAdresseLabel");
    if (label) label.textContent = "Recherche en cours...";

    const resultat = await coordonneesDepuisAdresse(adresse);

    if (!resultat) {
      if (label) label.textContent = "Adresse introuvable. Essayez une formulation différente ou cliquez sur la carte.";
      return;
    }

    definirPoint(type, resultat.lat, resultat.lng, resultat.adresse);
  }

  const departAdresseInput = document.querySelector("#departAdresseInput");
  const destinationAdresseInput = document.querySelector("#destinationAdresseInput");
  const btnRechercherDepart = document.querySelector("#btnRechercherDepart");
  const btnRechercherDestination = document.querySelector("#btnRechercherDestination");

  if (btnRechercherDepart) {
    btnRechercherDepart.addEventListener("click", () => rechercherEtDefinir("depart", departAdresseInput));
  }
  if (departAdresseInput) {
    departAdresseInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        rechercherEtDefinir("depart", departAdresseInput);
      }
    });
  }
  if (btnRechercherDestination) {
    btnRechercherDestination.addEventListener("click", () =>
      rechercherEtDefinir("destination", destinationAdresseInput),
    );
  }
  if (destinationAdresseInput) {
    destinationAdresseInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        rechercherEtDefinir("destination", destinationAdresseInput);
      }
    });
  }

  const btnMaPosition = document.querySelector("#btnMaPosition");
  if (btnMaPosition) {
    btnMaPosition.addEventListener("click", () => {
      if (!navigator.geolocation) {
        afficherMessageCourse("La géolocalisation n'est pas disponible sur cet appareil.");
        return;
      }
      btnMaPosition.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          btnMaPosition.disabled = false;
          definirPoint("depart", position.coords.latitude, position.coords.longitude);
        },
        () => {
          btnMaPosition.disabled = false;
          afficherMessageCourse("Impossible d'obtenir votre position. Cliquez sur la carte ou tapez une adresse.");
        },
      );
    });
  }

  const courseMessage = document.querySelector("#courseMessage");
  function afficherMessageCourse(texte) {
    if (courseMessage) courseMessage.textContent = texte;
  }

  // --- Soumission de la course ---

  const btnCommanderMoto = document.querySelector("#btnCommanderMoto");
  if (btnCommanderMoto) {
    btnCommanderMoto.addEventListener("click", async () => {
      const nom = courseNom?.value.trim();
      const telephone = courseTelephone?.value.trim();

      if (!nom || !telephone) {
        afficherMessageCourse("Veuillez indiquer votre nom et votre téléphone.");
        return;
      }
      if (!pointDepart) {
        afficherMessageCourse("Veuillez indiquer votre point de départ.");
        return;
      }
      if (!pointDestination) {
        afficherMessageCourse("Veuillez indiquer votre destination.");
        return;
      }

      btnCommanderMoto.disabled = true;
      afficherMessageCourse("");

      const reponse = await requeteAPI("/courses", {
        method: "POST",
        body: JSON.stringify({
          nom,
          telephone,
          departLat: pointDepart.lat,
          departLng: pointDepart.lng,
          departAdresse: pointDepart.adresse,
          destinationLat: pointDestination.lat,
          destinationLng: pointDestination.lng,
          destinationAdresse: pointDestination.adresse,
        }),
      });

      btnCommanderMoto.disabled = false;

      if (!reponse?.course) {
        afficherMessageCourse(reponse?.message || "Impossible de commander la moto pour le moment.");
        return;
      }

      demarrerSuivi(reponse.course.id);
    });
  }

  // --- Suivi en direct de la course ---

  function demarrerSuivi(courseId) {
    courseForm.style.display = "none";
    if (courseFormTitre) courseFormTitre.style.display = "none";

    const courseSuivi = document.querySelector("#courseSuivi");
    const courseSuiviTitre = document.querySelector("#courseSuiviTitre");
    const courseSuiviDetail = document.querySelector("#courseSuiviDetail");
    const btnAnnulerCourse = document.querySelector("#btnAnnulerCourse");

    if (courseSuivi) courseSuivi.style.display = "block";

    let intervalId = null;

    async function verifierStatut() {
      const reponse = await requeteAPI("/courses");
      const course = reponse?.courses?.find((c) => c.id === courseId);
      if (!course) return;

      if (course.statut === "Acceptée" || course.statut === "En cours") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Chauffeur trouvé !";
        if (courseSuiviDetail) {
          courseSuiviDetail.textContent = "Votre chauffeur a été notifié et arrive vers votre position.";
        }
        if (btnAnnulerCourse) btnAnnulerCourse.style.display = "none";
        clearInterval(intervalId);
      } else if (course.statut === "Terminée") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course terminée";
        if (courseSuiviDetail) courseSuiviDetail.textContent = "Merci d'avoir utilisé BaraChap !";
        clearInterval(intervalId);
      } else if (course.statut === "Annulée") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course annulée";
        clearInterval(intervalId);
      }
    }

    intervalId = setInterval(verifierStatut, 5000);
    verifierStatut();

    if (btnAnnulerCourse) {
      btnAnnulerCourse.addEventListener("click", async () => {
        if (!confirm("Voulez-vous vraiment annuler cette course ?")) return;
        await requeteAPI(`/courses/${courseId}/statut`, {
          method: "PUT",
          body: JSON.stringify({ statut: "Annulée" }),
        });
        clearInterval(intervalId);
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course annulée";
        if (btnAnnulerCourse) btnAnnulerCourse.style.display = "none";
      });
    }
  }
}
