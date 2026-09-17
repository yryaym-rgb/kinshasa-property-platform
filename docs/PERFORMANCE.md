# Performance — eLoyer Kinshasa

Ce document décrit les techniques qui permettent aux pages publiques et
d'authentification d'atteindre **100 en Performance Lighthouse mobile** sur un
profil « Moto G Power, 3G lente, CPU ×4 » — le profil réaliste d'un usager à
Kinshasa. Il complète [ARCHITECTURE.md](ARCHITECTURE.md) (§ *Static shell*).

Trois mécanismes coopèrent, dans cet ordre :

1. **Static shell** : le HTML contient déjà le premier écran (texte ou photo),
   stylé par un CSS critique inline. Le LCP est produit *par le HTML seul*.
2. **Paint-first loader** : la feuille de style et le bundle JS ne partent que
   lorsque le shell a été *présenté* à l'écran. Rien ne partage la bande
   passante avec le LCP.
3. **Police à métriques compatibles** (« Inter Fallback ») : le texte du shell
   se dessine dans une police locale calibrée sur Inter ; le swap vers la
   webfont ne provoque ni CLS ni ré-enregistrement du LCP.

Un quatrième, le **préchargement par route**, fait que React rend la page
finale en un seul aller-retour dès que le loader démarre.

---

## 1. Paint-first loader (`vite.config.ts` → `paintFirstLoader`)

### Le problème

Vite émet dans `index.html` un `<link rel="stylesheet">` bloquant et un
`<script type="module">` + `<link rel="modulepreload">` qui démarrent dès le
parsing du `<head>`. Sur 3G, ces requêtes (CSS ~40 KB, JS ~120 KB gz) se
disputent la bande passante avec la photo héro (74 KB) ou retardent le premier
rendu du texte. Lighthouse (Lantern) compte en plus comme *render-blocking*
toute ressource démarrée **et** terminée avant le paint observé.

### Le mécanisme

Le plugin (`apply: 'build'`, `enforce: 'post'`, `transformIndexHtml`) retire ces
trois familles de balises et les remplace par **un script inline** qui connaît
la route courante :

```text
route ∉ PAINT_FIRST_ROUTES            → load() immédiat (dashboards, 404…)
route = "/"  (LCP = image)            → load() sur l'évènement `eloyer:shellpainted`,
                                        plafond PAINT_FIRST_EVENT_CAP_MS = 1 500 ms
route ∈ auth (LCP = texte)            → load() sur l'entrée `first-contentful-paint`
                                        (PerformanceObserver), sinon 2 × rAF,
                                        plafond 300 ms
```

`load()` fait, dans l'ordre :

1. `<link rel="preload" as="style" data-app-css>` → devient `stylesheet` à
   l'`onload` (CSS non bloquant). `main.tsx` attend cette feuille
   (`whenStylesReady`) avant de monter React : rien ne se rend jamais sans style.
2. `<link rel="modulepreload">` pour le bundle d'entrée **et** pour le chunk de
   la page courante *et sa fermeture d'imports statiques* (voir § 4).
3. `<script type="module">` du bundle d'entrée.
4. Sur `/register` : `<link rel="prefetch">` des chunks des étapes 2 et 3
   (priorité idle).

Un `<noscript>` réinjecte la feuille de style bloquante pour les navigateurs
sans JS.

### Pourquoi deux signaux différents ?

| Route | LCP | Signal « le shell est à l'écran » |
|---|---|---|
| `/` | photo héro | `eloyer:shellpainted`, émis par le script de shell d'`index.html` quand l'entrée **Element Timing** `lp-shell-hero` arrive (= présentation réelle du bitmap). Repli : `load` de l'image + 2 rAF. Plafond 2 500 ms côté shell, 1 500 ms côté loader. |
| `/login`, `/register`, `/verify`, `/forgot-password`, `/reset-password` | titre H1 du shell | entrée `first-contentful-paint`. Deux rAF ne suffisent pas : sur une machine rapide une petite ressource peut démarrer *et* finir avant le paint observé, et Lantern la classe render-blocking (c'était la cause des 98/99 aléatoires). |

### Le piège du « candidat LCP en attente »

Chrome enregistre une image dessinée **pendant** que ses octets arrivent comme
un candidat LCP *pending* ; il ne devient définitif qu'au repaint suivant — qu'un
shell statique ne déclenche jamais. Résultat : dans ~40 % des chargements, le
LCP glissait silencieusement vers la copie React de la photo (3,1 s au lieu de
1,3 s). La parade, dans `index.html` :

```html
<img … elementtiming="lp-shell-hero" fetchpriority="high" decoding="sync"
     style="visibility:hidden" onload="this.style.visibility=''" onerror="this.style.visibility=''" />
```

L'image ne se dessine qu'une fois complète : son premier paint est un candidat
**final**. Même traitement pour la photo du panneau des pages `/login` et
`/register` sur desktop (`elementtiming="auth-shell-panel"`).

---

## 2. Police à métriques compatibles (« Inter Fallback »)

### Le problème

`font-display: swap` garde le texte visible, mais la police système est plus
étroite qu'Inter : quand la webfont arrive, chaque ligne s'élargit. Deux
effets : un décalage de mise en page (CLS) et, si le swap se produit avant que
React ait remplacé le shell, **un nouveau candidat LCP plus tardif** (le texte
repeint est plus grand que l'original).

### La technique

Un `@font-face` local, déclaré à l'identique dans le CSS critique
d'`index.html` et dans `src/styles/index.css` (**à garder synchronisés**) :

```css
@font-face {
  font-family: 'Inter Fallback';
  src: local('Roboto'), local('Roboto-Regular'), local('Arial'), local('ArialMT'),
       local('Liberation Sans'), local('Arimo'), local('Helvetica Neue'), local('Helvetica');
  size-adjust: 109%;
  ascent-override: 98.2%;
  descent-override: 27.5%;
  line-gap-override: 0%;
}
```

et partout `font-family: Inter, 'Inter Fallback', ui-sans-serif, system-ui, sans-serif`
(`--font-sans`).

- `size-adjust` / `ascent-override` / `descent-override` alignent la boîte de
  chaque glyphe sur celle d'Inter : les lignes ont la même largeur et la même
  hauteur avant et après le swap → **CLS ≈ 0**.
- La calibration vise ~1,5 % **au-dessus** d'Inter, volontairement : le texte
  peint avant l'arrivée de la webfont n'est jamais plus *petit* que son rendu
  final, donc le repaint post-swap ne peut pas devenir un candidat LCP plus grand.
- Les candidats `local()` couvrent Android (Roboto), Windows (Arial), Linux
  (Liberation Sans / Arimo) et macOS/iOS (Helvetica).

### Quand la webfont est-elle activée ?

Le `<link id="app-fonts">` Google Fonts n'a **pas de `rel`** au chargement ;
`window.__eloyerFonts()` le transforme en `preload as=style` → `stylesheet` :

| Route | Activation |
|---|---|
| dashboards, autres | immédiatement (dans le `<head>`) |
| `/` | à `eloyer:shellpainted` (après la présentation de la photo) |
| pages auth | **une frame après que React a remplacé le shell** (`MutationObserver` sur `#root`) ; filet de sécurité 3 s après `load`. Ainsi le shell et le premier rendu React peignent avec les mêmes métriques — jamais de repaint « plus large » avant le montage. |

Poppins (titres), JetBrains Mono (chiffres) et Caveat suivent le même chemin.

---

## 3. Préchargement par route

### Chunks de page connus du HTML

`ENTRY_ROUTE_MODULES` (vite.config.ts) relie chaque route d'entrée à son module
source. Au build, le plugin calcule pour chacune le chunk de page **et la
fermeture transitive de ses imports statiques**, moins ce que le bundle
d'entrée contient déjà, et l'inscrit dans les données du loader. À l'exécution,
`load()` émet un `modulepreload` par fichier : la page se rend après **un
aller-retour** au lieu de la cascade entrée → chunk de page → ses imports.

### Côté React (`src/routes/entryRoutes.ts`, `src/main.tsx`)

Chaque page d'entrée est un `lazyRoute()` exposant `preload()`. Avant de monter,
`main.tsx` attend (plafond 800 ms auth / 1 000 ms landing) :

```text
Promise.all([
  whenStylesReady(),            // la feuille data-app-css est appliquée
  whenXxxShellPainted(),        // la photo du shell a été présentée (Element Timing / decode + 2 rAF)
  preloadEntryRoute(pathname),  // le module de la page est en mémoire
])
```

Le premier commit React dessine donc **la page finale par-dessus le shell**,
sans fallback Suspense ni décalage. Sur `/register`, `preloadRegisterStep()`
réchauffe aussi l'étape sur laquelle un brouillon sauvegardé s'est arrêté.

### Images : mêmes candidats partout

Le `<picture>` du shell, celui de `Hero.tsx` et les `<link rel="preload"
as="image" imagesrcset imagesizes>` injectés dans le `<head>` déclarent
**exactement** les mêmes candidats, afin que le navigateur résolve un seul
fichier :

```text
(max-width: 1023px)  hero-kinshasa-750.webp 750w, hero-kinshasa-1024.webp 1024w          sizes 100vw
(min-width: 1024px)  … + hero-kinshasa.webp 1600w                                          sizes 100vw
panneau auth desktop hero-kinshasa-750.webp 750w, -1024.webp 1024w, hero-kinshasa.webp 1600w  sizes 1024px
```

Sous le point de rupture desktop, le fichier 1600w n'est *jamais* candidat : la
photo est couverte à 75–95 % par un dégradé, un 1024w est indiscernable sur un
écran 3× — 74 KB au lieu de 141 KB. Le préchargement du panneau auth n'est
créé que si `matchMedia('(min-width: 1024px)')` est vrai (le panneau est caché
sur mobile).

### Supabase à la demande (`src/lib/lazySupabase.ts`)

Le SDK (~55 KB gz) n'est importé qu'au premier appel (`getSupabase()`), ou au
montage seulement si `hasPersistedSession()` détecte un jeton en storage. Sur
`/register`, il est réchauffé à la première interaction — il ne précède plus
jamais le premier paint.

---

## 4. Mesurer

```bash
npm run build && npm run preview          # http://localhost:4173

# Lighthouse mobile (profil par défaut = Moto G Power, 3G lente, CPU ×4)
npx lighthouse http://localhost:4173/ --output=json --output-path=./lh.json \
  --chrome-flags="--headless=new" --only-categories=performance,accessibility,best-practices,seo
# Desktop
npx lighthouse http://localhost:4173/login --preset=desktop …
```

Exécuter **5 fois** et lire la **médiane** : le TBT/SI varient de ±0,1 s d'une
exécution à l'autre. Dans le rapport, vérifier :

- *Largest Contentful Paint element* : doit être un nœud **du shell**
  (`#lp-shell .sh-bg img` sur `/`, `#auth-shell .as-title` sur les pages auth).
- *Eliminate render-blocking resources* : aucune ressource listée.
- *Font display* : aucune webfont bloquante (`app-fonts` est activée après le paint).
- *Cumulative Layout Shift* : 0 (sinon, les métriques d'Inter Fallback ont dérivé —
  vérifier que les deux déclarations `@font-face` sont identiques).

Une sonde Playwright avec `PerformanceObserver` (`largest-contentful-paint`,
`paint`, `element`) sous throttling CDP est la façon la plus fiable de voir *quel*
candidat LCP est retenu et quand `react-mounted` survient par rapport à lui.

---

## 5. Invariants à préserver

- Toute modification du premier écran (`Hero.tsx`, `AuthLayout`, titres de page)
  doit être reportée dans le shell d'`index.html` : pixel-identique, sinon le
  montage React produit un décalage et un second candidat LCP.
- Les deux `@font-face` « Inter Fallback » restent identiques.
- Les trois déclarations de candidats d'image (shell, `Hero.tsx`, preload) restent identiques.
- Une nouvelle page d'entrée = une ligne dans `ENTRY_ROUTE_MODULES` **et** dans
  `entryRoutes.ts` ; si elle a un shell complet, elle est automatiquement
  paint-first ; si son LCP est une image, l'ajouter à `PAINT_FIRST_EVENT_ROUTES`
  et émettre `eloyer:shellpainted`.
- Ne jamais importer `@/config/supabase` statiquement depuis une page d'entrée.

## Scorecard

Voir le tableau dans le [README](../README.md#scorecard-performance).
