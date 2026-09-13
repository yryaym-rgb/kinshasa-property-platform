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

## Extensibilité Phase 2+

- Intégration Mobile Money (Orange, M-Pesa, Airtel)
- Génération PDF reçus/contrats
- Dashboard analytics avancé avec Recharts
- Cartographie Leaflet des biens par commune
- PWA avec service worker
