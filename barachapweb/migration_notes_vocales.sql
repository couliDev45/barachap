-- ==============================================================================
-- MIGRATION — Notes vocales pour départ/destination des courses taxi-moto
-- Accessibilité : permet à un client qui ne sait pas écrire d'enregistrer sa
-- position/destination à la voix plutôt que de taper du texte.
-- À exécuter une seule fois dans le SQL Editor de Neon.
-- ==============================================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS depart_audio_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS depart_transcription TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS destination_audio_url TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS destination_transcription TEXT;
