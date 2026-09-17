# Webhooks de paiement

> `payment-webhook` est le seul point d'entrée par lequel un opérateur peut
> faire évoluer l'état d'un paiement. Il est public (pas de JWT), signé
> (HMAC-SHA256), idempotent et conserve **toujours** la preuve brute.

Voir aussi : [PAYMENT_ARCHITECTURE.md § Webhook](./PAYMENT_ARCHITECTURE.md) ·
[MOBILE_MONEY_INTEGRATION.md](./MOBILE_MONEY_INTEGRATION.md)

---

## 1. URLs par opérateur

Projet de référence : `https://moxfwfxmdctkvjbfvxgx.supabase.co`

| Opérateur | URL à déclarer chez l'opérateur | En-tête de signature |
|---|---|---|
| Orange Money | `https://moxfwfxmdctkvjbfvxgx.supabase.co/functions/v1/payment-webhook?provider=orange_money` | `X-Signature` |
| M-Pesa (Vodacom) | `https://moxfwfxmdctkvjbfvxgx.supabase.co/functions/v1/payment-webhook?provider=mpesa` | `X-Mpesa-Signature` |
| Airtel Money | `https://moxfwfxmdctkvjbfvxgx.supabase.co/functions/v1/payment-webhook?provider=airtel_money` | `X-Auth-Token` |
| Carte (PSP) | `…/payment-webhook?provider=card` | `X-Signature` |
| Virement (confirmation manuelle) | `…/payment-webhook?provider=bank_transfer` | `X-Signature` |

Le paramètre `provider` est obligatoire (`400 unknown_provider` sinon) ; l'en-tête `X-Provider` est accepté en repli. Méthode : `POST`, corps JSON, 256 Ko max.

`supabase/config.toml` :

```toml
[functions.payment-webhook]
verify_jwt = false   # l'appelant est l'opérateur, pas un utilisateur
```

---

## 2. Vérification de signature

```
signature = hex( HMAC-SHA256( key = <PROVIDER>_WEBHOOK_SECRET, message = corps brut ) )
```

- Calculée sur les **octets bruts** du corps, avant tout parsing (`await req.text()`).
- Comparaison à **temps constant** (`timingSafeEqual` dans `_shared/providers/base.ts`), préfixe `sha256=` toléré.
- Implémentée via Web Crypto (`crypto.subtle`) — aucune dépendance.
- Secret par opérateur : `ORANGE_MONEY_WEBHOOK_SECRET`, `MPESA_WEBHOOK_SECRET`, `AIRTEL_MONEY_WEBHOOK_SECRET`, `CARD_WEBHOOK_SECRET`, `BANK_TRANSFER_WEBHOOK_SECRET`.
- Orange Money n'émet pas de HMAC natif : le secret partagé est configuré côté Orange comme en-tête statique `X-Signature` sur l'URL de notification (à confirmer avec le gestionnaire de compte ; à défaut, restreindre l'endpoint par IP source via `payment_webhooks.source_ip`).
- **Sandbox** : si le secret n'est pas défini, la livraison est acceptée avec un avertissement dans les logs (nécessaire pour les tests locaux). **Production** : secret manquant = `assertRequiredEnv()` échoue au démarrage.

Une signature invalide produit :

1. la ligne `payment_webhooks` est quand même écrite avec `signature_valid = false`, `processing_error = 'invalid_signature'` ;
2. une entrée `audit_logs` (`webhook.invalid_signature`, IP source) ;
3. réponse `401 {error: {code: 'invalid_signature'}}` — rien d'autre ne se produit.

---

## 3. Traitement

```
POST → provider ? → corps brut → parseWebhook → signature → INSERT payment_webhooks
     → doublon ? (provider, provider_event_id) → résolution paiement
     → applyProviderVerdict → transition_payment_state → pipeline si succeeded
     → UPDATE payment_webhooks (processed / processing_error) → 200
```

### Identifiant d'événement (idempotence)

| Opérateur | `provider_event_id` |
|---|---|
| Orange Money | `notif_token`, sinon `{txnid}:{status}` |
| M-Pesa | `{output_TransactionID}:{status}` |
| Airtel Money | `{airtel_money_id}:{status_code}` |
| card / bank_transfer | `event_id`, sinon `{reference}:{status}` |

L'index `UNIQUE (provider, provider_event_id)` fait le travail : une seconde livraison du même événement renvoie `200 {received: true, duplicate: true}` sans rien traiter. Un même paiement peut recevoir plusieurs événements distincts (`processing` puis `succeeded`) : chacun est appliqué via la machine à états, qui refuse les transitions illégales (un `failed` reçu après `succeeded` est journalisé et ignoré).

### Résolution du paiement

1. `paiements.provider_transaction_id` = `providerTransactionId` du webhook (+ `provider`) ;
2. sinon `paiements.reference` = `merchantReference` (notre référence `TRX-…`).

Paiement introuvable → `200 {ignored: 'payment_not_found'}` + audit `webhook.orphan` (le payload reste consultable).

### Statuts acceptés

`pending`, `processing`, `requires_action`, `succeeded`, `failed`, `cancelled`, `expired` → événement via `providerStatusToEvent()`. `refunded` et statuts inconnus sont stockés puis ignorés (`ignored: 'status:…'`) — les remboursements passent par `payment-refund`.

### Codes de réponse

| Code | Signification | L'opérateur doit-il réessayer ? |
|---|---|---|
| `200` | Reçu et stocké (traité, doublon, ignoré ou pipeline partiellement en file) | non |
| `400` | `unknown_provider` | non (configuration) |
| `401` | `invalid_signature` | non (configuration) |
| `413` | `payload_too_large` | non |
| `500` | `storage_failed` / `lookup_failed` — la preuve n'a pas pu être écrite | **oui** |

---

## 4. Comportement de reprise

### Côté opérateur

Chaque opérateur rejoue les webhooks non acquittés (2xx) selon sa propre politique (généralement backoff sur 24 h). Comme `payment-webhook` répond `200` dès que la preuve est stockée et interprétée, un problème **dans notre pipeline aval** ne déclenche jamais de tempête de retries : c'est notre file interne qui reprend.

### Côté eLoyer

- **Pipeline aval** (`tax`, `ledger`, `receipt`, `notifications`, `compliance`, `audit`) : chaque étape échouée est upsertée dans `payment_pipeline_jobs` avec son contexte complet et un `next_attempt_at` en backoff exponentiel ; un admin est notifié (`ADMIN_ALERT_USER_ID`). Les jobs sont relancés opportunément par `payment-verify` et peuvent être rejoués manuellement.
- **Webhook non traité** (`processed = false`) : l'index `idx_webhooks_unprocessed` permet un rejeu par un opérateur humain (`SELECT … FROM payment_webhooks WHERE processed = false`).
- **Confirmation tardive** : un `succeeded` arrivant après un `expired` local est accepté (`expired → succeeded` est une transition légale).
- **Filet de sécurité** : même sans webhook, `payment-verify` interroge l'opérateur toutes les 10 s pendant que l'utilisateur attend, et applique le même `applyProviderVerdict`.

---

## 5. Tests

### 5.1 Localement avec le CLI Supabase

```bash
supabase start
supabase functions serve payment-webhook --env-file supabase/.env.local
```

`supabase/.env.local` (non commité) :

```
PAYMENT_MODE=sandbox
ORANGE_MONEY_WEBHOOK_SECRET=test-secret
```

Signer et envoyer un webhook Orange Money :

```bash
BODY='{"status":"SUCCESS","txnid":"OM-1a2b3c-S-xyz","notif_token":"evt-001","order_id":"TRX-20260917-ABC123","amount":150000,"currency":"CDF"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "test-secret" | sed 's/^.* //')

curl -s -X POST "http://localhost:54321/functions/v1/payment-webhook?provider=orange_money" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  --data "$BODY"
```

Renvoyer exactement la même requête doit répondre `{"received":true,"duplicate":true}`.

Airtel Money :

```bash
BODY='{"transaction":{"id":"TRX-20260917-ABC123","airtel_money_id":"AM-77","status_code":"TS","message":"Success"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$AIRTEL_MONEY_WEBHOOK_SECRET" | sed 's/^.* //')
curl -X POST ".../payment-webhook?provider=airtel_money" -H "X-Auth-Token: $SIG" -H "Content-Type: application/json" --data "$BODY"
```

### 5.2 Exposer l'environnement local à un opérateur avec ngrok

```bash
ngrok http 54321
# → https://abcd-1234.ngrok-free.app
```

Déclarer chez l'opérateur (portail UAT) :

```
https://abcd-1234.ngrok-free.app/functions/v1/payment-webhook?provider=airtel_money
```

L'inspecteur ngrok (`http://127.0.0.1:4040`) permet de rejouer une livraison réelle et de vérifier l'idempotence.

### 5.3 Vérifier le résultat

```sql
SELECT id, provider, event_type, provider_event_id, signature_valid, processed, processing_error, received_at
FROM payment_webhooks ORDER BY received_at DESC LIMIT 10;

SELECT from_state, to_state, event, reason, actor, created_at
FROM payment_state_history WHERE paiement_id = '<uuid>' ORDER BY created_at;

SELECT pipeline FROM paiements WHERE id = '<uuid>';
SELECT * FROM payment_pipeline_jobs WHERE paiement_id = '<uuid>';
```

### 5.4 Tests automatisés

- `deno test` (`supabase/functions/_shared/`) : signature HMAC (valide, invalide, préfixe `sha256=`, comparaison temps constant), parsing des payloads par opérateur.
- `npm run test` (vitest) : machine à états, mapping erreurs, politique de retry, dérive du miroir `_shared/stateMachine.ts`.
- `npm run test:e2e` (Playwright, `tests/e2e/`) : parcours complet locataire sur un backend Supabase simulé — `payment-initiate` → écran de traitement (realtime + polling) → `payment-verify` règle le paiement → reçu avec l'impôt et sa base légale ; échec opérateur (message français, bouton Réessayer) ; annulation via `cancel_own_payment` uniquement dans les états autorisés par la machine à états.
