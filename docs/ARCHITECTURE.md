# Architecture eLoyer Kinshasa

## Principes de conception

### 1. Mobile-First
L'application est conçue pour les connexions mobiles instables de Kinshasa. Toutes les interfaces sont responsive avec navigation bottom sur mobile.

### 2. Offline-First
- Queue de synchronisation offline dans `supabase.ts`
- Store Zustand `offline.store.ts` pour l'état réseau
- Hook `useOfflineSync` pour la resynchronisation automatique

### 3. Security by Default
- Row Level Security (RLS) sur toutes les tables
- Rôles stockés dans `public.users.role` (pas dans `user_metadata`)
- Validation Zod côté client
- Audit logs pour traçabilité gouvernementale

### 4. Role-Based Access Control (RBAC)

| Rôle | Accès |
|------|-------|
| `bailleur` | Ses biens, contrats, locataires, paiements |
| `locataire` | Ses contrats, paiements, reçus |
| `agence` | Gestion multi-biens (comme bailleur) |
| `gestionnaire` | Gestion limitée bailleur |
| `admin` | Accès complet plateforme |
| `agent_fiscal` | Recettes, déclarations, contrôles fiscaux |

## Couches applicatives

```
┌─────────────────────────────────────┐
│           Pages (Routes)            │
├─────────────────────────────────────┤
│    Layouts + Navigation + Auth      │
├─────────────────────────────────────┤
│   Components (UI + Business Logic)  │
├─────────────────────────────────────┤
│  Hooks + Contexts + Zustand Stores  │
├─────────────────────────────────────┤
│     Services + API Endpoints        │
├─────────────────────────────────────┤
│   Supabase Client + PostgreSQL RLS  │
└─────────────────────────────────────┘
```

## Décisions techniques

### Pourquoi Supabase ?
- PostgreSQL natif avec RLS pour la sécurité gouvernementale
- Auth OTP téléphone intégré
- Realtime pour notifications live
- Storage pour documents KYC et contrats

### Pourquoi Zustand + TanStack Query ?
- Zustand : état UI léger (sidebar, theme, langue)
- TanStack Query : cache serveur, invalidation, optimistic updates

### Code splitting
Vite manual chunks : vendor, supabase, charts, maps pour optimiser le chargement initial.
Chaque page d'entrée (`/`, `/login`, `/register`, `/verify`, `/forgot-password`,
`/reset-password`) est son propre chunk, préchargé depuis le HTML pour la route
demandée (voir [PERFORMANCE.md](PERFORMANCE.md) § 3). L'assistant d'inscription
découpe en plus ses étapes 2 et 3 en chunks paresseux, réchauffés pendant
l'étape précédente.

## Static shell (pages publiques et d'authentification)

### Principe

Une SPA classique livre un `<div id="root"></div>` vide : sur 3G, l'usager
regarde une page blanche pendant que ~160 KB de CSS/JS arrivent et s'exécutent.
Pour les six routes d'entrée, `index.html` contient déjà **le premier écran**,
rendu par le navigateur avant qu'un seul octet de JavaScript applicatif ne soit
téléchargé. React monte ensuite *par-dessus* ce shell, pixel pour pixel.

```
index.html
├── <head>
│   ├── CSS critique inline : « Inter Fallback », #lp-shell, #auth-shell
│   ├── script : préchargements d'images selon la route (imagesrcset + media)
│   └── loader paint-first injecté au build (vite.config.ts)
└── <body>
    ├── #root
    │   ├── <template id="lp-shell-tpl">  shell landing (navbar + photo héro)
    │   ├── #auth-shell [hidden]          shell auth (top bar, titre, champs, bouton)
    │   └── <template id="as-register-tpl"> variante étape 1 de l'inscription
    ├── script de shell : choisit/complète le shell selon `location.pathname`
    └── <script type="module" src="/src/main.tsx">
```

### Deux familles de shell

| | Landing (`/`) | Auth (`/login`, `/register`, `/verify`, `/forgot-password`, `/reset-password`) |
|---|---|---|
| Contenu | identité de la navbar + photo héro plein écran (`aria-hidden`) | flag RDC, top bar, H1 / sous-titre réels de la page, gabarits des champs et du bouton, stepper ou cartes de profil pour `/register`, panneau photo sur desktop pour `/login` et `/register` |
| LCP | l'image héro | le titre H1 |
| Stocké dans | `<template>` — une image dans un template n'est jamais téléchargée sur les autres routes | `<div hidden>` + `<template>` pour la variante inscription |
| Signal « présenté » | Element Timing `lp-shell-hero` → évènement `eloyer:shellpainted` | entrée `first-contentful-paint` |

Le script de shell est du JavaScript inline sans dépendance : il clone le
template, retire le shell inutile, adapte titres et champs à la route
(`/verify` affiche les six cases OTP, `/forgot-password` masque le second champ,
etc.) et, sur desktop, insère le panneau photo des pages scindées.

### Contrat avec React

1. **Géométrie identique.** Le CSS critique reproduit la géométrie de
   `landing.css` / `auth.css` (hauteur de top bar, marges, tailles de titre,
   rayon des champs). Toute évolution du premier écran d'une page d'entrée doit
   être reportée dans le shell, sinon le montage produit un décalage (CLS) et un
   second candidat LCP.
2. **Montage après le shell.** `main.tsx` n'appelle `createRoot().render()`
   qu'une fois la feuille de style appliquée, le module de la page préchargé et
   la photo du shell présentée (plafond 800–1 000 ms). Le premier commit React
   remplace donc le shell par la page finale sans fallback Suspense.
3. **Polices après le shell.** Le texte du shell peint en « Inter Fallback »
   (métriques calées sur Inter) ; la webfont n'est activée qu'après la
   présentation du shell (landing) ou une frame après le montage React (auth).
4. **Pas de Supabase avant le paint.** Le SDK est chargé à la demande
   (`lib/lazySupabase.ts`) : à la première interaction, ou au montage seulement
   si une session est persistée.

Le détail des mécanismes (loader paint-first, calibration de la police,
préchargement par route, pièges du LCP) est dans [PERFORMANCE.md](PERFORMANCE.md).

## Extensibilité Phase 2+

- Intégration Mobile Money (Orange, M-Pesa, Airtel)
- Génération PDF reçus/contrats
- Dashboard analytics avancé avec Recharts
- Cartographie Leaflet des biens par commune
- PWA avec service worker
