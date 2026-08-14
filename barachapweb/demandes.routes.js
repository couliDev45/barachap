/**
 * demandes.routes.js
 * Routes pour la création, la consultation et la gestion des demandes de services.
 * Toutes les routes exigent un JWT valide (client, prestataire ou admin).
 *
 * Sécurité : le filtrage par propriétaire est appliqué côté serveur à partir
 * du rôle et de l'id présents dans le token JWT — jamais à partir des
 * paramètres envoyés par le client. Un client authentifié ne peut donc pas
 * lire, modifier ou supprimer les demandes d'un autre utilisateur en
 * modifiant l'URL ou le corps de la requête.
 */

import { Router } from "express";
import { query } from "../config/db.js";
import { verifierToken } from "../middleware/auth.js";

const router = Router();

router.use(verifierToken);

/**
 * GET /api/demandes
 * - Un client ne voit que ses propres demandes envoyées.
 * - Un prestataire ne voit que les demandes qui lui ont été adressées.
 * - Un admin voit tout, ou peut filtrer via ?clientId= / ?prestataireId=.
 */
router.get("/", async (req, res) => {
  const { id: userId, role } = req.user;
  const { clientId, prestataireId } = req.query;

  try {
    let sql = "SELECT demandes.*, EXISTS(SELECT 1 FROM avis WHERE avis.demande_id = demandes.id) AS a_avis FROM demandes";
    const params = [];

    if (role === "admin") {
      if (clientId) {
        params.push(clientId);
        sql += ` WHERE client_id = $${params.length}`;
      } else if (prestataireId) {
        params.push(prestataireId);
        sql += ` WHERE prestataire_id = $${params.length}`;
      }
    } else if (role === "prestataire") {
      params.push(userId);
      sql += ` WHERE prestataire_id = $${params.length}`;
    } else {
      params.push(userId);
      sql += ` WHERE client_id = $${params.length}`;
    }

    sql += " ORDER BY created_at DESC";

    const result = await query(sql, params);
    res.json({ demandes: result.rows });
  } catch (err) {
    console.error("Erreur Liste Demandes :", err);
    res.status(500).json({ message: "Erreur serveur lors de la récupération des demandes." });
  }
});

/**
 * POST /api/demandes
 * Soumission d'une nouvelle demande de service par le client connecté.
 * client_id est TOUJOURS déduit du token, jamais du corps de la requête.
 */
router.post("/", async (req, res) => {
  const { prestation, nom, prenom, telephone, besoin, date, ville, prestataireId } = req.body;
  const clientId = req.user.id;

  if (!prestation || !nom || !telephone || !besoin || !date || !ville) {
    return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
  }

  try {
    const result = await query(
      `INSERT INTO demandes (client_id, prestataire_id, prestation, nom_client, prenom_client, telephone_client, besoin, date_souhaitee, ville, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'En attente')
       RETURNING *`,
      [clientId, prestataireId || null, prestation, nom, prenom || null, telephone, besoin, date, ville]
    );

    res.status(201).json({
      message: "Votre demande a bien été envoyée. Le prestataire vous contactera bientôt.",
      demande: result.rows[0],
    });
  } catch (err) {
    console.error("Erreur Création Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la création de la demande." });
  }
});

/**
 * PUT /api/demandes/:id
 * Mise à jour du statut d'une demande. Réservé au prestataire destinataire
 * de la demande, ou à un admin.
 */
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;
  const { id: userId, role } = req.user;

  if (!statut) {
    return res.status(400).json({ message: "Veuillez fournir le statut." });
  }

  try {
    const existante = await query("SELECT prestataire_id FROM demandes WHERE id = $1", [id]);

    if (existante.rows.length === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    const estDestinataire = Number(existante.rows[0].prestataire_id) === Number(userId);
    if (role !== "admin" && !estDestinataire) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier cette demande." });
    }

    const result = await query(
      "UPDATE demandes SET statut = $1 WHERE id = $2 RETURNING *",
      [statut, id]
    );

    res.json({
      message: "Statut de la demande mis à jour avec succès.",
      demande: result.rows[0],
    });
  } catch (err) {
    console.error("Erreur Maj Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour de la demande." });
  }
});

/**
 * PUT /api/demandes/:id/modifier
 * Modifie le CONTENU complet d'une demande (prestation, coordonnées, date,
 * ville...). Distincte de PUT /:id qui ne gère que le statut — celle-ci est
 * réservée au client propriétaire de la demande (ou à un admin), jamais au
 * prestataire, et ne touche jamais au statut.
 */
router.put("/:id/modifier", async (req, res) => {
  const { id } = req.params;
  const { id: userId, role } = req.user;
  const { prestation, nom, prenom, telephone, besoin, date, ville } = req.body;

  if (!prestation || !nom || !telephone || !besoin || !date || !ville) {
    return res.status(400).json({ message: "Veuillez remplir tous les champs obligatoires." });
  }

  try {
    const existante = await query("SELECT client_id FROM demandes WHERE id = $1", [id]);

    if (existante.rows.length === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    const estProprietaire = Number(existante.rows[0].client_id) === Number(userId);
    if (role !== "admin" && !estProprietaire) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à modifier cette demande." });
    }

    const result = await query(
      `UPDATE demandes SET
        prestation = $1, nom_client = $2, prenom_client = $3,
        telephone_client = $4, besoin = $5, date_souhaitee = $6, ville = $7
       WHERE id = $8
       RETURNING *`,
      [prestation, nom, prenom || null, telephone, besoin, date, ville, id],
    );

    res.json({ message: "Demande modifiée avec succès.", demande: result.rows[0] });
  } catch (err) {
    console.error("Erreur Modification Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la modification de la demande." });
  }
});

/**
 * DELETE /api/demandes/:id
 * Réservé au client propriétaire de la demande, ou à un admin.
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { id: userId, role } = req.user;

  try {
    const existante = await query("SELECT client_id FROM demandes WHERE id = $1", [id]);

    if (existante.rows.length === 0) {
      return res.status(404).json({ message: "Demande non trouvée." });
    }

    const estProprietaire = Number(existante.rows[0].client_id) === Number(userId);
    if (role !== "admin" && !estProprietaire) {
      return res.status(403).json({ message: "Vous n'êtes pas autorisé à supprimer cette demande." });
    }

    await query("DELETE FROM demandes WHERE id = $1", [id]);

    res.json({ message: "Demande supprimée avec succès." });
  } catch (err) {
    console.error("Erreur Suppression Demande :", err);
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

export default router;
