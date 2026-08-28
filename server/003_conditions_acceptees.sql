-- ==============================================================================
-- MIGRATION — Acceptation des conditions d'utilisation
-- À exécuter une seule fois dans le SQL Editor de votre base PostgreSQL.
-- ==============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS conditions_acceptees_at TIMESTAMP WITH TIME ZONE;

-- Note : les comptes déjà existants avant cette migration auront cette
-- colonne à NULL (ils n'ont jamais explicitement accepté via la case à
-- cocher, puisqu'elle n'existait pas encore). C'est une trace honnête de
-- la réalité — ne pas la remplir artificiellement avec la date du jour,
-- qui donnerait une fausse preuve d'acceptation.
