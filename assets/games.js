

(function (root) {
  'use strict';

   
  var LN = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  var TORD = [4, 0, 2, 6, 8, 1, 3, 5, 7];

  function tttLine(b) {
    for (var i = 0; i < 8; i++) {
      var l = LN[i];
      if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return l;
    }
    return null;
  }
  function tttFull(b) { for (var i = 0; i < 9; i++) if (!b[i]) return false; return true; }

   
  function tttScore(b, turn, d, me) {
    var l = tttLine(b);
    if (l) return b[l[0]] === me ? 10 - d : d - 10;
    if (tttFull(b)) return 0;
    var best = turn === me ? -99 : 99;
    for (var k = 0; k < 9; k++) {
      var i = TORD[k];
      if (b[i]) continue;
      b[i] = turn;
      var v = tttScore(b, 3 - turn, d + 1, me);
      b[i] = 0;
      if (turn === me ? v > best : v < best) best = v;
    }
    return best;
  }
  function tttBest(b, who) {
    who = who || 2;
    var best = -99, mv = -1;
    for (var k = 0; k < 9; k++) {
      var i = TORD[k];
      if (b[i]) continue;
      b[i] = who;
      var v = tttScore(b, 3 - who, 1, who);
      b[i] = 0;
      if (v > best) { best = v; mv = i; }
    }
    return mv;
  }

   
  var W = 7, H = 6, INF = 1e6, WIN = 1e5, MAXD = 7, MS = 150;
  var CORD = [3, 2, 4, 1, 5, 0, 6];
  var D = [[1,0],[0,1],[1,1],[1,-1]];
  var WINDOWS = (function () {
    var w = [], c, r, k, d;
    for (c = 0; c < W; c++) for (r = 0; r < H; r++) for (d = 0; d < 4; d++) {
      var ec = c + 3 * D[d][0], er = r + 3 * D[d][1];
      if (ec < 0 || ec >= W || er < 0 || er >= H) continue;
      for (k = 0; k < 4; k++) w.push((r + k * D[d][1]) * W + c + k * D[d][0]);
    }
    return new Int8Array(w);
  })();
  var NW = WINDOWS.length / 4;

  function Game() { this.b = new Int8Array(W * H); this.h = new Int8Array(W); this.n = 0; }
  Game.prototype.can = function (c) { return this.h[c] < H; };
  Game.prototype.put = function (c, p) { var r = this.h[c]++; this.b[r * W + c] = p; this.n++; return r; };
  Game.prototype.undo = function (c) { var r = --this.h[c]; this.b[r * W + c] = 0; this.n--; };
  Game.prototype.line = function (c, r, p) {
    var b = this.b;
    for (var d = 0; d < 4; d++) {
      var cells = [r * W + c], s, x, y;
      for (s = -1; s <= 1; s += 2) {
        x = c + s * D[d][0]; y = r + s * D[d][1];
        while (x >= 0 && x < W && y >= 0 && y < H && b[y * W + x] === p) {
          cells.push(y * W + x); x += s * D[d][0]; y += s * D[d][1];
        }
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  };
  Game.prototype.wins = function (c, p) {
    var r = this.put(c, p), w = !!this.line(c, r, p);
    this.undo(c);
    return w;
  };
  Game.prototype.eval = function (p) {
    var b = this.b, s = 0, q = 3 - p, i, k, m, o;
    for (i = 0; i < NW; i++) {
      m = o = 0;
      for (k = 0; k < 4; k++) { var v = b[WINDOWS[i * 4 + k]]; if (v === p) m++; else if (v === q) o++; }
      if (m && o) continue;
      if (m) s += m === 3 ? 40 : m === 2 ? 8 : 1;
      else if (o) s -= o === 3 ? 46 : o === 2 ? 8 : 1;
    }
    for (i = 0; i < H; i++) { v = b[i * W + 3]; if (v === p) s += 4; else if (v === q) s -= 4; }
    return s;
  };

  function Search(g, p, ms, maxd) {
    var o = this.order = CORD.filter(function (c) { return g.can(c); }), me = this;
    this.g = g; this.p = p; this.ms = ms || MS; this.maxd = maxd || MAXD;
    this.t0 = Date.now(); this.d = 0; this.nodes = 0; this.best = o[0]; this.done = o.length === 1;
    [p, 3 - p].some(function (q) {
      return o.some(function (c) { if (g.wins(c, q)) { me.best = c; me.done = true; return true; } });
    });
  }
  Search.prototype.neg = function (d, a, b, p, ply) {
    if ((++this.nodes & 255) === 0 && Date.now() - this.t0 > this.ms) this.cut = true;
    if (this.cut) return 0;
    var g = this.g, k, c, v;
    if (g.n === W * H) return 0;
    for (k = 0; k < W; k++) if (g.can(CORD[k]) && g.wins(CORD[k], p)) return WIN - ply;
    if (d === 0) return g.eval(p);
    for (k = 0; k < W; k++) {
      c = CORD[k];
      if (!g.can(c)) continue;
      g.put(c, p);
      v = -this.neg(d - 1, -b, -a, 3 - p, ply + 1);
      g.undo(c);
      if (this.cut) return 0;
      if (v > a) { a = v; if (a >= b) break; }
    }
    return a;
  };
  Search.prototype.step = function () {
    if (this.done) return true;
    var d = this.d + 1, g = this.g, a = -INF, ties = [], k, c, v, me = this;
    var ord = this.order.slice().sort(function (x, y) { return (y === me.best) - (x === me.best); });
    this.cut = false;
    for (k = 0; k < ord.length; k++) {
      c = ord[k];
      g.put(c, this.p);
      v = -this.neg(d - 1, -INF, -a + 1, 3 - this.p, 1);
      g.undo(c);
      if (this.cut) break;
      if (v > a) { a = v; ties = [c]; } else if (v === a) ties.push(c);
    }
    if (!this.cut) {
      this.d = d;
      this.best = ties[Math.floor(Math.random() * ties.length)];
      if (a >= WIN - 50 || a <= -WIN + 50 && d >= 2 || d >= this.maxd) this.done = true;
    } else this.done = true;
    if (Date.now() - this.t0 > this.ms) this.done = true;
    return this.done;
  };
  function c4Best(g, p, ms, maxd) {
    var s = new Search(g, p, ms, maxd);
    while (!s.done) s.step();
    return s.best;
  }

  

  var TTT_MS = 420, C4_MS = 260;

  function tttGame(io) {
    var b, turn, over, timer, gen = 0, api = {};
    function state() { io.state(over ? 'over' : turn === 1 ? 'you' : 'stefan'); }
    function stefan() {
      var mine = gen;
      turn = 2; io.status('Stefan is thinking.');
      timer = io.schedule(function () { if (mine === gen && !over && turn === 2) play(tttBest(b, 2), 2); }, TTT_MS);
    }
    function play(i, who) {
      b[i] = who;
      var l = tttLine(b);
      if (l) { over = true; io.status(who === 1 ? 'You win. Again?' : 'Stefan wins. Again?'); }
      else if (tttFull(b)) { over = true; io.status('Draw. Again?'); }
      else if (who === 1) stefan();
      else { turn = 1; io.status('Your move.'); }
      io.paint(b, l); state();
    }
    api.click = function (i) {
      if (over || turn !== 1 || !(i >= 0 && i < 9) || b[i]) return false;
      play(i, 1); return true;
    };
    api.start = function (stefanFirst) {
      io.cancel(timer); gen++;
      b = [0,0,0,0,0,0,0,0,0]; over = false;
      if (stefanFirst) stefan(); else { turn = 1; io.status('Your move.'); }
      io.paint(b, null); state();
    };
    api.state = function () { return { b: b, turn: turn, over: over }; };
    return api;
  }

  function c4Game(io) {
    var g, turn, over, timer, search, gen = 0, api = {};
    function state() { io.state(over ? 'over' : turn === 1 ? 'you' : 'stefan'); }
    function drop(c, p) {
      var r = g.put(c, p), l = g.line(c, r, p);
      io.drop(c, r, p, l, g.can(c));
      if (l) { over = true; io.status(p === 1 ? 'You win. Again?' : 'Stefan wins. Again?'); }
      else if (g.n === W * H) { over = true; io.status('Draw. Again?'); }
      else if (p === 1) think();
      else { turn = 1; io.status('Your move.'); }
      state();
    }
    function think() {
      var mine = gen;
      turn = 2; io.status('Stefan is thinking.');
      timer = io.schedule(function () {
        if (mine !== gen) return;
        search = new Search(g, 2);
        (function tick() {
          if (mine !== gen || over || turn !== 2) return;
          if (search.done || search.step()) drop(search.best, 2);
          else timer = io.schedule(tick, 0);
        })();
      }, C4_MS);
    }
    api.click = function (c) {
      if (over || turn !== 1 || !(c >= 0 && c < W)) return false;
      if (!g.can(c)) { io.status('That column is full. Your move.'); return false; }
      drop(c, 1); return true;
    };
    api.start = function (stefanFirst) {
      io.cancel(timer); gen++; search = null;
      g = new Game(); over = false;
      io.reset();
      if (stefanFirst) drop(3, 2); else { turn = 1; io.status('Your move.'); }
      state();
    };
    api.state = function () { return { g: g, turn: turn, over: over }; };
    return api;
  }

  

  function digitColumn(e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return -1;
    return /^[1-7]$/.test(e.key) ? +e.key - 1 : -1;
  }
  function arrowTarget(e, i, n, cols) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return -1;
    var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (i < 0 || !d) return -1;
    var j = i + d;
    if (j < 0 || j >= n || (d * d === 1 && (j / cols | 0) !== (i / cols | 0))) return -1;
    return j;
  }
  function heldActivation(e) { return !!e.repeat && (e.key === 'Enter' || e.key === ' '); }

   
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function chrome(host, onNew) {
    host.textContent = '';
    var board = el('div'), st = el('p', 'g-status'), ctl = el('div', 'g-ctl');
    st.setAttribute('aria-live', 'polite');
    var nb = el('button', 'btn btn-ghost', 'New game'), sb = el('button', 'linkbtn', 'Stefan starts');
    nb.type = sb.type = 'button';
    nb.onclick = function () { onNew(false); };
    sb.onclick = function () { onNew(true); };
    ctl.appendChild(nb); ctl.appendChild(sb);
    host.appendChild(board); host.appendChild(st); host.appendChild(ctl);
    return { board: board, st: st };
  }
  function rove(board, items, cols, first) {
    board.addEventListener('focusin', function (e) {
      var i = items.indexOf(e.target);
      if (i >= 0) items.forEach(function (c, j) { c.tabIndex = j === i ? 0 : -1; });
    });
    board.addEventListener('keydown', function (e) {
      if (heldActivation(e)) { e.preventDefault(); return; }
      var j = arrowTarget(e, items.indexOf(document.activeElement), items.length, cols);
      if (j < 0) return;
      e.preventDefault(); items[j].focus();
    });
    items.forEach(function (c, j) { c.tabIndex = j === first ? 0 : -1; });
  }
  var timers = {
    schedule: function (fn, ms) { return setTimeout(fn, ms); },
    cancel: function (id) { clearTimeout(id); }
  };

  function mountTTT(host) {
    var cells = [], game, ui = chrome(host, function (stefanFirst) { game.start(stefanFirst); });
    ui.board.className = 'g-ttt';
    ui.board.setAttribute('role', 'group'); ui.board.setAttribute('aria-label', 'Tic-tac-toe board');
    for (var i = 0; i < 9; i++) (function (i) {
      var c = el('button'); c.type = 'button';
      c.onclick = function () { game.click(i); };
      cells.push(c); ui.board.appendChild(c);
    })(i);
    rove(ui.board, cells, 3, 4);
    game = tttGame({
      schedule: timers.schedule, cancel: timers.cancel,
      status: function (t) { ui.st.textContent = t; },
      state: function (s) { ui.board.setAttribute('data-state', s); },
      paint: function (b, line) {
        cells.forEach(function (c, i) {
          c.className = b[i] === 1 ? 'x' : b[i] === 2 ? 'o' : '';
          c.setAttribute('aria-label', 'Row ' + (1 + (i / 3 | 0)) + ', column ' + (1 + i % 3) + ', ' + ['empty', 'you', 'Stefan'][b[i]]);
        });
        if (line) line.forEach(function (k) { cells[k].classList.add('win'); });
      }
    });
    game.start(false);
  }

  function mountC4(host) {
    var cols = [], cellEl = [], game, ui = chrome(host, function (stefanFirst) { game.start(stefanFirst); });
    ui.board.className = 'g-c4';
    ui.board.setAttribute('role', 'group'); ui.board.setAttribute('aria-label', 'Connect Four board, seven columns');
    for (var c = 0; c < W; c++) (function (c) {
      var col = el('button', 'col'); col.type = 'button';
      col.setAttribute('aria-label', 'Column ' + (c + 1));
      for (var t = 0; t < H; t++) { var cell = el('span', 'cell'); cell.appendChild(el('i')); col.appendChild(cell); cellEl[(H - 1 - t) * W + c] = cell; }
      col.onclick = function () { game.click(c); };
      cols.push(col); ui.board.appendChild(col);
    })(c);
    rove(ui.board, cols, W, 3);
    ui.board.addEventListener('keydown', function (e) { var c = digitColumn(e); if (c >= 0) cols[c].click(); });
    game = c4Game({
      schedule: timers.schedule, cancel: timers.cancel,
      status: function (t) { ui.st.textContent = t; },
      state: function (s) { ui.board.setAttribute('data-state', s); },
      reset: function () {
        cellEl.forEach(function (x) { x.className = 'cell'; x.firstChild.style.removeProperty('--t'); });
        cols.forEach(function (c, i) { c.setAttribute('aria-label', 'Column ' + (i + 1)); });
        void ui.board.offsetWidth;
      },
      drop: function (c, r, p, line, open) {
        var cell = cellEl[r * W + c];
        cell.className = 'cell p' + p;
        cell.firstChild.style.setProperty('--t', H - 1 - r);
        cols[c].setAttribute('aria-label', 'Column ' + (c + 1) + (open ? '' : ', full'));
        if (line) line.forEach(function (k) { cellEl[k].classList.add('win'); });
      }
    });
    game.start(false);
  }

  if (typeof document !== 'undefined') {
    var mount = { ttt: mountTTT, c4: mountC4 };
    [].forEach.call(document.querySelectorAll('[data-game]'), function (card) {
      var host = card.querySelector('.g-play'), f = mount[card.getAttribute('data-game')];
      if (host && f && !host.hasAttribute('data-ready')) { host.setAttribute('data-ready', ''); f(host); }
    });
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = { tttBest: tttBest, tttLine: tttLine, tttFull: tttFull, tttGame: tttGame, Game: Game, Search: Search, c4Best: c4Best, c4Game: c4Game,
      digitColumn: digitColumn, arrowTarget: arrowTarget, heldActivation: heldActivation, W: W, H: H, WIN: WIN };
  }
})(this);
