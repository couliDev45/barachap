# Guide de Déploiement — BaraChap Web (Étape 6)

Ce guide détaille la procédure pas-à-pas pour déployer le frontend et le backend de BaraChap Web.

---

## 1. Déploiement du Backend & Base de données PostgreSQL (Render / Railway / Supabase)

### Étape 1 : Créer la base de données PostgreSQL
Vous pouvez utiliser **Render**, **Railway**, **Supabase** ou **Neon** (tous proposent des offres gratuites) :
1. Créez un compte sur [Render.com](https://render.com) ou [Supabase.com](https://supabase.com).
2. Créez une nouvelle base de données PostgreSQL nommée `barachap_db`.
3. Récupérez l'URL de connexion (ex: `postgresql://user:password@hostname:5432/barachap_db?sslmode=require`).
4. Ouvrez le SQL Editor ou l'outil d'exécution SQL et collez le contenu du fichier [`server/schema.sql`](file:///Users/coulidev/Desktop/BaraChap-web%20copie%202/server/schema.sql) pour créer toutes les tables et données initiales.

### Étape 2 : Déployer le serveur Node.js / Express sur Render
1. Sur Render.com, cliquez sur **New +** -> **Web Service**.
2. Connectez votre dépôt Git ou téléversez le dossier `server/`.
3. Configurez les paramètres :
   - **Environment** : `Node`
   - **Build Command** : `cd server && npm install`
   - **Start Command** : `cd server && npm start`
4. Ajoutez les variables d'environnement (**Environment Variables**) :
   - `PORT` = `5000`
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = *(URL de votre base PostgreSQL distante)*
   - `JWT_SECRET` = *(Une clé secrète longue et aléatoire)*
   - `FRONTEND_URL` = *(L'URL Vercel de votre frontend, ex: https://barachap.vercel.app)*
5. Cliquez sur **Deploy**. Vous obtiendrez l'URL publique de l'API (ex: `https://barachap-api.onrender.com`).

---

## 2. Déploiement du Frontend sur Vercel

1. Créez un compte sur [Vercel.com](https://vercel.com).
2. Cliquez sur **Add New...** -> **Project**.
3. Importez le projet `BaraChap-web`.
4. Vercel détectera automatiquement le fichier [`vercel.json`](file:///Users/coulidev/Desktop/BaraChap-web%20copie%202/vercel.json).
5. Cliquez sur **Deploy**.
6. Votre site est maintenant en ligne sur une URL gratuite `.vercel.app` !

---

## 3. Test local du Backend

Pour démarrer et tester le serveur API sur votre machine :

```bash
cd server
npm install
npm run dev
```

Testez dans votre navigateur : [http://localhost:5000/api/health](http://localhost:5000/api/health)
