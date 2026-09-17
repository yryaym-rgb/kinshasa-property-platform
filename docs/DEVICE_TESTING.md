# Tests sur appareil réel (Android)

Check-list à dérouler sur un **téléphone Android physique** avant chaque
livraison des pages publiques et d'authentification. Lighthouse en laboratoire
donne 100 ; cette liste vérifie ce que l'émulation ne voit pas : vrai réseau
mobile, vrai processeur, vrais doigts.

Durée indicative : 30 min. Copier ce fichier dans le ticket de recette et cocher.

---

## 0. Matériel et préparation

- [ ] Téléphone Android **milieu/entrée de gamme** (Tecno Spark, Infinix Hot,
      Samsung A1x/A2x, Redmi 9/10…) — 2 à 4 Go de RAM. C'est le parc majoritaire à Kinshasa.
- [ ] Chrome Android à jour (`chrome://version` → noter la version dans le compte rendu).
- [ ] Câble USB + PC avec Chrome desktop (pour DevTools distant).
- [ ] Sur le téléphone : *Paramètres → Options pour les développeurs → Débogage USB* activé.
- [ ] URL testée : ______________________ (préprod ou `npm run preview` exposé sur le réseau local :
      `npx vite preview --host` puis `http://<ip-du-pc>:4173`).
- [ ] Vider les données du site avant la première passe :
      Chrome → ⋮ → *Paramètres → Paramètres des sites → Toutes les données des sites* → rechercher le domaine → *Supprimer*.
- [ ] Noter : modèle ______, Android ______, Chrome ______, opérateur ______ (Vodacom / Airtel / Orange / Africell).

## 1. Brancher DevTools à distance

1. PC : Chrome → `chrome://inspect/#devices`, cocher *Discover USB devices*.
2. Téléphone : accepter « Autoriser le débogage USB » (cocher *Toujours autoriser*).
3. Sur le PC, l'onglet du téléphone apparaît sous son nom → **Inspect**.
4. Une fenêtre DevTools s'ouvre, miroir de l'écran du téléphone. Tous les onglets
   (Network, Performance, Lighthouse, Console, Application) pilotent désormais le
   téléphone.

- [ ] DevTools distant connecté.

## 2. Limiter le réseau en 3G

Deux méthodes ; **faire les deux**.

### 2a. Throttling DevTools (reproductible)

1. DevTools → onglet **Network**.
2. Menu déroulant *No throttling* → **Slow 3G** (400 ms RTT, 400 kb/s) — c'est
   plus sévère que le profil Lighthouse (150 ms RTT, 1,6 Mb/s) ; utiliser
   **Fast 3G** pour la comparaison directe avec les scores du README.
3. Cocher **Disable cache**.
4. Pour tester le processeur : onglet **Performance** → ⚙ → *CPU: 4× slowdown*.

- [ ] Throttling appliqué (préciser lequel : ______).

### 2b. Réseau mobile réel (représentatif)

1. Désactiver le Wi-Fi du téléphone ; forcer la 3G : *Paramètres → Réseau mobile →
   Type de réseau préféré → 3G* (ou `*#*#4636#*#*` → *Informations sur le téléphone*
   → *Définir le type de réseau préféré* → `WCDMA only`).
2. Vérifier l'icône **3G / H / H+** dans la barre d'état.
3. Refaire le parcours § 4 une fois en 3G réelle et noter les temps ressentis.

- [ ] Parcours refait en 3G réelle. Débit mesuré (fast.com) : ______ Mb/s.

## 3. Où lire les métriques sur l'appareil

| Métrique | Où | Ce qu'on attend |
|---|---|---|
| **Lighthouse (téléphone réel)** | DevTools distant → onglet **Lighthouse** → *Mobile*, cocher Performance + Accessibility → *Analyze page load*. Le rapport est calculé **sur le téléphone**. | Performance ≥ 95, Accessibility 100 sur `/`, `/login`, `/register` |
| **LCP / CLS / INP en direct** | DevTools → **Performance** → panneau *Live metrics* (visible avant d'enregistrer) ; ou installer l'extension [Web Vitals](https://chrome.google.com/webstore/detail/web-vitals/ahfhijdlegdabablpippeagghigmibma) sur le PC et l'ouvrir dans l'onglet distant. | LCP < 2,5 s en Fast 3G, CLS = 0 |
| **Élément LCP** | Performance → *Record and reload* → piste *Timings* → cliquer **LCP** : le nœud est surligné dans *Summary*. | `/` : `img` du héro dans **`#lp-shell`** (pas celui de `#accueil`). Pages auth : le `h1.as-title` |
| **Cascade réseau** | Onglet **Network**, colonne *Waterfall*. | Aucun `.js` / `.css` ne démarre avant la fin de la photo héro sur `/` ; la police Google (`css2?family=Inter…`) part **après** le premier paint |
| **Console** | Onglet **Console**, filtre *Errors*. | **0 erreur** sur `/`, `/login`, `/register`, `/verify`, `/forgot-password`, `/reset-password` |
| **Mémoire / plantage** | `chrome://crashes` sur le téléphone après la session. | Aucun crash listé |
| **Sans PC** | Sur le téléphone : Chrome ⋮ → *Plus d'outils* n'existe pas ; utiliser l'extension **Web Vitals** via DevTools distant, ou PageSpeed Insights (`pagespeed.web.dev`) sur l'URL de préprod pour un second avis en laboratoire. | — |

- [ ] Rapport Lighthouse « on device » exporté (JSON ou HTML) et joint au ticket.
- [ ] Élément LCP vérifié sur `/` et `/login`.

## 4. Parcours fonctionnel (en 3G)

Utiliser un **vrai numéro** de test fourni par l'équipe (l'OTP arrive par SMS).

### Landing `/`
- [ ] La photo et le titre apparaissent **avant** que le menu ne devienne interactif ; pas de page blanche.
- [ ] Le texte ne « saute » pas quand la police Inter arrive (pas de CLS visible).
- [ ] Menu ☰ → « Créer un compte » ouvre `/register`.

### Inscription `/register`
- [ ] Étape 1 : les deux cartes *Bailleur* / *Locataire* sont visibles dès le premier écran, sans défilement.
- [ ] Étape 2 : le clavier numérique s'ouvre sur le champ téléphone (`inputmode="tel"`), le préfixe **+243** est affiché ; `812345678` accepté, `12345` refusé avec message.
- [ ] Étape 2 (Bailleur) : la prise de photo de la pièce d'identité fonctionne depuis l'appareil photo **et** la galerie ; l'aperçu s'affiche.
- [ ] Étape 3 : la jauge de force réagit à la frappe ; `abc123` refusé ; les mots de passe différents refusés.
- [ ] Étape 3 : la case « J'accepte les CGU » se coche en tapant **sur la case et sur le texte** ; les liens CGU s'ouvrent dans un nouvel onglet sans perdre le formulaire.
- [ ] Un brouillon survit à un rechargement de la page (revenir sur `/register` → on retrouve l'étape et les champs).

### OTP `/verify`
- [ ] Le SMS arrive en < 60 s (noter le délai : ______ s).
- [ ] Android propose le remplissage automatique du code (barre de suggestion du clavier) ; sinon la saisie chiffre par chiffre passe automatiquement à la case suivante.
- [ ] Coller un code à 6 chiffres remplit les six cases.
- [ ] Un mauvais code affiche « Code incorrect. Il vous reste N tentative(s). » ; après 3 échecs les cases se désactivent.
- [ ] « Renvoyer le code » est grisé 45 s puis actif ; le second SMS arrive.

### Tableau de bord, session, déconnexion
- [ ] Après le bon code : redirection vers le tableau de bord du rôle, prénom affiché.
- [ ] Rafraîchir la page (tirer vers le bas) → toujours connecté.
- [ ] Fermer Chrome complètement (écran des applis récentes → balayer) → rouvrir l'URL → toujours connecté.
- [ ] Menu compte → Déconnexion → `/login` ; le bouton *Retour* d'Android ne ramène **pas** au tableau de bord.
- [ ] `/login` avec les mêmes identifiants → tableau de bord.
- [ ] Mode avion pendant le chargement du tableau de bord → message d'erreur compréhensible, pas d'écran blanc ; retour du réseau → l'appli se resynchronise.

## 5. Installation PWA

> **État actuel** : l'application ne livre pas encore de `manifest.webmanifest`
> ni de service worker (prévu Phase 2, voir ARCHITECTURE.md). Tant que ce n'est
> pas le cas, Chrome ne proposera **pas** « Installer l'application » : seule
> l'option *Ajouter à l'écran d'accueil* (raccourci) existe, et c'est elle qu'on
> vérifie aujourd'hui. Les points marqués ⏳ deviennent obligatoires dès que le
> PWA est livré.

- [ ] Chrome ⋮ → **Ajouter à l'écran d'accueil** → l'icône et le nom « eLoyer Kinshasa » sont corrects (favicon SVG rendu, pas l'icône générique).
- [ ] Lancer depuis l'écran d'accueil → la page s'ouvre sur `/` (ou le tableau de bord si connecté).
- [ ] ⏳ DevTools distant → **Application → Manifest** : aucune erreur, icônes 192/512 px listées, `display: standalone`, `theme_color #0A1628`.
- [ ] ⏳ **Application → Service workers** : un worker *activated and running* pour l'origine.
- [ ] ⏳ Chrome affiche la bannière ou l'entrée de menu **« Installer l'application »** (et non « Ajouter à l'écran d'accueil »).
- [ ] ⏳ L'appli installée s'ouvre **sans barre d'adresse**, la barre d'état prend la couleur `#0A1628`.
- [ ] ⏳ Mode avion → ouvrir l'appli installée → la landing et `/login` s'affichent depuis le cache (pas de dinosaure).
- [ ] ⏳ DevTools → **Lighthouse** → catégorie *PWA* (ou l'audit *Installable*) : aucun échec.

## 6. Problèmes fréquents à traquer

### Cibles tactiles
- [ ] Tous les boutons, liens de navigation et cases à cocher font **≥ 48 × 48 dp** (Lighthouse *Accessibility → Tap targets* ; ou DevTools → Elements → survoler pour lire la taille).
- [ ] Les six cases OTP sont tapables individuellement sans toucher la voisine.
- [ ] Le bouton « Ouvrir le menu » ☰ et le sélecteur de langue sont atteignables au pouce (angle supérieur droit : vérifier avec une main).
- [ ] Les liens du pied de page (CGU, Confidentialité) ne sont pas trop serrés (≥ 8 dp d'écart).

### Viewport et mise en page
- [ ] Aucun **défilement horizontal** sur `/`, `/register` étapes 1-3, `/verify` (glisser latéralement : rien ne bouge).
- [ ] Rotation **paysage** : le formulaire reste utilisable, le clavier ne masque pas le bouton principal.
- [ ] Le clavier ouvert ne casse pas la hauteur `100svh` : le titre reste visible, pas de « saut » à la fermeture.
- [ ] Zoom navigateur 200 % (Chrome ⋮ → Zoom) : pas de chevauchement, textes lisibles.
- [ ] Police système agrandie (*Paramètres Android → Affichage → Taille de police → maximum*) : les libellés ne sont pas coupés, les cartes de rôle ne débordent pas.
- [ ] Mode sombre Android activé : les pages publiques et auth restent lisibles (elles imposent le thème clair — vérifier qu'aucun composant n'hérite d'un fond sombre).
- [ ] Écran à encoche / barre de geste : le bouton « Créer mon compte » n'est pas caché derrière la barre de navigation Android.

### Saisie
- [ ] Champ téléphone : clavier **numérique** ; champ e-mail : clavier avec `@` ; champ mot de passe : l'œil affiche/masque bien le texte.
- [ ] La correction automatique n'altère pas le nom complet (majuscules forcées en fin de mot, etc.).
- [ ] Gestionnaire de mots de passe Google : proposé à l'inscription et reconnu à la connexion.

### Performance ressentie
- [ ] Première visite en Fast 3G : contenu visible en < 2 s, formulaire utilisable en < 4 s.
- [ ] Pas de flash blanc entre le shell statique et la page React (regarder attentivement le titre et le bouton).
- [ ] L'animation de zoom du héro et les transitions ne saccadent pas (< 1 s de jank au total au chargement).

## 7. Captures à archiver

Nommer `YYYY-MM-DD_<modèle>_<page>_<sujet>.png` et déposer dans le ticket / le dossier de recette.

| # | Capture | Comment |
|---|---|---|
| 1 | Fiche appareil | `chrome://version` (version Chrome) + *Paramètres → À propos* (modèle, Android) |
| 2 | Landing `/` — premier paint en 3G | Capture pendant le chargement (Slow 3G) : le shell doit être visible avec la photo |
| 3 | Landing `/` — page complète | Après chargement, défilement en haut |
| 4 | Lighthouse on-device `/` | Les 4 scores + le bloc *Metrics* |
| 5 | Lighthouse on-device `/login` | Les 4 scores |
| 6 | Élément LCP `/` | Onglet Performance, LCP sélectionné, nœud surligné (`#lp-shell`) |
| 7 | Cascade Network `/` | Onglet Network trié par heure de début : photo héro **avant** les `.js` |
| 8 | Console `/register` étape 3 | Filtre *Errors* vide |
| 9 | Register étape 2 avec clavier ouvert | Montre que le bouton *Continuer* reste atteignable |
| 10 | OTP — suggestion automatique du code | Barre de suggestion du clavier Android visible |
| 11 | OTP — état verrouillé | Après 3 mauvais codes |
| 12 | Tableau de bord après OTP | Prénom visible |
| 13 | Écran d'accueil Android | Icône « eLoyer Kinshasa » ajoutée |
| 14 | ⏳ Application → Manifest / Service workers | Dès que le PWA est livré |
| 15 | Tout défaut constaté | Une capture par anomalie, annotée (cercle rouge) |

Enregistrement vidéo utile en plus : *Paramètres rapides → Enregistrement d'écran*
pendant le parcours complet en 3G réelle (1 à 2 min).

## 8. Compte rendu

```
Appareil : ________  Android : ____  Chrome : ____  Réseau : ____
Lighthouse on-device  /        : P __ A __ BP __ SEO __   LCP __ s  CLS __
Lighthouse on-device  /login   : P __ A __ BP __ SEO __
Délai SMS OTP : __ s   Erreurs console : __
Bloquants : …
Mineurs : …
Captures : lien
```

Un point non coché sans justification = recette refusée.
