/*!
 * engine.js — moteur de calcul de la Calculatrice Scientifique
 * ------------------------------------------------------------
 * Moteur pur, sans dépendance ni DOM :
 *   normalisation -> tokenisation -> parseur (descente récursive) -> évaluation
 *
 * Exposé en navigateur sous window.CalcEngine et en CommonJS (pour les tests).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalcEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PI = Math.PI;
  const E = Math.E;
  const MAX_FACT = 170;
  const GROUP = '\u202F'; // espace fine insécable
  const MINUS = '\u2212'; // signe moins typographique

  /* ============================================================
   * 1. Erreurs
   * ============================================================ */

  class CalcError extends Error {
    constructor(message, code, position) {
      super(message);
      this.name = 'CalcError';
      this.code = code || 'CALC';
      this.position = position == null ? null : position;
    }
  }

  function fail(message, code, position) {
    throw new CalcError(message, code, position);
  }

  /* ============================================================
   * 2. Types de valeurs : nombre | complexe | matrice
   * ============================================================ */

  function isComplex(v) {
    return !!v && typeof v === 'object' && v.type === 'complex';
  }

  function isMatrix(v) {
    return !!v && typeof v === 'object' && v.type === 'matrix';
  }

  function complex(re, im) {
    return { type: 'complex', re: re, im: im };
  }

  function toComplex(v) {
    if (isComplex(v)) return v;
    if (typeof v === 'number') return complex(v, 0);
    return fail('Valeur complexe attendue', 'DOMAIN');
  }

  /** Réduit un complexe à un réel quand la partie imaginaire est négligeable. */
  function narrow(z) {
    const scale = Math.max(1, Math.abs(z.re));
    let im = z.im;
    if (Math.abs(im) <= 1e-12 * scale) im = 0;
    const re = z.re === 0 ? 0 : z.re;
    if (im === 0) return re;
    return complex(re, im);
  }

  function realArg(v) {
    if (typeof v === 'number') return v;
    if (isComplex(v) && Math.abs(v.im) <= 1e-12) return v.re;
    return fail('Un nombre réel est attendu ici', 'DOMAIN');
  }

  function kindOf(v) {
    if (isMatrix(v)) return 'matrix';
    if (isComplex(v)) return 'complex';
    return 'number';
  }

  /* ============================================================
   * 3. Formatage (français : 1 234,56 et 1,2×10¹²)
   * ============================================================ */

  const SUP = {
    '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
    '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
    '-': '\u207B', '+': ''
  };

  function superscript(n) {
    return String(n).split('').map(function (c) { return SUP[c] || c; }).join('');
  }

  function groupThousands(intPart) {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
  }

  /** 12 chiffres significatifs, regroupement des milliers, virgule décimale. */
  function formatNumber(value, options) {
    const opts = options || {};
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Erreur';
    if (!isFinite(value)) return value > 0 ? '∞' : '−∞';
    if (value === 0) return '0';

    let n = Number(value.toPrecision(12));
    if (n === 0) return '0';
    const sign = n < 0 ? MINUS : '';
    const abs = Math.abs(n);

    if (abs >= 1e12 || abs < 1e-9) {
      const parts = n.toExponential(9).split('e');
      let mantissa = parts[0].replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
      const exponent = parseInt(parts[1], 10);
      return sign + mantissa + '×10' + superscript(exponent);
    }

    const decimals = Math.max(0, Math.min(20, 11 - Math.floor(Math.log10(abs))));
    let text = abs.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
    const pieces = text.split('.');
    let intPart = pieces[0] || '0';
    if (opts.group !== false) intPart = groupThousands(intPart);
    text = pieces.length > 1 ? intPart + ',' + pieces[1] : intPart;
    return sign + text;
  }

  function formatComplex(z, options) {
    const c = toComplex(z);
    let re = c.re;
    let im = c.im;
    if (Math.abs(im) <= 1e-12 * Math.max(1, Math.abs(re))) im = 0;
    if (re === 0) re = 0;
    if (im === 0) return formatNumber(re, options);

    const imAbs = Math.abs(im);
    const coeff = Math.abs(imAbs - 1) < 1e-15 ? '' : formatNumber(imAbs, options);
    const imText = coeff + 'i';
    if (re === 0) return (im < 0 ? MINUS : '') + imText;
    return formatNumber(re, options) + (im < 0 ? MINUS : '+') + imText;
  }

  function format(value, options) {
    if (isMatrix(value)) {
      return value.data.map(function (_, r) {
        const row = [];
        for (let c = 0; c < value.cols; c++) row.push(formatNumber(value.data[r * value.cols + c], options));
        return row.join('\t');
      }).join('\n');
    }
    if (isComplex(value)) return formatComplex(value, options);
    return formatNumber(value, options);
  }

  /** Représentation réutilisable en entrée (point décimal, sans regroupement). */
  function toPlain(value) {
    if (typeof value === 'number') {
      if (!isFinite(value)) return '0';
      const n = Number(value.toPrecision(12));
      return String(n === 0 ? 0 : n);
    }
    if (isComplex(value)) {
      const re = Number(value.re.toPrecision(12));
      const im = Number(value.im.toPrecision(12));
      if (im === 0) return toPlain(re);
      const sign = im < 0 ? '-' : '+';
      const abs = Math.abs(im);
      return (re === 0 ? '' : String(re)) + sign + (Math.abs(abs - 1) < 1e-15 ? '' : String(abs)) + 'i';
    }
    if (isMatrix(value)) return format(value);
    return '0';
  }

  /* ============================================================
   * 4. Normalisation et tokenisation
   * ============================================================ */

  function normalize(input) {
    let s = String(input == null ? '' : input);
    s = s.replace(/[\u2212\u2013\u2014]/g, '-')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/,/g, '.')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/π/g, 'pi')
      .replace(/\s+/g, ' ')
      .trim();
    return s;
  }

  function isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  function isLetter(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  const FUNCS = {};      // rempli plus bas
  const CONSTANTS = { pi: true, e: true, i: true, ans: true, mem: true };
  let KNOWN_IDS = [];

  function isFunctionToken(t) {
    return t && t.type === 'id' && Object.prototype.hasOwnProperty.call(FUNCS, t.value);
  }

  function isConstantToken(t) {
    return t && t.type === 'id' && Object.prototype.hasOwnProperty.call(CONSTANTS, t.value);
  }

  /** Choisit le nom connu le plus long, sans avaler une lettre suivante. */
  function matchKnownId(src, index) {
    const rest = src.slice(index).toLowerCase();
    for (let k = 0; k < KNOWN_IDS.length; k++) {
      const name = KNOWN_IDS[k];
      if (rest.indexOf(name) === 0) {
        const after = rest.charAt(name.length);
        if (after && /[a-z]/.test(after)) continue;
        return name;
      }
    }
    return null;
  }

  function shouldImplicitMultiply(prev, next) {
    if (!prev || !next) return false;
    if (next.type === 'id' && next.value === 'mod') return false;
    if (isFunctionToken(prev)) return false;
    const prevEnds = prev.type === 'num' || prev.type === 'rparen' ||
      isConstantToken(prev) || prev.value === '!' || prev.value === '%';
    const nextStarts = next.type === 'num' || next.type === 'lparen' ||
      isConstantToken(next) || isFunctionToken(next);
    return prevEnds && nextStarts;
  }

  function tokenize(input) {
    const src = normalize(input);
    const tokens = [];
    let prev = null;
    let i = 0;

    function push(token) {
      if (shouldImplicitMultiply(prev, token)) {
        tokens.push({ type: 'op', value: '*', pos: token.pos, implicit: true });
      }
      tokens.push(token);
      prev = token;
    }

    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ') { i++; continue; }
      const start = i;

      if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
        let seenDot = false;
        while (i < src.length && (isDigit(src[i]) || (src[i] === '.' && !seenDot))) {
          if (src[i] === '.') seenDot = true;
          i++;
        }
        if (src[i] === 'e' || src[i] === 'E') {
          let j = i + 1;
          if (src[j] === '+' || src[j] === '-') j++;
          if (isDigit(src[j])) {
            i = j;
            while (i < src.length && isDigit(src[i])) i++;
          }
        }
        const raw = src.slice(start, i);
        push({ type: 'num', value: parseFloat(raw), raw: raw, pos: start });
        continue;
      }

      if (ch === 'π') { i++; push({ type: 'id', value: 'pi', pos: start }); continue; }
      if (ch === '√') { i++; push({ type: 'id', value: 'sqrt', pos: start }); continue; }
      if (ch === '∛') { i++; push({ type: 'id', value: 'cbrt', pos: start }); continue; }

      if (isLetter(ch)) {
        const known = matchKnownId(src, i);
        if (known) {
          i += known.length;
          push({ type: 'id', value: known, pos: start });
          continue;
        }
        let j = i;
        while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
        const word = src.slice(i, j).toLowerCase();
        i = j;
        push({ type: 'id', value: word, pos: start });
        continue;
      }

      if ('+-*/^'.indexOf(ch) !== -1) {
        i++;
        push({ type: 'op', value: ch, pos: start });
        continue;
      }
      if (ch === '(') { i++; push({ type: 'lparen', pos: start }); continue; }
      if (ch === ')') { i++; push({ type: 'rparen', pos: start }); continue; }
      if (ch === ';') { i++; push({ type: 'sep', pos: start }); continue; }
      if (ch === '!') { i++; push({ type: 'op', value: '!', pos: start }); continue; }
      if (ch === '%') { i++; push({ type: 'op', value: '%', pos: start }); continue; }

      fail('Symbole inconnu « ' + ch + ' »', 'SYNTAX', i);
    }

    tokens.push({ type: 'end', pos: src.length });
    return tokens;
  }
  /* ============================================================
   * 5. Parseur (descente récursive)
   * ============================================================ */

  function tokenText(token) {
    if (!token) return '';
    if (token.type === 'num') return String(token.value);
    if (token.type === 'id') return token.value;
    if (token.type === 'lparen') return '(';
    if (token.type === 'rparen') return ')';
    if (token.type === 'sep') return ';';
    if (token.type === 'end') return 'fin';
    return String(token.value);
  }

  class Parser {
    constructor(tokens) {
      this.tokens = tokens;
      this.index = 0;
    }
    peek(offset) {
      return this.tokens[this.index + (offset || 0)] || this.tokens[this.tokens.length - 1];
    }
    next() {
      return this.tokens[this.index++];
    }
    parse() {
      if (this.peek().type === 'end') fail('Expression vide', 'SYNTAX', 0);
      const node = this.parseAdditive();
      const rest = this.peek();
      if (rest.type !== 'end') {
        fail('Élément inattendu « ' + tokenText(rest) + ' »', 'SYNTAX', rest.pos);
      }
      return node;
    }
    parseAdditive() {
      let left = this.parseMultiplicative();
      for (;;) {
        const t = this.peek();
        if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
          this.next();
          left = { type: 'binary', op: t.value, left: left, right: this.parseMultiplicative(), pos: t.pos };
        } else {
          return left;
        }
      }
    }
    parseMultiplicative() {
      let left = this.parseUnary();
      for (;;) {
        const t = this.peek();
        if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
          this.next();
          left = { type: 'binary', op: t.value, left: left, right: this.parseUnary(), pos: t.pos };
        } else if (t.type === 'id' && t.value === 'mod') {
          this.next();
          left = { type: 'binary', op: 'mod', left: left, right: this.parseUnary(), pos: t.pos };
        } else {
          return left;
        }
      }
    }
    parseUnary() {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next();
        return { type: 'unary', op: t.value, arg: this.parseUnary(), pos: t.pos };
      }
      return this.parsePower();
    }
    parsePower() {
      let base = this.parsePostfix();
      const t = this.peek();
      if (t.type === 'op' && t.value === '^') {
        this.next();
        base = { type: 'binary', op: '^', left: base, right: this.parseUnary(), pos: t.pos };
      }
      return base;
    }
    parsePostfix() {
      let node = this.parsePrimary();
      for (;;) {
        const t = this.peek();
        if (t.type === 'op' && (t.value === '!' || t.value === '%')) {
          this.next();
          node = { type: 'postfix', op: t.value, arg: node, pos: t.pos };
        } else {
          return node;
        }
      }
    }
    parsePrimary() {
      const t = this.peek();
      if (t.type === 'num') { this.next(); return { type: 'num', value: t.value, pos: t.pos }; }
      if (t.type === 'lparen') {
        this.next();
        const node = this.parseAdditive();
        const close = this.peek();
        if (close.type !== 'rparen') fail('Parenthèse fermante manquante', 'SYNTAX', t.pos);
        this.next();
        return node;
      }
      if (t.type === 'id') {
        const name = t.value;
        this.next();
        if (Object.prototype.hasOwnProperty.call(FUNCS, name)) {
          if (this.peek().type === 'lparen') {
            return this.parseCall(name, t.pos);
          }
          return { type: 'call', name: name, args: [this.parsePostfix()], pos: t.pos };
        }
        if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
          return { type: 'const', name: name, pos: t.pos };
        }
        fail('Fonction inconnue « ' + name + ' »', 'UNKNOWN_FUNCTION', t.pos);
      }
      if (t.type === 'end') fail('Expression incomplète', 'SYNTAX', t.pos);
      if (t.type === 'rparen') fail('Parenthèse fermée sans ouverture', 'SYNTAX', t.pos);
      fail('Élément inattendu « ' + tokenText(t) + ' »', 'SYNTAX', t.pos);
    }
    parseCall(name, pos) {
      this.next(); // (
      const args = [];
      if (this.peek().type === 'rparen') {
        this.next();
        return { type: 'call', name: name, args: args, pos: pos };
      }
      for (;;) {
        args.push(this.parseAdditive());
        const t = this.peek();
        if (t.type === 'sep') { this.next(); continue; }
        if (t.type === 'rparen') { this.next(); break; }
        if (t.type === 'end') fail('Parenthèse fermante manquante', 'SYNTAX', pos);
        fail('Élément inattendu « ' + tokenText(t) + ' »', 'SYNTAX', t.pos);
      }
      return { type: 'call', name: name, args: args, pos: pos };
    }
  }

  /* ============================================================
   * 6. Angles
   * ============================================================ */

  function normalizeAngleMode(mode) {
    return mode === 'rad' || mode === 'grad' ? mode : 'deg';
  }

  function angleToRad(x, mode) {
    if (mode === 'deg') return (x * PI) / 180;
    if (mode === 'grad') return (x * PI) / 200;
    return x;
  }

  function radToAngle(x, mode) {
    if (mode === 'deg') return (x * 180) / PI;
    if (mode === 'grad') return (x * 200) / PI;
    return x;
  }

  function cleanTrig(x) {
    if (Math.abs(x) < 1e-12) return 0;
    if (Math.abs(x - 1) < 1e-12) return 1;
    if (Math.abs(x + 1) < 1e-12) return -1;
    return x;
  }

  /* ============================================================
   * 7. Opérations (nombres et complexes)
   * ============================================================ */

  function addValues(a, b) {
    if (isMatrix(a) || isMatrix(b)) return fail('Opération matricielle invalide ici', 'MATRIX_DIM');
    if (isComplex(a) || isComplex(b)) {
      const x = toComplex(a);
      const y = toComplex(b);
      return narrow(complex(x.re + y.re, x.im + y.im));
    }
    return a + b;
  }

  function subValues(a, b) {
    if (isMatrix(a) || isMatrix(b)) return fail('Opération matricielle invalide ici', 'MATRIX_DIM');
    if (isComplex(a) || isComplex(b)) {
      const x = toComplex(a);
      const y = toComplex(b);
      return narrow(complex(x.re - y.re, x.im - y.im));
    }
    return a - b;
  }

  function mulValues(a, b) {
    if (isMatrix(a) || isMatrix(b)) return fail('Opération matricielle invalide ici', 'MATRIX_DIM');
    if (isComplex(a) || isComplex(b)) {
      const x = toComplex(a);
      const y = toComplex(b);
      return narrow(complex(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re));
    }
    return a * b;
  }

  function divValues(a, b) {
    if (isMatrix(a) || isMatrix(b)) return fail('Opération matricielle invalide ici', 'MATRIX_DIM');
    if (isComplex(a) || isComplex(b)) {
      const x = toComplex(a);
      const y = toComplex(b);
      const denom = y.re * y.re + y.im * y.im;
      if (denom === 0) fail('Division par zéro', 'DIV_ZERO');
      return narrow(complex((x.re * y.re + x.im * y.im) / denom, (x.im * y.re - x.re * y.im) / denom));
    }
    if (b === 0) fail('Division par zéro', 'DIV_ZERO');
    return a / b;
  }

  function negateValue(v) {
    if (isComplex(v)) return complex(-v.re, -v.im);
    return -v;
  }

  function complexPowInt(base, n) {
    let result = 1;
    let b = toComplex(base);
    let e = Math.abs(n);
    while (e > 0) {
      if (e & 1) result = mulValues(result, b);
      b = mulValues(b, b);
      e >>= 1;
    }
    const out = isComplex(result) ? narrow(result) : result;
    return n < 0 ? divValues(1, out) : out;
  }

  function powValues(a, b) {
    if (isMatrix(a) || isMatrix(b)) fail('Puissance matricielle non prise en charge', 'MATRIX_DIM');
    if (isComplex(b)) {
      if (Math.abs(b.im) > 1e-12) fail('Exposant complexe non pris en charge', 'DOMAIN');
      b = b.re;
    }
    if (isComplex(a)) {
      if (Number.isInteger(b) && Math.abs(b) <= 1024) return complexPowInt(a, b);
      if (Math.abs(a.im) <= 1e-12 && a.re >= 0) return Math.pow(a.re, b);
      fail('Puissance complexe non prise en charge', 'DOMAIN');
    }
    if (b === 0) return 1;
    if (a === 0 && b < 0) fail('Division par zéro', 'DIV_ZERO');
    if (a < 0 && !Number.isInteger(b)) {
      fail('Puissance non réelle : base négative avec exposant non entier', 'DOMAIN');
    }
    return Math.pow(a, b);
  }

  function modValues(a, b) {
    const x = realArg(a);
    const y = realArg(b);
    if (y === 0) fail('Modulo par zéro', 'DIV_ZERO');
    return x % y;
  }

  function applyBinaryOp(op, a, b) {
    if (op === '+') return addValues(a, b);
    if (op === '-') return subValues(a, b);
    if (op === '*') return mulValues(a, b);
    if (op === '/') return divValues(a, b);
    if (op === '^') return powValues(a, b);
    if (op === 'mod') return modValues(a, b);
    return fail('Opérateur inconnu « ' + op + ' »', 'SYNTAX');
  }

  /* ============================================================
   * 8. Fonctions mathématiques
   * ============================================================ */

  function factorial(n) {
    n = realArg(n);
    if (!Number.isInteger(n) || n < 0) fail('Factorielle : entier positif attendu', 'DOMAIN');
    if (n > MAX_FACT) fail('Factorielle : valeur trop grande (n ≤ 170)', 'OVERFLOW');
    let out = 1;
    for (let k = 2; k <= n; k++) out *= k;
    return out;
  }

  function binomial(n, r, permutation) {
    n = realArg(n);
    r = realArg(r);
    if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
      fail('Combinaison : entiers 0 ≤ r ≤ n attendus', 'DOMAIN');
    }
    if (permutation) {
      let p = 1;
      for (let k = 0; k < r; k++) p *= n - k;
      if (!isFinite(p)) fail('Résultat trop grand', 'OVERFLOW');
      return p;
    }
    const k = Math.min(r, n - r);
    let c = 1;
    for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
    return Math.round(c);
  }

  function toPositiveArgs(x, label) {
    const v = realArg(x);
    if (!(v > 0)) fail(label + ' : valeur strictement positive attendue', 'DOMAIN');
    return v;
  }

  function nthRoot(x, n) {
    x = realArg(x);
    n = realArg(n);
    if (n === 0) fail('Racine nième : indice non nul attendu', 'DOMAIN');
    if (x < 0) {
      if (!Number.isInteger(n) || n % 2 === 0) fail('Racine nième non réelle', 'DOMAIN');
      return -Math.pow(-x, 1 / n);
    }
    return Math.pow(x, 1 / n);
  }

  function toInteger(x, label) {
    const v = realArg(x);
    if (!Number.isInteger(v)) fail(label + ' : entier attendu', 'DOMAIN');
    return v;
  }

  function roundValue(x, digits) {
    const v = realArg(x);
    const d = digits === undefined ? 0 : toInteger(digits, 'Arrondi');
    if (d < 0 || d > 15) fail('Arrondi : nombre de décimales entre 0 et 15 attendu', 'DOMAIN');
    const factor = Math.pow(10, d);
    return Math.round(v * factor) / factor;
  }

  Object.assign(FUNCS, {
    /* --- trigonométrie --- */
    sin: { args: [1, 1], fn: function (a, ctx) { return cleanTrig(Math.sin(angleToRad(realArg(a[0]), ctx.angle))); } },
    cos: { args: [1, 1], fn: function (a, ctx) { return cleanTrig(Math.cos(angleToRad(realArg(a[0]), ctx.angle))); } },
    tan: {
      args: [1, 1],
      fn: function (a, ctx) {
        const rad = angleToRad(realArg(a[0]), ctx.angle);
        if (Math.abs(Math.cos(rad)) < 1e-12) fail('Tangente non définie à cet angle', 'DOMAIN');
        return cleanTrig(Math.tan(rad));
      }
    },
    asin: {
      args: [1, 1],
      fn: function (a, ctx) {
        const x = realArg(a[0]);
        if (x < -1 || x > 1) fail('Arc sinus : argument entre -1 et 1 attendu', 'DOMAIN');
        return radToAngle(Math.asin(x), ctx.angle);
      }
    },
    acos: {
      args: [1, 1],
      fn: function (a, ctx) {
        const x = realArg(a[0]);
        if (x < -1 || x > 1) fail('Arc cosinus : argument entre -1 et 1 attendu', 'DOMAIN');
        return radToAngle(Math.acos(x), ctx.angle);
      }
    },
    atan: { args: [1, 1], fn: function (a, ctx) { return radToAngle(Math.atan(realArg(a[0])), ctx.angle); } },
    sinh: { args: [1, 1], fn: function (a) { return Math.sinh(realArg(a[0])); } },
    cosh: { args: [1, 1], fn: function (a) { return Math.cosh(realArg(a[0])); } },
    tanh: { args: [1, 1], fn: function (a) { return Math.tanh(realArg(a[0])); } },
    asinh: { args: [1, 1], fn: function (a) { return Math.asinh(realArg(a[0])); } },
    acosh: {
      args: [1, 1],
      fn: function (a) {
        const x = realArg(a[0]);
        if (x < 1) fail('Arc cosinus hyperbolique : argument ≥ 1 attendu', 'DOMAIN');
        return Math.acosh(x);
      }
    },
    atanh: {
      args: [1, 1],
      fn: function (a) {
        const x = realArg(a[0]);
        if (x <= -1 || x >= 1) fail('Arc tangente hyperbolique : argument entre -1 et 1 attendu', 'DOMAIN');
        return Math.atanh(x);
      }
    },

    /* --- puissances, racines, logarithmes --- */
    sqrt: {
      args: [1, 1],
      fn: function (a) {
        const x = realArg(a[0]);
        if (x < 0) fail('Racine carrée d’un nombre négatif', 'DOMAIN');
        return Math.sqrt(x);
      }
    },
    cbrt: { args: [1, 1], fn: function (a) { return Math.cbrt(realArg(a[0])); } },
    nthroot: { args: [2, 2], fn: function (a) { return nthRoot(a[0], a[1]); } },
    exp: { args: [1, 1], fn: function (a) { return Math.exp(realArg(a[0])); } },
    pow: { args: [2, 2], fn: function (a) { return powValues(a[0], a[1]); } },
    ln: {
      args: [1, 1],
      fn: function (a) {
        const x = realArg(a[0]);
        if (!(x > 0)) fail('Logarithme : valeur strictement positive attendue', 'DOMAIN');
        return Math.log(x);
      }
    },
    log: {
      args: [1, 1],
      fn: function (a) {
        const x = realArg(a[0]);
        if (!(x > 0)) fail('Logarithme : valeur strictement positive attendue', 'DOMAIN');
        return Math.log10(x);
      }
    },
    log2: {
      args: [1, 1],
      fn: function (a) {
        const x = realArg(a[0]);
        if (!(x > 0)) fail('Logarithme : valeur strictement positive attendue', 'DOMAIN');
        return Math.log2(x);
      }
    },
    logb: {
      args: [2, 2],
      fn: function (a) {
        const x = realArg(a[0]);
        const b = realArg(a[1]);
        if (!(x > 0) || !(b > 0) || b === 1) fail('Logarithme : base > 0 et ≠ 1 attendue', 'DOMAIN');
        return Math.log(x) / Math.log(b);
      }
    },

    /* --- combinatoire et divers --- */
    fact: { args: [1, 1], fn: function (a) { return factorial(a[0]); } },
    ncr: { args: [2, 2], fn: function (a) { return binomial(a[0], a[1], false); } },
    npr: { args: [2, 2], fn: function (a) { return binomial(a[0], a[1], true); } },
    mod: { args: [2, 2], fn: function (a) { return modValues(a[0], a[1]); } },
    abs: {
      args: [1, 1],
      fn: function (a) {
        const v = a[0];
        if (isComplex(v)) return Math.hypot(v.re, v.im);
        return Math.abs(realArg(v));
      }
    },
    sign: { args: [1, 1], fn: function (a) { return Math.sign(realArg(a[0])); } },
    floor: { args: [1, 1], fn: function (a) { return Math.floor(realArg(a[0])); } },
    ceil: { args: [1, 1], fn: function (a) { return Math.ceil(realArg(a[0])); } },
    trunc: { args: [1, 1], fn: function (a) { return Math.trunc(realArg(a[0])); } },
    round: { args: [1, 2], fn: function (a) { return roundValue(a[0], a[1]); } },
    min: {
      args: [1, 8],
      fn: function (a) { return Math.min.apply(null, a.map(function (v) { return realArg(v); })); }
    },
    max: {
      args: [1, 8],
      fn: function (a) { return Math.max.apply(null, a.map(function (v) { return realArg(v); })); }
    },
    gcd: {
      args: [2, 2],
      fn: function (a) {
        let x = Math.abs(toInteger(a[0], 'PGCD'));
        let y = Math.abs(toInteger(a[1], 'PGCD'));
        while (y) { const t = y; y = x % y; x = t; }
        return x;
      }
    },
    lcm: {
      args: [2, 2],
      fn: function (a) {
        let x = Math.abs(toInteger(a[0], 'PPCM'));
        let y = Math.abs(toInteger(a[1], 'PPCM'));
        if (x === 0 || y === 0) return 0;
        let p = x, q = y;
        while (q) { const t = q; q = p % q; p = t; }
        return (x / p) * y;
      }
    },
    rand: { args: [0, 0], fn: function () { return Math.random(); } },
    randint: {
      args: [2, 2],
      fn: function (a) {
        const lo = toInteger(a[0], 'Entier aléatoire');
        const hi = toInteger(a[1], 'Entier aléatoire');
        if (lo > hi) fail('Entier aléatoire : bornes inversées', 'DOMAIN');
        return lo + Math.floor(Math.random() * (hi - lo + 1));
      }
    },

    /* --- complexes --- */
    re: {
      args: [1, 1],
      fn: function (a) { return isComplex(a[0]) ? a[0].re : realArg(a[0]); }
    },
    im: {
      args: [1, 1],
      fn: function (a) { return isComplex(a[0]) ? a[0].im : 0; }
    },
    conj: {
      args: [1, 1],
      fn: function (a) { return isComplex(a[0]) ? narrow(complex(a[0].re, -a[0].im)) : a[0]; }
    },
    arg: {
      args: [1, 1],
      fn: function (a, ctx) {
        if (isComplex(a[0])) return radToAngle(Math.atan2(a[0].im, a[0].re), ctx.angle);
        return realArg(a[0]) < 0 ? radToAngle(PI, ctx.angle) : 0;
      }
    },

    /* --- conversions --- */
    deg2rad: { args: [1, 1], fn: function (a) { return (realArg(a[0]) * PI) / 180; } },
    rad2deg: { args: [1, 1], fn: function (a) { return (realArg(a[0]) * 180) / PI; } },
    dms: {
      args: [3, 3],
      fn: function (a) {
        const d = realArg(a[0]), m = realArg(a[1]), s = realArg(a[2]);
        const sign = d < 0 ? -1 : 1;
        return sign * (Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600);
      }
    },
    c2f: { args: [1, 1], fn: function (a) { return (realArg(a[0]) * 9) / 5 + 32; } },
    f2c: { args: [1, 1], fn: function (a) { return ((realArg(a[0]) - 32) * 5) / 9; } },
    km2mi: { args: [1, 1], fn: function (a) { return realArg(a[0]) / 1.609344; } },
    mi2km: { args: [1, 1], fn: function (a) { return realArg(a[0]) * 1.609344; } },
    kg2lb: { args: [1, 1], fn: function (a) { return realArg(a[0]) / 0.45359237; } },
    lb2kg: { args: [1, 1], fn: function (a) { return realArg(a[0]) * 0.45359237; } },
    m2ft: { args: [1, 1], fn: function (a) { return realArg(a[0]) / 0.3048; } },
    ft2m: { args: [1, 1], fn: function (a) { return realArg(a[0]) * 0.3048; } },
    l2gal: { args: [1, 1], fn: function (a) { return realArg(a[0]) / 3.785411784; } },
    gal2l: { args: [1, 1], fn: function (a) { return realArg(a[0]) * 3.785411784; } }
  });

  KNOWN_IDS = Object.keys(FUNCS).concat(Object.keys(CONSTANTS))
    .sort(function (a, b) { return b.length - a.length; });

  /* ============================================================
   * 9. Évaluation
   * ============================================================ */

  function evalNode(node, ctx) {
    switch (node.type) {
      case 'num':
        return node.value;
      case 'const':
        if (node.name === 'pi') return PI;
        if (node.name === 'e') return E;
        if (node.name === 'i') return complex(0, 1);
        if (node.name === 'ans') return ctx.ans;
        if (node.name === 'mem') return ctx.memory;
        return fail('Constante inconnue « ' + node.name + ' »', 'UNKNOWN_TOKEN', node.pos);
      case 'unary': {
        const v = evalNode(node.arg, ctx);
        return node.op === '-' ? negateValue(v) : v;
      }
      case 'binary': {
        const a = evalNode(node.left, ctx);
        const b = evalNode(node.right, ctx);
        return applyBinaryOp(node.op, a, b);
      }
      case 'postfix': {
        const v = evalNode(node.arg, ctx);
        if (node.op === '%') return divValues(v, 100);
        if (node.op === '!') return factorial(v);
        return fail('Opérateur postfixe inconnu', 'SYNTAX', node.pos);
      }
      case 'call': {
        const def = FUNCS[node.name];
        if (!def) return fail('Fonction inconnue « ' + node.name + ' »', 'UNKNOWN_FUNCTION', node.pos);
        const args = node.args.map(function (arg) { return evalNode(arg, ctx); });
        const min = def.args[0];
        const max = def.args[1];
        if (args.length < min || args.length > max) {
          const expected = min === max ? String(min) : min + ' à ' + max;
          fail('La fonction ' + node.name + ' attend ' + expected + ' argument' + (expected === '1' ? '' : 's'), 'ARITY', node.pos);
        }
        return def.fn(args, ctx);
      }
      default:
        return fail('Expression invalide', 'SYNTAX');
    }
  }

  function checkFinite(value) {
    if (typeof value === 'number') {
      if (!isFinite(value)) fail('Résultat trop grand pour être représenté', 'OVERFLOW');
      return;
    }
    if (isComplex(value) && (!isFinite(value.re) || !isFinite(value.im))) {
      fail('Résultat trop grand pour être représenté', 'OVERFLOW');
    }
  }

  /**
   * Évalue une expression.
   * @param {string} input
   * @param {{angle?:'deg'|'rad'|'grad', ans?:number, memory?:number}} [options]
   * @returns {{value:number|object, display:string, kind:string}}
   */
  function evaluate(input, options) {
    const opts = options || {};
    const ctx = {
      angle: normalizeAngleMode(opts.angle),
      ans: typeof opts.ans === 'number' && isFinite(opts.ans) ? opts.ans : 0,
      memory: typeof opts.memory === 'number' && isFinite(opts.memory) ? opts.memory : 0
    };
    const tokens = tokenize(input);
    const ast = new Parser(tokens).parse();
    const value = evalNode(ast, ctx);
    checkFinite(value);
    return { value: value, display: format(value), kind: kindOf(value) };
  }

  function parse(input) {
    return new Parser(tokenize(input)).parse();
  }

  /* ============================================================
   * 10. Matrices (2×2 et 3×3, plus 1×1 par simplicité)
   * ============================================================ */

  function matrixCreate(rows, cols, data) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 4 || cols > 4) {
      fail('Dimensions de matrice invalides', 'MATRIX_DIM');
    }
    if (!Array.isArray(data) || data.length !== rows * cols) {
      fail('Données de matrice incomplètes', 'MATRIX_DIM');
    }
    return { type: 'matrix', rows: rows, cols: cols, data: data.map(realArg) };
  }

  function matrixBinary(a, b, opLabel) {
    if (!isMatrix(a) || !isMatrix(b)) fail('Deux matrices sont attendues', 'MATRIX_DIM');
    if (a.rows !== b.rows || a.cols !== b.cols) {
      fail('Dimensions incompatibles pour ' + opLabel + ' (' + a.rows + '×' + a.cols + ' et ' + b.rows + '×' + b.cols + ')', 'MATRIX_DIM');
    }
    return a.data.map(function (v, i) { return opLabel === '+' ? v + b.data[i] : v - b.data[i]; });
  }

  function matrixAdd(a, b) {
    matrixBinary(a, b, '+');
    return { type: 'matrix', rows: a.rows, cols: a.cols, data: matrixBinary(a, b, '+') };
  }

  function matrixSub(a, b) {
    matrixBinary(a, b, '-');
    return { type: 'matrix', rows: a.rows, cols: a.cols, data: matrixBinary(a, b, '-') };
  }

  function matrixMul(a, b) {
    if (!isMatrix(a) || !isMatrix(b)) fail('Deux matrices sont attendues', 'MATRIX_DIM');
    if (a.cols !== b.rows) {
      fail('Produit impossible : ' + a.rows + '×' + a.cols + ' par ' + b.rows + '×' + b.cols, 'MATRIX_DIM');
    }
    const out = new Array(a.rows * b.cols).fill(0);
    for (let r = 0; r < a.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        let sum = 0;
        for (let k = 0; k < a.cols; k++) sum += a.data[r * a.cols + k] * b.data[k * b.cols + c];
        out[r * b.cols + c] = sum;
      }
    }
    return { type: 'matrix', rows: a.rows, cols: b.cols, data: out };
  }

  function matrixTranspose(m) {
    if (!isMatrix(m)) fail('Matrice attendue', 'MATRIX_DIM');
    const out = new Array(m.rows * m.cols);
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) out[c * m.rows + r] = m.data[r * m.cols + c];
    }
    return { type: 'matrix', rows: m.cols, cols: m.rows, data: out };
  }

  function matrixMinor(m, skipRow, skipCol) {
    const data = [];
    for (let r = 0; r < m.rows; r++) {
      if (r === skipRow) continue;
      for (let c = 0; c < m.cols; c++) {
        if (c === skipCol) continue;
        data.push(m.data[r * m.cols + c]);
      }
    }
    return matrixCreate(m.rows - 1, m.cols - 1, data);
  }

  function matrixDet(m) {
    if (!isMatrix(m)) fail('Matrice attendue', 'MATRIX_DIM');
    if (m.rows !== m.cols) fail('Le déterminant exige une matrice carrée', 'MATRIX_DIM');
    if (m.rows === 1) return m.data[0];
    if (m.rows === 2) return m.data[0] * m.data[3] - m.data[1] * m.data[2];
    if (m.rows === 3) {
      const d = m.data;
      return d[0] * (d[4] * d[8] - d[5] * d[7])
        - d[1] * (d[3] * d[8] - d[5] * d[6])
        + d[2] * (d[3] * d[7] - d[4] * d[6]);
    }
    return fail('Déterminant pris en charge jusqu’à 3×3', 'MATRIX_DIM');
  }

  function matrixInv(m) {
    if (!isMatrix(m)) fail('Matrice attendue', 'MATRIX_DIM');
    if (m.rows !== m.cols) fail('L’inverse exige une matrice carrée', 'MATRIX_DIM');
    if (m.rows > 3) fail('Inverse pris en charge jusqu’à 3×3', 'MATRIX_DIM');
    const det = matrixDet(m);
    if (Math.abs(det) < 1e-12) fail('Matrice non inversible (déterminant nul)', 'MATRIX_DIM');
    if (m.rows === 1) return matrixCreate(1, 1, [1 / m.data[0]]);
    const out = new Array(m.rows * m.cols);
    for (let r = 0; r < m.rows; r++) {
      for (let c = 0; c < m.cols; c++) {
        const cofactor = (r + c) % 2 === 0 ? 1 : -1;
        out[c * m.cols + r] = (cofactor * matrixDet(matrixMinor(m, r, c))) / det;
      }
    }
    return { type: 'matrix', rows: m.rows, cols: m.cols, data: out };
  }

  function matrixIdentity(n) {
    if (!Number.isInteger(n) || n < 1 || n > 4) fail('Taille de matrice invalide', 'MATRIX_DIM');
    const data = new Array(n * n).fill(0);
    for (let i = 0; i < n; i++) data[i * n + i] = 1;
    return { type: 'matrix', rows: n, cols: n, data: data };
  }

  /* ============================================================
   * 11. Statistiques
   * ============================================================ */

  function quantile(sorted, p) {
    const n = sorted.length;
    if (n === 1) return sorted[0];
    const pos = (n - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function statsSummary(values) {
    if (!Array.isArray(values) || values.length === 0) fail('Série vide', 'DOMAIN');
    const list = values.map(function (v) { return realArg(v); }).slice().sort(function (a, b) { return a - b; });
    const n = list.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += list[i];
    const mean = sum / n;
    let squares = 0;
    for (let i = 0; i < n; i++) squares += (list[i] - mean) * (list[i] - mean);
    const varPop = squares / n;
    const varSample = n > 1 ? squares / (n - 1) : null;
    return {
      n: n,
      sum: sum,
      mean: mean,
      min: list[0],
      max: list[n - 1],
      median: quantile(list, 0.5),
      q1: quantile(list, 0.25),
      q3: quantile(list, 0.75),
      variancePopulation: varPop,
      sdPopulation: Math.sqrt(varPop),
      varianceSample: varSample,
      sdSample: varSample === null ? null : Math.sqrt(varSample)
    };
  }

  function statsRegression(pairs) {
    if (!Array.isArray(pairs) || pairs.length < 2) fail('Régression : au moins deux couples (x ; y) attendus', 'DOMAIN');
    const pts = pairs.map(function (p) {
      if (!Array.isArray(p) || p.length !== 2) fail('Régression : couples (x ; y) attendus', 'DOMAIN');
      return [realArg(p[0]), realArg(p[1])];
    });
    const n = pts.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) { sx += pts[i][0]; sy += pts[i][1]; }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = pts[i][0] - mx;
      const dy = pts[i][1] - my;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    if (sxx === 0) fail('Régression impossible : les valeurs de x sont toutes identiques', 'DOMAIN');
    const slope = sxy / sxx;
    const intercept = my - slope * mx;
    const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
    return {
      n: n, slope: slope, intercept: intercept, r: r, r2: r * r,
      meanX: mx, meanY: my
    };
  }

  function polar(value, angleMode) {
    const z = toComplex(value);
    return {
      modulus: Math.hypot(z.re, z.im),
      argument: radToAngle(Math.atan2(z.im, z.re), normalizeAngleMode(angleMode))
    };
  }

  /* ============================================================
   * 12. Mode immédiat (machine à états pure)
   * ============================================================ */

  const OP_SYMBOLS = { '+': '+', '-': MINUS, '*': '×', '/': '÷', '^': '^' };

  function immInit() {
    return {
      entry: '0',
      accumulator: null,
      pendingOp: null,
      lastOp: null,
      lastOperand: null,
      replace: true,
      error: null,
      expression: ''
    };
  }

  function trimNumber(n) {
    if (!isFinite(n)) fail('Résultat trop grand pour être représenté', 'OVERFLOW');
    if (Object.is(n, -0) || n === 0) return '0';
    const rounded = Number(n.toPrecision(12));
    return String(rounded);
  }

  function entryPretty(entry) {
    let s = String(entry == null ? '0' : entry);
    if (/[eE]/.test(s)) return formatNumber(Number(s));
    s = s.replace('.', ',');
    if (s.charAt(0) === '-') s = MINUS + s.slice(1);
    return s;
  }

  function immCompute(a, op, b) {
    const result = applyBinaryOp(op, Number(a), Number(b));
    if (typeof result !== 'number') fail('Résultat non réel dans ce mode', 'DOMAIN');
    return trimNumber(result);
  }

  function immediateReduce(state, action) {
    const s = Object.assign(immInit(), state || {});
    const act = action || {};
    try {
      switch (act.type) {
        case 'digit': {
          if (s.error) return Object.assign(immInit(), { entry: String(act.value), replace: false });
          const d = String(act.value);
          let entry = s.replace ? d : (s.entry === '0' ? d : s.entry + d);
          if (entry.replace(/[-.]/g, '').length > 15) entry = s.replace ? d : s.entry;
          return Object.assign({}, s, { entry: entry, replace: false, error: null });
        }
        case 'dot': {
          if (s.error) return Object.assign(immInit(), { entry: '0.', replace: false });
          if (s.replace) return Object.assign({}, s, { entry: '0.', replace: false, error: null });
          if (s.entry.indexOf('.') !== -1) return s;
          return Object.assign({}, s, { entry: s.entry + '.' });
        }
        case 'sign': {
          if (s.error) return immInit();
          const v = Number(s.entry);
          return Object.assign({}, s, { entry: trimNumber(v === 0 ? 0 : -v) });
        }
        case 'percent': {
          if (s.error) return immInit();
          return Object.assign({}, s, { entry: trimNumber(Number(s.entry) / 100), replace: false });
        }
        case 'backspace': {
          if (s.error) return immInit();
          if (s.replace) return Object.assign({}, s, { entry: '0' });
          let entry = s.entry.slice(0, -1);
          if (entry === '' || entry === '-') entry = '0';
          return Object.assign({}, s, { entry: entry, replace: entry === '0' });
        }
        case 'clear':
          return immInit();
        case 'op': {
          if (s.error) return immInit();
          const op = act.value;
          if (s.pendingOp && !s.replace) {
            const result = immCompute(s.accumulator, s.pendingOp, s.entry);
            return Object.assign({}, s, {
              entry: result,
              accumulator: result,
              pendingOp: op,
              replace: true
            });
          }
          if (s.pendingOp) return Object.assign({}, s, { pendingOp: op });
          return Object.assign({}, s, {
            accumulator: s.entry,
            pendingOp: op,
            replace: true,
            lastOp: null,
            lastOperand: null
          });
        }
        case 'equals': {
          if (s.error) return immInit();
          if (s.pendingOp) {
            const a = s.accumulator;
            const b = s.replace ? s.accumulator : s.entry;
            const result = immCompute(a, s.pendingOp, b);
            return Object.assign({}, s, {
              entry: result,
              accumulator: null,
              pendingOp: null,
              lastOp: s.pendingOp,
              lastOperand: b,
              replace: true,
              expression: formatNumber(Number(a)) + ' ' + OP_SYMBOLS[s.pendingOp] + ' ' + formatNumber(Number(b)) + ' ='
            });
          }
          if (s.lastOp) {
            const result = immCompute(s.entry, s.lastOp, s.lastOperand);
            return Object.assign({}, s, {
              entry: result,
              replace: true,
              expression: formatNumber(Number(s.entry)) + ' ' + OP_SYMBOLS[s.lastOp] + ' ' + formatNumber(Number(s.lastOperand)) + ' ='
            });
          }
          return Object.assign({}, s, { replace: true, expression: formatNumber(Number(s.entry)) + ' =' });
        }
        default:
          return s;
      }
    } catch (err) {
      const message = err instanceof CalcError ? err.message : 'Erreur de calcul';
      return Object.assign(immInit(), { error: message });
    }
  }

  function immediateView(state) {
    const s = Object.assign(immInit(), state || {});
    let expression = s.expression || '';
    if (s.pendingOp) {
      expression = formatNumber(Number(s.accumulator)) + ' ' + OP_SYMBOLS[s.pendingOp] + ' ' + (s.replace ? '' : entryPretty(s.entry));
    }
    return {
      entry: entryPretty(s.entry),
      expression: expression,
      error: s.error || '',
      pendingOp: s.pendingOp,
      replace: s.replace
    };
  }

  /* ============================================================
   * 13. API publique
   * ============================================================ */

  return {
    CalcError: CalcError,
    constants: { PI: PI, E: E },
    normalize: normalize,
    tokenize: tokenize,
    parse: parse,
    evaluate: evaluate,
    format: format,
    formatNumber: formatNumber,
    toPlain: toPlain,
    applyBinaryOp: applyBinaryOp,
    factorial: factorial,
    angleToRad: angleToRad,
    radToAngle: radToAngle,
    polar: polar,
    isComplex: isComplex,
    isMatrix: isMatrix,
    complex: { make: complex, add: addValues, sub: subValues, mul: mulValues, div: divValues },
    matrix: {
      create: matrixCreate,
      add: matrixAdd,
      sub: matrixSub,
      multiply: matrixMul,
      transpose: matrixTranspose,
      det: matrixDet,
      inverse: matrixInv,
      identity: matrixIdentity
    },
    stats: { summary: statsSummary, regression: statsRegression, quantile: quantile },
    immediate: { init: immInit, reduce: immediateReduce, view: immediateView }
  };
});
