-- ==============================================================================
-- MIGRATION — Table des abonnements aux notifications push
-- À exécuter une seule fois dans le SQL Editor de votre base PostgreSQL
-- (Render / Supabase / Neon...), en plus de schema.sql déjà en place.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
