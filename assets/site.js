


(() => {
  const E = 'dGEuY2EudXdAaHNhdHlyZWgubmFmZXRz';
  const addr = () => atob(E).split('').reverse().join('');

  const btn = document.getElementById('show-email');
  const reveal = () => {
    const b = document.getElementById('show-email');
    if (!b) return;
    const a = document.createElement('a');
    a.className = 'mailto';
    a.textContent = addr();
    a.href = 'mailto:' + addr();
    b.replaceWith(a);
  };
  if (btn) btn.addEventListener('click', reveal);
  const form = document.getElementById('cform');
  if (form) {
    form.addEventListener('submit', () => {
      form.action = 'https://formsubmit.co/' + addr();
      const next = form.querySelector('input[name="_next"]');
      if (next) next.value = location.origin + location.pathname + '?sent=1#contact';
    });
  }
  window.wireThesis = () => {
    const tm = document.getElementById('thesis-mail');
    if (tm) {
      tm.addEventListener('click', () => {
        tm.href = 'mailto:' + addr() +
          '?subject=' + encodeURIComponent('Thesis supervision inquiry') +
          '&body=' + encodeURIComponent(
            'Dear Professor Herytash,\n\n' +
            'Programme and semester: \n' +
            'The question I care about: \n' +
            'Why this topic: \n' +
            'Timeline: \n\n' +
            '(CV and transcript attached)\n');
      });
    }
  };
})();

(() => {
  let pushed = false;
  let trigger = null;
  const sheet = document.getElementById('contact');
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href="#contact"], a[href="#finder"], a[href^="#contact-"]');
    if (a && !isOpen()) {
      pushed = true; trigger = a;
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    }
  }, true);
  const isOpen = () => location.hash === '#contact';
  const focusSheet = () => {
    if (!sheet || sheet.contains(document.activeElement)) return;
    sheet.tabIndex = -1; sheet.focus({ preventScroll: true });
  };
  window.closeSheet = (keepStep) => {
    if (!isOpen()) return;
    if (pushed) {
      pushed = false;
      history.back(); return;
    }
    location.replace('#_');
    history.replaceState(null, '', location.pathname + location.search);
  };
  addEventListener('hashchange', () => {
    if (isOpen()) { focusSheet(); return; }
    if (/^#(contact-|finder$)/.test(location.hash)) return;
    pushed = false;
    if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    const t = trigger; trigger = null;
    if (t && t.isConnected) t.focus({ preventScroll: true });
  });
  if (isOpen()) focusSheet();
  document.querySelectorAll('.sheet .close').forEach(c =>
    c.addEventListener('click', e => { e.preventDefault(); window.closeSheet(); }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) window.closeSheet();
  });
})();

(() => {
  const panel = document.getElementById('who-panel');
  const subj = document.getElementById('form-subject');
  const when = document.getElementById('f-when');
  const whenWrap = document.getElementById('f-when-wrap');
  if (!panel) return;
  const T = {
    research: { s: 'Website — research',
      h: '<p>I&rsquo;m always glad to hear from potential collaborators.</p>' },
    student: { s: 'Website — thesis supervision inquiry',
      h: '<p>If you want to write your thesis with me, get in touch.</p>' +
         '<p><a class="btn btn-ghost" id="thesis-mail" href="#contact">Use the thesis inquiry template</a></p>' },
    industry: { s: 'Website — industry',
      h: '<p>I take on selected consulting projects and talks.</p>' },
  };
  const pick = who => {
    document.querySelectorAll('.whobtn').forEach(x => {
      x.classList.toggle('active', x.dataset.who === who);
      x.setAttribute('aria-pressed', x.dataset.who === who ? 'true' : 'false');
    });
    panel.innerHTML = T[who].h;
    if (subj) subj.value = T[who].s;
    if (when && whenWrap) {
      whenWrap.hidden = who !== 'student';
      when.disabled = who !== 'student';
      if (who === 'student' && !when.value) when.value = 'Wednesday, 4 pm';
    }
    wireThesis();
  };
  window.pickWho = who => { if (T[who]) pick(who); };
  document.querySelectorAll('.whobtn').forEach(b => b.addEventListener('click', () => pick(b.dataset.who)));
  pick('research');
  if (new URLSearchParams(location.search).get('sent')) {
    const ok = document.getElementById('form-sent');
    if (ok) ok.hidden = false;
  }
})();


(() => {
  const go = document.getElementById('finder-go');
  const inp = document.getElementById('finder-name');
  const out = document.getElementById('finder-out');
  if (!go || !inp || !out) return;
  if (!window.crypto || !crypto.subtle) {
    go.disabled = true;
    out.textContent = 'The finder needs a secure connection (https).';
    return;
  }
  const enc = new TextEncoder(), dec = new TextDecoder();
  const TR = { 'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'đ': 'd',
    'ð': 'd', 'ł': 'l', 'ı': 'i', 'þ': 'th' };
  const norm = v => v.toLowerCase().replace(/[øßæœđðłıþ]/g, c => TR[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, ' ').trim();
  const keyOf = v => norm(v).split(' ').filter(t => t.length > 1).sort().join(' ');
  const sha = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  const STAYS = JSON.parse((document.getElementById('finder-stays') || { textContent: '[]' }).textContent);
  const MY_PLACES = ['Ludwig-Maximilians', 'Vienna University of Economics', 'Wirtschaftsuniversität',
    'University of Zurich', 'Vienna University of Technology', 'TU Wien', 'EM Lyon', 'Stanford'];
  const OA = 'https://api.openalex.org/';
  const CHECK_AT_MOST = 6;
  const TITLES_PER_EDGE = 3;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const failure = kind => Object.assign(new Error(kind), { kind });
  async function getJSON(url, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms || 10000);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (r.status === 429) throw failure('limit');
      if (!r.ok) throw failure('net');
      return await r.json();
    } catch (e) {
      if (e.kind) throw e;
      throw failure(e && e.name === 'AbortError' ? 'timeout' : 'net');
    } finally { clearTimeout(timer); }
  }
  async function oa(path) {
    try { return await getJSON(OA + path); }
    catch (e) {
      if (e.kind !== 'net') throw e;
      await new Promise(r => setTimeout(r, 700));
      return getJSON(OA + path);
    }
  }
  const idOf = u => String(u).split('/').pop();
  function lev(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  let db = null;
  async function lookup(name) {
    if (!db) {
      try { db = await (await fetch('/people.enc.json')).json(); }
      catch (e) { db = {}; }
    }
    const nm = norm(name);
    if (!nm) return null;
    const lk = hex(await sha(enc.encode('sh-lookup-1|' + nm))).slice(0, 16);
    const ct = db[lk];
    if (!ct) return null;
    const key0 = await sha(enc.encode('sh-enc-1|' + nm));
    const c = unhex(ct), pt = new Uint8Array(c.length);
    for (let i = 0; i < c.length; i += 32) {
      const blk = new Uint8Array(key0.length + 1);
      blk.set(key0); blk[key0.length] = i / 32;
      const ks = await sha(blk);
      for (let j = 0; j < 32 && i + j < c.length; j++) pt[i + j] = c[i + j] ^ ks[j];
    }
    try { return dec.decode(pt); } catch (e) { return null; }
  }

  let G = null;
  async function loadGraph() {
    if (G) return G;
    let d = null;
    try { d = await getJSON('/graph.json', 15000); } catch (e) {}
    const g = { ok: !!(d && d.v === 2), stefan: new Set(), papers: [], hop1: [],
      byId: new Map(), byKey: new Map(), hop2: new Map() };
    if (g.ok) {
      d.stefan.forEach(i => g.stefan.add(i));
      g.papers = d.papers;
      g.hop1 = d.hop1.map(e => ({ ids: e.i, n: e.n, p: e.p, key: keyOf(e.n) }));
      g.hop1.forEach((e, k) => {
        e.ids.forEach(i => g.byId.set(i, k));
        if (!g.byKey.has(e.key)) g.byKey.set(e.key, []);
        g.byKey.get(e.key).push(k);
      });
      let num = 0;
      (d.hop2 || '').split(',').forEach(t => {
        if (!t) return;
        const [delta, links] = t.split(':');
        num += parseInt(delta, 36);
        g.hop2.set('A' + num, links.split('-').map(x => parseInt(x, 36)));
      });
    }
    if (g.ok) G = g;
    return g;
  }

  function offlineHit(g, c) {
    for (const i of c.ids) if (g.stefan.has(i)) return { steps: 0 };
    for (const i of c.ids) if (g.byId.has(i)) return { steps: 1, k: g.byId.get(i) };
    for (const i of c.ids) if (g.hop2.has(i)) return { steps: 2, links: g.hop2.get(i) };
    return null;
  }
  async function liveHit(g, c) {
    const r = await oa('works?filter=author.id:' + c.ids[0] + '&group_by=author.id&per-page=200');
    const co = (r.group_by || []).map(x => ({ id: idOf(x.key), name: x.key_display_name, n: x.count }))
      .filter(x => x.id !== c.ids[0]);
    const best = (a, b) => b.n - a.n || g.hop1[b.k].p.length - g.hop1[a.k].p.length;
    const byId = co.filter(x => g.byId.has(x.id)).map(x => ({ ...x, k: g.byId.get(x.id) })).sort(best);
    const byName = co.filter(x => !g.byId.has(x.id)).map(x => {
      const ks = g.byKey.get(keyOf(x.name));
      return ks && ks.length === 1 && keyOf(x.name).indexOf(' ') > 0 ? { ...x, k: ks[0] } : null;
    }).filter(Boolean).sort(best);
    const two = byId.concat(byName);
    if (two.length) {
      const seen = new Set();
      const all = two.filter(x => !seen.has(x.k) && seen.add(x.k));
      return { steps: 2, via: all[0], others: all.slice(1, 4).map(x => g.hop1[x.k].n) };
    }
    const three = co.filter(x => g.hop2.has(x.id)).sort((a, b) => b.n - a.n);
    if (three.length) return { steps: 3, mid: three[0], k: g.hop2.get(three[0].id)[0] };
    return null;
  }
  async function bestHit(g, cands) {
    let best = null;
    const take = (c, hit) => {
      const ks = g.byKey.get(keyOf(c.name));
      if (hit && hit.steps === 2 && keyOf(c.name).indexOf(' ') > 0 && ks && ks.length === 1) hit = { steps: 1, k: ks[0] };
      if (hit && (!best || hit.steps < best.hit.steps)) best = { c, hit };
    };
    cands.forEach(c => take(c, offlineHit(g, c)));
    if (best) return { best, failed: 0 };
    let failed = 0;
    const real = cands.filter(c => c.works > 0).slice(0, CHECK_AT_MOST);
    const live = await Promise.all(real.map(async c => {
      try { return await liveHit(g, c); } catch (e) { failed++; return null; }
    }));
    real.forEach((c, i) => take(c, live[i]));
    return { best, failed };
  }
  async function sharedWorks(a, b) {
    try {
      const r = await oa('works?filter=author.id:' + a.join('|') + ',author.id:' + b.join('|') +
        '&per-page=10&sort=cited_by_count:desc&select=title');
      const seen = new Set(), titles = [];
      (r.results || []).forEach(w => {
        const t = (w.title || '').trim(), k = norm(t);
        if (t && !seen.has(k)) { seen.add(k); titles.push(t); }
      });
      const count = (r.meta || {}).count || 0;
      return { titles: titles.slice(0, TITLES_PER_EDGE), total: count > 10 ? count : titles.length };
    } catch (e) { return { titles: [], total: 0 }; }
  }
  function withStefan(g, k) {
    const p = g.hop1[k].p;
    return { titles: p.slice(0, TITLES_PER_EDGE).map(i => g.papers[i]), total: p.length };
  }
  async function pathOf(g, c, hit) {
    const you = { name: c.name, sub: c.inst, ids: c.ids, instId: c.instId };
    const stefan = { name: 'Stefan Herytash', pin: 'vienna' };
    const via = k => ({ name: g.hop1[k].n, ids: g.hop1[k].ids.slice(0, 3) });
    if (hit.steps === 1) return { nodes: [you, stefan], edges: [withStefan(g, hit.k)], kinds: ['co'] };
    if (hit.steps === 2 && hit.via) {
      const k = hit.via.k;
      return { nodes: [you, via(k), stefan], kinds: ['co', 'co'],
        edges: [await sharedWorks(c.ids, [hit.via.id]), withStefan(g, k)], others: hit.others };
    }
    if (hit.steps === 2) {
      const ks = hit.links.filter((k, i) => hit.links.indexOf(k) === i);
      const k = ks[0];
      return { nodes: [you, via(k), stefan], kinds: ['co', 'co'],
        edges: [await sharedWorks(c.ids, g.hop1[k].ids), withStefan(g, k)],
        others: ks.slice(1).map(x => g.hop1[x].n) };
    }
    const k = hit.k;
    const [e1, e2] = await Promise.all([sharedWorks(c.ids, [hit.mid.id]), sharedWorks([hit.mid.id], g.hop1[k].ids)]);
    return { nodes: [you, { name: hit.mid.name, ids: [hit.mid.id] }, via(k), stefan], kinds: ['co', 'co', 'co'],
      edges: [e1, e2, withStefan(g, k)] };
  }

  const COL_TEXT = JSON.parse((document.getElementById('finder-colleague') || { textContent: '{}' }).textContent);
  const colText = (grp, kind) => (COL_TEXT[grp] || {})[kind] || '';
  const COL_HOME = { wu: { pin: 'vienna', inst: 'WU Vienna' }, 'lmu-som': { pin: 'munich', inst: 'LMU Munich' } };
  let CG = null;
  async function loadColleagues() {
    if (CG) return CG;
    let d = null;
    try { d = await getJSON('/graph-colleagues.json', 15000); } catch (e) {}
    const g = { ok: !!(d && d.v === 1), people: [], byId: new Map(), byKey: new Map(), co: new Map() };
    if (g.ok) {
      g.people = d.people.map(r => ({ n: r[0], grp: d.g[r[1]], key: keyOf(r[0]),
        ids: r[2] ? r[2].split(',').map(x => 'A' + parseInt(x, 36)) : [] }));
      g.people.forEach((e, k) => {
        e.ids.forEach(i => g.byId.set(i, k));
        if (!g.byKey.has(e.key)) g.byKey.set(e.key, []);
        g.byKey.get(e.key).push(k);
      });
      let num = 0;
      (d.co || '').split(',').forEach(t => {
        if (!t) return;
        const [delta, ls] = t.split(':');
        num += parseInt(delta, 36);
        g.co.set('A' + num, ls.split('-').map(x => parseInt(x, 36)));
      });
      CG = g;
    }
    return g;
  }
  const uniqueByName = (cg, name) => {
    const k = keyOf(name), ks = cg.byKey.get(k);
    return k.indexOf(' ') > 0 && ks && ks.length === 1 ? ks[0] : -1;
  };
  function colleagueOffline(cg, c) {
    for (const i of c.ids) if (cg.byId.has(i)) return { steps: 1, k: cg.byId.get(i) };
    const u = uniqueByName(cg, c.name);
    if (u >= 0) return { steps: 1, k: u };
    for (const i of c.ids) if (cg.co.has(i)) {
      const ks = cg.co.get(i).filter(k => cg.people[k].ids.length);
      if (ks.length) return { steps: 2, k: ks[0], more: ks.slice(1) };
    }
    return null;
  }
  async function colleagueLive(cg, c) {
    const r = await oa('works?filter=author.id:' + c.ids[0] + '&group_by=author.id&per-page=200');
    const co = (r.group_by || []).map(x => ({ id: idOf(x.key), name: x.key_display_name, n: x.count }))
      .filter(x => x.id !== c.ids[0]).sort((a, b) => b.n - a.n);
    const hits = [];
    co.forEach(x => {
      let k = cg.byId.has(x.id) ? cg.byId.get(x.id) : uniqueByName(cg, x.name);
      if (k >= 0 && cg.people[k].ids.length && !hits.some(h => h.k === k)) hits.push({ k, id: cg.people[k].ids[0] });
    });
    return hits.length ? { steps: 2, k: hits[0].k, more: hits.slice(1, 4).map(h => h.k) } : null;
  }
  async function colleagueHit(cands, name) {
    const cg = await loadColleagues();
    if (!cg.ok) return null;
    let best = null;
    const take = (c, hit) => { if (hit && (!best || hit.steps < best.hit.steps)) best = { c, hit }; };
    cands.forEach(c => take(c, colleagueOffline(cg, c)));
    if (!best) {
      const real = cands.filter(c => c.works > 0).slice(0, CHECK_AT_MOST);
      const live = await Promise.all(real.map(c => colleagueLive(cg, c).catch(() => null)));
      real.forEach((c, i) => take(c, live[i]));
    }
    if (!best) {
      const u = uniqueByName(cg, name);
      if (u >= 0) best = { c: { ids: [], name: cg.people[u].n, inst: '' }, hit: { steps: 1, k: u } };
    }
    return best && { cg, c: best.c, hit: best.hit };
  }
  async function presentColleague(t, col, others) {
    const { cg, c, hit } = col, who = cg.people[hit.k];
    const home = COL_HOME[who.grp] || COL_HOME.wu, stefan = { name: 'Stefan Herytash', pin: 'vienna' };
    if (hit.steps === 1) {
      show(t, el('div', 'fo-hit', colText(who.grp, 'one')),
        mapButton({ nodes: [{ name: c.name, inst: home.inst, pin: home.pin }, stefan], kinds: ['col'] }));
      return;
    }
    const nodes = [el('div', 'fo-hit', HEAD[2])];
    const shared = await sharedWorks(c.ids, who.ids);
    const ol = pathNode({ nodes: [{ name: c.name, sub: c.inst }, { name: who.n }, { name: 'Stefan Herytash' }],
      edges: [shared, { titles: [], label: colText(who.grp, 'edge') }] });
    nodes.push(ol);
    nodes.push(mapButton({ nodes: [{ name: c.name, inst: c.inst, ids: c.ids, instId: c.instId },
      { name: who.n, inst: home.inst, pin: home.pin }, stefan], kinds: ['co', 'col'] }));
    const more = (hit.more || []).map(k => cg.people[k].n);
    if (more.length) nodes.push(el('div', 'fo-sub', 'Also through ' + more.join(', ') + '.'));
    const rest = (others || []).filter(o => o.works > 0).slice(0, 3);
    if (rest.length) {
      const b = el('button', 'fo-link', 'Not the right ' + c.name + '?');
      b.type = 'button';
      b.addEventListener('click', () => chooser(t, 'Which one is you?', rest, o => pick(o, others)));
      nodes.push(b);
    }
    show(t, ...nodes);
  }

  const GEO = 'sh-geo-1';
  const geoLoad = () => { try { const c = JSON.parse(sessionStorage.getItem(GEO)); if (c && c.a && c.i) return c; } catch (e) {} return { a: {}, i: {} }; };
  const geoSave = c => { try { sessionStorage.setItem(GEO, JSON.stringify(c)); } catch (e) {} };
  const orFilter = ids => 'filter=openalex:' + ids.join('|') + '&per-page=' + ids.length;
  async function resolveGeo(spec) {
    const C = geoLoad();
    const people = spec.nodes.filter(n => !n.pin);
    const askA = [...new Set(people.filter(n => !n.instId).flatMap(n => (n.ids || []).filter(i => !(i in C.a))))];
    if (askA.length) {
      try {
        const r = await oa('authors?' + orFilter(askA) + '&select=id,last_known_institutions');
        askA.forEach(i => { C.a[i] = 0; });
        (r.results || []).forEach(a => {
          const x = (a.last_known_institutions || [])[0];
          C.a[idOf(a.id)] = x && x.id ? idOf(x.id) : 0;
        });
      } catch (e) {}
    }
    people.forEach(n => {
      if (!n.instId) n.instId = (n.ids || []).map(i => C.a[i]).find(Boolean) || '';
    });
    const askI = [...new Set(people.map(n => n.instId).filter(i => i && !(i in C.i)))];
    if (askI.length) {
      try {
        const r = await oa('institutions?' + orFilter(askI) + '&select=id,display_name,geo');
        askI.forEach(i => { C.i[i] = 0; });
        (r.results || []).forEach(x => {
          const g = x.geo || {}, la = g.latitude != null ? g.latitude : g.lat, lo = g.longitude != null ? g.longitude : g.lng;
          if (typeof la === 'number' && typeof lo === 'number') C.i[idOf(x.id)] = [x.display_name, la, lo];
        });
      } catch (e) {}
    }
    geoSave(C);
    const nodes = [];
    spec.nodes.forEach((n, k) => {
      if (n.pin) { nodes.push({ n: n.name, pin: n.pin, i: n.inst || '', kind: spec.kinds[k - 1] }); return; }
      const g = n.instId && C.i[n.instId];
      if (g) nodes.push({ n: n.name, i: g[0] || n.inst || '', lat: g[1], lng: g[2], kind: spec.kinds[k - 1] });
    });
    return { nodes };
  }
  function toMap(path) {
    if (typeof window.mapShowPath === 'function') {
      if (window.closeSheet) window.closeSheet();
      window.mapShowPath(path);
      return;
    }
    try { sessionStorage.setItem('sh-path', JSON.stringify(path)); } catch (e) {}
    location.assign('/');
  }
  function mapButton(spec) {
    const b = el('button', 'fo-map', 'Show on map');
    b.type = 'button';
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      b.disabled = true;
      try { toMap(await resolveGeo({ nodes: spec.nodes.map(n => ({ ...n, inst: n.inst || n.sub })), kinds: spec.kinds })); }
      finally { b.disabled = false; }
    });
    return b;
  }

  let run = 0;
  const show = (t, ...nodes) => { if (t === run) out.replaceChildren(...nodes); };
  const say = (t, text) => show(t, el('div', 'fo-sub', text));
  const HEAD = [
    'That is my own author record.',
    'We have written together.',
    'We are two steps apart.',
    'We are three steps apart.',
  ];
  const ERR = {
    timeout: 'The open scholarly graph is slow just now. Try again in a moment.',
    limit: 'The open scholarly graph is not taking more searches from your network right now. Try again later.',
    net: 'Could not reach the open scholarly graph just now. Try again in a moment.',
  };
  function showMiss(t, lead) {
    const nodes = lead || [];
    nodes.push(el('div', null, 'We are more than three steps apart in the open scholarly graph.'));
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Where might we have crossed paths?');
    sel.innerHTML = '<option value="">Where might we have crossed paths?</option>' +
      STAYS.map((x, i) => '<option value="' + i + '">' + x[0] + '</option>').join('');
    const line = el('div', 'fo-sub');
    sel.addEventListener('change', () => {
      if (sel.value === '') { line.textContent = ''; return; }
      const st = STAYS[Number(sel.value)];
      line.textContent = 'I was at ' + st[0] + ' · ' + st[1] + '. If you were too, the form below reaches me.';
    });
    nodes.push(sel, line);
    show(t, ...nodes);
  }
  function edgeNode(e) {
    const li = el('li', 'fo-edge');
    if (e.label) li.textContent = e.label;
    else if (!e.titles.length) li.textContent = 'Coauthors';
    e.titles.forEach(x => li.appendChild(el('span', 'fo-paper', x)));
    if (e.total > e.titles.length) li.appendChild(el('span', null, 'and ' + (e.total - e.titles.length) + ' more'));
    return li;
  }
  function pathNode(p) {
    const ol = el('ol', 'fo-path');
    p.nodes.forEach((n, i) => {
      const li = el('li', 'fo-node', n.name + (i === 0 ? ' (you)' : ''));
      if (n.sub) li.appendChild(el('span', 'fo-where', n.sub));
      ol.appendChild(li);
      if (p.edges[i]) ol.appendChild(edgeNode(p.edges[i]));
    });
    return ol;
  }
  async function overlapLine(c) {
    if (!(c.works > 0)) return null;
    try {
      const r = await getJSON(OA + 'authors/' + c.ids[0] + '?select=affiliations', 4000);
      for (const a of r.affiliations || []) {
        const nm = (a.institution || {}).display_name || '';
        if (MY_PLACES.some(pat => nm.indexOf(pat) !== -1)) return 'Like me, you have also been at ' + nm + '.';
      }
    } catch (e) {}
    return null;
  }
  function candButton(c, onPick) {
    const b = el('button', 'fo-cand', c.name + (c.inst ? ' · ' + c.inst : '') +
      (c.works > 0 ? ' · ' + c.works + ' works' : ''));
    b.type = 'button';
    b.addEventListener('click', onPick);
    return b;
  }
  function chooser(t, lead, cands, onPick) {
    const nodes = [el('div', 'fo-sub', lead)];
    cands.forEach(c => nodes.push(candButton(c, () => onPick(c))));
    const none = el('button', 'fo-cand', 'None of these');
    none.type = 'button';
    none.addEventListener('click', () => showMiss(++run));
    nodes.push(none);
    show(t, ...nodes);
  }

  async function present(t, g, c, hit, others, note, lead) {
    if (hit.steps === 0) { show(t, el('div', 'fo-hit', HEAD[0])); return; }
    const [p, extra] = await Promise.all([pathOf(g, c, hit), overlapLine(c)]);
    const nodes = [];
    if (lead) nodes.push(el('div', 'fo-hit', lead));
    if (note) nodes.push(el('div', 'fo-sub', note));
    nodes.push(el('div', 'fo-hit', HEAD[hit.steps]), pathNode(p), mapButton(p));
    if (p.others && p.others.length) nodes.push(el('div', 'fo-sub', 'Also through ' + p.others.join(', ') + '.'));
    if (extra) nodes.push(el('div', 'fo-sub', extra));
    const rest = (others || []).filter(o => o.works > 0).slice(0, 3);
    if (rest.length) {
      const b = el('button', 'fo-link', 'Not the right ' + c.name + '?');
      b.type = 'button';
      b.addEventListener('click', () => chooser(t, 'Which one is you?', rest, o => pick(o, others)));
      nodes.push(b);
    }
    show(t, ...nodes);
  }
  async function pick(c, others) {
    const t = ++run;
    go.disabled = true;
    say(t, 'Checking coauthorships…');
    try {
      const g = await loadGraph();
      const lead = await lookup(c.name);
      const { best, failed } = await bestHit(g, [c]);
      const col = !lead && !(best && best.hit.steps <= 2) ? await colleagueHit([c], c.name) : null;
      if (col) await presentColleague(t, col, (others || []).filter(o => o !== c));
      else if (best) await present(t, g, c, best.hit, (others || []).filter(o => o !== c), null, lead);
      else if (lead) show(t, el('div', 'fo-hit', lead));
      else if (failed) say(t, ERR.net);
      else showMiss(t);
    } finally { if (t === run) go.disabled = false; }
  }

  async function search() {
    if (go.disabled) return;
    const name = inp.value.trim();
    if (!norm(name)) return;
    const t = ++run;
    go.disabled = true;
    out.setAttribute('aria-busy', 'true');
    try { await find(t, name); }
    finally { if (t === run) { go.disabled = false; out.removeAttribute('aria-busy'); } }
  }
  async function find(t, name) {
    out.replaceChildren();
    const g = await loadGraph();
    const q = keyOf(name);
    const graphNames = q.indexOf(' ') > 0 ? (g.byKey.get(q) || []) : [];
    const fromGraph = graphNames.map(k => ({ ids: g.hop1[k].ids, name: g.hop1[k].n, works: 0, inst: '' }));

    const hit = await lookup(name);
    if (!hit && !g.ok) { say(t, ERR.net); return; }
    if (hit) {
      const nodes = [el('div', 'fo-hit', hit)];
      if (g.ok && fromGraph.length) {
        const p = await pathOf(g, fromGraph[0], { steps: 1, k: graphNames[0] });
        nodes.push(pathNode(p), mapButton(p));
      }
      show(t, ...nodes);
      return;
    }
    say(t, 'Searching the open scholarly graph…');
    let found;
    try {
      const r = await oa('authors?search=' + encodeURIComponent(name) +
        '&per-page=50&select=id,display_name,works_count,last_known_institutions');
      found = (r.results || []).filter(c => c.works_count > 0).map(c => ({
        ids: [idOf(c.id)], name: c.display_name, works: c.works_count,
        inst: ((c.last_known_institutions || [])[0] || {}).display_name || '',
        instId: idOf(((c.last_known_institutions || [])[0] || {}).id || '') }));
    } catch (e) {
      if (fromGraph.length === 1) {
        await present(t, g, fromGraph[0], { steps: 1, k: graphNames[0] }, [],
          'The open scholarly graph did not answer, so this is matched by name only.');
      } else {
        const col = await colleagueHit([], name);
        if (col) await presentColleague(t, col, []);
        else say(t, ERR[e.kind] || ERR.net);
      }
      return;
    }
    found.sort((a, b) => b.works - a.works);
    const exact = q.indexOf(' ') > 0 ? found.filter(c => keyOf(c.name) === q) : [];
    if (exact.length || fromGraph.length) {
      const known = new Set();
      exact.forEach(c => c.ids.forEach(i => known.add(i)));
      const cands = exact.concat(fromGraph.filter(c => !c.ids.some(i => known.has(i))));
      say(t, 'Checking coauthorships…');
      const { best, failed } = await bestHit(g, cands);
      const col = !(best && best.hit.steps <= 2) ? await colleagueHit(cands, name) : null;
      if (col) {
        await presentColleague(t, col, exact.filter(c => c !== col.c));
      } else if (best) {
        await present(t, g, best.c, best.hit, exact.filter(c => c !== best.c));
      } else if (failed) {
        say(t, ERR.net);
      } else showMiss(t);
      return;
    }
    const qt = q.split(' ');
    const closeTo = n => {
      const nt = keyOf(n).split(' ');
      return qt.every(a => nt.some(b => lev(a, b) <= (a.length > 4 ? 1 : 0)));
    };
    const col = await colleagueHit([], name);
    if (col) { await presentColleague(t, col, []); return; }
    const close = found.filter(c => closeTo(c.name));
    if (qt.length > 1) g.hop1.forEach(e => {
      if (closeTo(e.n)) close.push({ ids: e.ids, name: e.n, works: 0, inst: 'on my papers' });
    });
    close.sort((a, b) => (offlineHit(g, b) ? 1 : 0) - (offlineHit(g, a) ? 1 : 0) || b.works - a.works);
    if (!close.length) { showMiss(t); return; }
    chooser(t, 'Which one is you?', close.slice(0, 3), c => pick(c, []));
  }

  go.addEventListener('click', search);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); search(); }
  });
})();

(() => {
  const btn = document.querySelector('.theme');
  if (!btn) return;
  const root = document.documentElement;
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const now = () => root.getAttribute('data-theme') || (sys.matches ? 'dark' : 'light');
  const store = v => { try { v ? localStorage.setItem('theme', v) : localStorage.removeItem('theme'); } catch (e) {} };
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  metas.forEach(m => { m.dataset.c = m.content; });
  const label = () => {
    btn.setAttribute('aria-label', now() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    const forced = root.getAttribute('data-theme');
    const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
    metas.forEach(m => { m.content = forced && paper ? paper : m.dataset.c; });
  };
  btn.addEventListener('click', () => {
    const next = now() === 'dark' ? 'light' : 'dark';
    if (next === (sys.matches ? 'dark' : 'light')) { root.removeAttribute('data-theme'); store(null); }
    else { root.setAttribute('data-theme', next); store(next); }
    label();
  });
  sys.addEventListener('change', label);
  label();
})();



(() => {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let box, cur, sp;
  const load = () => sp || (sp = fetch('/assets/sketches.svg').then(r => r.text()).then(t => {
    const d = document.createElement('div');
    d.hidden = true; d.innerHTML = t;
    box = document.createElement('div');
    box.className = 'sketch'; box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<svg viewBox="0 0 160 100"><use/></svg><span></span>';
    document.body.append(d, box);
  }));
  const hide = () => { cur = null; box && box.classList.remove('on'); };
  const show = (el, x, y) => {
    cur = el;
    load().then(() => {
      const s = cur === el && document.getElementById('sk-' + el.dataset.sketch);
      if (!s) return;
      box.firstChild.firstChild.setAttribute('href', '#sk-' + el.dataset.sketch);
      box.lastChild.textContent = s.dataset.n;
      const w = box.offsetWidth, h = box.offsetHeight;
      y = y + h + 28 > innerHeight ? y - h - 12 : y + 18;
      box.style.transform = 'translate(' + Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px,' + Math.max(8, y) + 'px)';
      box.classList.add('on');
    }, hide);
  };
  const inst = t => t.closest && t.closest('.inst[data-sketch]');
  addEventListener('mouseover', e => {
    const el = inst(e.target);
    if (el !== cur) el ? show(el, e.clientX + 12, e.clientY) : hide();
  });
  addEventListener('focusin', e => {
    const t = e.target, el = t.matches(':focus-visible') && (inst(t) || t.querySelector('.inst[data-sketch]'));
    if (el) { const r = el.getBoundingClientRect(); show(el, r.left, r.bottom - 8); }
  });
  addEventListener('focusout', hide);
  addEventListener('keydown', e => e.key === 'Escape' && hide());
  addEventListener('scroll', hide, { passive: true, capture: true });
})();
 

(() => {
  const open = () => {
    const h = location.hash;
    const m = /^#contact-(student|researcher|industry)$/.exec(h);
    if (!m && h !== '#finder') return;
    if (m) window.pickWho && window.pickWho(m[1] === 'researcher' ? 'research' : m[1]);
    location.replace('#contact');
    if (!m) {
      const f = document.getElementById('finder-name');
      if (f) f.focus({ preventScroll: true });
    }
  };
  addEventListener('hashchange', open);
  open();
})();
