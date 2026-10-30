# Calculatrice Scientifique

Calculatrice scientifique avancée, 100 % en français, qui tourne entièrement dans le
navigateur. Aucun serveur, aucune dépendance, aucun CDN : le calcul se fait par un moteur
maison (`engine.js`), jamais avec `eval()`.

---

## Démarrage

### Double-clic (le plus simple)

Ouvrez `index.html` dans un navigateur récent (Chrome, Edge, Firefox, Safari).
Tout fonctionne hors ligne, y compris l'historique et les thèmes.

> Le service worker (installation PWA) ne s'active qu'en `http(s)://`. En `file://`,
> l'application reste pleinement fonctionnelle, seule l'installation est indisponible.

### Petit serveur local (pour la PWA)

Avec Python déjà installé :

```powershell
py -m http.server 8123 --bind 127.0.0.1
```

Puis ouvrez <http://localhost:8123/index.html>.

---

## Les deux modes de calcul

| Mode | Comportement | Exemple |
| --- | --- | --- |
| **Expression** | Priorités habituelles, expression modifiable, aperçu du résultat en direct. | `2+3×4 = 14` |
| **Immédiat** | Façon calculatrice de poche, opérations enchaînées de gauche à droite. | `2+3×4 = 20` |

En mode immédiat, `=` répété rejoue la dernière opération (`2+3=`, `=` → `8`, `=` → `11`).
Les fonctions à deux arguments (`nCr`, `nPr`, `nthroot`) et `EXP` basculent automatiquement
en mode expression avec un préremplissage, pour éviter toute ambiguïté.

---

## Conventions de saisie

| Écriture | Sens |
| --- | --- |
| `,` | virgule décimale (`1,5`) |
| `;` | séparateur d'arguments (`log(8;2)`) |
| `%` | division par 100 (`200+10% = 200,1`) |
| `^` | puissance, associative à droite (`2^3^2 = 512`) |
| `−2^2` | `−4` (le moins unaire s'applique après la puissance) |
| `2π`, `3(4+5)`, `2sin(30)` | multiplication implicite acceptée |
| `!` | factorielle (`5! = 120`) |
| `×10^(` | bouton `EXP`, ex. `1,23 EXP 5 = 123 000` |

Les angles suivent le mode **DEG / RAD / GRAD** affiché dans l'écran (bouton du pavé ou
pastille `DEG`).

---

## Fonctions disponibles

- **Trigonométrie** : `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- **Hyperboliques** : `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`
- **Puissances et racines** : `sqrt`, `cbrt`, `nthroot(x;n)`, `exp`, `pow(x;y)`, `^`, `²`, `³`
- **Logarithmes** : `ln`, `log` (base 10), `log2`, `logb(x;base)`
- **Combinatoire** : `fact`, `!`, `nCr(n;r)`, `nPr(n;r)`, `mod`, `abs`, `sign`
- **Arrondis** : `floor`, `ceil`, `trunc`, `round(x;décimales)`
- **Divers** : `min`, `max`, `gcd`, `lcm`, `rand()`, `randint(a;b)`
- **Complexes** : `re`, `im`, `conj`, `arg`, constante `i`
- **Conversions** : `deg2rad`, `rad2deg`, `dms(d;m;s)`, `c2f`, `f2c`, `km2mi`, `mi2km`,
  `kg2lb`, `lb2kg`, `m2ft`, `ft2m`, `l2gal`, `gal2l`
- **Constantes et mémoire** : `pi`, `e`, `ans`, `mem`

### Modules avancés

- **Complexes** — somme, différence, produit, quotient ; résultat en forme algébrique et
  polaire (module, argument).
- **Matrices** — 2×2 ou 3×3 : `A+B`, `A−B`, `A×B`, `det(A)`, `A⁻¹`, `Aᵀ`, `Bᵀ`.
- **Statistiques** — effectif, somme, moyenne, médiane, quartiles, min/max, écarts-types
  (population et échantillon) ; régression linéaire avec pente, ordonnée à l'origine,
  coefficient de corrélation et `r²`.

---

## Formatage des résultats

- 12 chiffres significatifs, sans bruit de flottant (`0,1+0,2` affiche `0,3`).
- Séparateur de milliers : espace fine insécable (`1 234 567`).
- Virgule décimale française (`1 234,56`).
- Notation scientifique au-delà de `10¹²` ou en dessous de `10⁻⁹` (`1×10¹³`).
- Signe moins typographique `−`.

---

## Historique, copie et export

- **100 derniers calculs** conservés dans `localStorage`, avec date et heure.
- Un clic sur une entrée la réinjecte dans la calculatrice.
- Bouton **Copier** : copie le résultat courant au format réutilisable (point décimal).
- Bouton **Exporter** : télécharge un CSV (`Date;Expression;Résultat`, séparateur `;`,
  encodage UTF-8 avec BOM pour Excel).
- Bouton **Vider** : efface l'historique.

---

## Thèmes et responsive

- Deux thèmes **clair** et **sombre**, choisis par défaut selon le système, mémorisés
  ensuite (`calc.theme`).
- Bascule par l'icône lune/soleil en haut à droite.
- Mise en page adaptée du mobile (pavé 6 colonnes, historique en tiroir) au grand écran
  (historique en colonne latérale).
- Respect de `prefers-reduced-motion`.

---

## Clavier physique

| Touche | Action |
| --- | --- |
| `0`–`9` | chiffres |
| `+` `-` `*` `/` `^` | opérateurs |
| `(` `)` `!` `%` `;` | symboles |
| `.` ou `,` | virgule décimale |
| `Entrée` ou `=` | calculer |
| `Retour arrière` | effacer un caractère |
| `Échap` | fermer le tiroir d'historique, sinon tout effacer |
| `Suppr` | tout effacer |
| `p` | insérer π |

Le pavé écran respecte les libellés AZERTY affichés ; le clavier physique accepte les
touches AZERTY comme QWERTY pour les chiffres et opérateurs.

---

## Tests

Le même jeu de tests (135 cas) est fourni en deux versions.

### Navigateur

Ouvrez `tests/tests.html` (double-clic ou via <http://localhost:8123/tests/tests.html>).
La page affiche le nombre de tests réussis/échoués et le détail des erreurs.

### Node.js

Si Node.js est installé :

```bash
node --test tests/
```

Le runner `tests/engine.test.mjs` importe `engine.js` (CommonJS) et `tests/cases.js`.

Couverture : priorités et associativité, multiplications implicites, fonctions,
erreurs et codes, constantes/`ans`/mémoire, complexes, formatage français, matrices,
statistiques, et machine à états du mode immédiat.

---

## PWA et hors ligne

- `manifest.webmanifest` : nom, icônes (normale + maskable), mode `standalone`.
- `sw.js` : stratégie *stale-while-revalidate* sur les ressources locales, avec repli
  sur `index.html` pour la navigation.
- Après une première visite en `http://localhost`, l'application est installable et
  utilisable hors ligne.

---

## Arborescence

```text
.
├── index.html              structure de l'interface et aide
├── styles.css              thèmes clair/sombre et responsive
├── app.js                  état, pavé, historique, modules, clavier
├── engine.js               moteur pur : tokenizer, parseur, évaluation
├── manifest.webmanifest    manifeste PWA
├── sw.js                   service worker
├── icons/
│   ├── icon.svg
│   └── icon-maskable.svg
├── tests/
│   ├── cases.js            les 135 cas partagés
│   ├── tests.html          runner navigateur
│   └── engine.test.mjs     runner Node.js
└── README.md
```

---

## Limites connues

- L'inverse et le déterminant matriciels sont pris en charge jusqu'à 3×3.
- Les puissances complexes d'exposant non entier sont refusées avec un message explicite.
- L'arrondi est fait sur 12 chiffres significatifs : ce n'est pas un moteur à précision
  arbitraire.
- Le service worker nécessite `http(s)://` ; en `file://`, il est simplement ignoré.

Toutes les erreurs sont explicites et en français (division par zéro, domaine,
parenthèse manquante, arité, dimension de matrice, etc.).
