/*!
 * app.js — interface de la Calculatrice Scientifique
 * Dépend de engine.js (window.CalcEngine)
 */
(function () {
  'use strict';

  var Calc = window.CalcEngine;
  if (!Calc) {
    document.body.textContent = 'Erreur : le moteur de calcul (engine.js) est introuvable.';
    return;
  }

  /* ============================================================
   * Utilitaires
   * ============================================================ */

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  var STORE = {
    theme: 'calc.theme',
    mode: 'calc.mode',
    angle: 'calc.angle',
    memory: 'calc.memory',
    history: 'calc.history'
  };
  var HISTORY_MAX = 100;
  var ANGLES = ['deg', 'rad', 'grad'];
  var ANGLE_UNITS = { deg: '°', rad: ' rad', grad: ' gon' };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* stockage indisponible */ }
  }

  function formatTime(timestamp) {
    try {
      return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      return '';
    }
  }

  function scrollToEnd(element) {
    if (element) element.scrollLeft = element.scrollWidth;
  }

  function angleUnit() {
    return ANGLE_UNITS[state.angle] || '°';
  }

  /* ============================================================
   * État persistant
   * ============================================================ */

  var THEMES = ['dark', 'light', 'amber'];
  var THEME_COLORS = { dark: '#0b1020', light: '#eef2fb', amber: '#140d07' };
  var storedTheme = load(STORE.theme, null);
  var systemLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

  var state = {
    theme: THEMES.indexOf(storedTheme) !== -1 ? storedTheme : (systemLight ? 'light' : 'dark'),
    mode: load(STORE.mode, 'expression') === 'immediate' ? 'immediate' : 'expression',
    angle: ANGLES.indexOf(load(STORE.angle, 'deg')) !== -1 ? load(STORE.angle, 'deg') : 'deg',
    second: false,
    tab: 'calc',
    expr: '',
    preview: '',
    lastResult: null,
    justEvaluated: false,
    error: '',
    ans: 0,
    memory: Number(load(STORE.memory, 0)) || 0,
    history: [],
    immediate: Calc.immediate.init(),
    matrix: {
      size: 2,
      a: ['1', '2', '3', '4'],
      b: ['5', '6', '7', '8'],
      label: '',
      result: null
    }
  };

  var storedHistory = load(STORE.history, []);
  if (Array.isArray(storedHistory)) {
    state.history = storedHistory.filter(function (item) {
      return item && typeof item.expr === 'string' && typeof item.display === 'string' && typeof item.plain === 'string';
    }).slice(0, HISTORY_MAX);
  }

  /* ============================================================
   * Références DOM
   * ============================================================ */

  var ui = {
    root: document.documentElement,
    keypad: $('#keypad'),
    exprLine: $('#exprLine'),
    resultLine: $('#resultLine'),
    errorLine: $('#errorLine'),
    angleChip: $('#angleChip'),
    secondChip: $('#secondChip'),
    memChip: $('#memChip'),
    displayHint: $('#displayHint'),
    copyBtn: $('#copyBtn'),
    modeButtons: $$('.mode-switch button'),
    tabs: $$('.tab'),
    panels: $$('.tab-panel'),
    historyPanel: $('#historyPanel'),
    historyToggle: $('#historyToggle'),
    historyList: $('#historyList'),
    historyEmpty: $('#historyEmpty'),
    historyCount: $('#historyCount'),
    closeHistory: $('#closeHistory'),
    backdrop: $('#backdrop'),
    exportBtn: $('#exportBtn'),
    clearHistoryBtn: $('#clearHistoryBtn'),
    themeToggle: $('#themeToggle'),
    helpToggle: $('#helpToggle'),
    helpDialog: $('#helpDialog'),
    toast: $('#toast'),
    complexInput: $('#complexInput'),
    complexEval: $('#complexEval'),
    complexClear: $('#complexClear'),
    complexRect: $('#complexRect'),
    complexPolar: $('#complexPolar'),
    complexDetail: $('#complexDetail'),
    complexError: $('#complexError'),
    matrixSize: $('#matrixSize'),
    matrixA: $('#matrixA'),
    matrixB: $('#matrixB'),
    matrixReset: $('#matrixReset'),
    matrixResult: $('#matrixResult'),
    matrixResultLabel: $('#matrixResultLabel'),
    matrixError: $('#matrixError'),
    statsInput: $('#statsInput'),
    statsCompute: $('#statsCompute'),
    statsExample: $('#statsExample'),
    statsSummary: $('#statsSummary'),
    statsRegressionBox: $('#statsRegressionBox'),
    statsRegression: $('#statsRegression'),
    statsEquation: $('#statsEquation'),
    statsError: $('#statsError')
  };

  /* ============================================================
   * Pavé : définitions et dispositions
   * ============================================================ */

  var KEYS = {
    shift: { label: '2nd', cls: 'k-fn k-shift', action: 'shift', aria: '2nd — secondes fonctions' },
    angle: { label: 'DEG', cls: 'k-fn', action: 'angle', aria: 'DEG — changer l’unité d’angle' },
    mc: { label: 'MC', cls: 'k-fn', action: 'mc', aria: 'MC — effacer la mémoire' },
    mr: { label: 'MR', cls: 'k-fn', action: 'mr', aria: 'MR — rappeler la mémoire' },
    mplus: { label: 'M+', cls: 'k-fn', action: 'mplus', aria: 'M+ — ajouter à la mémoire' },
    mminus: { label: 'M−', cls: 'k-fn', action: 'mminus', aria: 'M− — soustraire de la mémoire' },

    sin: { label: 'sin', cls: 'k-fn', insert: 'sin(' },
    cos: { label: 'cos', cls: 'k-fn', insert: 'cos(' },
    tan: { label: 'tan', cls: 'k-fn', insert: 'tan(' },
    ln: { label: 'ln', cls: 'k-fn', insert: 'ln(' },
    log: { label: 'log', cls: 'k-fn', insert: 'log(' },
    clear: { label: 'C', cls: 'k-fn k-danger', action: 'clear', aria: 'C — tout effacer' },

    square: { label: 'x²', cls: 'k-fn', insert: '²', aria: 'x² — carré' },
    power: { label: 'xʸ', cls: 'k-fn', insert: '^', aria: 'xʸ — puissance' },
    sqrt: { label: '√', cls: 'k-fn', insert: '√(', aria: '√ — racine carrée' },
    lparen: { label: '(', cls: 'k-fn', insert: '(' },
    rparen: { label: ')', cls: 'k-fn', insert: ')' },
    back: { label: '⌫', cls: 'k-fn', action: 'backspace', aria: '⌫ — effacer un caractère' },

    div: { label: '÷', cls: 'k-op', insert: '÷', aria: '÷ — diviser' },
    mul: { label: '×', cls: 'k-op', insert: '×', aria: '× — multiplier' },
    sub: { label: '−', cls: 'k-op', insert: '−', aria: '− — soustraire' },
    add: { label: '+', cls: 'k-op', insert: '+', aria: '+ — additionner' },

    fact: { label: 'n!', cls: 'k-fn', insert: '!', aria: 'n! — factorielle' },
    percent: { label: '%', cls: 'k-fn', insert: '%', aria: '% — pourcentage' },
    pi: { label: 'π', cls: 'k-fn', insert: 'π', aria: 'π — constante pi' },
    econst: { label: 'e', cls: 'k-fn', insert: 'e', aria: 'Constante d’Euler' },
    ans: { label: 'Ans', cls: 'k-fn', insert: 'Ans', aria: 'Ans — dernier résultat' },
    exp: { label: 'EXP', cls: 'k-fn', insert: '×10^(', aria: 'EXP — exposant décimal' },

    dot: { label: ',', cls: 'k-num', insert: ',', aria: ', — virgule décimale' },
    sign: { label: '±', cls: 'k-fn', action: 'sign', aria: '± — changer le signe' },
    equals: { label: '=', cls: 'k-eq', action: 'equals', rows: 2, aria: '= — calculer' },

    asin: { label: 'sin⁻¹', cls: 'k-fn', insert: 'asin(' },
    acos: { label: 'cos⁻¹', cls: 'k-fn', insert: 'acos(' },
    atan: { label: 'tan⁻¹', cls: 'k-fn', insert: 'atan(' },
    expbtn: { label: 'eˣ', cls: 'k-fn', insert: 'e^(', aria: 'eˣ — exponentielle' },
    tenpow: { label: '10ˣ', cls: 'k-fn', insert: '10^(', aria: '10ˣ — puissance de dix' },
    cube: { label: 'x³', cls: 'k-fn', insert: '³', aria: 'x³ — cube' },
    nthroot: { label: 'ⁿ√x', cls: 'k-fn', insert: 'nthroot(', aria: 'ⁿ√x — racine nième' },
    cbrt: { label: '∛x', cls: 'k-fn', insert: '∛(', aria: '∛x — racine cubique' },
    absbtn: { label: '|x|', cls: 'k-fn', insert: 'abs(', aria: '|x| — valeur absolue' },
    modbtn: { label: 'mod', cls: 'k-fn', insert: ' mod ', aria: 'mod — modulo' },
    ncr: { label: 'nCr', cls: 'k-fn', insert: 'nCr(' },
    npr: { label: 'nPr', cls: 'k-fn', insert: 'nPr(' },
    sinh: { label: 'sinh', cls: 'k-fn', insert: 'sinh(' },
    cosh: { label: 'cosh', cls: 'k-fn', insert: 'cosh(' },
    tanh: { label: 'tanh', cls: 'k-fn', insert: 'tanh(' }
  };

  '0123456789'.split('').forEach(function (digit) {
    KEYS[digit] = { label: digit, cls: 'k-num', insert: digit, aria: 'Chiffre ' + digit };
  });

  var LAYOUT_NORMAL = [
    ['shift', 'angle', 'mc', 'mr', 'mplus', 'mminus'],
    ['sin', 'cos', 'tan', 'ln', 'log', 'clear'],
    ['square', 'power', 'sqrt', 'lparen', 'rparen', 'back'],
    ['7', '8', '9', 'div', 'fact', 'percent'],
    ['4', '5', '6', 'mul', 'pi', 'econst'],
    ['1', '2', '3', 'sub', 'ans', 'equals'],
    ['0', 'dot', 'sign', 'add', 'exp']
  ];

  var LAYOUT_SECOND = [
    ['shift', 'angle', 'mc', 'mr', 'mplus', 'mminus'],
    ['asin', 'acos', 'atan', 'expbtn', 'tenpow', 'clear'],
    ['cube', 'nthroot', 'cbrt', 'absbtn', 'modbtn', 'back'],
    ['7', '8', '9', 'div', 'ncr', 'npr'],
    ['4', '5', '6', 'mul', 'sinh', 'cosh'],
    ['1', '2', '3', 'sub', 'tanh', 'equals'],
    ['0', 'dot', 'sign', 'add', 'exp']
  ];

  function renderKeypad() {
    if (!ui.keypad) return;
    var layout = state.second ? LAYOUT_SECOND : LAYOUT_NORMAL;
    ui.keypad.innerHTML = '';

    layout.forEach(function (row, rowIndex) {
      row.forEach(function (id, colIndex) {
        var def = KEYS[id];
        if (!def) return;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'key ' + def.cls;
        button.dataset.key = id;
        button.textContent = id === 'angle' ? state.angle.toUpperCase() : def.label;
        var aria = def.aria || def.label;
        if (id === 'angle') aria = state.angle.toUpperCase() + ' — changer l’unité d’angle';
        button.setAttribute('aria-label', aria);
        button.style.gridRow = (rowIndex + 1) + ' / span ' + (def.rows || 1);
        button.style.gridColumn = String(colIndex + 1);

        if (id === 'shift') {
          button.classList.toggle('is-on', state.second);
          button.setAttribute('aria-pressed', state.second ? 'true' : 'false');
        }
        if (id === 'angle') {
          button.title = 'Unité d’angle : ' + state.angle.toUpperCase();
        }

        button.addEventListener('click', function () { onKey(id); });
        ui.keypad.appendChild(button);
      });
    });
  }

  /* ============================================================
   * Afficheur
   * ============================================================ */

  function contextOptions() {
    return { angle: state.angle, ans: state.ans, memory: state.memory };
  }

  function syncChips() {
    if (ui.angleChip) ui.angleChip.textContent = state.angle.toUpperCase();
    if (ui.secondChip) ui.secondChip.hidden = !state.second;
    if (ui.memChip) {
      ui.memChip.hidden = state.memory === 0;
      ui.memChip.title = 'Mémoire : ' + Calc.formatNumber(state.memory);
    }
  }

  function updateHint() {
    if (!ui.displayHint) return;
    ui.displayHint.textContent = state.mode === 'immediate'
      ? 'Mode poche : = répété rejoue la dernière opération'
      : 'Tapez une expression, Entrée pour calculer';
  }

  function renderDisplay() {
    if (!ui.resultLine) return;

    if (state.mode === 'immediate') {
      var view = Calc.immediate.view(state.immediate);
      ui.exprLine.textContent = view.expression || ' ';
      ui.resultLine.textContent = view.entry;
      ui.resultLine.classList.remove('is-preview');
      ui.errorLine.hidden = !view.error;
      ui.errorLine.textContent = view.error || '';
      ui.copyBtn.disabled = !!view.error;
      scrollToEnd(ui.exprLine);
      scrollToEnd(ui.resultLine);
      syncChips();
      return;
    }

    ui.exprLine.textContent = state.expr || '0';

    var text = '0';
    var preview = false;
    if (state.justEvaluated && state.lastResult != null) {
      text = Calc.format(state.lastResult);
    } else if (state.preview && state.expr.trim()) {
      text = state.preview;
      preview = true;
    } else if (state.lastResult != null) {
      text = Calc.format(state.lastResult);
    }

    ui.resultLine.textContent = text;
    ui.resultLine.classList.toggle('is-preview', preview);
    ui.errorLine.hidden = !state.error;
    ui.errorLine.textContent = state.error || '';
    ui.copyBtn.disabled = currentResultValue() == null;
    scrollToEnd(ui.exprLine);
    scrollToEnd(ui.resultLine);
    syncChips();
  }

  function syncModeButtons() {
    ui.modeButtons.forEach(function (button) {
      var active = button.dataset.mode === state.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    updateHint();
  }

  /* ============================================================
   * Mode expression
   * ============================================================ */

  function currentResultValue() {
    if (state.mode === 'immediate') {
      var view = Calc.immediate.view(state.immediate);
      if (view.error) return null;
      var numeric = Number(state.immediate.entry);
      return isFinite(numeric) ? numeric : null;
    }
    if (state.justEvaluated && state.lastResult != null) return state.lastResult;
    if (state.expr.trim()) {
      try { return Calc.evaluate(state.expr, contextOptions()).value; } catch (err) { return null; }
    }
    return state.lastResult;
  }

  function updatePreview() {
    var input = state.expr.trim();
    state.error = '';
    if (!input) {
      state.preview = '';
      renderDisplay();
      return;
    }
    try {
      state.preview = Calc.evaluate(input, contextOptions()).display;
    } catch (err) {
      // Une expression en cours de frappe est incomplète : on n'affiche pas d'erreur.
      state.preview = '';
    }
    renderDisplay();
  }

  function isContinuationToken(token) {
    var text = String(token).trim();
    if (!text) return false;
    if ('+−×÷^!%²³'.indexOf(text.charAt(0)) !== -1) return true;
    if (text.charAt(0) === '-') return true;
    return text === 'mod';
  }

  function pressToken(token) {
    if (state.mode === 'immediate') {
      immediateToken(token);
      return;
    }

    var expression = state.expr;
    if (state.justEvaluated) {
      var continueWithResult = isContinuationToken(token) && state.lastResult != null;
      expression = continueWithResult ? Calc.toPlain(state.lastResult) : '';
      state.justEvaluated = false;
    }

    state.expr = expression + token;
    updatePreview();
  }

  function equals() {
    if (state.mode === 'immediate') {
      var before = Calc.immediate.view(state.immediate);
      state.immediate = Calc.immediate.reduce(state.immediate, { type: 'equals' });
      var after = Calc.immediate.view(state.immediate);
      if (!after.error && after.entry !== before.entry) {
        addHistory(before.expression || before.entry, after.entry, state.immediate.entry);
      }
      renderDisplay();
      return;
    }

    var input = state.expr.trim();
    if (!input) return;
    try {
      var result = Calc.evaluate(input, contextOptions());
      state.lastResult = result.value;
      state.preview = result.display;
      state.error = '';
      state.justEvaluated = true;
      if (typeof result.value === 'number' && isFinite(result.value)) state.ans = result.value;
      addHistory(input, result.display, Calc.toPlain(result.value));
      renderDisplay();
    } catch (err) {
      state.error = err.message;
      state.justEvaluated = false;
      renderDisplay();
    }
  }

  function clearAll() {
    state.expr = '';
    state.preview = '';
    state.lastResult = null;
    state.error = '';
    state.justEvaluated = false;
    state.immediate = Calc.immediate.init();
    renderDisplay();
  }

  function backspace() {
    if (state.mode === 'immediate') {
      state.immediate = Calc.immediate.reduce(state.immediate, { type: 'backspace' });
      renderDisplay();
      return;
    }
    state.expr = state.expr.slice(0, -1);
    state.justEvaluated = false;
    state.lastResult = null;
    updatePreview();
  }

  function toggleSign() {
    if (state.mode === 'immediate') {
      state.immediate = Calc.immediate.reduce(state.immediate, { type: 'sign' });
      renderDisplay();
      return;
    }

    if (state.justEvaluated && state.lastResult != null) {
      state.expr = '-(' + Calc.toPlain(state.lastResult) + ')';
      state.justEvaluated = false;
      state.lastResult = null;
      updatePreview();
      return;
    }

    var expression = state.expr.trim();
    if (!expression) {
      state.expr = '-';
    } else if (/^-\([\s\S]*\)$/.test(expression)) {
      state.expr = expression.slice(2, -1);
    } else {
      state.expr = '-(' + expression + ')';
    }
    updatePreview();
  }

  /* ============================================================
   * Mode immédiat
   * ============================================================ */

  function setImmediateEntry(value) {
    state.immediate = Object.assign({}, state.immediate, {
      entry: Calc.toPlain(value),
      replace: true,
      error: null
    });
    renderDisplay();
  }

  function applyImmediateExpression(expression) {
    try {
      var output = Calc.evaluate(expression, contextOptions()).value;
      if (typeof output !== 'number' || !isFinite(output)) {
        throw new Error('Résultat non réel dans ce mode');
      }
      state.immediate = Object.assign({}, state.immediate, {
        entry: Calc.toPlain(output),
        replace: true,
        error: null
      });
    } catch (err) {
      state.immediate = Object.assign({}, state.immediate, { error: err.message });
    }
    renderDisplay();
  }

  function switchToExpression(prefill) {
    state.mode = 'expression';
    state.expr = prefill;
    state.lastResult = null;
    state.justEvaluated = false;
    state.error = '';
    save(STORE.mode, 'expression');
    syncModeButtons();
    updatePreview();
    toast('Mode expression pour cette fonction');
  }

  function immediateToken(token) {
    var entryText = state.immediate.entry;

    if (/^[0-9]$/.test(token)) {
      state.immediate = Calc.immediate.reduce(state.immediate, { type: 'digit', value: token });
      renderDisplay();
      return;
    }
    if (token === ',') {
      state.immediate = Calc.immediate.reduce(state.immediate, { type: 'dot' });
      renderDisplay();
      return;
    }
    if (token === '÷') { reduceOp('/'); return; }
    if (token === '×') { reduceOp('*'); return; }
    if (token === '−') { reduceOp('-'); return; }
    if (token === '+') { reduceOp('+'); return; }
    if (token === '^') { reduceOp('^'); return; }
    if (token === '%') {
      state.immediate = Calc.immediate.reduce(state.immediate, { type: 'percent' });
      renderDisplay();
      return;
    }
    if (token === '!' || token === '²' || token === '³') {
      var suffix = token === '!' ? 'fact(' + entryText + ')' : '(' + entryText + ')^' + (token === '²' ? '2' : '3');
      applyImmediateExpression(suffix);
      return;
    }
    if (token === 'π') { setImmediateEntry(Calc.constants.PI); return; }
    if (token === 'e') { setImmediateEntry(Calc.constants.E); return; }
    if (token === 'Ans') { setImmediateEntry(state.ans); return; }

    if (token === '×10^(') {
      switchToExpression(entryText + '×10^(');
      return;
    }
    if (token === ' mod ' || token === '(' || token === ')' || token === ';') {
      switchToExpression(entryText + token);
      return;
    }
    if (token === 'nthroot(' || token === 'nCr(' || token === 'nPr(') {
      switchToExpression(token + entryText + ';');
      return;
    }

    if (token === '√(') { applyImmediateExpression('sqrt(' + entryText + ')'); return; }
    if (token === '∛(') { applyImmediateExpression('cbrt(' + entryText + ')'); return; }
    if (token === 'e^(') { applyImmediateExpression('e^(' + entryText + ')'); return; }
    if (token === '10^(') { applyImmediateExpression('10^(' + entryText + ')'); return; }

    if (/^[A-Za-z][A-Za-z0-9]*\($/.test(token)) {
      applyImmediateExpression(token.slice(0, -1) + '(' + entryText + ')');
      return;
    }

    // Tout le reste (fonctions à deux arguments) se fait mieux en mode expression.
    switchToExpression(entryText + token);
  }

  function reduceOp(op) {
    state.immediate = Calc.immediate.reduce(state.immediate, { type: 'op', value: op });
    renderDisplay();
  }

  function setMode(mode) {
    if (mode !== 'expression' && mode !== 'immediate') return;
    if (mode === state.mode) return;

    if (mode === 'immediate') {
      var seed = 0;
      if (state.expr.trim()) {
        try {
          var result = Calc.evaluate(state.expr, contextOptions()).value;
          if (typeof result === 'number' && isFinite(result)) seed = result;
        } catch (err) { /* on garde 0 */ }
      } else if (typeof state.lastResult === 'number' && isFinite(state.lastResult)) {
        seed = state.lastResult;
      }
      state.immediate = Object.assign(Calc.immediate.init(), {
        entry: Calc.toPlain(seed),
        replace: true
      });
      state.error = '';
    } else {
      state.expr = state.immediate.entry && state.immediate.entry !== '0' ? state.immediate.entry : '';
      state.preview = '';
      state.error = '';
      state.lastResult = null;
      state.justEvaluated = false;
    }

    state.mode = mode;
    save(STORE.mode, mode);
    syncModeButtons();
    if (mode === 'expression') updatePreview(); else renderDisplay();
  }

  /* ============================================================
   * Angle et mémoire
   * ============================================================ */

  function cycleAngle() {
    var index = ANGLES.indexOf(state.angle);
    state.angle = ANGLES[(index + 1) % ANGLES.length];
    save(STORE.angle, state.angle);
    syncChips();
    renderKeypad();
    if (state.mode === 'expression') updatePreview(); else renderDisplay();
    if (state.tab === 'complex') complexCompute();
    toast('Unité d’angle : ' + state.angle.toUpperCase());
  }

  function currentNumericValue() {
    var value = currentResultValue();
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  function addMemory(sign) {
    var value = currentNumericValue();
    if (value == null) {
      toast('Aucune valeur réelle à mémoriser');
      return;
    }
    state.memory = Number((state.memory + sign * value).toPrecision(12));
    if (Object.is(state.memory, -0)) state.memory = 0;
    save(STORE.memory, state.memory);
    renderDisplay();
    toast('Mémoire : ' + Calc.formatNumber(state.memory));
  }

  function clearMemory() {
    state.memory = 0;
    save(STORE.memory, 0);
    renderDisplay();
    toast('Mémoire effacée');
  }

  function recallMemory() {
    if (state.mode === 'immediate') {
      setImmediateEntry(state.memory);
    } else {
      insertPlain(Calc.toPlain(state.memory));
    }
    toast('MR = ' + Calc.formatNumber(state.memory));
  }

  function insertPlain(text) {
    if (state.mode === 'immediate') {
      state.immediate = Object.assign(Calc.immediate.init(), { entry: text, replace: true });
      renderDisplay();
      return;
    }
    if (state.justEvaluated) {
      state.expr = '';
      state.justEvaluated = false;
      state.lastResult = null;
    }
    state.expr += text;
    updatePreview();
  }

  /* ============================================================
   * Actions du pavé
   * ============================================================ */

  function onKey(id) {
    var def = KEYS[id];
    if (!def) return;
    if (def.action) {
      handleAction(def.action);
      return;
    }
    if (def.insert != null) pressToken(def.insert);
  }

  function handleAction(action) {
    switch (action) {
      case 'shift':
        state.second = !state.second;
        renderKeypad();
        syncChips();
        break;
      case 'angle':
        cycleAngle();
        break;
      case 'clear':
        clearAll();
        break;
      case 'backspace':
        backspace();
        break;
      case 'equals':
        equals();
        break;
      case 'sign':
        toggleSign();
        break;
      case 'mc':
        clearMemory();
        break;
      case 'mr':
        recallMemory();
        break;
      case 'mplus':
        addMemory(1);
        break;
      case 'mminus':
        addMemory(-1);
        break;
      default:
        break;
    }
  }

  /* ============================================================
   * Historique
   * ============================================================ */

  function addHistory(expression, display, plain) {
    state.history.unshift({
      id: Date.now().toString(36) + Math.random().toString(16).slice(2, 8),
      expr: expression,
      display: display,
      plain: plain,
      at: Date.now()
    });
    state.history = state.history.slice(0, HISTORY_MAX);
    save(STORE.history, state.history);
    renderHistory();
  }

  function renderHistory() {
    if (!ui.historyList) return;
    ui.historyList.innerHTML = '';
    ui.historyEmpty.hidden = state.history.length > 0;
    ui.historyCount.textContent = state.history.length + (state.history.length > 1 ? ' calculs' : ' calcul');

    state.history.forEach(function (item) {
      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';
      button.dataset.id = item.id;
      button.title = item.expr + ' = ' + item.display;

      var expression = document.createElement('span');
      expression.className = 'history-expr';
      expression.textContent = item.expr;

      var row = document.createElement('span');
      row.className = 'history-result';
      var value = document.createElement('strong');
      value.textContent = item.display;
      var time = document.createElement('span');
      time.className = 'history-time';
      time.textContent = formatTime(item.at);

      row.appendChild(value);
      row.appendChild(time);
      button.appendChild(expression);
      button.appendChild(row);
      li.appendChild(button);
      ui.historyList.appendChild(li);
    });
  }

  function useHistory(id) {
    var item = state.history.find(function (entry) { return entry.id === id; });
    if (!item) return;

    if (state.mode === 'immediate') {
      state.immediate = Object.assign(Calc.immediate.init(), {
        entry: item.plain,
        replace: true
      });
      renderDisplay();
    } else {
      state.expr = item.plain;
      state.lastResult = null;
      state.justEvaluated = false;
      state.error = '';
      updatePreview();
    }
    switchTab('calc');
    closeHistory();
  }

  function clearHistory() {
    state.history = [];
    save(STORE.history, []);
    renderHistory();
    toast('Historique vidé');
  }

  function csvCell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }

  function dateStamp() {
    var now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  }

  function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportHistory() {
    if (!state.history.length) {
      toast('Historique vide');
      return;
    }
    var rows = ['Date;Expression;Résultat'];
    state.history.slice().reverse().forEach(function (item) {
      rows.push([
        csvCell(new Date(item.at).toLocaleString('fr-FR')),
        csvCell(item.expr),
        csvCell(item.display)
      ].join(';'));
    });
    downloadFile('calculs-' + dateStamp() + '.csv', '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    toast('Historique exporté en CSV');
  }

  /* ============================================================
   * Copie, toast, thème
   * ============================================================ */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        var copied = document.execCommand('copy');
        area.remove();
        if (copied) resolve(); else reject(new Error('copie refusée'));
      } catch (err) {
        area.remove();
        reject(err);
      }
    });
  }

  function copyResult() {
    var value = currentResultValue();
    if (value == null) return;
    var plain = Calc.toPlain(value);
    copyText(plain).then(function () {
      toast('Copié : ' + plain);
    }, function () {
      toast('Copie impossible');
    });
  }

  var toastTimer = null;
  function toast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { ui.toast.hidden = true; }, 2400);
  }

  function applyTheme(theme, persist) {
    state.theme = THEMES.indexOf(theme) !== -1 ? theme : 'dark';
    ui.root.dataset.theme = state.theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[state.theme]);
    if (persist) save(STORE.theme, state.theme);
  }

  function toggleTheme() {
    applyTheme(THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length], true);
  }

  /* ============================================================
   * Onglets et tiroir
   * ============================================================ */

  function switchTab(tab) {
    state.tab = tab;
    ui.tabs.forEach(function (button) {
      var active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    ui.panels.forEach(function (panel) {
      panel.hidden = panel.id !== 'panel-' + tab;
    });
    if (tab === 'complex') complexCompute();
    if (tab === 'stats' && !ui.statsSummary.children.length) statsCompute();
  }

  function openHistory() {
    if (!ui.historyPanel) return;
    ui.historyPanel.classList.add('is-open');
    ui.backdrop.hidden = false;
    ui.historyToggle.setAttribute('aria-expanded', 'true');
  }

  function closeHistory() {
    if (!ui.historyPanel) return;
    ui.historyPanel.classList.remove('is-open');
    ui.backdrop.hidden = true;
    ui.historyToggle.setAttribute('aria-expanded', 'false');
  }

  /* ============================================================
   * Clavier physique
   * ============================================================ */

  function handleKeyboard(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    var target = event.target;
    var tag = target && target.tagName ? target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (ui.helpDialog && ui.helpDialog.open) return;

    var key = event.key;
    if (key === 'Escape') {
      if (ui.historyPanel.classList.contains('is-open')) {
        closeHistory();
        event.preventDefault();
      } else {
        clearAll();
        event.preventDefault();
      }
      return;
    }

    if (state.tab !== 'calc') return;

    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      pressToken(key);
      return;
    }

    var map = {
      '.': ',',
      ',': ',',
      '+': '+',
      '-': '−',
      '*': '×',
      '/': '÷',
      '^': '^',
      '(': '(',
      ')': ')',
      '!': '!',
      '%': '%',
      ';': ';'
    };
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      event.preventDefault();
      pressToken(map[key]);
      return;
    }

    if (key === 'Enter' || key === '=') {
      event.preventDefault();
      equals();
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      backspace();
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      clearAll();
      return;
    }
    if (key === 'p' || key === 'P') {
      event.preventDefault();
      pressToken('π');
    }
  }

  /* ============================================================
   * Module complexes
   * ============================================================ */

  function insertAtCursor(input, text) {
    var start = input.selectionStart == null ? input.value.length : input.selectionStart;
    var end = input.selectionEnd == null ? input.value.length : input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    var position = start + text.length;
    try { input.setSelectionRange(position, position); } catch (err) { /* ignore */ }
  }

  function complexCompute() {
    var input = ui.complexInput.value.trim();
    ui.complexError.hidden = true;
    if (!input) {
      ui.complexRect.textContent = '—';
      ui.complexPolar.textContent = '—';
      ui.complexDetail.textContent = '—';
      return;
    }
    try {
      var result = Calc.evaluate(input, contextOptions());
      if (Calc.isMatrix(result.value)) throw new Error('Les matrices ne sont pas prises en charge dans ce module.');
      ui.complexRect.textContent = Calc.format(result.value);
      var polar = Calc.polar(result.value, state.angle);
      var unit = angleUnit();
      ui.complexPolar.textContent = Calc.formatNumber(polar.modulus) + ' ∠ ' + Calc.formatNumber(polar.argument) + unit;
      ui.complexDetail.textContent = '|z| = ' + Calc.formatNumber(polar.modulus) +
        '   ·   arg z = ' + Calc.formatNumber(polar.argument) + unit;
      if (typeof result.value === 'number' && isFinite(result.value)) state.ans = result.value;
    } catch (err) {
      ui.complexRect.textContent = '—';
      ui.complexPolar.textContent = '—';
      ui.complexDetail.textContent = '—';
      ui.complexError.hidden = false;
      ui.complexError.textContent = err.message;
    }
  }

  /* ============================================================
   * Module matrices
   * ============================================================ */

  var MATRIX_PRESETS = {
    2: { a: ['1', '2', '3', '4'], b: ['5', '6', '7', '8'] },
    3: { a: ['1', '2', '3', '0', '1', '4', '5', '6', '0'], b: ['1', '0', '0', '0', '1', '0', '0', '0', '1'] }
  };

  function applyMatrixPreset() {
    var preset = MATRIX_PRESETS[state.matrix.size];
    state.matrix.a = preset.a.slice();
    state.matrix.b = preset.b.slice();
  }

  function renderMatrixInputs(container, key) {
    var size = state.matrix.size;
    container.style.setProperty('--n', size);
    container.innerHTML = '';

    for (var index = 0; index < size * size; index++) {
      (function (i) {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'matrix-cell';
        input.inputMode = 'decimal';
        input.autocomplete = 'off';
        input.value = state.matrix[key][i] == null ? '' : state.matrix[key][i];
        input.setAttribute('aria-label', 'Matrice ' + key.toUpperCase() +
          ', ligne ' + (Math.floor(i / size) + 1) +
          ', colonne ' + ((i % size) + 1));
        input.addEventListener('input', function (event) {
          state.matrix[key][i] = event.target.value;
        });
        container.appendChild(input);
      })(index);
    }
  }

  function renderMatrix() {
    ui.matrixSize.value = String(state.matrix.size);
    renderMatrixInputs(ui.matrixA, 'a');
    renderMatrixInputs(ui.matrixB, 'b');
  }

  function resetMatrix() {
    applyMatrixPreset();
    renderMatrix();
    ui.matrixResult.className = 'matrix-result';
    ui.matrixResult.textContent = '—';
    ui.matrixResultLabel.textContent = 'Résultat';
    ui.matrixError.hidden = true;
  }

  function readMatrix(key) {
    var size = state.matrix.size;
    var data = [];
    for (var i = 0; i < size * size; i++) {
      var raw = String(state.matrix[key][i] == null ? '' : state.matrix[key][i]).trim();
      if (!raw) throw new Error('Toutes les cellules de la matrice ' + key.toUpperCase() + ' doivent être remplies.');
      var value;
      try {
        value = Calc.evaluate(raw, contextOptions()).value;
      } catch (err) {
        throw new Error('Cellule invalide « ' + raw + ' » : ' + err.message);
      }
      if (typeof value !== 'number' || !isFinite(value)) {
        throw new Error('La cellule « ' + raw + ' » doit être un nombre réel.');
      }
      data.push(value);
    }
    return Calc.matrix.create(size, size, data);
  }

  function showMatrixResult(result, label) {
    ui.matrixError.hidden = true;
    ui.matrixResultLabel.textContent = label;
    ui.matrixResult.className = 'matrix-result';
    ui.matrixResult.innerHTML = '';

    if (Calc.isMatrix(result)) {
      ui.matrixResult.style.setProperty('--n', result.cols);
      result.data.forEach(function (value) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = Calc.formatNumber(value);
        ui.matrixResult.appendChild(cell);
      });
    } else {
      ui.matrixResult.classList.add('single');
      ui.matrixResult.textContent = Calc.format(result);
    }
  }

  function matrixCompute(op) {
    ui.matrixError.hidden = true;
    try {
      var a = readMatrix('a');
      var b = readMatrix('b');
      var result;
      var label;

      switch (op) {
        case 'add':
          result = Calc.matrix.add(a, b);
          label = 'A + B';
          break;
        case 'sub':
          result = Calc.matrix.sub(a, b);
          label = 'A − B';
          break;
        case 'mul':
          result = Calc.matrix.multiply(a, b);
          label = 'A × B';
          break;
        case 'detA':
          result = Calc.matrix.det(a);
          label = 'det(A)';
          break;
        case 'invA':
          result = Calc.matrix.inverse(a);
          label = 'A⁻¹';
          break;
        case 'transA':
          result = Calc.matrix.transpose(a);
          label = 'Aᵀ';
          break;
        case 'transB':
          result = Calc.matrix.transpose(b);
          label = 'Bᵀ';
          break;
        default:
          return;
      }
      showMatrixResult(result, label);
    } catch (err) {
      ui.matrixResult.className = 'matrix-result';
      ui.matrixResult.textContent = '—';
      ui.matrixResultLabel.textContent = 'Résultat';
      ui.matrixError.hidden = false;
      ui.matrixError.textContent = err.message;
    }
  }

  /* ============================================================
   * Module statistiques
   * ============================================================ */

  function parseStatNumber(raw) {
    var cleaned = String(raw).replace(/\s+/g, '').replace(/,/g, '.');
    var value = Number(cleaned);
    if (!cleaned || !isFinite(value)) throw new Error('Valeur numérique invalide : « ' + raw + ' »');
    return value;
  }

  function parseStats(text) {
    var lines = String(text).split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (!lines.length) throw new Error('Saisissez au moins une valeur.');

    var values = [];
    var pairs = [];
    var hasPairs = false;
    var hasSingles = false;

    lines.forEach(function (line) {
      var parts = line.split(/\s*;\s*|\t+|\s{2,}/).filter(Boolean);
      if (parts.length === 2) {
        hasPairs = true;
        pairs.push([parseStatNumber(parts[0]), parseStatNumber(parts[1])]);
      } else if (parts.length === 1) {
        hasSingles = true;
        values.push(parseStatNumber(parts[0]));
      } else {
        throw new Error('Ligne incomprise : « ' + line + ' »');
      }
    });

    if (hasPairs && hasSingles) {
      throw new Error('Ne mélangez pas valeurs seules et couples (x ; y).');
    }
    return hasPairs ? { pairs: pairs } : { values: values };
  }

  function renderStatCards(container, items) {
    container.innerHTML = '';
    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'stat-card';
      var label = document.createElement('span');
      label.textContent = item[0];
      var value = document.createElement('b');
      value.textContent = item[1] == null ? '—' : Calc.formatNumber(Number(item[1]));
      card.appendChild(label);
      card.appendChild(value);
      container.appendChild(card);
    });
  }

  function statsCompute() {
    ui.statsError.hidden = true;
    try {
      var parsed = parseStats(ui.statsInput.value);

      if (parsed.pairs) {
        var regression = Calc.stats.regression(parsed.pairs);
        var xs = parsed.pairs.map(function (pair) { return pair[0]; });
        var ys = parsed.pairs.map(function (pair) { return pair[1]; });
        var summaryX = Calc.stats.summary(xs);
        var summaryY = Calc.stats.summary(ys);

        renderStatCards(ui.statsSummary, [
          ['Couples n', regression.n],
          ['Moyenne x', summaryX.mean],
          ['Moyenne y', summaryY.mean],
          ['Écart-type x', summaryX.sdSample],
          ['Écart-type y', summaryY.sdSample]
        ]);

        ui.statsRegressionBox.hidden = false;
        renderStatCards(ui.statsRegression, [
          ['Pente a', regression.slope],
          ['Ordonnée b', regression.intercept],
          ['Corrélation r', regression.r],
          ['r²', regression.r2]
        ]);
        var sign = regression.intercept < 0 ? '− ' : '+ ';
        ui.statsEquation.textContent = 'y = ' + Calc.formatNumber(regression.slope) + 'x ' + sign +
          Calc.formatNumber(Math.abs(regression.intercept));
      } else {
        var summary = Calc.stats.summary(parsed.values);
        renderStatCards(ui.statsSummary, [
          ['Effectif n', summary.n],
          ['Somme', summary.sum],
          ['Moyenne', summary.mean],
          ['Médiane', summary.median],
          ['Q1', summary.q1],
          ['Q3', summary.q3],
          ['Minimum', summary.min],
          ['Maximum', summary.max],
          ['σ population', summary.sdPopulation],
          ['s échantillon', summary.sdSample]
        ]);
        ui.statsRegressionBox.hidden = true;
      }
    } catch (err) {
      ui.statsSummary.innerHTML = '';
      ui.statsRegressionBox.hidden = true;
      ui.statsError.hidden = false;
      ui.statsError.textContent = err.message;
    }
  }

  /* ============================================================
   * Liaisons et démarrage
   * ============================================================ */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* mode fichier ou réseau indisponible */ });
    });
  }

  function bindEvents() {
    ui.modeButtons.forEach(function (button) {
      button.addEventListener('click', function () { setMode(button.dataset.mode); });
    });

    ui.tabs.forEach(function (button) {
      button.addEventListener('click', function () { switchTab(button.dataset.tab); });
    });

    ui.copyBtn.addEventListener('click', copyResult);
    ui.themeToggle.addEventListener('click', toggleTheme);
    ui.helpToggle.addEventListener('click', function () {
      if (ui.helpDialog && typeof ui.helpDialog.showModal === 'function') ui.helpDialog.showModal();
    });
    if (ui.helpDialog) {
      ui.helpDialog.addEventListener('click', function (event) {
        if (event.target === ui.helpDialog) ui.helpDialog.close();
      });
    }

    ui.historyToggle.addEventListener('click', openHistory);
    ui.closeHistory.addEventListener('click', closeHistory);
    ui.backdrop.addEventListener('click', closeHistory);
    ui.exportBtn.addEventListener('click', exportHistory);
    ui.clearHistoryBtn.addEventListener('click', clearHistory);
    ui.historyList.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('.history-item') : null;
      if (button) useHistory(button.dataset.id);
    });

    ui.complexEval.addEventListener('click', complexCompute);
    ui.complexClear.addEventListener('click', function () {
      ui.complexInput.value = '';
      complexCompute();
      ui.complexInput.focus();
    });
    ui.complexInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        complexCompute();
      }
    });
    $('#complexKeys').addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('button[data-insert]') : null;
      if (button) insertAtCursor(ui.complexInput, button.dataset.insert);
    });

    ui.matrixSize.addEventListener('change', function () {
      state.matrix.size = Number(ui.matrixSize.value) === 3 ? 3 : 2;
      applyMatrixPreset();
      renderMatrix();
      ui.matrixResult.className = 'matrix-result';
      ui.matrixResult.textContent = '—';
      ui.matrixResultLabel.textContent = 'Résultat';
      ui.matrixError.hidden = true;
    });
    ui.matrixReset.addEventListener('click', resetMatrix);
    $$('.matrix-ops button').forEach(function (button) {
      button.addEventListener('click', function () { matrixCompute(button.dataset.op); });
    });

    ui.statsCompute.addEventListener('click', statsCompute);
    ui.statsExample.addEventListener('click', function () {
      ui.statsInput.value = '1 ; 3\n2 ; 5\n3 ; 7\n4 ; 9';
      statsCompute();
    });

    document.addEventListener('keydown', handleKeyboard);

    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: light)');
      var onChange = function (event) {
        if (load(STORE.theme, null) == null) applyTheme(event.matches ? 'light' : 'dark', false);
      };
      if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
    }
  }

  function init() {
    applyTheme(state.theme, false);
    renderKeypad();
    syncModeButtons();
    renderDisplay();
    renderHistory();
    renderMatrix();
    statsCompute();
    switchTab('calc');
    bindEvents();
    registerServiceWorker();
    ui.historyToggle.setAttribute('aria-expanded', 'false');
  }

  init();
})();
