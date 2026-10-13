

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

  

  var SW = 320, SH = 240, SDT = 1 / 120, SROWS = 4, SX = 30, SY = 20, IW = 18, IH = 12;
  var SHIP_Y = 222, SHIP_W = 22, SHIP_H = 10, SHIP_V = 150, SHIP_PULL = 260;
  var DROP = 8, STEP = 5, SHOT_V = 280, BOMB_V = 90, BOMBS = 3, LIVES = 3, HIT_T = 1.2;
  var SHIELD_Y = 180, CELL = 3, SCOLS = 8, SROWS_S = 4;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function SD(cols, seed) {
    this.cols = cols || 8; this.rnd = rng(seed == null ? (Math.random() * 4294967296) : seed);
    this.wave = 0; this.lives = LIVES; this.over = false; this.acc = 0; this.ticks = 0; this.hitT = 0;
    this.shipX = SW / 2; this.shields = [];
    for (var k = 0; k < 3; k++) for (var r = 0; r < SROWS_S; r++) for (var c = 0; c < SCOLS; c++) {
      if (r === SROWS_S - 1 && c > 1 && c < SCOLS - 2) continue;
      this.shields.push({ x: SW * (k + 1) / 4 - SCOLS * CELL / 2 + c * CELL, y: SHIELD_Y + r * CELL, on: true });
    }
    this.newWave();
  }
  SD.prototype.newWave = function () {
    this.wave++; this.inv = [];
    for (var r = 0; r < SROWS; r++) for (var c = 0; c < this.cols; c++) this.inv.push({ c: c, r: r, on: true });
    this.alive = this.inv.length; this.fx = 16; this.fy = 28; this.dir = 1;
    this.shot = null; this.bombs = []; this.stepT = this.interval(); this.fireT = this.fireEvery();
  };
  SD.prototype.pace = function () { return 1 + 0.15 * (this.wave - 1); };
  SD.prototype.interval = function () { return 0.55 * (0.1 + 0.9 * this.alive / this.inv.length) / this.pace(); };
  SD.prototype.fireEvery = function () { return (1.1 + this.rnd()) / this.pace(); };
  SD.prototype.ix = function (v) { return this.fx + v.c * SX; };
  SD.prototype.iy = function (v) { return this.fy + v.r * SY; };
  SD.prototype.march = function () {
    var lo = SW, hi = 0, bottom = 0, me = this;
    this.inv.forEach(function (v) {
      if (!v.on) return;
      lo = Math.min(lo, me.ix(v)); hi = Math.max(hi, me.ix(v) + IW); bottom = Math.max(bottom, me.iy(v) + IH);
    });
    if (hi + STEP * this.dir > SW - 6 || lo + STEP * this.dir < 6) { this.fy += DROP; this.dir = -this.dir; bottom += DROP; }
    else this.fx += STEP * this.dir;
    this.inv.forEach(function (v) {
      if (!v.on) return;
      var x = me.ix(v), y = me.iy(v);
      me.shields.forEach(function (b) { if (b.on && b.x < x + IW && b.x + CELL > x && b.y < y + IH && b.y + CELL > y) b.on = false; });
    });
    if (bottom >= SHIP_Y - SHIP_H / 2) this.end();
  };
  SD.prototype.end = function () { this.over = true; this.shot = null; this.bombs = []; };
  SD.prototype.shieldHit = function (x, y, h) {
    for (var i = 0; i < this.shields.length; i++) {
      var b = this.shields[i];
      if (b.on && x >= b.x - 1 && x <= b.x + CELL + 1 && y + h >= b.y && y <= b.y + CELL) { b.on = false; return true; }
    }
    return false;
  };
  SD.prototype.tick = function (inp) {
    if (this.over) return;
    this.ticks++;
    if (this.hitT > 0) { this.hitT -= SDT; return; }
    var dt = SDT, i, v, me = this;
    var vx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (inp.x != null) {
      var d = inp.x - this.shipX, m = SHIP_PULL * dt;
      this.shipX += Math.abs(d) <= m ? d : d > 0 ? m : -m;
    } else this.shipX += vx * SHIP_V * dt;
    this.shipX = Math.max(SHIP_W / 2 + 2, Math.min(SW - SHIP_W / 2 - 2, this.shipX));
    if ((inp.fire || inp.tap) && !this.shot) { this.shot = { x: this.shipX, y: SHIP_Y - SHIP_H / 2 - 8 }; inp.tap = false; }
    if (this.shot) {
      var s = this.shot;
      s.y -= SHOT_V * dt;
      if (s.y < -8 || this.shieldHit(s.x, s.y, 8)) this.shot = null;
      else for (i = 0; i < this.inv.length; i++) {
        v = this.inv[i];
        var x = this.ix(v), y = this.iy(v);
        if (v.on && s.x >= x - 1 && s.x <= x + IW + 1 && s.y <= y + IH && s.y + 8 >= y) {
          v.on = false; this.alive--; this.shot = null; break;
        }
      }
      if (!this.alive) { this.newWave(); return; }
    }
    this.stepT -= dt;
    if (this.stepT <= 0) { this.march(); this.stepT += this.interval(); if (this.over) return; }
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = this.fireEvery();
      if (this.bombs.length < BOMBS) {
        var low = {};
        this.inv.forEach(function (v) { if (v.on && (!low[v.c] || v.r > low[v.c].r)) low[v.c] = v; });
        var ks = Object.keys(low), f = low[ks[Math.floor(this.rnd() * ks.length)]];
        this.bombs.push({ x: this.ix(f) + IW / 2, y: this.iy(f) + IH });
      }
    }
    for (i = this.bombs.length - 1; i >= 0; i--) {
      var b = this.bombs[i];
      b.y += BOMB_V * dt;
      if (b.y > SH || this.shieldHit(b.x, b.y, 8)) { this.bombs.splice(i, 1); continue; }
      if (b.y + 8 >= SHIP_Y - SHIP_H / 2 && b.y <= SHIP_Y + SHIP_H / 2 && Math.abs(b.x - this.shipX) <= SHIP_W / 2) {
        this.lives--; this.bombs = []; this.shot = null;
        if (this.lives <= 0) this.end(); else this.hitT = HIT_T;
        return;
      }
    }
    if (this.shot && this.bombs.length) {
      for (i = 0; i < this.bombs.length; i++) {
        b = this.bombs[i];
        if (Math.abs(b.x - this.shot.x) < 3 && b.y < this.shot.y + 8 && b.y + 8 > this.shot.y) { this.bombs.splice(i, 1); this.shot = null; break; }
      }
    }
  };
  SD.prototype.advance = function (dt, inp) {
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= SDT - 1e-9 && !this.over) { this.tick(inp); this.acc -= SDT; }
    if (this.over) this.acc = 0;
  };

  

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
  function chrome(host, onNew, solo) {
    host.textContent = '';
    var board = el('div'), st = el('p', 'g-status'), ctl = el('div', 'g-ctl');
    st.setAttribute('aria-live', 'polite');
    var nb = el('button', 'btn btn-ghost', 'New game'), sb = el('button', 'linkbtn', 'Stefan starts');
    nb.type = sb.type = 'button';
    nb.onclick = function () { onNew(false); };
    sb.onclick = function () { onNew(true); };
    ctl.appendChild(nb); if (!solo) ctl.appendChild(sb);
    host.appendChild(board); host.appendChild(st); host.appendChild(ctl);
    return { board: board, st: st, btn: nb };
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

  

  function mountSD(host) {
    var game, run = false, raf = 0, last = 0, said = '', col = {}, cw = 0;
    var inp = { left: false, right: false, fire: false, tap: false, x: null }, keys = {}, ptr = null;
    var ui = chrome(host, function () { press(); }, true);
    var cv = el('canvas'), ctx = cv.getContext('2d'), again = el('button', 'linkbtn', 'New game');
    again.type = 'button'; again.style.display = 'none';
    again.onclick = function () { fresh(); play(); };
    ui.btn.parentNode.appendChild(again);
    ui.board.className = 'g-sd';
    cv.tabIndex = 0;
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'Space defenders: rows of invaders step sideways and down; your ship moves along the bottom and shoots up.');
    ui.board.appendChild(cv);
    ui.btn.textContent = 'Play';

    function colours() {
      var cs = getComputedStyle(document.documentElement);
      ['paper', 'paper-tint', 'ink', 'ink-soft', 'accent', 'now', 'line-strong'].forEach(function (k) { col[k] = cs.getPropertyValue('--' + k).trim() || '#000'; });
    }
    function say(t) { if (t !== said) { said = t; ui.st.textContent = t; } }
    function status() {
      if (game.over) say('Game over. Again?');
      else say((run || !game.ticks ? '' : 'Paused. ') + 'Wave ' + game.wave + ' · ' + game.lives + (game.lives === 1 ? ' life' : ' lives'));
    }
    function fresh() {
      game = new SD(cw && cw < 250 ? 6 : 8);
      status();
    }
    function state() {
      ui.board.setAttribute('data-state', run ? 'run' : game.over ? 'over' : 'still');
      ui.btn.textContent = run ? 'Pause' : game.over ? 'New game' : game.ticks ? 'Resume' : 'Play';
      again.style.display = run || game.over || !game.ticks ? 'none' : '';
    }
    function size() {
      var w = ui.board.clientWidth, dpr = window.devicePixelRatio || 1;
      if (!w) return;
      cw = w;
      cv.style.height = Math.round(w * SH / SW) + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(w * SH / SW * dpr);
      draw();
    }
    function draw() {
      var k = cv.width / SW, g = game, me = g;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.fillStyle = col.paper; ctx.fillRect(0, 0, SW, SH);
      ctx.fillStyle = col['line-strong']; ctx.fillRect(0, SHIP_Y + SHIP_H / 2 + 4, SW, 1);
      ctx.fillStyle = col['ink-soft'];
      g.shields.forEach(function (b) { if (b.on) ctx.fillRect(b.x, b.y, CELL, CELL); });
      g.inv.forEach(function (v) {
        if (!v.on) return;
        var x = me.ix(v), y = me.iy(v);
        ctx.fillStyle = col.ink;
        if (v.r === 0) {
          ctx.beginPath(); ctx.moveTo(x + IW / 2, y); ctx.lineTo(x + IW, y + IH / 2); ctx.lineTo(x + IW / 2, y + IH); ctx.lineTo(x, y + IH / 2); ctx.closePath(); ctx.fill();
          ctx.fillStyle = col.paper; ctx.fillRect(x + IW / 2 - 2, y + IH / 2 - 2, 4, 4);
        } else {
          ctx.fillRect(x + 1, y, IW - 2, IH - 4);
          ctx.fillRect(x, y + IH - 4, 4, 4); ctx.fillRect(x + IW - 4, y + IH - 4, 4, 4);
          ctx.fillStyle = col.paper; ctx.fillRect(x + 4, y + 3, 3, 3); ctx.fillRect(x + IW - 7, y + 3, 3, 3);
        }
      });
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5;
      g.bombs.forEach(function (b) {
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + 2, b.y + 2.7); ctx.lineTo(b.x - 2, b.y + 5.3); ctx.lineTo(b.x, b.y + 8); ctx.stroke();
      });
      if (g.shot) { ctx.fillStyle = col.accent; ctx.fillRect(g.shot.x - 1, g.shot.y, 2, 8); }
      var sx = g.shipX - SHIP_W / 2, sy = SHIP_Y - SHIP_H / 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy + SHIP_H); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx + 8, sy + 4); ctx.lineTo(sx + 9, sy);
      ctx.lineTo(sx + SHIP_W - 9, sy); ctx.lineTo(sx + SHIP_W - 8, sy + 4); ctx.lineTo(sx + SHIP_W, sy + 4); ctx.lineTo(sx + SHIP_W, sy + SHIP_H);
      ctx.closePath();
      if (g.hitT > 0 || g.over && g.lives <= 0) { ctx.strokeStyle = col.now; ctx.lineWidth = 1.5; ctx.stroke(); }
      else { ctx.fillStyle = col.accent; ctx.fill(); }
    }
    function frame(t) {
      raf = 0;
      if (!run) return;
      var dt = last ? (t - last) / 1000 : 0;
      last = t;
      inp.left = !!(keys.ArrowLeft || keys.a); inp.right = !!(keys.ArrowRight || keys.d);
      inp.fire = !!(keys.fire || ptr && ptr.touch);
      inp.x = ptr ? ptr.x : null;
      game.advance(dt, inp);
      draw();
      if (game.over) stop();
      status();
      if (run) raf = requestAnimationFrame(frame);
    }
    function play() {
      if (run || game.over) return;
      run = true; last = 0; status(); state();
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; run = false; keys = {}; ptr = null; inp.tap = false;
      status(); state();
    }
    function press() {
      if (run) stop();
      else { if (game.over) fresh(); play(); }
      draw();
    }

    function px(e) { var r = cv.getBoundingClientRect(); return (e.clientX - r.left) / r.width * SW; }
    cv.addEventListener('pointerdown', function (e) {
      if (!run) return;
      e.preventDefault();
      ptr = { id: e.pointerId, x: px(e), touch: e.pointerType !== 'mouse' };
      if (!ptr.touch) inp.tap = true;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', function (e) { if (ptr && e.pointerId === ptr.id) ptr.x = px(e); });
    function up(e) { if (ptr && e.pointerId === ptr.id) ptr = null; }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('click', function () { if (!run && !game.over) play(); });

    var KEY = { ArrowLeft: 'ArrowLeft', a: 'a', A: 'a', ArrowRight: 'ArrowRight', d: 'd', D: 'd', ' ': 'fire', ArrowUp: 'fire' };
    cv.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!run) {
        if (!game.over && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); play(); }
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); stop(); draw(); return; }
      if (KEY[e.key]) { e.preventDefault(); keys[KEY[e.key]] = true; }
    });
    cv.addEventListener('keyup', function (e) { if (KEY[e.key]) keys[KEY[e.key]] = false; });
    cv.addEventListener('blur', function () { keys = {}; });

    if (window.IntersectionObserver) new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (run && x.intersectionRatio < 0.5) stop(); });
    }, { threshold: [0, 0.5] }).observe(cv);
    document.addEventListener('visibilitychange', function () { if (document.hidden && run) stop(); });
    window.addEventListener('blur', function () { if (run) stop(); });

    function retheme() { colours(); draw(); }
    new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', retheme); else if (mq.addListener) mq.addListener(retheme);
    }
    if (window.ResizeObserver) new ResizeObserver(function () { if (ui.board.clientWidth !== cw) size(); }).observe(ui.board);
    else window.addEventListener('resize', size);

    colours();
    cw = ui.board.clientWidth;
    fresh(); state(); size();
  }

  if (typeof document !== 'undefined') {
    var mount = { ttt: mountTTT, c4: mountC4, sd: mountSD };
    [].forEach.call(document.querySelectorAll('[data-game]'), function (card) {
      var host = card.querySelector('.g-play'), f = mount[card.getAttribute('data-game')];
      if (host && f && !host.hasAttribute('data-ready')) { host.setAttribute('data-ready', ''); f(host); }
    });
  }
  if (typeof module === 'object' && module.exports) {
    module.exports = { tttBest: tttBest, tttLine: tttLine, tttFull: tttFull, tttGame: tttGame, Game: Game, Search: Search, c4Best: c4Best, c4Game: c4Game,
      digitColumn: digitColumn, arrowTarget: arrowTarget, heldActivation: heldActivation, W: W, H: H, WIN: WIN,
      SD: SD, SD_DT: SDT, SD_W: SW, SD_SHIP_Y: SHIP_Y, SD_SHIP_H: SHIP_H };
  }
})(this);
