-- ==============================================================================
-- MIGRATION — Avis clients + paramètres du site
-- À exécuter une seule fois dans le SQL Editor de Neon, après les migrations
-- précédentes. Sûr à relancer plusieurs fois.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS avis (
    id SERIAL PRIMARY KEY,
    demande_id INT REFERENCES demandes(id) ON DELETE SET NULL,
    client_id INT REFERENCES users(id) ON DELETE SET NULL,
    prestataire_id INT REFERENCES users(id) ON DELETE CASCADE,
    note INT NOT NULL CHECK (note >= 1 AND note <= 5),
    commentaire TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Un seul avis par demande, pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS avis_demande_unique ON avis(demande_id);

CREATE TABLE IF NOT EXISTS parametres (
    cle VARCHAR(100) PRIMARY KEY,
    valeur TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO parametres (cle, valeur) VALUES ('hero_image_url', NULL)
ON CONFLICT (cle) DO NOTHING;
