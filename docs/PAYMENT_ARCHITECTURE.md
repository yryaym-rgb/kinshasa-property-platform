# Architecture des paiements — Module 4

> Infrastructure de paiement de niveau gouvernemental : zéro confiance entre le
> frontend et les opérateurs, machine à états stricte, idempotence de bout en
> bout, piste d'audit complète.

Documents liés : [MOBILE_MONEY_INTEGRATION.md](./MOBILE_MONEY_INTEGRATION.md) ·
[PAYMENT_WEBHOOKS.md](./PAYMENT_WEBHOOKS.md) · [TAX_ENGINE.md](./TAX_ENGINE.md)

---

## 1. Principes

| Principe | Mise en œuvre |
|---|---|
| **Zéro confiance frontend ↔ opérateur** | Le navigateur ne connaît aucune clé opérateur. Il appelle uniquement des Edge Functions authentifiées par JWT (`payment-initiate`, `payment-verify`, `payment-refund`) ou des RPC protégées par RLS (`cancel_own_payment`). |
| **Le webhook fait autorité** | Les changements d'état « argent reçu » proviennent de l'opérateur (webhook) ou d'une vérification serveur → serveur (`payment-verify`). Le frontend ne peut jamais écrire `succeeded`. |
| **Machine à états unique** | `src/services/payment/stateMachine.ts` est la source de vérité, mirrorée octet pour octet dans `supabase/functions/_shared/stateMachine.ts` (`npm run sync:edge`, test unitaire de dérive). La transition SQL `transition_payment_state()` refuse toute transition illégale. |
| **Idempotence** | Clé client sur `payment-initiate` (fenêtre 5 min), `(provider, provider_event_id)` unique sur les webhooks, clés dérivées sur chaque étape du pipeline. |
| **Audit** | `payment_state_history` (chaque transition + raison), `payment_webhooks` (payload brut, même invalide), `audit_logs`, `calculs_fiscaux`, `ledger_entries`. |
| **Sandbox / production** | `PAYMENT_MODE=sandbox` (défaut) → simulateur déterministe, aucun appel réseau. `production` → appels réels (`// TODO: Enable in production`). |

---

## 2. Vue d'ensemble

```mermaid
flowchart LR
  subgraph Browser["Frontend (Vite / React)"]
    W[PaymentWizard] --> PS[paymentService]
    PS --> H[usePaymentStatus<br/>Realtime + polling]
  end

  subgraph Edge["Supabase Edge Functions (Deno)"]
    PI[payment-initiate]
    PV[payment-verify]
    PW[payment-webhook]
    PR[payment-refund]
    TC[tax-calculate]
    TR[tax-recalculate]
    SH[_shared<br/>providers · settlement · pipeline · tax]
  end

  subgraph DB["PostgreSQL (RLS)"]
    P[(paiements)]
    HIST[(payment_state_history)]
    WH[(payment_webhooks)]
    JOBS[(payment_pipeline_jobs)]
    LED[(ledger_entries)]
    IMP[(impots · calculs_fiscaux)]
    REC[(recus · notifications · audit_logs)]
  end

  OP((Opérateurs<br/>Orange · M-Pesa · Airtel))

  PS -- JWT --> PI & PV & PR
  PI & PV & PR & PW --> SH
  SH -- HTTPS (prod) --> OP
  OP -- webhook signé --> PW
  SH --> P & HIST & WH & JOBS & LED & IMP & REC
  P -. Realtime UPDATE .-> H
```

---

## 3. Machine à états

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> validating : VALIDATE
  draft --> cancelled : USER_CANCELLED
  validating --> failed : VALIDATION_FAILED
  validating --> pending : INITIATE
  validating --> cancelled : USER_CANCELLED
  pending --> processing : PROVIDER_ACCEPTED
  pending --> requires_action : PROVIDER_REQUIRES_ACTION
  pending --> succeeded : PROVIDER_SUCCESS
  pending --> failed : PROVIDER_FAILED
  pending --> cancelled : USER_CANCELLED
  pending --> expired : TIMEOUT
  processing --> requires_action : PROVIDER_REQUIRES_ACTION
  processing --> succeeded : PROVIDER_SUCCESS
  processing --> failed : PROVIDER_FAILED
  processing --> expired : TIMEOUT
  requires_action --> processing : USER_ACTION_COMPLETED
  requires_action --> succeeded : PROVIDER_SUCCESS
  requires_action --> failed : PROVIDER_FAILED
  requires_action --> cancelled : USER_CANCELLED
  requires_action --> expired : TIMEOUT
  expired --> succeeded : PROVIDER_SUCCESS (confirmation tardive)
  succeeded --> refunded : REFUND
  succeeded --> disputed : DISPUTE
  disputed --> refunded : REFUND
  failed --> [*]
  cancelled --> [*]
  refunded --> [*]
```

### Choix de conception

- `PROVIDER_SUCCESS` est accepté depuis `pending`, `processing` **et** `requires_action` : les webhooks peuvent arriver dans le désordre.
- `expired → succeeded` est légal : si l'opérateur confirme après le délai local de 60 s, l'argent a bel et bien bougé.
- Les états d'argent reçu (`succeeded`) ne peuvent aller que vers `refunded` / `disputed`.
- `failed`, `cancelled`, `refunded` sont finaux (`isFinal`). `isTerminal` inclut aussi `succeeded`, `expired`, `disputed`.

### API (`stateMachine.ts`)

| Fonction | Rôle |
|---|---|
| `canTransition(from, event)` | État suivant ou `null` si illégal |
| `transition(from, event)` | Idem mais lève `InvalidTransitionError` |
| `isTerminal` / `isSuccessful` / `isInFlight` / `isFinal` | Prédicats |
| `canRetryInitiation(state)` | `draft`, `validating`, `failed`, `expired` uniquement |
| `providerStatusToEvent(status)` | Mapping statut opérateur normalisé → événement (partagé par verify et webhook) |

### Persistance

Chaque transition passe par la RPC `transition_payment_state(p_payment_id, p_event, p_to_state, p_reason, p_actor, p_metadata)` (migration 006) qui :

1. verrouille la ligne (`FOR UPDATE`) ;
2. vérifie que `(state, event) → to_state` est cohérent avec la table `TRANSITIONS` ;
3. met à jour `state`, `previous_state`, `state_changed_at`, `attempt_count`, `paid_at`… ;
4. insère la ligne d'audit dans `payment_state_history` ;
5. synchronise l'enum historique `status` (`en_attente`, `en_cours`, `complete`, `echoue`, `rembourse`) via `payment_state_to_status()` pour ne pas casser les écrans du Module 2.

---

## 4. Séquences

### 4.1 Initiation (Mobile Money, USSD push)

```mermaid
sequenceDiagram
  autonumber
  participant U as Locataire
  participant FE as Frontend
  participant PI as payment-initiate
  participant DB as PostgreSQL
  participant AD as Adapter (Orange/M-Pesa/Airtel)
  participant OP as Opérateur

  U->>FE: Confirme le paiement
  FE->>FE: idempotencyKey = pay-{contrat}-{ts}-{rand}
  FE->>PI: POST {contractId, amount, method, phone, idempotencyKey} + JWT
  PI->>PI: CORS, JWT, validation zod
  PI->>DB: lookup idempotency_key (fenêtre 5 min)
  alt clé connue
    PI-->>FE: paiement existant (replay)
  else nouvelle clé
    PI->>DB: contrat, montant, période non déjà payée
    PI->>DB: INSERT paiements (state=validating)
    PI->>DB: transition INITIATE → pending
    PI->>AD: initiate(config, req)
    AD->>OP: (prod) OAuth + push USSD
    OP-->>AD: providerTransactionId, status
    PI->>DB: transition PROVIDER_ACCEPTED / REQUIRES_ACTION / SUCCESS
    PI->>DB: audit_logs
    PI-->>FE: {paymentId, state, providerTransactionId, redirectUrl?, expiresAt}
  end
  FE->>FE: écran « processing » (usePaymentStatus)
```

En cas d'erreur après création, le paiement passe en `failed` avec la raison (`VALIDATION_FAILED` ou `PROVIDER_FAILED`) et une entrée d'audit est toujours écrite.

### 4.2 Suivi : Realtime + polling hybride (`usePaymentStatus`)

```mermaid
sequenceDiagram
  participant H as usePaymentStatus
  participant RT as Supabase Realtime
  participant PV as payment-verify
  participant DB as PostgreSQL
  participant OP as Opérateur

  H->>RT: subscribe paiements UPDATE id=eq.{paymentId}
  loop toutes les 5 s tant que isInFlight(state)
    H->>PV: POST {paymentId}
    PV->>DB: lecture (état terminal → réponse immédiate)
    alt last_verified_at > 10 s
      PV->>OP: verify(txId)
      PV->>DB: applyProviderVerdict → transition + pipeline si succeeded
    end
    PV-->>H: snapshot {state, pipeline, receiptId…}
  end
  RT-->>H: UPDATE (state=succeeded)
  H->>H: cleanup (unsubscribe, clearInterval), onTerminal()
  Note over H: 60 s sans issue → verdict local « expired »<br/>(un webhook tardif peut encore passer en succeeded)
```

`payment-verify` est limité à 1 appel opérateur / 5 s / paiement (`VERIFY_MIN_INTERVAL_SECONDS`) et ne sollicite l'opérateur que si la dernière vérification date de plus de 10 s (`VERIFY_PROVIDER_STALENESS_SECONDS`).

### 4.3 Webhook → pipeline aval

```mermaid
sequenceDiagram
  autonumber
  participant OP as Opérateur
  participant PW as payment-webhook
  participant DB as PostgreSQL
  participant ST as settlement.ts
  participant PL as pipeline.ts

  OP->>PW: POST ?provider=orange_money (corps brut + signature)
  PW->>DB: INSERT payment_webhooks (payload, headers, signature_valid=null)
  PW->>PW: HMAC-SHA256 timing-safe
  alt signature invalide
    PW->>DB: signature_valid=false
    PW-->>OP: 401
  else valide
    PW->>DB: UNIQUE (provider, provider_event_id)
    alt doublon
      PW-->>OP: 200 {duplicate:true}
    else premier passage
      PW->>DB: résout paiement (provider_transaction_id → reference)
      PW->>ST: applyProviderVerdict(status)
      ST->>DB: transition_payment_state
      opt state = succeeded
        ST->>PL: runPostSuccessPipeline
        PL->>DB: tax → impots → ledger → recus → notifications → compliance → audit_logs
      end
      PW->>DB: processed=true (ou processing_error)
      PW-->>OP: 200
    end
  end
```

Le webhook répond **toujours 200** dès que le payload est stocké et interprété ; un échec d'étape aval ne provoque jamais de nouvelle livraison par l'opérateur (voir § 6).

### 4.4 Remboursement

`payment-refund` (admin ou bailleur propriétaire) : vérifie `state ∈ {succeeded, disputed}`, `supports_refund` sur `payment_providers`, fenêtre (`REFUND_WINDOW_DAYS`, 30 j par défaut), appelle `adapter.refund()`, transition `REFUND → refunded`, puis **inverse la fiscalité** : `impots.status = 'annule'`, écritures `ledger_entries` de contre-passation (`reversal_of`), recalcul des soldes du bailleur, anomalie `refund_after_tax_paid` si l'impôt avait déjà été reversé à la DGI.

---

## 5. Responsabilités des Edge Functions

| Fonction | JWT | Rôle |
|---|---|---|
| `payment-initiate` | oui | Validation, idempotence, création du paiement, appel opérateur, première transition |
| `payment-verify` | oui | Lecture d'état, vérification opérateur rate-limitée, même pipeline aval que le webhook, relance opportuniste des jobs en file |
| `payment-webhook` | **non** | Réception opérateur, signature, idempotence, transition autoritaire, pipeline aval |
| `payment-refund` | oui (admin / bailleur) | Remboursement + inversion fiscale + audit |
| `tax-calculate` | oui (ou secret interne) | Calcul autoritaire (paiement) et simulations (bailleur) |
| `tax-recalculate` | oui (admin) | Recalcul rétroactif après changement de règles, rapport de deltas |

Modules partagés (`supabase/functions/_shared/`) :

| Module | Contenu |
|---|---|
| `env.ts` | Variables d'environnement, `providerConfigs`, `assertRequiredEnv()` |
| `auth.ts` | JWT → profil + rôle, `requireRole`, `isInternalCall`, CORS, `HttpError` |
| `db.ts` | Clients service / utilisateur, helpers `transitionPayment`, `writeAuditLog`, `updatePipeline` |
| `logger.ts` | Logs JSON structurés, redaction des clés sensibles, `requestId` |
| `idempotency.ts` | `lookupIdempotencyKey`, `isUniqueViolation`, `derivedKey` |
| `stateMachine.ts` | Miroir du frontend |
| `settlement.ts` | `applyProviderVerdict` — un seul chemin verify/webhook → machine à états → pipeline |
| `pipeline.ts` | Étapes aval idempotentes + file de retry |
| `providers/*` | Interface `PaymentProviderAdapter`, `BaseProvider`, 3 adaptateurs Mobile Money, `card`, `bank_transfer`, registre |
| `tax/*` | Règles, calculateur, références légales (voir TAX_ENGINE.md) |

---

## 6. Pipeline aval et tolérance aux pannes

```mermaid
flowchart TD
  S[state = succeeded] --> T[tax<br/>calculateTax → calculs_fiscaux → impots]
  T --> L[ledger<br/>bailleur crédit · dgi débit · platform crédit]
  L --> R[receipt<br/>recus + code auto]
  R --> N[notifications<br/>locataire · bailleur · DGI]
  N --> C[compliance<br/>check_compliance_score]
  C --> A[audit<br/>audit_logs]
  T & L & R & N & C & A -. échec .-> Q[(payment_pipeline_jobs<br/>contexte complet, backoff)]
  Q --> AL[Alerte admin<br/>notifications]
  Q -. relance .-> PV[payment-verify<br/>retry opportuniste]
```

- Chaque étape est **idempotente** (`UNIQUE` sur `impots(paiement_id)`, `ledger_entries(paiement_id, account_type, direction)`, `recus(paiement_id)`, clé dérivée sur les notifications).
- Les checkpoints sont stockés dans `paiements.pipeline` (JSONB `{step: {status, at, error?}}`) et exposés au frontend (timeline de `PaymentProcessing`).
- Si une étape échoue : le paiement **reste `succeeded`**, la ligne `payment_pipeline_jobs` est upsertée avec son contexte, l'admin est alerté, les étapes suivantes s'exécutent quand même.
- Reprise : `payment-verify` relance les jobs échus lorsqu'il est appelé ; un cron (`expire_stale_payments()`, `mark_overdue_taxes()`) complète la maintenance.

### Répartition de l'argent

Le locataire paie `montant = loyer + impôt + frais plateforme + frais opérateur`. Le pipeline :

- crédite le **bailleur** du loyer brut (`bailleurs.solde_disponible`, `total_encaisse`) ;
- débite la **DGI** de l'impôt (`total_impots_dus`) — c'est la créance fiscale ;
- crédite la **plateforme** de ses frais.

Le journal `ledger_entries` est en partie double ; les remboursements créent des écritures inverses (`reversal_of`) et ne suppriment jamais rien.

---

## 7. Stratégie d'idempotence

| Surface | Clé | Comportement |
|---|---|---|
| `payment-initiate` | `idempotencyKey` (client, `^[A-Za-z0-9._:-]{8,100}$`) | Même clé < 5 min → renvoie le paiement existant sans toucher l'opérateur ; > 5 min → `409 stale_idempotency_key` ; course concurrente → `23505`, relecture du gagnant |
| `payment-webhook` | `(provider, provider_event_id)` UNIQUE | Doublon → `200 {duplicate: true}`, zéro traitement |
| Pipeline | contraintes UNIQUE + `derivedKey(step, paymentId)` | Rejouer une étape est sans effet |
| Retry frontend (`retryPolicy.ts`) | opérations idempotentes uniquement | Backoff exponentiel + jitter, 3 tentatives max, jamais après `user_cancelled` |
| Transitions | `transition_payment_state` | Transition illégale → exception, aucune mutation |

---

## 8. Sécurité

- **Secrets** : uniquement dans les secrets Edge Functions (`supabase secrets set`). Rien dans le dépôt, rien dans le bundle.
- **JWT** : `verify_jwt = true` sur toutes les fonctions sauf `payment-webhook`. Le profil et le rôle sont relus en base (`public.users.role`), jamais depuis `user_metadata`.
- **Autorisation** : `payment-verify` n'autorise que le payeur, le bailleur du contrat et le staff ; `payment-refund` admin / bailleur ; `tax-recalculate` admin.
- **Webhooks** : HMAC-SHA256 en comparaison à temps constant sur le **corps brut** ; payload conservé même si invalide ; limite de taille 256 Ko ; `provider` obligatoire dans l'URL.
- **RLS** : `payment_state_history`, `payment_webhooks`, `ledger_entries`, `calculs_fiscaux` lisibles uniquement par les parties concernées et le staff ; écriture réservée au rôle service.
- **CORS** : `ALLOWED_ORIGINS` (`*` en sandbox, `APP_URL` par défaut en production).
- **Rate-limiting** : `payment-verify` 1 appel opérateur / 5 s / paiement.
- **Logs** : JSON structurés, clés sensibles (`apiKey`, `secret`, `pin`, `token`, `authorization`…) masquées.
- **Expiration** : `expires_at` (15 min par défaut) + `expire_stale_payments()`.

---

## 9. Frontend

| Fichier | Rôle |
|---|---|
| `src/services/payment/paymentService.ts` | `initiatePayment`, `verifyPayment`, `cancelPayment` (RPC `cancel_own_payment`), `refundPayment`, `getPaymentMethods` (`payment_providers`) |
| `src/services/payment/stateMachine.ts` | Machine à états canonique |
| `src/services/payment/retryPolicy.ts` | `withRetry` (backoff + jitter, idempotent uniquement) |
| `src/hooks/usePaymentStatus.ts` | Realtime + polling, timeout 60 s, cleanup |
| `src/hooks/usePayment.ts` | Orchestration du wizard |
| `src/components/payments/PaymentProcessing.tsx` | Timeline d'états + checkpoints pipeline + annulation |
| `src/utils/paymentErrors.ts` | Codes → messages français, `isRetryableError`, `mapEdgeError` |
| `src/types/payment.ts` | Contrats requête/réponse des Edge Functions |

---

## 10. Déploiement

```bash
supabase db push                       # migrations 006 → 010 dans l'ordre
supabase functions deploy payment-initiate
supabase functions deploy payment-verify
supabase functions deploy payment-webhook
supabase functions deploy payment-refund
supabase functions deploy tax-calculate
supabase functions deploy tax-recalculate
```

Vérifications locales : `npm run build`, `npm run test`, `deno task check` (dans `supabase/functions`), `npm run sync:edge -- --check`.
