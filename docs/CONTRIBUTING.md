# Guide de contribution

## Standards de code

### TypeScript
- Mode strict activé — pas de `any`
- Types explicites pour les props et retours de fonctions
- Utiliser les types générés dans `src/types/`

### React
- Composants fonctionnels avec hooks
- Pas de logique métier dans les composants UI
- Lazy loading pour les pages

### Style
- Tailwind CSS avec variables CSS du thème
- Composants UI du design system (`src/components/ui/`)
- Texte UI en français

### Commits
Format conventionnel :
```
feat: ajouter page de paiement Mobile Money
fix: corriger validation numéro DRC
docs: mettre à jour schéma base de données
```

## Branches

- `main` — production
- `develop` — intégration
- `feature/*` — nouvelles fonctionnalités
- `fix/*` — corrections de bugs

## Pull Requests

1. Description claire du changement
2. Screenshots pour les changements UI
3. Build passant (`npm run build`)
4. Pas de régression sur l'authentification

## Tests

```bash
npm run build    # Vérification TypeScript + build
npm run lint     # Linting
npm run dev      # Test manuel
```

## Contexte DRC

- Téléphones : format +243 8XX XXX XXX
- Devise principale : CDF (Franc congolais)
- 24 communes de Kinshasa
- Opérateurs : Orange, Vodacom (M-Pesa), Airtel, Africell

## Contact

Équipe technique — Ville de Kinshasa
support@kinshasa.gouv.cd
