/**
 * courses.routes.js
 * Routes du service taxi-moto : le client choisit départ/destination sur une
 * carte, la course apparaît chez tous les chauffeurs disponibles à proximité
 * (triée par distance), premier arrivé premier servi sur l'acceptation.
 *
 * Pas de minuteur de réattribution séquentielle à un seul chauffeur : voir
 * l'explication donnée à l'utilisateur — un site web ne peut pas garantir
 * qu'un chauffeur reçoive une notification en temps réel écran verrouillé,
 * donc un modèle "premier arrivé, premier servi" parmi les chauffeurs
 * disponibles à proximité est plus fiable en pratique.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();

router.use(verifierToken);

// Formule de Haversine en SQL brut : distance en km entre deux points GPS,
// sans dépendre d'une extension Postgres particulière.
function sqlDistanceKm(latParam, lngParam, colLat, colLng) {
  return `(6371 * acos(
    LEAST(1, GREATEST(-1,
      cos(radians(${latParam})) * cos(radians(${colLat})) *
      cos(radians(${colLng}) - radians(${lngParam})) +
      sin(radians(${latParam})) * sin(radians(${colLat}))
    ))
  ))`;
}

/**
 * POST /api/courses
 * Le client connecté crée une nouvelle demande de course.
 */
router.post("/", async (req, res) => {
  const { nom, telephone, departLat, departLng, departAdresse, destinationLat, destinationLng, destinationAdresse } =
    req.body;
  const clientId = req.user.id;

  if (!nom || !telephone || departLat == null || departLng == null || destinationLat == null || destinationLng == null) {
    return res.status(400).json({ message: "Veuillez indiquer le départ et la destination." });
  }

  try {
    const result = await query(
      `INSERT INTO courses (client_id, nom_client, telephone_client, depart_lat, depart_lng, depart_adresse, destination_lat, destination_lng, destination_adresse, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'En attente')
       RETURNING *`,
      [clientId, nom, telephone, departLat, departLng, departAdresse || null, destinationLat, destinationLng, destinationAdresse || null],
    );

    res.status(201).json({ message: "Recherche d'un chauffeur en cours...", course: result.rows[0] });
  } catch (err) {
    console.error("Erreur Création Course :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création de la course." });
  }
});

/**
 * GET /api/courses
 * - Client : ses propres courses (historique + en cours).
 * - Chauffeur : les courses qui lui sont assignées.
 * - Admin : tout.
 */
router.get("/", async (req, res) => {
  const { id: userId, role } = req.user;

  try {
    let sql = "SELECT * FROM courses";
    const params = [];

    if (role === "prestataire") {
      params.push(userId);
      sql += ` WHERE chauffeur_id = $${params.length}`;
    } else if (role === "client") {
      params.push(userId);
      sql += ` WHERE client_id = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC";

    const result = await query(sql, params);
    res.json({ courses: result.rows });
  } catch (err) {
    console.error("Erreur Liste Courses :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des courses." });
  }
});

/**
 * GET /api/courses/disponibles
 * Pour un chauffeur disponible : les courses en attente triées par distance
 * depuis sa dernière position connue.
 */
router.get("/disponibles", async (req, res) => {
  const { id: userId } = req.user;

  try {
    const chauffeur = await query("SELECT position_lat, position_lng, disponible FROM users WHERE id = $1", [userId]);

    if (chauffeur.rows.length === 0 || !chauffeur.rows[0].disponible) {
      return res.json({ courses: [], message: "Activez votre disponibilité pour voir les courses proches." });
    }

    const { position_lat, position_lng } = chauffeur.rows[0];

    if (position_lat == null || position_lng == null) {
      return res.json({ courses: [], message: "Position non disponible pour le moment." });
    }

    const distance = sqlDistanceKm("$1", "$2", "depart_lat", "depart_lng");
    const result = await query(
      `SELECT *, ROUND(${distance}::numeric, 1) AS distance_km
       FROM courses
       WHERE statut = 'En attente'
       ORDER BY distance_km ASC
       LIMIT 20`,
      [position_lat, position_lng],
    );

    res.json({ courses: result.rows });
  } catch (err) {
    console.error("Erreur Courses Disponibles :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des courses proches." });
  }
});

/**
 * PUT /api/courses/:id/accepter
 * Premier chauffeur disponible à cliquer "Accepter" obtient la course.
 * La condition WHERE statut = 'En attente' dans l'UPDATE rend l'opération
 * atomique : si deux chauffeurs cliquent en même temps, un seul des deux
 * UPDATE affectera une ligne, l'autre recevra 0 ligne modifiée.
 */
router.put("/:id/accepter", async (req, res) => {
  const { id } = req.params;
  const chauffeurId = req.user.id;

  try {
    const result = await query(
      `UPDATE courses SET chauffeur_id = $1, statut = 'Acceptée'
       WHERE id = $2 AND statut = 'En attente'
       RETURNING *`,
      [chauffeurId, id],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ message: "Cette course vient d'être acceptée par un autre chauffeur." });
    }

    res.json({ message: "Course acceptée avec succès.", course: result.rows[0] });
  } catch (err) {
    console.error("Erreur Acceptation Course :", err);
    res.status(500).json({ message: "Erreur serveur lors de l'acceptation de la course." });
  }
});

/**
 * PUT /api/courses/:id/statut
 * Changement de statut (En cours / Terminée / Annulée), réservé au
 * chauffeur assigné ou au client propriétaire (pour l'annulation), ou admin.
 */
router.put("/:id/statut", async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  const { id: userId, role } = req.user;

  const statutsValides = ["En cours", "Terminée", "Annulée"];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ message: "Statut invalide." });
  }

  try {
    const existante = await query("SELECT client_id, chauffeur_id FROM courses WHERE id = $1", [id]);

    if (existante.rows.length === 0) {
      return res.status(404).json({ message: "Course non trouvée." });
    }

    const course = existante.rows[0];
    const estChauffeur = Number(course.chauffeur_id) === Number(userId);
    const estClient = Number(course.client_id) === Number(userId);

    if (role !== "admin" && !estChauffeur && !(statut === "Annulée" && estClient)) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier cette course." });
    }

    const result = await query("UPDATE courses SET statut = $1 WHERE id = $2 RETURNING *", [statut, id]);

    res.json({ message: "Statut mis à jour avec succès.", course: result.rows[0] });
  } catch (err) {
    console.error("Erreur Maj Statut Course :", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour du statut." });
  }
});

export default router;
