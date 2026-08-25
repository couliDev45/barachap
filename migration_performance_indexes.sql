-- ==============================================================================
-- MIGRATION — Index de performance des listes et tableaux de bord BaraChap
-- À exécuter une seule fois dans le SQL Editor de Neon, après les migrations
-- existantes. Toutes les instructions sont idempotentes.
-- ==============================================================================

-- Demandes : tableaux de bord client, prestataire et administration.
CREATE INDEX IF NOT EXISTS demandes_client_created_at_idx
  ON demandes (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS demandes_prestataire_created_at_idx
  ON demandes (prestataire_id, created_at DESC);

-- Courses taxi-moto : historique, attribution et recherche de courses actives.
CREATE INDEX IF NOT EXISTS courses_client_created_at_idx
  ON courses (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS courses_chauffeur_created_at_idx
  ON courses (chauffeur_id, created_at DESC);
CREATE INDEX IF NOT EXISTS courses_statut_created_at_idx
  ON courses (statut, created_at DESC);

-- Pages profil, catalogue et statistiques des catégories.
CREATE INDEX IF NOT EXISTS services_prestataire_created_at_idx
  ON services (prestataire_id, created_at DESC);
CREATE INDEX IF NOT EXISTS services_categorie_id_idx
  ON services (categorie_id);
CREATE INDEX IF NOT EXISTS realisations_prestataire_created_at_idx
  ON realisations (prestataire_id, created_at DESC);
CREATE INDEX IF NOT EXISTS avis_prestataire_created_at_idx
  ON avis (prestataire_id, created_at DESC);

-- Listes de prestataires validés et en attente de traitement administratif.
CREATE INDEX IF NOT EXISTS users_role_statut_created_at_idx
  ON users (role, statut_validation, created_at DESC);
