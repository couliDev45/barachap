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

// Déconnexion réelle : les liens "Déconnexion" du header ne faisaient
// jusqu'ici que naviguer vers connexion.html sans jamais effacer la
// session (jwt_token / utilisateurConnecte restaient en localStorage).
const btnDeconnexion = document.querySelector("#btnDeconnexion");
if (btnDeconnexion) {
  btnDeconnexion.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("utilisateurConnecte");
    window.location.href = "connexion.html";
  });
}
