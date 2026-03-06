# Changelog

## 2.2.1

- **Feat** : ajout de `getSignedUploadUrl(fileName, contentType)` — obtenir une URL presignée Supabase pour uploader l'audio directement, sans passer par `/api/v1/upload` (Vercel Serverless Function, limite ~4.5 MB). Recommandé pour les proxies serveur (Next.js, Express…) gérant des fichiers > 4 MB.
- **Types** : ajout de `SignedUploadResult` dans `index.d.ts`.
- **Docs** : `uploadAudio()` annotée avec l'avertissement Vercel dans `index.js`, `index.d.ts`, `SDK_REFERENCE.md` et `README.md`.
- **Examples** : `nextjs/route-generate.ts` et `nextjs/route-generate.mjs` mis à jour pour utiliser `getSignedUploadUrl()`.
- **Security** : exemple proxy dans `SECURITY.md` mis à jour.

## 2.2.0

- **Feat** : ajout de `listJobs(options?)` — liste les jobs avec pagination (`limit`, `offset`) et filtres (`status`, `sort`, `order`). Aligne le SDK sur `GET /api/v1/jobs`.
- **Types** : ajout des interfaces `ListJobsOptions`, `JobSummary`, `ListJobsResult` dans `index.d.ts`.
- **Types** : `is_default?: boolean` ajouté dans `CreateTemplateParams` — exposé côté serveur mais absent des types SDK.
- **Types** : signature de `updateTemplate()` mise à jour pour inclure `is_default`.

## 2.1.1

- **Fix** : `_fetch` filtre désormais les clés `null`/`undefined` des payloads JSON (payloads plus propres, évite d'envoyer `callback_url: null`).
- **Fix doc** : README corrigé — `verifyWebhook` → `verifyWebhookSignature` (aligné sur l'export réel).
- **Fix doc** : SDK_REFERENCE timeout par défaut corrigé à 5 min (était indiqué 10 min).
- **Simplification** : les spread conditionnels (`...(x ? {k:v} : {})`) supprimés dans `createJob`, `amendJob`, `reformulateReport` — le filtrage `_fetch` gère.

## 2.1.0

- Simplification : suppression des exports `@reqvet/sdk/recorder` et `@reqvet/sdk/react`.
- Le SDK se concentre sur les appels **core** ReqVet (upload/jobs/templates/reformulations/amend).
- `uploadAudio()` retourne aussi un alias `path` (même valeur que `audio_file`) pour réduire les erreurs d’intégration.
- `callbackUrl` devient optionnel sur `createJob()` (fallback côté serveur sur le webhook par défaut de l’organisation).
- `generateReport()` supporte un mode polling (`waitForResult: true`).
