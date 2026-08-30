# BaraChap — Correctif CORS (branches de test) + balise meta dépréciée

## 1. CORS — le vrai bug bloquant

**Cause** : `server.js` n'autorisait qu'une seule origine exacte
(`FRONTEND_URL`, ta prod). Chaque branche de test déployée par Vercel
génère une URL de preview différente (`barachap-git-<branche>-<compte>.vercel.app`),
que le backend rejetait automatiquement.

**Correctif** : le CORS accepte maintenant :
- ta prod (`FRONTEND_URL`, inchangé)
- **toute** URL `*.vercel.app` commençant par `barachap` → couvre la prod
  et toutes tes previews de branches, présentes et futures, sans jamais
  avoir à toucher au code pour une nouvelle branche
- `localhost` sur n'importe quel port → pour `npm run dev` en local
- les requêtes sans origine (Postman, curl, une future app Capacitor)

### Où placer le fichier
```
server/server.js   → REMPLACE
```
Redéploie le backend sur Render (push suffit si le déploiement auto est
activé).

## 2. Balise meta dépréciée

`apple-mobile-web-app-capable` est spécifique à Safari/iOS et dépréciée en
faveur du standard `mobile-web-app-capable`. Correctif : la nouvelle
balise standard est ajoutée **à côté** de l'ancienne (pas à la place) sur
les 15 pages — l'ancienne reste nécessaire pour la compatibilité avec les
anciennes versions d'iOS Safari qui ne connaissent que celle-là.

### Où placer les fichiers
```
index.html          → REMPLACE
pages/*.html (14)   → REMPLACE (tous)
```

## Tester

1. Redéploie le backend avec le nouveau `server.js`.
2. Sur ta branche de test, refais un push (ou redéploie manuellement) avec
   les pages corrigées.
3. Retourne sur `barachap-git-dev-test-maj-importante-couli-dev.vercel.app`
   (ou l'URL de preview actuelle) → la connexion et les autres appels API
   doivent fonctionner sans erreur CORS dans la console.
4. Le warning sur la balise meta ne doit plus apparaître.

## Remarque

Le filtre `*.vercel.app` commençant par `barachap` est volontairement
large (couvre toutes tes futures branches automatiquement) mais reste
raisonnablement restreint : seules les URLs Vercel qui commencent
précisément par "barachap" passent — un tiers ne peut pas usurper cette
origine simplement en nommant son propre projet Vercel différemment.
