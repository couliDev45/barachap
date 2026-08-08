-- ==============================================================================
-- SCHÉMA DE BASE DE DONNÉES POSTGRESQL — BARACHAP WEB
-- ==============================================================================

-- Extension pour la génération d'UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Type Enum pour les rôles d'utilisateurs
DO $$ BEGIN
    CREATE TYPE role_utilisateur AS ENUM ('client', 'prestataire', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Type Enum pour les statuts de demande
DO $$ BEGIN
    CREATE TYPE statut_demande AS ENUM ('En attente', 'Acceptée', 'Refusée', 'Terminée');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Table des utilisateurs (Clients, Prestataires, Administrateurs)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nom_complet VARCHAR(150) NOT NULL,
    telephone VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role role_utilisateur NOT NULL DEFAULT 'client',
    metier VARCHAR(100),
    ville VARCHAR(100) DEFAULT 'Abidjan',
    quartier VARCHAR(100),
    statut_validation VARCHAR(50) DEFAULT 'Validé', -- 'En attente', 'Validé', 'Rejeté'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table des catégories de services
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des services proposés par les prestataires
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    prestataire_id INT REFERENCES users(id) ON DELETE CASCADE,
    titre VARCHAR(150) NOT NULL,
    description TEXT,
    tarif_indicatif VARCHAR(100),
    categorie_id INT REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table des demandes de services
CREATE TABLE IF NOT EXISTS demandes (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES users(id) ON DELETE SET NULL,
    prestataire_id INT REFERENCES users(id) ON DELETE SET NULL,
    prestation VARCHAR(150) NOT NULL,
    nom_client VARCHAR(100) NOT NULL,
    prenom_client VARCHAR(100),
    telephone_client VARCHAR(30) NOT NULL,
    besoin TEXT NOT NULL,
    date_souhaitee DATE NOT NULL,
    ville VARCHAR(100) NOT NULL,
    statut statut_demande DEFAULT 'En attente',
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Table des réalisations et portfolio des prestataires
CREATE TABLE IF NOT EXISTS realisations (
    id SERIAL PRIMARY KEY,
    prestataire_id INT REFERENCES users(id) ON DELETE CASCADE,
    titre VARCHAR(150) NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Données initiales par défaut (Catégories et administrateur démo)
INSERT INTO categories (nom, description) VALUES
    ('Plombier', 'Dépannage, tuyauterie et sanitaire'),
    ('Électricien', 'Installation et réparation électrique'),
    ('Taxi-moto', 'Transport rapide en ville et quartier'),
    ('Chauffeur', 'Transport privé et trajets'),
    ('Livraison', 'Livraison de colis et marchandises'),
    ('Mécanicien', 'Entretien et réparation automobile'),
    ('Coiffeur', 'Coiffure et tresses à domicile ou salon'),
    ('Couturier', 'Confection et retouche d étêtement'),
    ('Maçon', 'Travaux de maçonnerie et rénovation'),
    ('Menuisier', 'Fabrication et réparation de meubles')
ON CONFLICT (nom) DO NOTHING;

-- Création d un administrateur par défaut (mot de passe: admin12345)
INSERT INTO users (nom_complet, telephone, email, password_hash, role, statut_validation) VALUES
    ('Administrateur BaraChap', '+2250700000000', 'admin@barachap.ci', '$2a$10$p4XwM3.HjI717k1P4.YqOu0.X4Z740M0h1X1.p4XwM3.HjI717k1P', 'admin', 'Validé')
ON CONFLICT (telephone) DO NOTHING;
