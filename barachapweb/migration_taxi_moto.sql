-- ==============================================================================
-- MIGRATION — Système de courses Taxi-moto
-- À exécuter une seule fois dans le SQL Editor de Neon, après les migrations
-- précédentes. Sûr à relancer plusieurs fois.
-- ==============================================================================

DO $$ BEGIN
    CREATE TYPE statut_course AS ENUM ('En attente', 'Acceptée', 'En cours', 'Terminée', 'Annulée');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES users(id) ON DELETE SET NULL,
    chauffeur_id INT REFERENCES users(id) ON DELETE SET NULL,
    nom_client VARCHAR(100) NOT NULL,
    telephone_client VARCHAR(30) NOT NULL,
    depart_lat DOUBLE PRECISION NOT NULL,
    depart_lng DOUBLE PRECISION NOT NULL,
    depart_adresse TEXT,
    destination_lat DOUBLE PRECISION NOT NULL,
    destination_lng DOUBLE PRECISION NOT NULL,
    destination_adresse TEXT,
    statut statut_course DEFAULT 'En attente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disponibilité et position des chauffeurs (générique : réutilisable pour
-- d'autres prestataires "à la demande" plus tard, pas seulement taxi-moto)
ALTER TABLE users ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position_updated_at TIMESTAMP WITH TIME ZONE;
