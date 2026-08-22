-- ==============================================================================
-- MIGRATION — Coordonnées GPS optionnelles pour les courses taxi-moto
-- Certains lieux réels (quartiers, repères locaux) n'existent pas sur
-- OpenStreetMap, surtout dans les zones moins couvertes comme Séguéla — le
-- client doit pouvoir commander une course même sans coordonnées exactes,
-- avec juste une description textuelle du départ et de la destination.
-- À exécuter une seule fois dans le SQL Editor de Neon.
-- ==============================================================================

ALTER TABLE courses ALTER COLUMN depart_lat DROP NOT NULL;
ALTER TABLE courses ALTER COLUMN depart_lng DROP NOT NULL;
ALTER TABLE courses ALTER COLUMN destination_lat DROP NOT NULL;
ALTER TABLE courses ALTER COLUMN destination_lng DROP NOT NULL;
