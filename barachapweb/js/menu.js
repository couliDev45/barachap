const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

// Vérifie que le menu existe sur la page
if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav-open");

    navToggle.setAttribute("aria-expanded", isOpen);
  });

  // Ferme le menu lorsqu'on clique sur un lien
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("nav-open");

      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// Reflète le vrai état de connexion sur TOUTE page (pas seulement les 3
// dashboards) : sans ça, une session pourtant active sur services.html,
// prestataires.html, profil.html, demande.html ou l'accueil affichait
// toujours "Connexion" en dur, donnant l'impression d'être déconnecté à
// chaque changement de page alors que le token restait valide.
// Cible tout lien de nav pointant vers connexion.html, quel que soit le
// texte actuellement écrit en dur dans le HTML (Connexion ou Déconnexion).
const lienConnexion = document.querySelector('.nav a[href$="connexion.html"]');

if (lienConnexion) {
  const utilisateurConnecte = JSON.parse(localStorage.getItem("utilisateurConnecte") || "null");

  if (utilisateurConnecte) {
    lienConnexion.textContent = "Déconnexion";
    lienConnexion.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("utilisateurConnecte");
      window.location.href = "connexion.html";
    });
  } else {
    lienConnexion.textContent = "Connexion";
  }
}
