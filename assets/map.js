  (() => {
  if (!document.documentElement.classList.contains('js')) return;
  const boot = () => {
    const svg = document.getElementById('map');
    const cvs = document.getElementById('globe'), ctx = cvs.getContext('2d');
    const stage = document.getElementById('main');
    const phone = matchMedia('(max-width: 719px)');
    const gest = matchMedia('(max-width: 719px), (max-height: 500px) and (orientation: landscape)');
    const coarse = matchMedia('(pointer: coarse) and (hover: none)');
    const hovers = () => matchMedia('(hover: hover)').matches;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const B = JSON.parse(document.getElementById('map-boxes').textContent);
    const root = document.documentElement;
    const SVGNS = 'http://www.w3.org/2000/svg';
    const G = window.GLOBE_LAND;
    const D2R = Math.PI / 180, TAU = 2 * Math.PI;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const vec = (lon, lat) => { const l = lon * D2R, p = lat * D2R, c = Math.cos(p); return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]; };
    const lonlat = v => [Math.atan2(v[1], v[0]) / D2R, Math.asin(clamp(v[2], -1, 1)) / D2R];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const slerp = (a, b, t) => {
      const th = Math.acos(clamp(dot(a, b), -1, 1));
      if (th < 1e-7) return a.slice();
      if (th > Math.PI - 1e-4) b = norm([b[0] + 1e-3, b[1] - 1e-3, b[2] + 1e-3]);
      const s = Math.sin(th), ka = Math.sin((1 - t) * th) / s, kb = Math.sin(t * th) / s;
      return norm([a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]);
    };

    const ringOf = (vs, closed, o = 1) => {
      const n = vs.length, p = new Float64Array(n * 3); let sx = 0, sy = 0, sz = 0;
      vs.forEach((v, i) => { p[3 * i] = v[0]; p[3 * i + 1] = v[1]; p[3 * i + 2] = v[2]; sx += v[0]; sy += v[1]; sz += v[2]; });
      const c = norm([sx, sy, sz]); let r = 0;
      for (let i = 0; i < n; i++) r = Math.max(r, Math.acos(clamp(c[0] * p[3 * i] + c[1] * p[3 * i + 1] + c[2] * p[3 * i + 2], -1, 1)));
      return { p, n, c, r, o, closed };
    };
    const decode = (name, closed, S = G) => (S && S[name] || []).map(a => {
      const q = S.q[name], n = a.length >> 1, vs = []; let x = 0, y = 0, sa = 0, px = 0, py = 0;
      for (let i = 0; i < n; i++) {
        x = i ? x + a[2 * i] : a[0]; y = i ? y + a[2 * i + 1] : a[1];
        const lon = x * q, lat = y * q;
        vs.push(vec(lon, lat));
        if (i) sa += px * lat - lon * py;
        px = lon; py = lat;
      }
      sa += px * a[1] * q - a[0] * q * py;
      return ringOf(vs, closed, sa > 0 ? 1 : -1);
    });
    const boxRing = (b, d) => {
      const [x0, y0, x1, y1] = [b[0] + d, b[1] + d, b[2] - d, b[3] - d], vs = [];
      const edge = (ax, ay, bx, by) => { const k = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))); for (let i = 0; i < k; i++) vs.push(vec(ax + (bx - ax) * i / k, ay + (by - ay) * i / k)); };
      edge(x0, y0, x1, y0); edge(x1, y0, x1, y1); edge(x1, y1, x0, y1); edge(x0, y1, x0, y0);
      return ringOf(vs, true, 1);
    };
    const grat = [];
    for (let lon = -180; lon < 180; lon += 15) { const vs = []; for (let lat = -75; lat <= 75; lat += 1) vs.push(vec(lon, lat)); grat.push(ringOf(vs, false)); }
    for (let lat = -75; lat <= 75; lat += 15) { const vs = []; for (let lon = -180; lon <= 180; lon += 1) vs.push(vec(lon, lat)); grat.push(ringOf(vs, false)); }
    const boxes = G ? Object.values(G.boxes) : [];
    const LAND = {
      world: decode('world', true), lakes: decode('lakes', true), rivers: decode('rivers', false),
      mid: [], fine: [], fineLakes: [], fineRivers: [],
      boxIn: boxes.map(b => boxRing(b, 0.05)), boxOut: boxes.map(b => boxRing(b, 0.25)), grat
    };
    const FINE_R = 650;
    const MID_R = 2200;
    const DEC = 1.4;

    const takeFine = () => {
      const F = window.GLOBE_FINE;
      if (!F) return;
      LAND.mid = decode('mid', true, F); LAND.fine = decode('fine', true, F);
      LAND.fineLakes = decode('fine_lakes', true, F); LAND.fineRivers = decode('fine_rivers', false, F);
      render(false);
    };
    const loadFine = () => {
      if (window.GLOBE_FINE) { takeFine(); return; }
      const s = document.createElement('script');
      s.src = '/assets/globe-fine.js'; s.async = true; s.onload = takeFine;
      document.head.appendChild(s);
    };

    const probe = document.createElement('i'); probe.hidden = true; document.body.appendChild(probe);
    let COL = {};
    const readColours = () => {
      const get = v => { probe.style.color = 'var(' + v + ')'; return getComputedStyle(probe).color; };
      COL = { sea: get('--globe-sea'), land: get('--land'), border: get('--map-border'), grat: get('--map-grat'),
              water: get('--water'), limb: get('--globe-limb'), shade: get('--globe-shade') };
    };

    let cam = { lon: -22, lat: 40, R: 300, ox: innerWidth / 2, oy: innerHeight / 2 };
    let E = [0, 1, 0], NV = [0, 0, 1], CV = [1, 0, 0];
    const basis = (c = cam) => {
      const l = c.lon * D2R, p = c.lat * D2R, sl = Math.sin(l), cl = Math.cos(l), sp = Math.sin(p), cp = Math.cos(p);
      E = [-sl, cl, 0]; NV = [-sp * cl, -sp * sl, cp]; CV = [cp * cl, cp * sl, sp];
    };
    const proj = v => [cam.ox + cam.R * dot(v, E), cam.oy - cam.R * dot(v, NV), dot(v, CV)];
    let SR = stage.getBoundingClientRect(), CR = cvs.getBoundingClientRect(), dpr = 1;
    const sizeCanvas = () => {
      SR = stage.getBoundingClientRect(); CR = cvs.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(CR.width * dpr)), h = Math.max(1, Math.round(CR.height * dpr));
      if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
      svg.setAttribute('viewBox', '0 0 ' + SR.width.toFixed(1) + ' ' + SR.height.toFixed(1));
    };

    let VX = new Float64Array(2048), VY = new Float64Array(2048), VZ = new Float64Array(2048);
    let OX = 0, OY = 0, RR = 1, VANG = Math.PI / 2;
    const seen = r => Math.acos(clamp(r.c[0] * CV[0] + r.c[1] * CV[1] + r.c[2] * CV[2], -1, 1)) - r.r < VANG;
    function trace(r) {
      if (!seen(r)) return;
      const n = r.n, p = r.p;
      if (VX.length < n) { VX = new Float64Array(n * 2); VY = new Float64Array(n * 2); VZ = new Float64Array(n * 2); }
      const e0 = E[0], e1 = E[1], e2 = E[2], n0 = NV[0], n1 = NV[1], n2 = NV[2], c0 = CV[0], c1 = CV[1], c2 = CV[2];
      let vis = 0;
      for (let i = 0, k = 0; i < n; i++, k += 3) {
        const a = p[k], b = p[k + 1], c = p[k + 2];
        VX[i] = a * e0 + b * e1 + c * e2; VY[i] = a * n0 + b * n1 + c * n2;
        if ((VZ[i] = a * c0 + b * c1 + c * c2) > 0) vis++;
      }
      if (!vis) return;
      const hz = (i, j) => { const t = VZ[i] / (VZ[i] - VZ[j]), x = VX[i] + (VX[j] - VX[i]) * t, y = VY[i] + (VY[j] - VY[i]) * t, l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
      const dec = DEC / RR;
      if (!r.closed) {
        let pen = false, lx = 9, ly = 9;
        for (let i = 0; i < n; i++) {
          if (VZ[i] > 0) {
            if (pen) { if (Math.abs(VX[i] - lx) + Math.abs(VY[i] - ly) > dec || i === n - 1 || VZ[i + 1] <= 0) { ctx.lineTo(OX + RR * VX[i], OY - RR * VY[i]); lx = VX[i]; ly = VY[i]; } }
            else { if (i > 0) { const h = hz(i - 1, i); ctx.moveTo(OX + RR * h[0], OY - RR * h[1]); ctx.lineTo(OX + RR * VX[i], OY - RR * VY[i]); } else ctx.moveTo(OX + RR * VX[i], OY - RR * VY[i]); pen = true; }
          } else if (pen) { const h = hz(i - 1, i); ctx.lineTo(OX + RR * h[0], OY - RR * h[1]); pen = false; }
        }
        return;
      }
      if (vis === n) {
        let lx = VX[0], ly = VY[0];
        ctx.moveTo(OX + RR * lx, OY - RR * ly);
        for (let i = 1; i < n; i++) if (Math.abs(VX[i] - lx) + Math.abs(VY[i] - ly) > dec) { lx = VX[i]; ly = VY[i]; ctx.lineTo(OX + RR * lx, OY - RR * ly); }
        ctx.closePath(); return;
      }
      let s = 0; while (!(VZ[s] > 0 && VZ[(s - 1 + n) % n] <= 0)) s++;
      const pieces = []; let pc = null;
      for (let k = 0; k < n; k++) {
        const i = (s + k) % n, j = (i + 1) % n;
        if (VZ[i] <= 0) continue;
        if (!pc) { const h = hz((i - 1 + n) % n, i); pc = { a: Math.atan2(h[1], h[0]), pts: [h[0], h[1]] }; }
        const L = pc.pts.length;
        if (Math.abs(VX[i] - pc.pts[L - 2]) + Math.abs(VY[i] - pc.pts[L - 1]) > dec || VZ[j] <= 0) pc.pts.push(VX[i], VY[i]);
        if (VZ[j] <= 0) { const h = hz(i, j); pc.pts.push(h[0], h[1]); pc.b = Math.atan2(h[1], h[0]); pieces.push(pc); pc = null; }
      }
      const o = r.o, used = pieces.map(() => false);
      const next = b => { let best = 0, bd = Infinity;
        pieces.forEach((q, m) => { const d = (((o > 0 ? q.a - b : b - q.a) % TAU) + TAU) % TAU; if (d < bd) { bd = d; best = m; } });
        return [best, bd]; };
      for (let m0 = 0; m0 < pieces.length; m0++) {
        if (used[m0]) continue;
        let m = m0, first = true;
        while (!used[m]) {
          used[m] = true;
          const P = pieces[m].pts;
          if (first) { ctx.moveTo(OX + RR * P[0], OY - RR * P[1]); first = false; } else ctx.lineTo(OX + RR * P[0], OY - RR * P[1]);
          for (let t = 2; t < P.length; t += 2) ctx.lineTo(OX + RR * P[t], OY - RR * P[t + 1]);
          const [nx, d] = next(pieces[m].b), b = pieces[m].b;
          ctx.arc(OX, OY, RR, -b, o > 0 ? -b - d : -b + d, o > 0);
          m = nx;
        }
        ctx.closePath();
      }
    }
    function ground(land, lakes, rivers) {
      ctx.beginPath(); land.forEach(trace);
      ctx.fillStyle = COL.land; ctx.fill(); ctx.lineWidth = 0.55; ctx.strokeStyle = COL.border; ctx.stroke();
      ctx.beginPath(); lakes.forEach(trace); ctx.fillStyle = COL.sea; ctx.fill();
      ctx.beginPath(); rivers.forEach(trace); ctx.lineWidth = 0.8; ctx.strokeStyle = COL.water; ctx.stroke();
    }
    function draw() {
      basis();
      const W = CR.width, H = CR.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      OX = cam.ox - CR.left; OY = cam.oy - CR.top; RR = cam.R;
      const far = Math.max(Math.hypot(OX, OY), Math.hypot(W - OX, OY), Math.hypot(OX, H - OY), Math.hypot(W - OX, H - OY));
      VANG = far >= RR ? Math.PI / 2 : Math.asin(far / RR);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(OX, OY, RR, 0, TAU); ctx.fillStyle = COL.sea; ctx.fill();
      ctx.beginPath(); LAND.grat.forEach(trace); ctx.strokeStyle = COL.grat; ctx.lineWidth = 0.6; ctx.stroke();
      const fine = RR > FINE_R && LAND.fine.length > 0 && LAND.boxIn.some(seen);
      if (fine) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); LAND.boxOut.forEach(trace); ctx.clip('evenodd'); }
      ground(LAND.world, LAND.lakes, LAND.rivers);
      if (fine) {
        ctx.restore(); ctx.save(); ctx.beginPath(); LAND.boxIn.forEach(trace); ctx.clip();
        ground(RR < MID_R ? LAND.mid : LAND.fine, LAND.fineLakes, LAND.fineRivers); ctx.restore();
      }
      if (RR < 3 * Math.max(W, H)) {
        const g = ctx.createRadialGradient(OX, OY, RR * 0.7, OX, OY, RR);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, COL.shade);
        ctx.beginPath(); ctx.arc(OX, OY, RR, 0, TAU); ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = COL.limb; ctx.stroke();
      }
    }

    const pins = [...svg.querySelectorAll('.pin')];
    pins.forEach(a => { a.v = vec(+a.dataset.lon, +a.dataset.lat); a.querySelectorAll('circle').forEach(c => { c.setAttribute('cx', 0); c.setAttribute('cy', 0); }); });
    const labs = [...svg.querySelectorAll('.lab')];
    const card = document.getElementById('card');
    const intro = document.getElementById('intro');
    const steps = [...document.querySelectorAll('.step')];
    let route = null;
    let anim = null, shownStop = null, shownTrip = null, manual = false;
    let introGone = false;
    let want = null, frameKey = '';

    const pinOf = id => svg.querySelector('.pin[data-id="' + id + '"]');
    const tour = steps.filter(st => st.dataset.step !== 'world').map(st => {
      const city = st.dataset.step, el = document.querySelector('.stay[data-city="' + city + '"]'), a = pinOf(city);
      return { id: city, city, el, step: st, now: !!el.dataset.now,
               name: document.getElementById(city).querySelector('h2').textContent, lon: +a.dataset.lon, lat: +a.dataset.lat, v: a.v };
    });
    const N = tour.length, idx = new Map(tour.map((t, i) => [t.city, i]));
    const trips = new Map(pins.filter(a => a.classList.contains('pin-trip')).map(a => {
      const el = document.getElementById(a.dataset.id);
      return [a.dataset.id, { id: a.dataset.id, el, name: el.querySelector('h2').textContent,
        years: (el.querySelector('.yrs') || {}).textContent || '', lon: +a.dataset.lon, lat: +a.dataset.lat, v: a.v }];
    }));
    const tm = i => Math.round(B.rampMin + (100 - B.rampMin) * (N > 1 ? i / (N - 1) : 1)) + '%';
    const stopOf = key => idx.has(key) ? idx.get(key) : (tour.findIndex(t => key.indexOf(t.city + '-') === 0));

    const PXS = { dot: 4.6, hit: 22, font: 11 };
    const ASC = 8, DESC = 2.6, PAD = 1.5;
    const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    const segHitsBox = (x1, y1, x2, y2, b) => {
      let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
      for (const [pp, qq] of [[-dx, x1 - b[0]], [dx, b[2] - x1], [-dy, y1 - b[1]], [dy, b[3] - y1]]) {
        if (pp === 0) { if (qq < 0) return false; }
        else { const t = qq / pp; if (pp < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); }
      }
      return t0 <= t1;
    };
    const segDist = (px, py, x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L)) : 0;
      return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
    };
    const cross = (a, b) => {
      const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      return o(a[0], a[1], b[0]) !== o(a[0], a[1], b[1]) && o(b[0], b[1], a[0]) !== o(b[0], b[1], a[1]);
    };
    const labFor = new Map(labs.map(t => [t.dataset.for, t]));
    const nowLab = svg.querySelector('.lab-now');
    const hostOf = t => t.closest('a') || t;
    labs.forEach(t => { const l = document.createElementNS(SVGNS, 'line'); l.setAttribute('class', 'leader off');
      hostOf(t).parentNode.insertBefore(l, hostOf(t)); t.leader = l; });
    {
      const hg = document.createElementNS(SVGNS, 'g'); hg.setAttribute('class', 'lab-hits');
      pins[0].parentNode.parentNode.insertBefore(hg, pins[0].parentNode);
      labs.forEach(t => { const a = document.createElementNS(SVGNS, 'a'), r = document.createElementNS(SVGNS, 'rect');
        a.setAttribute('href', '#' + t.dataset.for); a.setAttribute('tabindex', '-1'); r.setAttribute('class', 'lab-hit off'); r.dataset.id = t.dataset.for;
        a.appendChild(r); hg.appendChild(a); t.hit = r; t.hitA = a; });
    }
    const widths = new Map(), last = new Map();
    let P = [];
    const FRONT = 0.04;
    const RFIT = () => 0.45 * Math.min(SR.width, SR.height);
    const isWorld = () => cam.R < 1.8 * RFIT();
    const tr = (x, y) => 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')';
    function placePins(full, quick) {
      basis();
      const sl = SR.left, st = SR.top;
      P = pins.map(a => { const [x, y, z] = proj(a.v); return { a, id: a.dataset.id, w: +a.dataset.w || 1, x, y, z, front: z > FRONT }; });
      P.forEach(q => {
        const t = labFor.get(q.id), els = [q.a]; if (t) els.push(hostOf(t), t.leader, t.hitA);
        if (nowLab && q.a.classList.contains('pin-now')) els.push(nowLab);
        const T = tr(q.x - sl, q.y - st);
        els.forEach(el => { el.classList.toggle('back', !q.front); if (q.front) el.setAttribute('transform', T); });
      });
      if (!full) return;
      const p = PXS, front = P.filter(q => q.front);
      const gap = q => Math.min(...front.filter(o => o !== q).map(o => Math.hypot(o.x - q.x, o.y - q.y)), 400);
      front.forEach(q => { q.r = Math.max(2.2, Math.min(p.dot * q.w, Math.max(gap(q) / 2 - 1, 4))); q.nowR = q.r + 5.6; q.g = gap(q); });
      front.forEach(q => { if (q.a.classList.contains('pin-now'))
        q.nowR = Math.max(q.r + 2.5, Math.min(q.nowR, ...front.filter(o => o !== q).map(o => Math.hypot(o.x - q.x, o.y - q.y) - o.r - 2.5))); });
      front.forEach(q => {
        const a = q.a, f = sel => a.querySelector(sel);
        f('.dot').setAttribute('r', q.r.toFixed(2));
        f('.hit').setAttribute('r', Math.max(20, Math.min(p.hit, q.g / 2)).toFixed(1));
        const ring = f('.ring'); ring.setAttribute('r', (q.nowR + 3.5).toFixed(2)); ring.setAttribute('stroke-width', 1.2);
        f('.pulse').setAttribute('r', (q.r + 3.1).toFixed(2));
        const halo = f('.halo'); if (halo) halo.setAttribute('r', (q.r + 1.5).toFixed(2));
        const nr = f('.now-ring'); if (nr) { nr.setAttribute('r', q.nowR.toFixed(2)); nr.setAttribute('stroke-width', 1.6); }
      });
      const R = svg.getBoundingClientRect();
      const open = getComputedStyle(svg).overflow === 'visible', m = isWorld() ? 16 : 4;
      const view = open ? [m, m, innerWidth - m, innerHeight - m]
        : [Math.max(R.left, 0) + m, Math.max(R.top, 0) + m, Math.min(R.right, innerWidth) - m, Math.min(R.bottom, innerHeight) - m];
      const taken = [];
      ['#card:not([hidden])', '#intro', '.mapbase', phone.matches ? '.bar' : '.bar > *', '.tkey', '.cue', '#tl', '#tl .tl-y', '#pathx:not([hidden])'].forEach(sel => document.querySelectorAll(sel).forEach(e => {
        const b = e.getBoundingClientRect(); if (b.width) taken.push([b.left - 4, b.top - 4, b.right + 4, b.bottom + 4]); }));
      const vis = front.filter(q => q.x > view[0] - 4 && q.x < view[2] + 4 && q.y > view[1] - 4 && q.y < view[3] + 4 &&
        (open || (q.x > R.left && q.x < R.right && q.y > R.top && q.y < R.bottom)) &&
        !taken.some(b => q.x > b[0] + 4 && q.x < b[2] - 4 && q.y > b[1] + 4 && q.y < b[3] - 4));
      const dots = vis.map(q => [q, [q.x - q.r - 2, q.y - q.r - 2, q.x + q.r + 2, q.y + q.r + 2]]);
      if (nowLab) {
        const q = front.find(q => q.a.classList.contains('pin-now'));
        if (q) {
          nowLab.setAttribute('font-size', 11); nowLab.setAttribute('stroke-width', 3); nowLab.setAttribute('text-anchor', 'middle');
          nowLab.setAttribute('x', 0); nowLab.setAttribute('y', (q.nowR + 11).toFixed(1));
          if (vis.includes(q)) taken.push([q.x - 11, q.y + q.nowR + 3, q.x + 11, q.y + q.nowR + 13.5]);
        }
      }
      labs.forEach(t => { t.setAttribute('font-size', p.font); t.setAttribute('stroke-width', 3); });
      vis.forEach(q => { const t = labFor.get(q.id); if (t && !widths.get(t)) { t.classList.remove('off'); const w = t.getBBox().width; if (w) widths.set(t, w); } });
      const world = isWorld();
      const crowd = new Map(vis.map(q => [q.id, vis.filter(o => o !== q && Math.hypot(o.x - q.x, o.y - q.y) < 40 * (world ? 1 : 2.5)).length]));
      const gapTo = (b, q) => Math.hypot(Math.max(b[0] - q.x, 0, q.x - b[2]), Math.max(b[1] - q.y, 0, q.y - b[3]));
      const inside = b => b[0] >= view[0] && b[2] <= view[2] && b[1] >= view[1] && b[3] <= view[3];
      const boxAt = (lx, ly, dx, dy, w, shift = 0) => {
        const h = ASC + DESC;
        const x0 = dx > 0.38 ? lx : dx < -0.38 ? lx - w : lx - w / 2 + shift * (w / 2 - 4);
        const y0 = dy > 0.38 ? ly : dy < -0.38 ? ly - h : ly - h / 2;
        return { b: [x0 - PAD, y0 - PAD, x0 + w + PAD, y0 + h + PAD], x: x0, base: y0 + ASC };
      };
      const order = vis.slice().sort((m, n) =>
        (labFor.get(n.id).classList.contains('on') - labFor.get(m.id).classList.contains('on')) ||
        (n.a.classList.contains('pin-now') - m.a.classList.contains('pin-now')) ||
        (crowd.get(n.id) - crowd.get(m.id)) || (n.w - m.w));
      const cands = new Map();
      vis.forEach(q => {
        const g = q.r + 3 + PAD, d = 0.7071;
        const list = [[1, 0], [-1, 0], [0, -1], [0, 1], [d, d], [d, -d], [-d, d], [-d, -d]]
          .map(([dx, dy]) => ({ dx, dy, L: g, lead: false, shift: 0 }));
        const prev = last.get(labFor.get(q.id));
        if (prev && !prev.lead) list.unshift({ ...prev, L: g });
        if (prev && prev.lead) list.push({ ...prev, L: g + prev.L - prev.g });
        let cx = 0, cy = 0, n = 0;
        vis.forEach(o => { if (o !== q && Math.hypot(o.x - q.x, o.y - q.y) < 90) { cx += o.x - q.x; cy += o.y - q.y; n++; } });
        const away = n ? Math.atan2(-cy, -cx) : Math.PI / 2;
        for (const L of (crowd.get(q.id) >= 2 && world ? [20, 30, 42, 56, 72, 92, 116, 144, 176] : [12, 20, 30, 42, 56, 72, 92, 116, 144, 176])) {
          for (let i = 0; i < 24; i++) {
            const th = away + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12, dx = Math.cos(th), dy = Math.sin(th);
            list.push({ dx, dy, L: g + L, g, lead: true, shift: 0 });
            if (Math.abs(dx) <= 0.38) list.push({ dx, dy, L: g + L, g, lead: true, shift: 1 }, { dx, dy, L: g + L, g, lead: true, shift: -1 });
          }
        }
        cands.set(q, list);
      });
      const fit = (q, picks) => {
        const t = labFor.get(q.id), w = widths.get(t);
        const others = [...picks.entries()].filter(([o]) => o !== q).map(([, pk]) => pk);
        for (const strict of [true, false]) {
          for (const c of cands.get(q)) {
            if (!strict && !c.lead) continue;
            const lx = q.x + c.dx * c.L, ly = q.y + c.dy * c.L;
            const bx = boxAt(lx, ly, c.dx, c.dy, w, c.shift);
            if (!inside(bx.b) || taken.some(o => overlap(bx.b, o)) || dots.some(([o, b]) => o !== q && overlap(bx.b, b))) continue;
            if (others.some(pk => overlap(bx.b, pk.bx.b) || (pk.seg && segHitsBox(...pk.seg[0], ...pk.seg[1], bx.b)))) continue;
            const own = gapTo(bx.b, q);
            if (strict && !vis.every(o => o === q || gapTo(bx.b, o) > (crowd.get(q.id) >= 2 && world ? Math.max(own * 2.2, own + 8) : Math.max(own * 1.5, own + 4)))) continue;
            if (!strict && !vis.every(o => o === q || (gapTo(bx.b, o) > o.r + 6 && own < gapTo(bx.b, o) + 24))) continue;
            if (!c.lead) return { c, bx };
            const seg = [[q.x + c.dx * (q.r + 1.5), q.y + c.dy * (q.r + 1.5)], [lx - c.dx * PAD, ly - c.dy * PAD]];
            if (vis.some(o => o !== q && segDist(o.x, o.y, ...seg[0], ...seg[1]) < o.r + 1.2)) continue;
            if (others.some(pk => (pk.seg && cross(pk.seg, seg)) || segHitsBox(...seg[0], ...seg[1], pk.bx.b))) continue;
            return { c, bx, seg };
          }
        }
        return null;
      };
      let picks = new Map();
      const failed = [];
      order.forEach(q => { const pk = fit(q, picks); pk ? picks.set(q, pk) : failed.push(q); });
      const repair = (picks, failed) => {
        failed.forEach(q => {
          const near = [...picks.keys()].sort((m, n) => Math.hypot(m.x - q.x, m.y - q.y) - Math.hypot(n.x - q.x, n.y - q.y));
          for (const o of near) {
            const tmp = new Map(picks); tmp.delete(o);
            const pq = fit(q, tmp); if (!pq) continue;
            tmp.set(q, pq);
            const po = fit(o, tmp); if (!po) continue;
            tmp.set(o, po); picks.clear(); tmp.forEach((v, k) => picks.set(k, v)); return;
          }
        });
        return picks;
      };
      if (!quick) repair(picks, failed);
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let k = 0; !quick && k < 6 && picks.size < vis.length; k++) {
        const ord = order.map(q => [rnd(), q]).sort((m, n) => m[0] - n[0]).map(x => x[1]);
        const alt = new Map(), miss = [];
        ord.forEach(q => { const pk = fit(q, alt); pk ? alt.set(q, pk) : miss.push(q); });
        repair(alt, miss);
        if (alt.size > picks.size) picks = alt;
      }
      const off = t => { t.classList.add('off'); t.leader.classList.add('off'); t.hit.classList.add('off'); last.delete(t); };
      for (const q of vis) {
        const t = labFor.get(q.id), pick = picks.get(q);
        if (!t) continue;
        if (!pick) { off(t); continue; }
        t.classList.remove('off');
        t.setAttribute('text-anchor', 'start');
        t.setAttribute('x', (pick.bx.x - q.x).toFixed(1)); t.setAttribute('y', (pick.bx.base - q.y).toFixed(1));
        last.set(t, pick.c);
        { const b = pick.bx.b, w = Math.max(b[2] - b[0], 44), h = Math.max(b[3] - b[1], 44), cx = (b[0] + b[2]) / 2 - q.x, cy = (b[1] + b[3]) / 2 - q.y, r = t.hit;
          r.setAttribute('x', (cx - w / 2).toFixed(1)); r.setAttribute('y', (cy - h / 2).toFixed(1));
          r.setAttribute('width', w.toFixed(1)); r.setAttribute('height', h.toFixed(1)); r.classList.remove('off'); }
        if (pick.seg) {
          const l = t.leader;
          l.setAttribute('x1', (pick.seg[0][0] - q.x).toFixed(1)); l.setAttribute('y1', (pick.seg[0][1] - q.y).toFixed(1));
          l.setAttribute('x2', (pick.seg[1][0] - q.x).toFixed(1)); l.setAttribute('y2', (pick.seg[1][1] - q.y).toFixed(1));
          l.setAttribute('stroke-width', 1); l.classList.remove('off');
        } else t.leader.classList.add('off');
      }
      labs.forEach(t => { if (!vis.some(q => labFor.get(q.id) === t)) off(t); });
    }
    const size = () => placePins(true);

    function render(lite) {
      draw();
      placePins(!lite, !!(anim || inert || drag || pinch));
      if (route) placeRoute();
      if (manual && !lite) focusCentre();
    }
    let rq = 0, rqLite = true, rqN = 0;
    const queue = (lite = true) => {
      rqLite = rqLite && lite;
      if (!rq) rq = requestAnimationFrame(() => { rq = 0; const l = rqLite && (++rqN % 4 !== 0); rqLite = true; render(l); });
    };
    let movingTimer = 0;
    const moving = (on, hold = 0) => {
      clearTimeout(movingTimer);
      if (on) root.classList.add('moving');
      else if (hold) movingTimer = setTimeout(() => root.classList.remove('moving'), hold);
      else root.classList.remove('moving');
    };
    let inert = 0;
    const stopInertia = () => { if (inert) { cancelAnimationFrame(inert); inert = 0; moving(false); } };
    function flyTo(to, o = {}) {
      cancelAnimationFrame(anim); anim = 0; stopInertia();
      if (o.instant || reduce) { moving(false); cam = to; render(false); return; }
      moving(true);
      const from = { ...cam }, a = vec(from.lon, from.lat), b = vec(to.lon, to.lat), t0 = performance.now();
      const d = Math.acos(clamp(dot(a, b), -1, 1)), l0 = Math.log(from.R), l1 = Math.log(to.R);
      const md = Math.min(SR.width, SR.height);
      const ov = Math.log(Math.max(0.36 * md / Math.max(Math.sin(Math.min(d, Math.PI) / 2), 1e-4), RFIT() * 0.85));
      const dip = Math.max(0, Math.min(l0, l1) - ov) > 0 ? (l0 + l1) / 2 - ov : 0;
      const D = 900 + Math.min(800, d / D2R * 6 + Math.abs(l1 - l0) / Math.LN2 * 140 + dip * 120);
      const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      let frames = 0;
      const step = now => {
        const k = Math.min(1, (now - t0) / D), e = ease(k), [lon, lat] = lonlat(slerp(a, b, e));
        cam = { lon, lat, R: Math.exp(l0 + (l1 - l0) * e - dip * 4 * e * (1 - e)), ox: from.ox + (to.ox - from.ox) * e, oy: from.oy + (to.oy - from.oy) * e };
        if (k >= 1) { anim = 0; moving(false); cam = { ...to }; render(false); return; }
        render(++frames % 3 !== 0);
        anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }

    function freeRect(withCard = true) {
      const r = svg.getBoundingClientRect(), bar = document.querySelector('.bar').getBoundingClientRect();
      const top = Math.max(r.top, bar.bottom + 4), left = Math.max(r.left, 0);
      let right = Math.min(r.right, innerWidth);
      const rail = document.getElementById('tl').getBoundingClientRect();
      if (rail.width) right = Math.min(right, rail.left - 6);
      let bottom = Math.min(r.bottom, innerHeight) - 14;
      document.querySelectorAll('.mapbase').forEach(el => { const b = el.getBoundingClientRect(); if (b.width) bottom = Math.min(bottom, b.top - 8); });
      const whole = [left, top, right, Math.max(bottom, top + 80)];
      const over = withCard && !card.hidden ? card : intro;
      const c = over ? over.getBoundingClientRect() : null;
      if (!c || !c.width) return whole;
      const cands = [[left, c.bottom + 10, right, whole[3]], [c.right + 16, top, right, whole[3]], [left, top, c.left - 16, whole[3]], [left, top, right, c.top - 10]]
        .filter(f => f[2] - f[0] >= 120 && f[3] - f[1] >= 120);
      const area = f => (f[2] - f[0]) * (f[3] - f[1]);
      return cands.sort((m, n) => area(n) - area(m))[0] || whole;
    }
    const fitR = f => 0.5 * Math.min(f[2] - f[0], f[3] - f[1]) * 0.92;
    const mid = f => [(f[0] + f[2]) / 2, (f[1] + f[3]) / 2];
    const RMIN = () => 0.25 * Math.min(SR.width, SR.height);
    const RMAX = () => Math.min(SR.width, SR.height) / (3 * D2R);
    const START = [-22, 40];
    let WC = null;
    const worldCentre = () => {
      if (WC) return WC;
      let best = -2;
      for (let lat = 20; lat <= 58; lat += 1) for (let lon = -60; lon <= 40; lon += 1) {
        const c = vec(lon, lat); let m = 2; for (const a of pins) m = Math.min(m, dot(a.v, c));
        if (m > best) { best = m; WC = [lon, lat]; }
      }
      return WC;
    };
    function globeRoom() {
      const bar = document.querySelector('.bar').getBoundingClientRect(), rail = document.getElementById('tl').getBoundingClientRect();
      const base = document.querySelector('.mapbase').getBoundingClientRect(), ib = intro.getBoundingClientRect();
      const tlYears = [...document.querySelectorAll('#tl .tl-y')].reduce((m, e) => Math.min(m, e.getBoundingClientRect().left || m), rail.left);
      const thumbLeft = rail.left + tlThumb.offsetLeft - 22;
      let top = bar.bottom, bottom = base.height && base.top > top + 100 ? base.top : innerHeight, left = 0,
        right = phone.matches ? thumbLeft - 4 : Math.min(rail.left, tlYears);
      if (ib.width) { if (phone.matches) top = ib.bottom; else left = ib.right; }
      return [left, top, right, bottom];
    }
    function globeFit() {
      const f = globeRoom(), w = f[2] - f[0], h = f[3] - f[1];
      if (phone.matches) {
        const g = parseFloat(getComputedStyle(intro).left) || 16;
        const R = Math.max(60, Math.min((w - g) / 2, h / 2 - 16));
        return { R, ox: f[0] + g + (w - g) / 2, oy: (f[1] + f[3]) / 2 };
      }
      const R = Math.max(60, Math.min(0.45 * h, h / 2 - 24, w / 2 - 24));
      return { R, ox: (f[0] + f[2]) / 2, oy: (f[1] + f[3]) / 2 };
    }
    const startView = () => ({ lon: START[0], lat: START[1], ...globeFit() });
    const worldView = () => { const c = worldCentre(); return { lon: c[0], lat: c[1], ...globeFit() }; };
    const cityView = t => {
      const f = freeRect(), [x, y] = mid(f), fw = f[2] - f[0], fh = f[3] - f[1], span = (phone.matches ? 20 : 16) * D2R;
      return { lon: t.lon, lat: t.lat, R: clamp(Math.min(fw, fh * 1.4) / span, fitR(f), RMAX()), ox: x, oy: y };
    };

    const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function cardHTML(i) {
      const t = tour[i];
      return '<div class="sc-body"><div class="sc-head"><h2>' + esc(t.name) +
        (t.now ? '<span class="nowtag">now</span>' : '') + '</h2><span class="sc-nav"><button class="sc-step sc-prev" type="button" aria-label="Previous city"' + (i === 0 ? ' disabled' : '') +
        '>&lsaquo;</button><span class="count">' + (i + 1) + ' / ' + N + '</span><button class="sc-step sc-next" type="button" aria-label="Next city"' + (i === N - 1 ? ' disabled' : '') +
        '>&rsaquo;</button></span></div>' +
        t.el.querySelector('ol').outerHTML + '</div>';
    }
    function tripHTML(t) {
      const ph = t.el.querySelector('.photos');
      return '<div class="sc-body"><div class="sc-head"><h2>' + esc(t.name) + '</h2><span class="end"><span class="when">' + esc(t.years) +
        '</span><button class="sc-x" type="button" aria-label="Close ' + esc(t.name) + '">&times;</button></span></div>' + (ph ? ph.outerHTML : '') + '</div>';
    }
    const mark = (cls, city) => document.querySelectorAll('.pin, .chip, .lab').forEach(el => el.classList.toggle(cls, !!city && (el.dataset.id === city || el.dataset.for === city)));
    const swap = () => { card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); };
    function showStop(i, instant) {
      const t = tour[i];
      mark('on', t.city);
      const chip = document.querySelector('.chip[data-id="' + t.city + '"]');
      if (chip) { const nav = chip.parentNode;
        nav.scrollTo({ left: nav.scrollLeft + chip.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - chip.offsetWidth) / 2, behavior: reduce || instant ? 'auto' : 'smooth' }); }
      if (shownStop === i) return;
      shownStop = i; shownTrip = null;
      root.classList.toggle('at-now', t.now);
      card.classList.remove('trip');
      card.innerHTML = cardHTML(i);
      card.style.setProperty('--tm', tm(i));
      card.hidden = false;
      root.classList.add('card-open');
      swap();
    }
    function showTrip(id) {
      const t = trips.get(id);
      mark('on', id);
      if (shownTrip === id) return;
      shownTrip = id; shownStop = null;
      root.classList.remove('at-now');
      card.classList.add('trip'); card.classList.toggle('lone', t.el.querySelectorAll('.photos figure').length < 2);
      card.style.removeProperty('--tm');
      card.innerHTML = tripHTML(t);
      card.hidden = false;
      root.classList.add('card-open');
      swap();
    }
    function hideCard() {
      if (card.hidden && shownStop === null && shownTrip === null) return;
      shownStop = null; shownTrip = null; card.hidden = true; card.classList.remove('trip');
      root.classList.remove('card-open'); root.classList.add('at-now');
      mark('on', null);
    }

    const TRIP = -3;
    let pos = -2, jpos = -1, tripY = 0;
    function arrive(p, o = {}) {
      if (p === pos && !manual && !o.force) return;
      pos = p; manual = false;
      root.classList.toggle('at-start', p === -1 && !introGone);
      if (p >= -1) { jpos = p; if (!tlDrag || gest.matches) setC(p, true); }
      if (p < 0) { hideCard(); want = startView; }
      else if (p >= N) { hideCard(); want = worldView; }
      else { showStop(p, o.instant); want = () => cityView(tour[p]); }
      flyTo(want(), { instant: o.instant });
    }
    function arriveTrip(id) {
      const t = trips.get(id);
      pos = TRIP; manual = false; tripY = scrollY;
      root.classList.remove('at-start');
      halt();
      showTrip(id); want = () => cityView(t);
      flyTo(want());
    }
    const leaveTrip = () => arrive(Math.max(jpos, -1), { force: true });
    const halt = () => { cancelAnimationFrame(anim); anim = 0; stopInertia(); moving(false); };

    const stepsTop = i => { const r = steps[i + 1].getBoundingClientRect();
      return Math.max(0, r.top + scrollY + (coarse.matches ? 0 : (r.height - innerHeight) / 2)); };
    function inView() {
      const mid = innerHeight / 2; let best = 0, bd = Infinity;
      steps.forEach((st, k) => { const r = st.getBoundingClientRect(), d = r.top <= mid && r.bottom > mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (d < bd) { bd = d; best = k; } });
      return best - 1;
    }
    let born = performance.now();
    let resizing = false;
    let hold = null, holdT = 0, snapT = 0;
    const commit = () => {
      if (resizing || gest.matches) return;
      root.classList.toggle('scrolled', scrollY > 8);
      const now = performance.now();
      if (hold) {
        if (now - hold.t < 700) { later(150); return; }
        if (hold.y === null) hold.y = scrollY;
        if (Math.abs(scrollY - hold.y) < 40) return;
        hold = null;
      }
      if (pos === TRIP && Math.abs(scrollY - tripY) < 8) return;
      const p = inView();
      if (p !== pos) arrive(p, { instant: now - born < 1500 });
    };
    let settle = 0, maxWait = 0;
    const run = () => { clearTimeout(settle); clearTimeout(maxWait); settle = maxWait = 0; commit();
      if (!gest.matches && !tlDrag && !hold && !resizing) setC(pos === TRIP ? jpos : Math.max(pos, -1), true); };
    const later = ms => { clearTimeout(settle); settle = setTimeout(run, ms); if (!maxWait) maxWait = setTimeout(run, 400); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(() => later(90), { rootMargin: '-50% 0px -50% 0px', threshold: [0, 1] });
      steps.forEach(st => io.observe(st));
    }
    addEventListener('scroll', () => later(90), { passive: true });
    addEventListener('scrollend', () => later(0), { passive: true });

    function goTo(p, o = {}) {
      p = Math.max(-1, Math.min(N, p));
      if (p === -1) {
        introGone = false;
        if (intro.classList.contains('open')) intro.querySelector('.i-more').click();
      }
      if (gest.matches) { hold = null; halt(); arrive(p, { force: true, instant: o.instant }); return; }
      hold = { pos: p, t: performance.now(), y: null };
      clearTimeout(holdT); holdT = setTimeout(() => { if (hold) hold.y = scrollY; }, 720);
      halt(); arrive(p, { force: true, instant: o.instant });
      try {
        root.classList.add('nosnap');
        scrollTo(0, stepsTop(p));
      } catch (e) {   }
      clearTimeout(snapT); snapT = setTimeout(() => root.classList.remove('nosnap'), 300);
    }
    function choose(id) {
      if (window.closeSheet) closeSheet(true);
      if (idx.has(id)) goTo(idx.get(id));
      else if (trips.has(id)) arriveTrip(id);
    }

    let acted = { id: '', t: 0 }, clickT = 0;
    const idOf = el => el.dataset.id || el.dataset.for;
    const activate = id => {
      const now = performance.now();
      if (id === acted.id && now - acted.t < 450) return;
      acted = { id, t: now };
      choose(id);
    };
    document.addEventListener('click', e => {
      const t = e.target.closest && e.target.closest('.pin, .chip, .lab, .lab-hit');
      if (!t) return;
      e.preventDefault(); clickT = performance.now();
      activate(idOf(t));
    });
    let tap = null;
    document.addEventListener('pointerdown', e => {
      const t = e.pointerType === 'touch' && e.isPrimary && e.target.closest && e.target.closest('.pin, .chip, .lab, .lab-hit');
      tap = t ? { t, x: e.clientX, y: e.clientY, at: performance.now() } : null;
    }, true);
    document.addEventListener('pointerup', e => {
      const d = tap; tap = null;
      if (!d || e.pointerType !== 'touch') return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || performance.now() - d.at > 600) return;
      const up = performance.now();
      setTimeout(() => { if (clickT < up) activate(idOf(d.t)); }, 380);
    }, true);
    card.addEventListener('click', e => {
      if (e.target.closest('.sc-x')) { leaveTrip(); return; }
      const b = e.target.closest('.sc-step');
      if (!b || b.disabled) return;
      const next = b.classList.contains('sc-next'), cur = shownStop !== null ? shownStop : jpos;
      goTo(Math.max(0, Math.min(N - 1, cur + (next ? 1 : -1))));
      if (e.detail === 0) { const nb = card.querySelector(next ? '.sc-next' : '.sc-prev'); if (nb && !nb.disabled) nb.focus({ preventScroll: true }); }
    });

    const tl = document.getElementById('tl'), tlTrack = tl.querySelector('.tl-track'), tlThumb = tl.querySelector('.tl-thumb');
    const tlYear = tlThumb.querySelector('.tl-ty'), tlNotches = [...tl.querySelectorAll('.tl-n:not(.tl-s)')];
    const tlHome = tl.getAttribute('aria-valuetext');
    let tlC = -1, tlNear = -2, tlDrag = false, tlGo = -9, tlRaf = 0;
    function setC(c, glide) {
      c = Math.max(-1, Math.min(N, c)); tlC = c;
      tlThumb.style.transition = glide ? '' : 'none';
      tlThumb.style.setProperty('--f', ((c + 1) / (N + 1)).toFixed(4));
      const near = Math.round(c);
      if (near === tlNear) return;
      tlNear = near;
      tlThumb.classList.toggle('is-start', near < 0); tlThumb.classList.toggle('is-world', near >= N);
      tlYear.textContent = near >= 0 && near < N ? tlNotches[near].dataset.year : '';
      tl.setAttribute('aria-valuenow', near);
      tl.setAttribute('aria-valuetext', near < 0 ? tlHome : tlNotches[near].title);
    }
    const tlYs = () => { const a = []; for (let i = -1; i <= N; i++) a.push(stepsTop(i)); return a; };
    const cOfScroll = () => {
      const a = tlYs(), y = scrollY;
      if (y <= a[0]) return -1;
      for (let k = 1; k < a.length; k++) if (y <= a[k]) return k - 2 + (a[k] > a[k - 1] ? (y - a[k - 1]) / (a[k] - a[k - 1]) : 0);
      return N;
    };
    const scrollOfC = c => {
      const a = tlYs(), s = Math.max(0, Math.min(N + 1, c + 1)), k = Math.min(Math.floor(s), N), f = s - k;
      return a[k] + (a[k + 1] - a[k]) * f;
    };
    addEventListener('scroll', () => {
      if (gest.matches || tlDrag || tlRaf) return;
      tlRaf = requestAnimationFrame(() => {
        tlRaf = 0;
        if (resizing || (hold && (hold.y === null || Math.abs(scrollY - hold.y) < 40))) return;
        setC(cOfScroll(), false);
      });
    }, { passive: true });
    const cAt = y => { const r = tlTrack.getBoundingClientRect(); return Math.max(0, Math.min(1, (y - r.top) / r.height)) * (N + 1) - 1; };
    function tlMove(e) {
      const c = cAt(e.clientY);
      if (gest.matches) { const p = Math.round(c); if (p !== tlGo) { tlGo = p; goTo(p); } return; }
      setC(c, false);
      try { root.classList.add('nosnap'); scrollTo(0, scrollOfC(c)); } catch (x) {   }
    }
    tl.addEventListener('pointerdown', e => {
      if (e.button) return;
      e.preventDefault(); if (e.pointerType !== 'touch') tl.focus({ preventScroll: true });
      tlDrag = true; tlGo = -9; hold = null;
      try { tl.setPointerCapture(e.pointerId); } catch (x) {   }
      tlMove(e);
    });
    tl.addEventListener('pointermove', e => { if (tlDrag) tlMove(e); });
    const tlEnd = e => {
      if (!tlDrag) return;
      tlDrag = false;
      if (e.type === 'pointercancel') { setC(jpos, true); return; }
      goTo(Math.round(cAt(e.clientY)));
    };
    tl.addEventListener('pointerup', tlEnd); tl.addEventListener('pointercancel', tlEnd);
    tl.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); goTo(e.key === 'Home' ? -1 : N); }
    });

    const more = intro.querySelector('.i-more');
    more.addEventListener('click', () => {
      const open = intro.classList.toggle('open');
      more.setAttribute('aria-expanded', open); more.setAttribute('aria-label', open ? 'Show less' : 'Show more');
      if (want === startView) { halt(); flyTo(want(), { instant: true }); }
      size();
    });

    function focusCentre() {
      if (isWorld()) { hideCard(); return; }
      let best = null, bd = 0.32 * Math.min(SR.width, SR.height);
      P.forEach(q => { if (!q.front) return; const d = Math.hypot(q.x - cam.ox, q.y - cam.oy); if (d < bd) { bd = d; best = q.a; } });
      if (!best) hideCard();
      else if (idx.has(best.dataset.id)) showStop(idx.get(best.dataset.id));
      else showTrip(best.dataset.id);
    }

    const turn = (c, dx, dy) => {
      const k = Math.max(Math.cos(c.lat * D2R), 0.3);
      const lon = ((c.lon - dx / (c.R * k) / D2R) % 360 + 540) % 360 - 180;
      return { ...c, lon, lat: clamp(c.lat + dy / c.R / D2R, -90, 90) };
    };
    const zoomCam = (c, px, py, R2) => {
      R2 = clamp(R2, RMIN(), RMAX()); basis(c);
      const x = (px - c.ox) / c.R, y = (c.oy - py) / c.R, r = Math.hypot(x, y);
      if (r >= 0.98 || r < 1e-9) return { ...c, R: R2 };
      const th = Math.asin(r), r2 = r * c.R / R2, th2 = r2 >= 0.98 ? Math.asin(0.98) : Math.asin(r2), z = Math.sqrt(1 - r * r);
      const g = [x * E[0] + y * NV[0] + z * CV[0], x * E[1] + y * NV[1] + z * CV[1], x * E[2] + y * NV[2] + z * CV[2]];
      const [lon, lat] = lonlat(slerp(CV, g, (th - th2) / th));
      return { ...c, lon, lat, R: R2 };
    };
    const ptrs = new Map();
    let drag = null, moved = false, pinch = null, clearMoved = 0, lastTap = null;
    const endGesture = touch => { clearTimeout(clearMoved); clearMoved = setTimeout(() => { moved = false; }, touch ? 350 : 0); };
    const fingers = e => e.pointerType === 'touch' && gest.matches;
    const handsOn = () => {
      manual = true; want = null; halt();
      if (gest.matches && !introGone) { introGone = true; root.classList.remove('at-start'); }
    };
    function fling(vs, now) {
      if (reduce) return false;
      const rec = vs.filter(s => now - s[0] < 90);
      if (rec.length < 2) return false;
      const dt = Math.max(16, now - rec[0][0]);
      let vx = rec.slice(1).reduce((a, s) => a + s[1], 0) / dt, vy = rec.slice(1).reduce((a, s) => a + s[2], 0) / dt;
      if (Math.hypot(vx, vy) < 0.12) return false;
      let t0 = performance.now(), n = 0;
      moving(true);
      const step = t => {
        const dt = Math.min(40, t - t0), f = Math.exp(-dt / 320); t0 = t;
        cam = turn(cam, vx * dt, vy * dt); vx *= f; vy *= f;
        if (Math.hypot(vx, vy) < 0.02) { inert = 0; moving(false); render(false); return; }
        render(++n % 4 !== 0);
        inert = requestAnimationFrame(step);
      };
      inert = requestAnimationFrame(step);
      return true;
    }
    svg.addEventListener('pointerdown', e => {
      if (e.isPrimary || e.pointerType === 'mouse') ptrs.clear();
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      moved = false; stopInertia();
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        handsOn();
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, R: cam.R, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
        drag = null; moved = true;
      } else if (ptrs.size === 1) {
        drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, vs: [] };
      }
    });
    addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        moving(true); moving(false, 180);
        cam = turn(cam, m[0] - pinch.m[0], m[1] - pinch.m[1]); pinch.m = m;
        cam = zoomCam(cam, m[0], m[1], pinch.R * d / pinch.d);
        queue(); return;
      }
      if (!drag || (e.pointerType === 'touch' && !gest.matches)) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < (e.pointerType === 'touch' ? 10 : 6)) return;
      if (!moved) { moved = true; handsOn(); svg.classList.add('dragging'); moving(true); const sel = getSelection(); if (sel) sel.removeAllRanges(); }
      const mx = e.clientX - drag.lx, my = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
      cam = turn(cam, mx, my);
      drag.vs.push([e.timeStamp, mx, my]); if (drag.vs.length > 12) drag.vs.shift();
      queue();
    });
    svg.addEventListener('pointerup', e => {
      if (!fingers(e) || moved || ptrs.size !== 1 || pinch) { lastTap = null; return; }
      if (e.target.closest && e.target.closest('.pin, .lab, .lab-hit')) { lastTap = null; return; }
      const now = performance.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 32) {
        lastTap = null; handsOn(); basis();
        flyTo(zoomCam(cam, e.clientX, e.clientY, cam.R * 2));
      } else lastTap = { t: now, x: e.clientX, y: e.clientY };
    });
    const up = e => {
      const had = ptrs.has(e.pointerId);
      ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
      if (!ptrs.size) {
        const flung = had && drag && moved && fling(drag.vs, e.timeStamp);
        drag = null; svg.classList.remove('dragging');
        if (!flung && had && moved) { moving(false); render(false); }
      }
      if (moved) endGesture(e.pointerType === 'touch');
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    addEventListener('blur', () => { ptrs.clear(); drag = pinch = null; moved = false; svg.classList.remove('dragging'); });
    svg.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    let wheelT = 0;
    svg.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      halt(); manual = true; want = null; moving(true);
      clearTimeout(wheelT); wheelT = setTimeout(() => { moving(false); render(false); }, 180);
      basis(); cam = zoomCam(cam, e.clientX, e.clientY, cam.R * Math.exp(-e.deltaY * 0.01));
      queue();
    }, { passive: false });

    pins.forEach(a => {
      const t = labFor.get(a.dataset.id);
      if (!t) return;
      const show = () => { if (!hovers() || !t.classList.contains('off')) return;
        t.setAttribute('x', (4.6 * (+a.dataset.w || 1) + 4).toFixed(1)); t.setAttribute('y', 4); t.setAttribute('text-anchor', 'start'); t.classList.add('peek'); };
      const hide = () => t.classList.remove('peek');
      a.addEventListener('mouseenter', show); a.addEventListener('mouseleave', hide);
    });

    const routeG = document.getElementById('route'), pathX = document.getElementById('pathx');
    const wrapText = (t, n) => {
      const out = []; let line = '';
      String(t || '').split(/\s+/).filter(Boolean).forEach(w => {
        if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
      });
      if (line) out.push(line);
      return out;
    };
    const svgEl = (tag, cls, attrs) => {
      const e = document.createElementNS(SVGNS, tag);
      if (cls) e.setAttribute('class', cls);
      Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
      return e;
    };
    function clearPath() {
      route = null; routeG.replaceChildren(); pathX.hidden = true; root.classList.remove('path-on');
      if (want === routeView) want = null;
    }
    function spec(n, mode) {
      if (n.side !== 0) {
        const sx = n.side, x = sx * 14, y0 = 4 - (n.n - 1) * 6.5;
        return { x, y0, anchor: sx > 0 ? 'start' : 'end', box: (px, py) => sx > 0 ? [px - 12, py + y0 - 14, px + 14 + n.w, py + y0 + (n.n - 1) * 13 + 6] : [px - 14 - n.w, py + y0 - 14, px + 12, py + y0 + (n.n - 1) * 13 + 6] };
      }
      const sx = mode % 2 ? -1 : 1, up = mode > 1, y0 = up ? -(16 + (n.n - 1) * 13) : 38, x = sx > 0 ? -9 : 9;
      return { x, y0, anchor: sx > 0 ? 'start' : 'end', box: (px, py) => {
        const t = Math.min(py - 12, py + y0 - 12), b = Math.max(py + 12, py + y0 + (n.n - 1) * 13 + 5);
        return sx > 0 ? [px - 12, t, px - 9 + n.w, b] : [px + 9 - n.w, t, px + 12, b]; } };
    }
    function setMode(n, mode) {
      const sp = spec(n, mode); n.mode = mode;
      n.texts.forEach((t, j) => { t.setAttribute('x', sp.x); t.setAttribute('y', (sp.y0 + j * 13).toFixed(1)); t.setAttribute('text-anchor', sp.anchor); });
    }
    function placeRoute() {
      basis();
      const sl = SR.left, st = SR.top;
      route.arcs.forEach(a => {
        let d = '', pen = false, prev = null;
        a.pts.forEach(v => {
          const [x, y, z] = proj(v);
          if (z > 0) {
            if (!pen && prev) { const t = prev[2] / (prev[2] - z); d += 'M' + (prev[0] + (x - prev[0]) * t - sl).toFixed(1) + ' ' + (prev[1] + (y - prev[1]) * t - st).toFixed(1) + 'L'; }
            else d += pen ? 'L' : 'M';
            d += (x - sl).toFixed(1) + ' ' + (y - st).toFixed(1); pen = true;
          } else if (pen) { const t = prev[2] / (prev[2] - z); d += 'L' + (prev[0] + (x - prev[0]) * t - sl).toFixed(1) + ' ' + (prev[1] + (y - prev[1]) * t - st).toFixed(1); pen = false; }
          prev = [x, y, z];
        });
        a.els.forEach(el => el.setAttribute('d', d || 'M0 0'));
      });
      const dots = P.filter(q => q.front).map(q => [q.x, q.y]);
      let free = null;
      route.nodes.forEach(n => {
        const [px, py, z] = proj(n.v);
        n.el.classList.toggle('back', z <= FRONT);
        if (z <= FRONT) return;
        if (n.side === 0) {
          const score = m => {
            const b = spec(n, m).box(px, py);
            let sc = dots.filter(d => Math.hypot(d[0] - px, d[1] - py) > 6 && d[0] > b[0] - 6 && d[0] < b[2] + 6 && d[1] > b[1] - 6 && d[1] < b[3] + 6).length * 10;
            n.nbrs.forEach(o => { const [ox, oy] = proj(o), dx = ox - px, dy = oy - py, L = Math.hypot(dx, dy) || 1;
              [28, 50, 80].forEach(d => { const qx = px + dx / L * d, qy = py + dy / L * d; if (qx > b[0] && qx < b[2] && qy > b[1] && qy < b[3]) sc += 6; }); });
            if (m !== 0) { free = free || freeRect(); if (b[0] < free[0] + 8 || b[2] > free[2] - 8 || b[1] < free[1] + 8 || b[3] > free[3] - 8) sc += 1000; }
            return sc;
          };
          let best = n.mode, bs = score(best);
          if (bs > 0) [0, 1, 2, 3].forEach(m => { const v = score(m) + (m === n.mode ? 0 : 0.5); if (v < bs) { bs = v; best = m; } });
          if (best !== n.mode) setMode(n, best);
        }
        n.el.setAttribute('transform', tr(px - sl, py - st));
      });
    }
    function routeView() {
      const f = freeRect(), [x, y] = mid(f);
      const c = norm(route.spots.reduce((s, q) => [s[0] + q.v[0], s[1] + q.v[1], s[2] + q.v[2]], [0, 0, 0]));
      const dmax = Math.max(...route.spots.map(q => Math.acos(clamp(dot(q.v, c), -1, 1))));
      const half = 0.5 * Math.min(f[2] - f[0], f[3] - f[1]) - 90;
      const R = dmax < 1e-4 ? cityView({ lon: 0, lat: 0 }).R : clamp(Math.max(half, 60) / Math.sin(Math.min(dmax, Math.PI / 2)), Math.min(fitR(f), RFIT()), RMAX());
      const [lon, lat] = lonlat(c);
      return { lon, lat, R, ox: x, oy: y };
    }
    function showPath(path) {
      clearPath();
      const spots = [];
      (path && path.nodes || []).forEach(n => {
        let v = null;
        if (n.pin) { const a = pinOf(n.pin); if (a) v = a.v; }
        else if (isFinite(n.lat) && isFinite(n.lng)) v = vec(+n.lng, +n.lat);
        if (!v) return;
        let sp = spots.find(q => Math.acos(clamp(dot(q.v, v), -1, 1)) < 0.004);
        const lastSp = spots[spots.length - 1];
        if (!sp) { sp = { v, people: [], kind: n.kind, you: false, home: false }; spots.push(sp); }
        else if (sp !== lastSp) sp.kind = sp.kind || n.kind;
        if (n.pin === 'vienna' && n.n === 'Stefan Herytash') sp.home = true;
        else sp.people.push({ n: n.n, i: n.i });
        if (n === path.nodes[0]) sp.you = true;
      });
      const shown = spots.filter(q => q.people.length);
      if (!shown.length) return;
      const cen = norm(spots.reduce((s, q) => [s[0] + q.v[0], s[1] + q.v[1], s[2] + q.v[2]], [0, 0, 0]));
      const east = norm([-cen[1], cen[0], 0]);
      const nodes = [], arcs = [];
      spots.forEach((q, k) => {
        if (k === 0) return;
        const p = spots[k - 1], pts = [];
        for (let i = 0; i <= 48; i++) pts.push(slerp(p.v, q.v, i / 48));
        const els = [svgEl('path', 'rt-halo', { style: '--i:' + (k - 1) }), svgEl('path', 'rt-edge ' + (q.kind === 'col' ? 'rt-col' : 'rt-co'), { style: '--i:' + (k - 1) })];
        els.forEach(el => routeG.appendChild(el));
        arcs.push({ pts, els });
      });
      spots.forEach((q, k) => {
        if (!q.people.length) return;
        const g = svgEl('g', 'rt-node', { style: '--i:' + k });
        const side = q.home ? 0 : (dot(q.v, east) < 0 ? -1 : 1);
        g.appendChild(q.you ? svgEl('circle', 'rt-ring', { r: 8.5 }) : svgEl('circle', 'rt-dot', { r: 5.5 }));
        const lines = [];
        q.people.forEach(p => { wrapText(p.n, phone.matches ? 21 : 27).forEach(t => lines.push([t, 'rt-name']));
          wrapText(p.i, phone.matches ? 21 : 27).slice(0, 2).forEach(t => lines.push([t, 'rt-inst'])); });
        const texts = lines.map(l => { const t = svgEl('text', l[1]); t.textContent = l[0]; g.appendChild(t); return t; });
        routeG.appendChild(g);
        const nbrs = [spots[k - 1], spots[k + 1]].filter(Boolean).map(o => o.v);
        const node = { el: g, v: q.v, side, w: Math.max(...lines.map(l => l[0].length)) * 6.6 + 4, n: lines.length, texts, nbrs, mode: 0 };
        nodes.push(node); setMode(node, 0);
      });
      route = { nodes, arcs, spots }; root.classList.add('path-on');
      pathX.hidden = false; placeX();
      if (gest.matches && !introGone) { introGone = true; root.classList.remove('at-start'); }
      halt(); manual = false; want = routeView;
      flyTo(want());
    }
    window.mapShowPath = showPath;
    pathX.addEventListener('click', clearPath);
    const placeX = () => {
      const c = !card.hidden && phone.matches ? card.getBoundingClientRect() : null;
      pathX.style.top = c && c.height ? Math.round(c.bottom + 8) + 'px' : '';
    };
    if ('MutationObserver' in window) new MutationObserver(placeX).observe(card, { attributes: true, childList: true, attributeFilter: ['hidden', 'class'] });
    addEventListener('resize', placeX);
    const takePending = () => {
      let raw = null;
      try { raw = sessionStorage.getItem('sh-path'); sessionStorage.removeItem('sh-path'); } catch (e) {   }
      if (!raw) return;
      try { showPath(JSON.parse(raw)); } catch (e) {   }
    };

    let stepT = 0;
    function stepBy(dir) {
      const cur = pos === TRIP ? jpos : Math.max(pos, -1), nxt = Math.max(-1, Math.min(N, cur + dir));
      if (nxt === cur && pos !== TRIP) return;
      goTo(nxt);
    }
    addEventListener('keydown', e => {
      const el = e.target;
      if (el && el.closest && el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (document.querySelector('.sheet:target')) return;
      if (e.key === 'Escape') { if (pos === TRIP) leaveTrip(); else hideCard(); return; }
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const dir = { ArrowDown: 1, ArrowRight: 1, j: 1, ArrowUp: -1, ArrowLeft: -1, k: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - stepT < 220) return;
      stepT = now; stepBy(dir);
    });

    const barEdge = () => root.style.setProperty('--bar-b', Math.ceil(document.querySelector('.bar').getBoundingClientRect().bottom) + 'px');
    if ('ResizeObserver' in window) new ResizeObserver(barEdge).observe(document.querySelector('.bar'));
    if (window.visualViewport) visualViewport.addEventListener('resize', barEdge);
    addEventListener('load', barEdge);
    const frame = () => { const r = svg.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    let lastW = innerWidth, lastH = innerHeight, resizeT = 0;
    addEventListener('resize', () => {
      barEdge();
      resizing = true;
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        const k = frame(), real = innerWidth !== lastW || Math.abs(innerHeight - lastH) > 150;
        lastW = innerWidth; lastH = innerHeight;
        if (real && pos >= -1 && !gest.matches) { try { scrollTo(0, stepsTop(pos)); } catch (e) {   } }
        resizing = false;
        sizeCanvas();
        if (k !== frameKey) { frameKey = k; if (want && !manual) { halt(); cam = want(); } }
        render(false);
        later(150);
      }, 140);
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => { const w = cvs.width; sizeCanvas(); if (cvs.width !== w || !resizing) render(true); }).observe(stage);
    const handOver = () => { halt(); hold = null; try { if (gest.matches) scrollTo(0, 0); else goTo(Math.max(-1, pos === TRIP ? jpos : pos), { instant: true }); } catch (e) {   } };
    gest.addEventListener ? gest.addEventListener('change', handOver) : gest.addListener(handOver);
    addEventListener('pageshow', e => {
      if (!e.persisted) return;
      halt(); manual = false; hold = null; barEdge(); born = performance.now(); pos = -2; commit(); size();
    });
    if (document.fonts) document.fonts.ready.then(() => {
      widths.clear();
      if (want && !manual) { frameKey = frame(); cam = want(); }
      render(false);
    });
    const repaint = () => { readColours(); draw(); };
    if ('MutationObserver' in window) new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    const dark = matchMedia('(prefers-color-scheme: dark)');
    dark.addEventListener ? dark.addEventListener('change', repaint) : dark.addListener(repaint);

    root.classList.add('at-now', 'at-start'); barEdge(); sizeCanvas(); readColours();
    want = startView; frameKey = frame();
    cam = want(); render(false);
    const fromHash = () => {
      const key = decodeURIComponent(location.hash.slice(1)), i = stopOf(key);
      if (i >= 0) {
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
        goTo(i);
      } else if (trips.has(key)) {
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
        arriveTrip(key);
      }
    };
    const navType = (performance.getEntriesByType && (performance.getEntriesByType('navigation')[0] || {}).type) || 'navigate';
    const isPlace = () => { const k = decodeURIComponent(location.hash.slice(1)); return stopOf(k) >= 0 || trips.has(k); };
    const first = () => { if (navType === 'navigate') fromHash(); else if (location.hash && isPlace()) history.replaceState(null, '', location.pathname + location.search); };
    document.readyState === 'complete' ? requestAnimationFrame(first) : addEventListener('load', () => requestAnimationFrame(first));
    addEventListener('hashchange', fromHash);
    later(0);
    const afterPaint = () => requestAnimationFrame(() => setTimeout(loadFine, 0));
    document.readyState === 'complete' ? afterPaint() : addEventListener('load', afterPaint);
    document.readyState === 'complete' ? setTimeout(takePending, 450) : addEventListener('load', () => setTimeout(takePending, 450));
  };
  if (window.GLOBE_LAND) boot(); else addEventListener('DOMContentLoaded', boot);
  })();
