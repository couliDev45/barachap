# BaraChap — Mise à jour : disponibilité persistante + notifications push

## Où placer chaque fichier

Remplace / ajoute ces fichiers dans ton projet en respectant l'arborescence
(adapte `server/` si ton dossier backend a un autre nom) :

```
server/
  server.js                       → REMPLACE (routes push ajoutées)
  package.json                    → REMPLACE (dépendance web-push ajoutée)
  routes/
    auth.routes.js                → REMPLACE (expose "disponible" dans /me)
    courses.routes.js             → REMPLACE (déclenche le push à la création)
    push.routes.js                → NOUVEAU
  utils/
    webpush.js                    → NOUVEAU
  migrations/
    001_push_subscriptions.sql    → À EXÉCUTER une fois dans ta base (voir plus bas)

sw.js                              → REMPLACE (à la racine du site, à côté de vercel.json)
js/
  push.js                          → NOUVEAU
  prestataire.js                   → REMPLACE
```

## Étapes à suivre dans l'ordre

### 1. Base de données
Ouvre le SQL Editor de ta base (Render / Supabase / Neon...) et exécute le
contenu de `server/migrations/001_push_subscriptions.sql`.

### 2. Dépendance backend
```bash
cd server
npm install
```
(`web-push` est déjà ajouté dans le `package.json` fourni.)

### 3. Générer les clés VAPID (une seule fois)
```bash
npx web-push generate-vapid-keys
```
Tu obtiens une clé publique et une clé privée.

### 4. Variables d'environnement sur Render
Dans le service backend sur Render (Environment Variables), ajoute :
- `VAPID_PUBLIC_KEY` = la clé publique générée
- `VAPID_PRIVATE_KEY` = la clé privée générée
- `VAPID_SUBJECT` = `mailto:contact@barachap.ci`

Puis redéploie le backend.

### 5. Déployer le frontend
Redéploie simplement sur Vercel comme d'habitude (`sw.js`, `js/push.js` et
`js/prestataire.js` remplacés).

## Comment tester

1. Connecte-toi avec un compte chauffeur (métier = "Taxi-moto").
2. Clique sur "Activer ma disponibilité" → le navigateur doit demander la
   permission de notification. Accepte.
3. Recharge complètement la page (F5) : le bouton doit rester sur
   "Désactiver ma disponibilité" (avant, il repassait à "Activer").
4. Depuis un autre appareil/navigateur, commande une course sur
   `taxi-moto.html`.
5. Verrouille l'écran du téléphone du chauffeur (ou mets l'app en arrière-
   plan) : une notification doit apparaître dans les secondes qui suivent.

## Notes importantes

- **iOS (Safari)** : le push web ne fonctionne que si le chauffeur a
  installé la PWA via "Partager → Sur l'écran d'accueil". Depuis un simple
  onglet Safari, ça ne fonctionnera pas — c'est une limitation d'Apple, pas
  du code. Le `manifest.json` du projet est déjà correctement configuré
  pour l'installation.
- **Android/Chrome** : fonctionne aussi bien depuis un onglet que depuis la
  PWA installée.
- Le sondage périodique (toutes les 8s pour les courses, 30s pour la
  position) reste actif en complément : si le push échoue pour une raison
  quelconque, un chauffeur avec l'app ouverte verra quand même la course.
