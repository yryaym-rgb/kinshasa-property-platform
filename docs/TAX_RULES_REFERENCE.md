# Référentiel des règles fiscales

> Registre des règles configurées dans `regles_fiscales`, avec leurs références
> légales et leur statut de validation. La source de vérité est la base de
> données ; ce document est le journal humain qui l'accompagne.
>
> ⚠️ **Toutes les règles ci-dessous sont des PLACEHOLDERS.** Les taux, seuils et
> numéros d'article doivent être validés par le conseil juridique de la DGI
> avant toute mise en production. Tant que `reference_legale` contient
> « à valider », le moteur signale la règle comme `pendingValidation` sur les
> reçus, le simulateur et les PDF.

Fonctionnement du moteur : [TAX_ENGINE.md](./TAX_ENGINE.md)

---

## 1. Règles actives (seed `supabase/seed/03_tax_rules_drc.sql`)

Rappel : `taux` est une **fraction** (`0.1000` = 10 %). Priorité : plus petit = évalué d'abord.

| # | Nom | Périmètre | Tranche (CDF/mois) | Taux | Mode | Priorité | Référence légale | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | Exonération micro-loyer | Tous types, toutes communes | 0 → 49 999,99 | 0 % (exonéré) | exclusif | 10 | Code des impôts RDC — seuil d'exonération des revenus locatifs, *Art. XXX* | ⚠️ à valider |
| 2 | Impôt sur revenus locatifs — résidentiel | `Appartement`, `Studio`, `Villa` | ≥ 50 000 | **10 %** | exclusif | 100 | Code des impôts RDC — IRL, taux résidentiel, *Art. XXX* | ⚠️ à valider |
| 3 | Impôt sur revenus locatifs — commercial | `Bureau`, `Magasin`, `Entrepôt` | ≥ 50 000 | **15 %** | exclusif | 100 | Code des impôts RDC — IRL, taux locaux commerciaux, *Art. XXX* | ⚠️ à valider |
| 4 | Impôt sur revenus locatifs — taux par défaut | Tous (filet de sécurité) | ≥ 50 000 | 10 % | exclusif | 900 | Code des impôts RDC — IRL, taux général, *Art. XXX* | ⚠️ à valider |

Toutes : `date_debut = 2024-01-01`, `date_fin = NULL`, `type_contribuable = NULL` (personnes physiques et morales).

### Règles inactives (exemples)

| Nom | Périmètre | Taux | Mode | Priorité | Référence | Statut |
|---|---|---|---|---|---|---|
| Surtaxe communale — Gombe (exemple) | Commune `Gombe`, ≥ 50 000 | 1 % | **cumulatif** | 200 | Arrêté communal Gombe — taxe locative additionnelle (référence à confirmer) | `is_active = false` — démontre l'empilement d'une surtaxe communale sans code |

### Résultats attendus (jeux de test du moteur)

| Loyer | Type | Commune | Résultat |
|---|---|---|---|
| 40 000 | Appartement | Lemba | Exonéré (règle 1) → 0 |
| 850 000 | Appartement | Gombe | Règle 2 → 85 000 (10 %) |
| 1 200 000 | Bureau | Gombe | Règle 3 → 180 000 (15 %) |
| 1 200 000 | Bureau | Gombe, surtaxe Gombe activée | Règle 3 + surtaxe → 180 000 + 12 000 = 192 000 (16 %) |
| 300 000 | *(type inconnu)* | Kintambo | Règle 4 (filet) → 30 000 |

Ces cas sont couverts par les tests `deno test` de `_shared/tax/` et la fonction pure `evaluateRules`.

---

## 2. Références légales à confirmer

| Élément | Texte à confirmer | Responsable | Échéance |
|---|---|---|---|
| Définition de la base imposable (loyer brut vs net de charges) | Code des impôts, dispositions IRL | DGI — Direction de la législation | avant production |
| Taux résidentiel (10 % placeholder) | Article et éventuelles tranches | DGI | avant production |
| Taux commercial (15 % placeholder) | Article, définition des locaux professionnels | DGI | avant production |
| Seuil d'exonération (50 000 CDF placeholder) | Existence et montant d'un seuil | DGI | avant production |
| Distinction personne physique / morale | Régime applicable aux sociétés bailleresses | DGI | avant production |
| Échéance de reversement (15 du mois suivant) | Délai légal de paiement de l'IRL retenu à la source | DGI | avant production |
| Surtaxes communales | Arrêtés communaux de Kinshasa | Hôtel de Ville / communes | à la demande |

Une fois validée, mettre à jour la règle : `reference_legale` et `article_loi` sans marqueur « à valider », `validated_by`, `validated_at`. Le marqueur disparaît automatiquement des écrans et des PDF.

---

## 3. Journal des modifications

| Date | Règle(s) | Action | Motif | Auteur |
|---|---|---|---|---|
| 2026-09-17 | Règles 1-4 + exemple Gombe | Création (seed 03) | Mise en place du moteur configurable (Module 5). Placeholders en attente de validation DGI. | Équipe eLoyer |

Procédure : toute modification passe par SQL ou le Dashboard, est tracée automatiquement dans `regles_fiscales_historique` (trigger), et doit être reportée ici avec son motif. Un changement rétroactif est suivi d'un `tax-recalculate` dont le `runId` est indiqué dans la colonne « Motif ».

---

## 4. Contact pour validation juridique

| Rôle | Contact |
|---|---|
| Direction Générale des Impôts — Direction de la législation fiscale | *(à renseigner)* |
| Référent fiscal eLoyer | *(à renseigner — `agent_fiscal` désigné dans `DGI_NOTIFICATION_USER_ID`)* |
| Conseil juridique externe | *(à renseigner)* |

Toute règle insérée sans référence légale est **refusée** par la base (`reference_legale NOT NULL`).
