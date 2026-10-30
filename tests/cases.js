/*!
 * tests/cases.js — suite de tests du moteur, partagée navigateur / Node
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalcTestCases = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function cases(Calc) {
    const list = [];
    const test = function (name, fn) { list.push({ name: name, fn: fn }); };

    function show(v) {
      try { return typeof v === 'number' ? String(v) : Calc.toPlain(v); } catch (e) { return String(v); }
    }

    function num(name, input, expected, options, eps) {
      test(name, function () {
        const got = Calc.evaluate(input, options || {}).value;
        if (typeof got !== 'number') throw new Error('attendu un réel, obtenu ' + show(got));
        const tolerance = eps == null ? 1e-9 : eps;
        if (!(Math.abs(got - expected) <= tolerance)) {
          throw new Error('« ' + input + ' » = ' + got + ' (attendu ' + expected + ')');
        }
      });
    }

    function display(name, input, expected, options) {
      test(name, function () {
        const got = Calc.evaluate(input, options || {}).display;
        if (got !== expected) throw new Error('« ' + input + ' » affiche « ' + got + ' » (attendu « ' + expected + ' »)');
      });
    }

    function err(name, input, code, options) {
      test(name, function () {
        try {
          Calc.evaluate(input, options || {});
        } catch (e) {
          if (e.code !== code) throw new Error('code ' + e.code + ' au lieu de ' + code + ' (' + e.message + ')');
          return;
        }
        throw new Error('aucune erreur levée pour « ' + input + ' »');
      });
    }

    function ok(name, fn) { test(name, fn); }

    /* ---------- 1. Priorités et associativité ---------- */
    num('priorité : 2+3×4', '2+3*4', 14);
    num('parenthèses : (2+3)×4', '(2+3)*4', 20);
    num('division à gauche : 10÷2÷5', '10/2/5', 1);
    num('soustraction à gauche : 2−3−4', '2-3-4', -5);
    num('puissance à droite : 2^3^2', '2^3^2', 512);
    num('moins unaire : −2^2', '-2^2', -4);
    num('exposant négatif : 2^−3', '2^-3', 0.125);
    num('signes multiples : −−3', '--3', 3);
    num('modulo opérateur', '10 mod 3', 1);
    num('modulo et priorité', '2+10 mod 4', 4);

    /* ---------- 2. Multiplications implicites ---------- */
    num('2π', '2pi', 2 * Math.PI);
    num('2(3+4)', '2(3+4)', 14);
    num('(1+2)(3+4)', '(1+2)(3+4)', 21);
    num('2sin(30) en degrés', '2sin(30)', 1);
    num('3!2', '3!2', 12);
    num('2e (constante d’Euler)', '2e', 2 * Math.E);
    num('notation 1e3', '1e3', 1000);
    num('1,5e−2', '1.5e-2', 0.015);
    num('racine collée : √9', '√9', 3);
    num('cube collée : ∛27', '∛27', 3);
    num('π entre parenthèses', 'pi(2)', 2 * Math.PI);

    /* ---------- 3. Fonctions ---------- */
    num('sqrt(144)', 'sqrt(144)', 12);
    num('cbrt(27)', 'cbrt(27)', 3);
    num('ln(e)', 'ln(e)', 1);
    num('log(1000)', 'log(1000)', 3);
    num('log2(8)', 'log2(8)', 3);
    num('logb(81;3)', 'logb(81;3)', 4);
    num('sin(30) degrés', 'sin(30)', 0.5);
    num('cos(60) degrés', 'cos(60)', 0.5);
    num('tan(45) degrés', 'tan(45)', 1);
    num('sin(π/2) radians', 'sin(pi/2)', 1, { angle: 'rad' });
    num('cos(90) degrés = 0 exact', 'cos(90)', 0);
    num('sin(180) degrés = 0 exact', 'sin(180)', 0);
    num('asin(0,5) degrés', 'asin(0.5)', 30);
    num('asin(0,5) radians', 'asin(0.5)', Math.PI / 6, { angle: 'rad' });
    num('atan(1) degrés', 'atan(1)', 45);
    num('grads : sin(100)', 'sin(100)', 1, { angle: 'grad' });
    num('sinh(0)', 'sinh(0)', 0);
    num('cosh(0)', 'cosh(0)', 1);
    num('tanh(0)', 'tanh(0)', 0);
    num('asinh(0)', 'asinh(0)', 0);
    num('acosh(1)', 'acosh(1)', 0);
    num('atanh(0)', 'atanh(0)', 0);
    num('nthroot(27;3)', 'nthroot(27;3)', 3);
    num('nthroot(−8;3)', 'nthroot(-8;3)', -2);
    num('exp(0)', 'exp(0)', 1);

    /* ---------- 4. Combinatoire et divers ---------- */
    num('5!', '5!', 120);
    num('fact(5)', 'fact(5)', 120);
    num('0!', '0!', 1);
    num('nCr(5;2)', 'nCr(5;2)', 10);
    num('nPr(5;2)', 'nPr(5;2)', 20);
    num('mod(10;3)', 'mod(10;3)', 1);
    num('gcd(12;18)', 'gcd(12;18)', 6);
    num('lcm(4;6)', 'lcm(4;6)', 12);
    num('min(3;−1;7)', 'min(3;-1;7)', -1);
    num('max(3;−1;7)', 'max(3;-1;7)', 7);
    num('round(2,567;2)', 'round(2.567;2)', 2.57);
    num('floor(−2,5)', 'floor(-2.5)', -3);
    num('ceil(2,1)', 'ceil(2.1)', 3);
    num('sign(−4)', 'sign(-4)', -1);
    num('abs(−3)', 'abs(-3)', 3);
    ok('rand() dans [0,1[', function () {
      const v = Calc.evaluate('rand()').value;
      if (!(v >= 0 && v < 1)) throw new Error('valeur hors intervalle : ' + v);
    });

    /* ---------- 5. Conversions ---------- */
    num('dms(12;30;0)', 'dms(12;30;0)', 12.5);
    num('dms(−12;30;0)', 'dms(-12;30;0)', -12.5);
    num('deg2rad(180)', 'deg2rad(180)', Math.PI);
    num('rad2deg(π)', 'rad2deg(pi)', 180);
    num('c2f(100)', 'c2f(100)', 212);
    num('f2c(32)', 'f2c(32)', 0);
    num('km2mi(1,609344)', 'km2mi(1.609344)', 1);
    num('kg2lb(0,45359237)', 'kg2lb(0.45359237)', 1);
    num('m2ft(0,3048)', 'm2ft(0.3048)', 1);

    /* ---------- 6. Erreurs ---------- */
    err('division par zéro', '1/0', 'DIV_ZERO');
    err('logarithme de zéro', 'ln(0)', 'DOMAIN');
    err('logarithme négatif', 'ln(-1)', 'DOMAIN');
    err('racine carrée négative', 'sqrt(-1)', 'DOMAIN');
    err('arc sinus hors domaine', 'asin(2)', 'DOMAIN');
    err('atanh(1)', 'atanh(1)', 'DOMAIN');
    err('puissance non réelle', '(-8)^(1/3)', 'DOMAIN');
    err('factorielle non entière', '3.5!', 'DOMAIN');
    err('factorielle trop grande', '171!', 'OVERFLOW');
    err('fonction inconnue', 'foo(1)', 'UNKNOWN_FUNCTION');
    err('expression incomplète', '2+', 'SYNTAX');
    err('parenthèse fermée en trop', '(2+3))', 'SYNTAX');
    err('parenthèse ouverte non fermée', '(2+3', 'SYNTAX');
    err('argument manquant', 'sin()', 'ARITY');
    err('trop d’arguments', 'log(8;2;3)', 'ARITY');
    err('tangente indéfinie', 'tan(90)', 'DOMAIN');
    err('modulo par zéro', '5 mod 0', 'DIV_ZERO');
    err('expression vide', '', 'SYNTAX');

    /* ---------- 7. Constantes, Ans, mémoire ---------- */
    display('π affiché avec 12 chiffres', 'pi', '3,14159265359');
    num('constante ans', 'ans+1', 42, { ans: 41 });
    num('constante mem', 'mem*2', 42, { memory: 21 });
    num('i² = −1', 'i^2', -1);

    /* ---------- 8. Complexes ---------- */
    ok('(3+4i)+(1−2i)', function () {
      const v = Calc.evaluate('(3+4i)+(1-2i)').value;
      if (!Calc.isComplex(v) || v.re !== 4 || v.im !== 2) throw new Error('obtenu ' + show(v));
    });
    ok('(3+4i)×(1−2i)', function () {
      const v = Calc.evaluate('(3+4i)*(1-2i)').value;
      if (!Calc.isComplex(v) || Math.abs(v.re - 11) > 1e-9 || Math.abs(v.im + 2) > 1e-9) throw new Error('obtenu ' + show(v));
    });
    ok('(3+4i)÷(1−2i)', function () {
      const v = Calc.evaluate('(3+4i)/(1-2i)').value;
      if (!Calc.isComplex(v) || Math.abs(v.re + 1) > 1e-9 || Math.abs(v.im - 2) > 1e-9) throw new Error('obtenu ' + show(v));
    });
    num('module |3+4i|', 'abs(3+4i)', 5);
    num('argument arg(1+i) en degrés', 'arg(1+i)', 45);
    ok('conjugué', function () {
      const v = Calc.evaluate('conj(3-4i)').value;
      if (!Calc.isComplex(v) || v.re !== 3 || v.im !== 4) throw new Error('obtenu ' + show(v));
    });
    num('partie réelle', 're(2+5i)', 2);
    num('partie imaginaire', 'im(2+5i)', 5);
    ok('(1+i)² = 2i', function () {
      const v = Calc.evaluate('(1+i)^2').value;
      if (!Calc.isComplex(v) || Math.abs(v.re) > 1e-9 || Math.abs(v.im - 2) > 1e-9) throw new Error('obtenu ' + show(v));
    });
    ok('forme polaire de 3+4i', function () {
      const p = Calc.polar(Calc.evaluate('3+4i').value, 'deg');
      if (Math.abs(p.modulus - 5) > 1e-9 || Math.abs(p.argument - 53.1301023542) > 1e-9) {
        throw new Error('module ' + p.modulus + ', argument ' + p.argument);
      }
    });

    /* ---------- 9. Formatage ---------- */
    display('0,1+0,2 sans bruit flottant', '0.1+0.2', '0,3');
    display('milliers groupés', '1234567', '1\u202F234\u202F567');
    display('négatif avec virgule', '-1234.5', '\u22121\u202F234,5');
    display('notation scientifique positive', '1e13', '1×10¹³');
    display('notation scientifique négative', '1e-10', '1×10⁻¹⁰');
    display('zéro', '0', '0');
    display('moins zéro', '-0', '0');
    display('décimale simple', '2.5', '2,5');
    display('tiers arrondi à 12 chiffres', '1/3', '0,333333333333');
    ok('toPlain sans regroupement', function () {
      if (Calc.toPlain(1234.5) !== '1234.5') throw new Error('obtenu ' + Calc.toPlain(1234.5));
    });
    ok('toPlain complexe', function () {
      if (Calc.toPlain(Calc.evaluate('3+4i').value) !== '3+4i') throw new Error('obtenu ' + Calc.toPlain(Calc.evaluate('3+4i').value));
    });

    /* ---------- 10. Matrices ---------- */
    function mat2(data) { return Calc.matrix.create(2, 2, data); }
    ok('déterminant 2×2', function () {
      const d = Calc.matrix.det(mat2([1, 2, 3, 4]));
      if (d !== -2) throw new Error('obtenu ' + d);
    });
    ok('déterminant 3×3', function () {
      const d = Calc.matrix.det(Calc.matrix.create(3, 3, [1, 2, 3, 0, 1, 4, 5, 6, 0]));
      if (d !== 1) throw new Error('obtenu ' + d);
    });
    ok('inverse 2×2', function () {
      const inv = Calc.matrix.inverse(mat2([1, 2, 3, 4]));
      const expected = [-2, 1, 1.5, -0.5];
      inv.data.forEach(function (v, i) { if (Math.abs(v - expected[i]) > 1e-9) throw new Error('indice ' + i + ' : ' + v); });
    });
    ok('A × A⁻¹ = I', function () {
      const a = mat2([1, 2, 3, 4]);
      const prod = Calc.matrix.multiply(a, Calc.matrix.inverse(a));
      const expected = [1, 0, 0, 1];
      prod.data.forEach(function (v, i) { if (Math.abs(v - expected[i]) > 1e-9) throw new Error('indice ' + i + ' : ' + v); });
    });
    ok('transposée', function () {
      const t = Calc.matrix.transpose(Calc.matrix.create(2, 3, [1, 2, 3, 4, 5, 6]));
      if (t.rows !== 3 || t.cols !== 2 || t.data.join(',') !== '1,4,2,5,3,6') throw new Error(t.data.join(','));
    });
    ok('dimensions incompatibles', function () {
      try {
        Calc.matrix.add(mat2([1, 2, 3, 4]), mat2([1, 2, 3, 4]));
      } catch (e) {
        throw new Error('ne devrait pas échouer : ' + e.message);
      }
      try {
        Calc.matrix.add(Calc.matrix.create(2, 3, [1, 2, 3, 4, 5, 6]), mat2([1, 2, 3, 4]));
        throw new Error('erreur attendue');
      } catch (e) {
        if (e.code !== 'MATRIX_DIM') throw e;
      }
    });
    ok('matrice singulière non inversible', function () {
      try {
        Calc.matrix.inverse(mat2([1, 2, 2, 4]));
        throw new Error('erreur attendue');
      } catch (e) {
        if (e.code !== 'MATRIX_DIM') throw e;
      }
    });

    /* ---------- 11. Statistiques ---------- */
    ok('statistiques descriptives', function () {
      const s = Calc.stats.summary([2, 4, 4, 4, 5, 5, 7, 9]);
      if (s.n !== 8 || s.mean !== 5 || s.median !== 4.5 || s.q1 !== 4 || s.q3 !== 5.5) {
        throw new Error(JSON.stringify(s));
      }
      if (Math.abs(s.sdPopulation - 2) > 1e-9) throw new Error('σ = ' + s.sdPopulation);
      if (Math.abs(s.sdSample - Math.sqrt(32 / 7)) > 1e-9) throw new Error('s = ' + s.sdSample);
    });
    ok('régression linéaire y = 2x + 1', function () {
      const r = Calc.stats.regression([[1, 3], [2, 5], [3, 7]]);
      if (Math.abs(r.slope - 2) > 1e-9 || Math.abs(r.intercept - 1) > 1e-9 || Math.abs(r.r - 1) > 1e-9) {
        throw new Error(JSON.stringify(r));
      }
    });
    ok('série vide refusée', function () {
      try { Calc.stats.summary([]); throw new Error('erreur attendue'); }
      catch (e) { if (e.code !== 'DOMAIN') throw e; }
    });
    ok('régression avec x constant refusée', function () {
      try { Calc.stats.regression([[2, 1], [2, 3]]); throw new Error('erreur attendue'); }
      catch (e) { if (e.code !== 'DOMAIN') throw e; }
    });

    /* ---------- 12. Mode immédiat ---------- */
    function runImmediate(actions) {
      let s = Calc.immediate.init();
      actions.forEach(function (a) { s = Calc.immediate.reduce(s, a); });
      return s;
    }
    function dig(text) {
      return text.split('').map(function (c) {
        return c === '.' ? { type: 'dot' } : { type: 'digit', value: c };
      });
    }
    ok('mode immédiat : saisie 12', function () {
      const s = runImmediate(dig('12'));
      if (s.entry !== '12') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : 12 + 3 =', function () {
      const s = runImmediate(dig('12').concat([{ type: 'op', value: '+' }], dig('3'), [{ type: 'equals' }]));
      if (s.entry !== '15') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : = répété', function () {
      let s = runImmediate(dig('2').concat([{ type: 'op', value: '+' }], dig('3'), [{ type: 'equals' }]));
      s = Calc.immediate.reduce(s, { type: 'equals' });
      s = Calc.immediate.reduce(s, { type: 'equals' });
      if (s.entry !== '11') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : pas de priorité (2+3×4=20)', function () {
      const s = runImmediate(dig('2').concat(
        [{ type: 'op', value: '+' }], dig('3'), [{ type: 'op', value: '*' }], dig('4'), [{ type: 'equals' }]
      ));
      if (s.entry !== '20') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : division par zéro', function () {
      const s = runImmediate(dig('8').concat([{ type: 'op', value: '/' }], dig('0'), [{ type: 'equals' }]));
      if (!s.error) throw new Error('erreur attendue');
    });
    ok('mode immédiat : retour arrière', function () {
      const s = runImmediate(dig('123').concat([{ type: 'backspace' }]));
      if (s.entry !== '12') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : signe', function () {
      const s = runImmediate(dig('5').concat([{ type: 'sign' }]));
      if (s.entry !== '-5') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : pourcentage', function () {
      const s = runImmediate(dig('50').concat([{ type: 'percent' }]));
      if (s.entry !== '0.5') throw new Error('obtenu ' + s.entry);
    });
    ok('mode immédiat : effacer', function () {
      const s = runImmediate(dig('12').concat([{ type: 'op', value: '+' }, { type: 'clear' }]));
      if (s.entry !== '0' || s.pendingOp !== null) throw new Error('état non réinitialisé');
    });
    ok('mode immédiat : virgule unique', function () {
      const s = runImmediate(dig('1.2.3'));
      if (s.entry !== '1.23') throw new Error('obtenu ' + s.entry);
    });

    return list;
  }

  return { cases: cases };
});
