/**
 * taxi-moto.js
 * Gère la commande d'une course taxi-moto :
 * - départ et destination en TEXTE LIBRE, avec suggestions en direct
 *   (Nominatim, biaisé sur la région de Séguéla/Worodougou) — choisir une
 *   suggestion capture ses coordonnées, mais ce n'est jamais obligatoire :
 *   beaucoup de lieux réels (quartiers, repères locaux) n'existent pas sur
 *   OpenStreetMap, la course doit pouvoir être commandée avec juste une
 *   description tapée à la main
 * - note vocale possible à la place du texte (accessibilité pour les
 *   personnes qui ne savent pas écrire) : enregistrement via MediaRecorder,
 *   transcription automatique best-effort via l'API Web Speech du navigateur
 *   (fiable surtout sur Chrome/Android — se dégrade proprement ailleurs, la
 *   note vocale reste toujours utilisable même sans transcription)
 * - "Ma position actuelle" pour pré-remplir le départ
 * - soumission de la course (POST /api/courses) et suivi en direct par
 *   sondage (GET /api/courses) jusqu'à ce qu'un chauffeur accepte, avec
 *   partage des coordonnées du chauffeur une fois trouvé (le chauffeur a
 *   déjà celles du client, incluses directement dans la course)
 * - barrière de connexion propre à cette page
 */

import { lireStockage } from "./utils.js";
import { requeteAPI } from "./api.js";
import { uploaderAudio } from "./cloudinary.js";

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

// Centre par défaut du biais géographique : Séguéla, région du Worodougou
const CENTRE_DEFAUT = { lat: 7.9601, lng: -6.6746 };

function initialiserFormulaireCourse() {
  const utilisateurConnecte = lireStockage("utilisateurConnecte", null);

  const courseNom = document.querySelector("#courseNom");
  const courseTelephone = document.querySelector("#courseTelephone");
  if (courseNom && utilisateurConnecte?.nom_complet) courseNom.value = utilisateurConnecte.nom_complet;
  if (courseTelephone && utilisateurConnecte?.telephone) courseTelephone.value = utilisateurConnecte.telephone;

  const courseMessage = document.querySelector("#courseMessage");
  function afficherMessageCourse(texte) {
    if (courseMessage) courseMessage.textContent = texte;
  }

  // Points retenus pour chaque champ : le texte est TOUJOURS ce que
  // l'utilisateur voit dans l'input (tapé ou choisi via suggestion) ; lat/lng
  // ne sont renseignés que si une suggestion a été cliquée, et sont effacés
  // dès que le texte est modifié à la main pour ne jamais envoyer des
  // coordonnées qui ne correspondent plus à ce qui est affiché.
  const points = {
    depart: { lat: null, lng: null },
    destination: { lat: null, lng: null },
  };

  // Note vocale par champ : le blob audio est uploadé seulement au moment de
  // la soumission (pas à chaque enregistrement), la transcription (si captée)
  // est gardée à part pour être envoyée en plus du texte.
  const notesVocales = {
    depart: { blob: null, transcription: null },
    destination: { blob: null, transcription: null },
  };

  // --- Enregistrement vocal (accessibilité : pas besoin de savoir écrire) ---
  // Utilise MediaRecorder (toujours disponible, capture l'audio pour lecture
  // par le chauffeur) et, en parallèle, l'API Web Speech pour une
  // transcription en direct quand le navigateur la supporte (surtout
  // Chrome/Android) — jamais bloquant si elle échoue ou n'existe pas.

  function initEnregistrementVocal(type) {
    const bouton = document.querySelector(type === "depart" ? "#btnVocalDepart" : "#btnVocalDestination");
    const statut = document.querySelector(type === "depart" ? "#departVocalStatut" : "#destinationVocalStatut");
    const apercu = document.querySelector(type === "depart" ? "#departVocalApercu" : "#destinationVocalApercu");
    const input = document.querySelector(type === "depart" ? "#departAdresseInput" : "#destinationAdresseInput");
    if (!bouton) return;

    const ReconnaissanceVocale = window.SpeechRecognition || window.webkitSpeechRecognition;
    let enregistreur = null;
    let reconnaissance = null;
    let morceaux = [];
    let enCours = false;

    function remettreEtatNormal() {
      enCours = false;
      bouton.textContent = "🎤";
      bouton.classList.remove("btn-delete");
      if (statut) {
        statut.textContent = notesVocales[type].transcription
          ? "Note vocale enregistrée et transcrite."
          : "Note vocale enregistrée (transcription non disponible sur ce navigateur).";
      }
    }

    bouton.addEventListener("click", async () => {
      if (enCours) {
        enregistreur?.stop();
        reconnaissance?.stop();
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        if (statut) statut.textContent = "L'enregistrement vocal n'est pas disponible sur cet appareil.";
        return;
      }

      try {
        const flux = await navigator.mediaDevices.getUserMedia({ audio: true });

        morceaux = [];
        enregistreur = new MediaRecorder(flux);
        enregistreur.ondataavailable = (e) => morceaux.push(e.data);
        enregistreur.onstop = () => {
          flux.getTracks().forEach((piste) => piste.stop());
          const blob = new Blob(morceaux, { type: "audio/webm" });
          notesVocales[type].blob = blob;
          if (apercu) {
            apercu.src = URL.createObjectURL(blob);
            apercu.style.display = "block";
          }
          remettreEtatNormal();
        };
        enregistreur.start();

        // Transcription en direct, best-effort — n'empêche jamais
        // l'enregistrement audio de fonctionner si elle échoue.
        if (ReconnaissanceVocale) {
          reconnaissance = new ReconnaissanceVocale();
          reconnaissance.lang = "fr-FR";
          reconnaissance.interimResults = false;
          reconnaissance.onresult = (e) => {
            const texte = Array.from(e.results)
              .map((r) => r[0].transcript)
              .join(" ");
            notesVocales[type].transcription = texte;
            if (input) input.value = texte;
            points[type].lat = null;
            points[type].lng = null;
          };
          reconnaissance.start();
        }

        enCours = true;
        bouton.textContent = "⏹";
        bouton.classList.add("btn-delete");
        if (statut) statut.textContent = "🔴 Enregistrement en cours... appuyez à nouveau pour arrêter.";
      } catch {
        if (statut) {
          statut.textContent = "Micro non autorisé. Vérifiez les permissions de votre navigateur.";
        }
      }
    });
  }

  initEnregistrementVocal("depart");
  initEnregistrementVocal("destination");

  // --- Autocomplétion (suggestions en direct pendant la saisie) ---

  function initAutocompletion(type) {
    const input = document.querySelector(type === "depart" ? "#departAdresseInput" : "#destinationAdresseInput");
    const liste = document.querySelector(type === "depart" ? "#departSuggestions" : "#destinationSuggestions");
    if (!input || !liste) return;

    let timeoutId = null;

    function fermerListe() {
      liste.style.display = "none";
      liste.innerHTML = "";
    }

    async function rechercherSuggestions(texte) {
      const delta = 0.8;
      const viewbox = `${CENTRE_DEFAUT.lng - delta},${CENTRE_DEFAUT.lat + delta},${CENTRE_DEFAUT.lng + delta},${CENTRE_DEFAUT.lat - delta}`;

      try {
        const reponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texte)}&countrycodes=ci&viewbox=${viewbox}&limit=5`,
        );
        if (!reponse.ok) throw new Error("Échec de la recherche");
        return await reponse.json();
      } catch {
        return [];
      }
    }

    input.addEventListener("input", () => {
      // Le texte a changé à la main : les coordonnées précédentes ne
      // correspondent plus forcément à ce qui est affiché, on les efface.
      points[type].lat = null;
      points[type].lng = null;

      clearTimeout(timeoutId);
      const texte = input.value.trim();

      if (texte.length < 3) {
        fermerListe();
        return;
      }

      timeoutId = setTimeout(async () => {
        const resultats = await rechercherSuggestions(texte);

        if (!resultats.length) {
          fermerListe();
          return;
        }

        liste.innerHTML = resultats
          .map(
            (r, i) => `
          <div class="suggestion-item" data-index="${i}" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 14px;">
            ${r.display_name}
          </div>
        `,
          )
          .join("");
        liste.style.display = "block";

        liste.querySelectorAll(".suggestion-item").forEach((el) => {
          el.addEventListener("mouseenter", () => (el.style.backgroundColor = "var(--gray-light)"));
          el.addEventListener("mouseleave", () => (el.style.backgroundColor = ""));
          el.addEventListener("click", () => {
            const resultat = resultats[parseInt(el.dataset.index, 10)];
            input.value = resultat.display_name;
            points[type].lat = parseFloat(resultat.lat);
            points[type].lng = parseFloat(resultat.lon);
            fermerListe();
          });
        });
      }, 400);
    });

    // Ferme la liste si on clique ailleurs sur la page
    document.addEventListener("click", (e) => {
      if (e.target !== input && !liste.contains(e.target)) fermerListe();
    });
  }

  initAutocompletion("depart");
  initAutocompletion("destination");

  // --- Ma position actuelle (pré-remplit le champ départ en texte) ---

  const btnMaPosition = document.querySelector("#btnMaPosition");
  if (btnMaPosition) {
    btnMaPosition.addEventListener("click", () => {
      if (!navigator.geolocation) {
        afficherMessageCourse("La géolocalisation n'est pas disponible sur cet appareil.");
        return;
      }
      btnMaPosition.disabled = true;
      btnMaPosition.textContent = "Localisation en cours...";

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          points.depart.lat = latitude;
          points.depart.lng = longitude;

          const departInput = document.querySelector("#departAdresseInput");
          try {
            const reponse = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            );
            const data = await reponse.json();
            if (departInput) departInput.value = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          } catch {
            if (departInput) departInput.value = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          }

          btnMaPosition.disabled = false;
          btnMaPosition.textContent = "📍 Utiliser ma position actuelle";
        },
        () => {
          btnMaPosition.disabled = false;
          btnMaPosition.textContent = "📍 Utiliser ma position actuelle";
          afficherMessageCourse("Impossible d'obtenir votre position. Tapez votre lieu de départ manuellement.");
        },
      );
    });
  }

  // --- Soumission de la course ---
  // Seuls le nom, le téléphone, et les deux textes (départ/destination) sont
  // obligatoires — jamais les coordonnées, jamais une transcription réussie :
  // si une note vocale existe mais n'a pas pu être transcrite (navigateur
  // sans support), un texte de repli suffit pour ne jamais bloquer l'envoi.

  const btnCommanderMoto = document.querySelector("#btnCommanderMoto");
  if (btnCommanderMoto) {
    btnCommanderMoto.addEventListener("click", async () => {
      const nom = courseNom?.value.trim();
      const telephone = courseTelephone?.value.trim();

      const departTexte =
        document.querySelector("#departAdresseInput")?.value.trim() ||
        (notesVocales.depart.blob ? "Note vocale (voir audio)" : "");
      const destinationTexte =
        document.querySelector("#destinationAdresseInput")?.value.trim() ||
        (notesVocales.destination.blob ? "Note vocale (voir audio)" : "");

      if (!nom || !telephone) {
        afficherMessageCourse("Veuillez indiquer votre nom et votre téléphone.");
        return;
      }
      if (!departTexte) {
        afficherMessageCourse("Veuillez indiquer votre point de départ (texte ou note vocale).");
        return;
      }
      if (!destinationTexte) {
        afficherMessageCourse("Veuillez indiquer votre destination (texte ou note vocale).");
        return;
      }

      btnCommanderMoto.disabled = true;

      let departAudioUrl = null;
      let destinationAudioUrl = null;

      if (notesVocales.depart.blob || notesVocales.destination.blob) {
        afficherMessageCourse("Envoi des notes vocales...");
        if (notesVocales.depart.blob) departAudioUrl = await uploaderAudio(notesVocales.depart.blob);
        if (notesVocales.destination.blob) destinationAudioUrl = await uploaderAudio(notesVocales.destination.blob);
      }

      afficherMessageCourse("");

      const reponse = await requeteAPI("/courses", {
        method: "POST",
        body: JSON.stringify({
          nom,
          telephone,
          departLat: points.depart.lat,
          departLng: points.depart.lng,
          departAdresse: departTexte,
          departAudioUrl,
          departTranscription: notesVocales.depart.transcription,
          destinationLat: points.destination.lat,
          destinationLng: points.destination.lng,
          destinationAdresse: destinationTexte,
          destinationAudioUrl,
          destinationTranscription: notesVocales.destination.transcription,
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
    const courseSuiviSpinner = document.querySelector("#courseSuiviSpinner");
    const courseSuiviDetail = document.querySelector("#courseSuiviDetail");
    const btnAnnulerCourse = document.querySelector("#btnAnnulerCourse");
    const chauffeurContact = document.querySelector("#chauffeurContact");
    const chauffeurNom = document.querySelector("#chauffeurNom");
    const chauffeurAppeler = document.querySelector("#chauffeurAppeler");
    const chauffeurWhatsapp = document.querySelector("#chauffeurWhatsapp");

    if (courseSuivi) courseSuivi.style.display = "block";

    let intervalId = null;

    function normaliserPourWhatsApp(telephone) {
      const chiffres = (telephone || "").replace(/\D/g, "");
      if (chiffres.startsWith("225")) return chiffres;
      if (chiffres.startsWith("0")) return "225" + chiffres.slice(1);
      return "225" + chiffres;
    }

    async function verifierStatut() {
      const reponse = await requeteAPI("/courses");
      const course = reponse?.courses?.find((c) => c.id === courseId);
      if (!course) return;

      if (course.statut === "Acceptée" || course.statut === "En cours") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Chauffeur trouvé !";
        if (courseSuiviSpinner) courseSuiviSpinner.style.display = "none";
        if (courseSuiviDetail) {
          courseSuiviDetail.textContent = "Voici les coordonnées de votre chauffeur :";
        }

        if (chauffeurContact && course.chauffeur_nom) {
          chauffeurContact.style.display = "block";
          if (chauffeurNom) chauffeurNom.textContent = course.chauffeur_nom;
          if (chauffeurAppeler) chauffeurAppeler.href = `tel:${course.chauffeur_telephone || ""}`;
          if (chauffeurWhatsapp) {
            chauffeurWhatsapp.href = `https://wa.me/${normaliserPourWhatsApp(course.chauffeur_telephone)}`;
          }
        }

        if (btnAnnulerCourse) btnAnnulerCourse.style.display = "none";
        clearInterval(intervalId);
      } else if (course.statut === "Terminée") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course terminée";
        if (courseSuiviSpinner) courseSuiviSpinner.style.display = "none";
        if (courseSuiviDetail) courseSuiviDetail.textContent = "Merci d'avoir utilisé BaraChap !";
        clearInterval(intervalId);
      } else if (course.statut === "Annulée") {
        if (courseSuiviTitre) courseSuiviTitre.textContent = "Course annulée";
        if (courseSuiviSpinner) courseSuiviSpinner.style.display = "none";
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
        if (courseSuiviSpinner) courseSuiviSpinner.style.display = "none";
        if (btnAnnulerCourse) btnAnnulerCourse.style.display = "none";
      });
    }
  }
}
