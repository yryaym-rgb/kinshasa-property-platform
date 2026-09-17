# Intégration Mobile Money — Orange Money, M-Pesa, Airtel Money

> Guide d'onboarding par opérateur, configuration sandbox, checklist de mise en
> production, variables d'environnement et référence des codes d'erreur.

Architecture générale : [PAYMENT_ARCHITECTURE.md](./PAYMENT_ARCHITECTURE.md) ·
Webhooks : [PAYMENT_WEBHOOKS.md](./PAYMENT_WEBHOOKS.md)

---

## 1. Où vit le code

```
supabase/functions/_shared/providers/
├── types.ts          # PaymentProviderAdapter, ProviderConfig, ProviderInitRequest/Response, ParsedWebhook…
├── base.ts           # BaseProvider : HMAC-SHA256 timing-safe, cache de tokens, httpJson (timeouts), simulateur sandbox
├── orange-money.ts   # Orange Developer "Web Payment" API
├── mpesa.ts          # Vodacom M-Pesa Open API (openapi.m-pesa.com)
├── airtel-money.ts   # Airtel Africa Open API (openapi.airtel.africa)
└── index.ts          # Registre : getProviderAdapter(key), getProviderConfig(key) + adaptateurs card / bank_transfer
```

Chaque adaptateur implémente :

```ts
interface PaymentProviderAdapter {
  readonly key: ProviderKey;
  readonly signatureHeader: string;
  initiate(config, req): Promise<ProviderInitResponse>;
  verify(config, txId): Promise<ProviderVerifyResponse>;
  refund(config, txId, amount, reason): Promise<ProviderRefundResponse>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean>;
  parseWebhook(payload: unknown, headers: Headers): ParsedWebhook;
}
```

**Aucun appel réseau réel n'est effectué tant que `PAYMENT_MODE !== 'production'`.** Chaque appel HTTP réel est encadré par `if (config.sandbox)` et annoté `// TODO: Enable in production`.

---

## 2. Mode sandbox

Le simulateur (`base.ts`) est déterministe et ne dépend d'aucun état mémoire (les isolates Deno peuvent redémarrer entre deux appels) : l'issue et l'horodatage sont encodés dans le `providerTransactionId` (`OM-…`, `MP-…`, `AM-…`, `CARD-…`, `BANK-…`).

| Suffixe du numéro | Comportement |
|---|---|
| `…000` (`SANDBOX_FORCE_FAIL_SUFFIX`) | Échec (`insufficient_funds`, puis rotation sur les autres codes) |
| `…111` (`SANDBOX_FORCE_SUCCESS_SUFFIX`) | Succès **immédiat** (pipeline aval déclenché dans `payment-initiate`) |
| `…222` (`SANDBOX_FORCE_ACTION_SUFFIX`) | `requires_action` pendant `SANDBOX_SETTLE_SECONDS`, puis succès |
| autre | Tirage pseudo-aléatoire selon `SANDBOX_SUCCESS_RATE` (0,9), règlement après `SANDBOX_SETTLE_SECONDS` (4 s) |

Le suivi Realtime + polling (`usePaymentStatus`) fait avancer le paiement : `payment-verify` appelle `sandboxVerify(txId)` qui renvoie `processing` puis `succeeded` / `failed` une fois le délai écoulé.

Pour simuler un webhook en sandbox, voir [PAYMENT_WEBHOOKS.md § Tests](./PAYMENT_WEBHOOKS.md).

---

## 3. Variables d'environnement

Configurer avec `supabase secrets set KEY=value` ou Dashboard → Edge Functions → Secrets. **Ne jamais committer.**

### Globales

| Variable | Défaut | Description |
|---|---|---|
| `PAYMENT_MODE` | `sandbox` | `sandbox` ou `production` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | injectées | Fournies automatiquement par la plateforme |
| `APP_URL` | `http://localhost:5173` | Origine du frontend (URL de retour carte, CORS prod) |
| `ALLOWED_ORIGINS` | `*` (sandbox) / `APP_URL` (prod) | Origines CORS, séparées par des virgules |
| `PAYMENT_EXPIRY_MINUTES` | `15` | Durée de vie d'un paiement en attente |
| `IDEMPOTENCY_WINDOW_MINUTES` | `5` | Fenêtre de rejeu d'une clé d'idempotence |
| `VERIFY_MIN_INTERVAL_SECONDS` | `5` | Rate-limit `payment-verify` par paiement |
| `VERIFY_PROVIDER_STALENESS_SECONDS` | `10` | Ancienneté minimale avant de réinterroger l'opérateur |
| `REFUND_WINDOW_DAYS` | `30` | Fenêtre de remboursement par défaut |
| `PLATFORM_FEE_RATE` | `0.02` | Frais plateforme (fraction) |
| `TAX_CALCULATION_VERSION` | `1.0.0` | Version de l'algorithme fiscal stockée sur chaque calcul |
| `INTERNAL_FUNCTION_SECRET` | — | Secret des appels fonction → fonction (webhook → tax-calculate) |
| `DGI_NOTIFICATION_USER_ID` | — | Utilisateur `agent_fiscal` notifié (sinon tous) |
| `ADMIN_ALERT_USER_ID` | — | Admin alerté quand une étape du pipeline échoue |

### Sandbox

| Variable | Défaut |
|---|---|
| `SANDBOX_SUCCESS_RATE` | `0.9` |
| `SANDBOX_SETTLE_SECONDS` | `4` |
| `SANDBOX_FORCE_FAIL_SUFFIX` | `000` |
| `SANDBOX_FORCE_SUCCESS_SUFFIX` | `111` |
| `SANDBOX_FORCE_ACTION_SUFFIX` | `222` |

### Orange Money

| Variable | Description |
|---|---|
| `ORANGE_MONEY_API_KEY` | Client ID OAuth (Orange Developer) |
| `ORANGE_MONEY_API_SECRET` | Client secret OAuth |
| `ORANGE_MONEY_MERCHANT_ID` | Identifiant marchand |
| `ORANGE_MONEY_MERCHANT_KEY` | *Merchant key* Web Payment (distincte du client id) |
| `ORANGE_MONEY_BASE_URL` | `https://api.orange.com` |
| `ORANGE_MONEY_COUNTRY` | `cd` (segment de chemin WebPayment) |
| `ORANGE_MONEY_WEBHOOK_SECRET` | Secret HMAC configuré comme en-tête statique `X-Signature` côté Orange |

### M-Pesa (Vodacom RDC)

| Variable | Description |
|---|---|
| `MPESA_CONSUMER_KEY` | API key (chiffrée en clé de session) |
| `MPESA_CONSUMER_SECRET` | — |
| `MPESA_PUBLIC_KEY` | Clé publique Vodacom (RSA) pour chiffrer l'API key |
| `MPESA_SHORTCODE` | Code marchand |
| `MPESA_SERVICE_PROVIDER_CODE` | `input_ServiceProviderCode` |
| `MPESA_MARKET` | `vodacomDRC` |
| `MPESA_BASE_URL` | `https://openapi.m-pesa.com/sandbox` / `https://openapi.m-pesa.com/openapi` |
| `MPESA_WEBHOOK_SECRET` | Secret HMAC (`X-Mpesa-Signature`) |

### Airtel Money

| Variable | Description |
|---|---|
| `AIRTEL_MONEY_CLIENT_ID` / `AIRTEL_MONEY_CLIENT_SECRET` | OAuth2 client_credentials |
| `AIRTEL_MONEY_MERCHANT_ID` | Identifiant marchand |
| `AIRTEL_MONEY_BASE_URL` | `https://openapiuat.airtel.africa` (UAT) / `https://openapi.airtel.africa` |
| `AIRTEL_MONEY_COUNTRY` | `CD` |
| `AIRTEL_MONEY_CURRENCY` | `CDF` |
| `AIRTEL_MONEY_WEBHOOK_SECRET` | Secret HMAC (`X-Auth-Token`) |

### Autres moyens

| Variable | Description |
|---|---|
| `CARD_WEBHOOK_SECRET` | Secret HMAC du PSP carte (à brancher) |
| `BANK_TRANSFER_WEBHOOK_SECRET` | Secret HMAC des confirmations manuelles de virement |

`assertRequiredEnv()` échoue au démarrage en production si une `*_API_KEY` ou un `*_WEBHOOK_SECRET` manque.

---

## 4. Onboarding par opérateur

### 4.1 Orange Money (Web Payment API)

1. Créer un compte sur [developer.orange.com](https://developer.orange.com), souscrire à **Orange Money Web Payment** pour la RDC, obtenir client id / secret et la *merchant key*.
2. Déclarer l'URL de notification : `https://<project>.supabase.co/functions/v1/payment-webhook?provider=orange_money` et l'en-tête statique `X-Signature`.
3. Flux implémenté :
   - `POST /oauth/v3/token` (client_credentials, Basic) → token mis en cache avec le TTL renvoyé ;
   - `POST /orange-money-webpay/cd/v1/webpayment` → `pay_token`, `payment_url` (redirection → `requires_action`), `notif_token` ;
   - `POST /orange-money-webpay/cd/v1/transactionstatus` → `INITIATED | PENDING | SUCCESS | FAILED | EXPIRED`.
4. Remboursement : non exposé par WebPayment. L'adaptateur renvoie `pending` avec un identifiant `OM-RFD-MANUAL-…` ; l'équipe traite dans le back-office marchand.

### 4.2 M-Pesa (Vodacom M-Pesa Open API — **pas** Safaricom Daraja)

1. Onboarding via Vodacom Congo (compte marchand + accès *M-Pesa Open API*, marché `vodacomDRC`).
2. Récupérer la clé publique RSA, l'API key, le shortcode et le service provider code.
3. Flux implémenté :
   - `GET /ipg/v2/vodacomDRC/getSession/` avec `Authorization: Bearer <apiKey chiffrée RSA>` → `output_SessionID` (cache ~1 h) ;
   - `POST /ipg/v2/vodacomDRC/c2bPayment/singleStage/` → push USSD au client ;
   - `GET /ipg/v2/vodacomDRC/queryTransactionStatus/?input_QueryReference=…` ;
   - `POST /ipg/v2/vodacomDRC/reversal/` pour les remboursements.
4. Callback : `…/payment-webhook?provider=mpesa`, signé `X-Mpesa-Signature`.

### 4.3 Airtel Money (Airtel Africa Open API)

1. Compte sur [developers.airtel.africa](https://developers.airtel.africa), application pour le pays `CD`, devise `CDF`.
2. Flux implémenté :
   - `POST /auth/oauth2/token` (client_credentials) → token (~180 s, mis en cache) ;
   - `POST /merchant/v1/payments/` avec `X-Country: CD`, `X-Currency: CDF` → push USSD ;
   - `GET /standard/v1/payments/{transactionId}` → `TIP | TS | TF | TA | TE` ;
   - `POST /standard/v1/payments/refund`.
3. Callback : `…/payment-webhook?provider=airtel_money`, hash HMAC dans `X-Auth-Token`.

### 4.4 Carte bancaire et virement

- `card` : en sandbox, redirection simulée (`requires_action` → succès). En production, lève `method_unavailable` tant qu'aucun PSP n'est branché (`CardProvider` dans `index.ts`).
- `bank_transfer` : `pending` jusqu'à une confirmation manuelle postée sur `…/payment-webhook?provider=bank_transfer` et signée avec `BANK_TRANSFER_WEBHOOK_SECRET`.

Les frais, plafonds et disponibilité de chaque moyen sont configurés dans la table `payment_providers` (migration 008) — modifiable sans déploiement.

---

## 5. Référence des codes d'erreur

Les adaptateurs normalisent les codes opérateur vers des codes canoniques ; le frontend (`src/utils/paymentErrors.ts`) les traduit en français et décide s'ils sont réessayables.

### Codes canoniques

| Code | Message (FR) | Réessayable |
|---|---|---|
| `insufficient_funds` | Solde insuffisant sur votre compte Mobile Money. | non |
| `phone_not_registered` | Ce numéro n'est pas enregistré auprès de l'opérateur. | non |
| `account_blocked` | Votre compte Mobile Money est bloqué. Contactez votre opérateur. | non |
| `account_limit_exceeded` | Le plafond de transaction de votre compte est dépassé. | non |
| `wrong_pin` | Code PIN incorrect. Réessayez. | oui |
| `pin_attempts_exceeded` | Trop de tentatives de code PIN. Votre compte est temporairement bloqué. | non |
| `user_cancelled` | Vous avez annulé le paiement. | non (jamais rejoué) |
| `user_timeout` | Vous n'avez pas confirmé le paiement à temps sur votre téléphone. | oui |
| `otp_expired` | Le code de confirmation a expiré. Relancez le paiement. | oui |
| `provider_timeout` | Le service de l'opérateur ne répond pas. Réessayez. | oui |
| `provider_error` | Erreur du service de l'opérateur. Réessayez dans quelques instants. | oui |
| `provider_unavailable` | Le service de l'opérateur est momentanément indisponible. | oui |
| `provider_rejected` | L'opérateur a refusé la transaction. | non |
| `invalid_provider_response` | Réponse invalide de l'opérateur. Le paiement n'a pas été confirmé. | oui |
| `duplicate_payment` | Ce paiement a déjà été effectué. | non |
| `invalid_amount` / `amount_below_minimum` / `amount_above_maximum` | Montant invalide / hors bornes du moyen de paiement | non |
| `invalid_phone` | Numéro de téléphone invalide. Format attendu : +243 8XX XXX XXX. | non |
| `contract_not_found` / `contract_inactive` / `period_already_paid` | Erreurs de validation métier | non |
| `method_unavailable` | Ce mode de paiement n'est pas disponible actuellement. | non |
| `payment_not_found` / `payment_expired` / `invalid_state` | État du paiement | non |
| `refund_not_allowed` / `refund_window_closed` | Remboursement refusé | non |
| `unauthorized` / `forbidden` / `rate_limited` / `network_error` / `unknown` | Infra | `rate_limited`, `network_error` : oui |

### Correspondances opérateur → canonique

**Orange Money**

| Code OM | Canonique |
|---|---|
| `60019` | `insufficient_funds` |
| `60020` | `account_limit_exceeded` |
| `60021` | `phone_not_registered` |
| `60022` | `account_blocked` |
| `60023` | `wrong_pin` |
| `60024` | `pin_attempts_exceeded` |
| `60025` / statut `CANCELLED` | `user_cancelled` |
| `60026` / statut `EXPIRED` | `user_timeout` |
| `60030` | `provider_unavailable` |
| `50` | `provider_error` |
| `4001` | `invalid_amount` |
| `4002` | `invalid_phone` |

**M-Pesa (Vodacom)**

| Code | Canonique |
|---|---|
| `INS-0` | succès |
| `INS-1`, `INS-4` | `provider_error` |
| `INS-2`, `INS-17` → `INS-26` | `invalid_provider_response` |
| `INS-5` | `user_timeout` |
| `INS-6`, `INS-993`, `INS-994` | `provider_rejected` |
| `INS-9` | `provider_timeout` |
| `INS-10` | `duplicate_payment` |
| `INS-13`, `INS-14` | `invalid_phone` |
| `INS-15` | `invalid_amount` |
| `INS-16` | `provider_unavailable` |

**Airtel Money**

| Code | Canonique |
|---|---|
| `DP00800001000` | succès |
| `DP00800001001` | en cours |
| `DP00800001002` | `user_cancelled` |
| `DP00800001003` | `insufficient_funds` |
| `DP00800001004` | `phone_not_registered` |
| `DP00800001005` | `account_limit_exceeded` |
| `DP00800001006` | `user_timeout` |
| `DP00800001007` | `wrong_pin` |
| `DP00800001008` | `account_blocked` |
| `DP00800001009` | `invalid_amount` |
| `DP00800001010`, `ESB000001` | `provider_error` |
| `DP00800001024` | `duplicate_payment` |
| `DP00800001025`, `ESB000004` | `provider_unavailable` |
| `ESB000008`, `ESB000010` | `invalid_provider_response` |

Statuts : OM `INITIATED→pending`, `PENDING→processing`, `SUCCESS→succeeded`, `FAILED/EXPIRED/CANCELLED→failed` ; Airtel `TIP/TA→processing`, `TS→succeeded`, `TF/TE→failed`.

---

## 6. Checklist de mise en production

- [ ] Contrats marchands signés avec Orange, Vodacom et Airtel ; comptes de règlement ouverts.
- [ ] Secrets définis pour chaque opérateur (`*_API_KEY`, `*_API_SECRET`, `*_MERCHANT_ID`, `*_WEBHOOK_SECRET`) — `assertRequiredEnv()` passe.
- [ ] `PAYMENT_MODE=production`, `APP_URL` et `ALLOWED_ORIGINS` renseignés.
- [ ] URLs de callback déclarées chez chaque opérateur avec le bon paramètre `?provider=`.
- [ ] Remplacement des `// TODO: Enable in production` validé opérateur par opérateur sur les environnements UAT (Airtel `openapiuat`, M-Pesa `sandbox`).
- [ ] Endpoints confirmés avec les gestionnaires de compte (les chemins documentés dans les adaptateurs sont ceux des APIs publiques et peuvent varier par contrat).
- [ ] `payment_providers.is_sandbox = false` pour les moyens activés ; `is_active = false` pour les autres.
- [ ] Test bout en bout : initiation → push USSD → webhook → pipeline (impôt, ledger, reçu, notifications).
- [ ] Test de remboursement et vérification de l'inversion fiscale.
- [ ] Plan de reprise : lecture de `payment_pipeline_jobs`, alertes admin, cron `expire_stale_payments()`.
- [ ] Journalisation : vérifier qu'aucune donnée sensible n'apparaît (redaction activée).
- [ ] Runbook support : consultation de `payment_webhooks` et `payment_state_history` par référence.
