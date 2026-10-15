

(() => {
  const sec = document.querySelector('[data-deck]');
  if (!sec) return;
  const deck = sec.querySelector('.deck');
  const cards = [...deck.querySelectorAll('.deck-card')];
  const tablist = sec.querySelector('.deck-tabs');
  const tabs = [...tablist.querySelectorAll('.deck-tab')];
  const N = cards.length;
  if (!N || tabs.length !== N) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const MS = 300;
  let cur = 0, chosen = false;

  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-labelledby', sec.getAttribute('aria-labelledby'));
  tabs.forEach((t, i) => {
    t.setAttribute('role', 'tab');
    t.id = 'tab-' + cards[i].id;
    t.setAttribute('aria-controls', cards[i].id);
  });
  cards.forEach((c, i) => {
    c.setAttribute('role', 'tabpanel');
    c.setAttribute('aria-labelledby', tabs[i].id);
    const body = c.querySelector('.deck-doc');
    body.setAttribute('role', 'region');
    body.setAttribute('aria-label', tabs[i].textContent);
  });

  const reflow = el => void el.offsetWidth;
  const place = () => {
    cards.forEach((c, k) => {
      const d = (k - cur + N) % N, front = d === 0;
      c.style.setProperty('--d', d);
      c.classList.toggle('is-front', front);
      if (front) c.removeAttribute('aria-hidden'); else c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('a').forEach(a => { if (front) a.removeAttribute('tabindex'); else a.tabIndex = -1; });
      c.querySelector('.deck-doc').tabIndex = front ? 0 : -1;
    });
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', k === cur ? 'true' : 'false');
      t.tabIndex = k === cur ? 0 : -1;
    });
    const t = tabs[cur], row = tablist;
    if (row.scrollWidth > row.clientWidth) {
      const l = t.offsetLeft - row.offsetLeft, r = l + t.offsetWidth;
      if (l < row.scrollLeft + 16) row.scrollLeft = l - 16;
      else if (r > row.scrollLeft + row.clientWidth - 16) row.scrollLeft = r - row.clientWidth + 16;
    }
  };

  const show = (i, how, fromDrag) => {
    i = ((i % N) + N) % N;
    const old = cards[cur];
    if (i === cur) {
      if (fromDrag) settle(old);
      return;
    }
    cur = i;
    const now = cards[cur];
    const fly = !still.matches && how !== 0;
    if (fly && how === 1) {
      old.style.setProperty('--out', -1);
      old.classList.remove('deck-drag');
      old.classList.add('deck-out');
      old.style.removeProperty('--dx');
      setTimeout(() => {
        old.classList.add('deck-snap', 'deck-hide');
        old.classList.remove('deck-out');
        reflow(old);
        old.classList.remove('deck-snap');
        old.classList.remove('deck-hide');
      }, MS);
    } else if (fly && how === -1) {
      if (fromDrag) settle(old);
      now.style.setProperty('--out', -1);
      now.classList.add('deck-snap', 'deck-from');
      reflow(now);
      now.classList.remove('deck-snap');
      requestAnimationFrame(() => now.classList.remove('deck-from'));
    } else if (fromDrag) settle(old);
    place();
    chosen = true;
    history.replaceState(history.state, '', '#' + now.id);
  };
  const settle = c => { c.classList.remove('deck-drag'); c.style.removeProperty('--dx'); c.style.removeProperty('opacity'); };

  tabs.forEach((t, i) => t.addEventListener('click', e => {
    e.preventDefault();
    show(i, i === (cur + 1) % N ? 1 : i === (cur - 1 + N) % N ? -1 : 0);
  }));
  tablist.addEventListener('keydown', e => {
    const k = e.key;
    let i = null;
    if (k === 'ArrowRight' || k === 'ArrowDown') i = cur + 1;
    else if (k === 'ArrowLeft' || k === 'ArrowUp') i = cur - 1;
    else if (k === 'Home') i = 0;
    else if (k === 'End') i = N - 1;
    if (i === null) return;
    e.preventDefault(); e.stopPropagation();
    const target = ((i % N) + N) % N;
    show(target, k === 'ArrowRight' || k === 'ArrowDown' ? 1 : k === 'ArrowLeft' || k === 'ArrowUp' ? -1 : 0);
    tabs[cur].focus();
  });

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const k = e.key;
    const dir = (k === 'ArrowRight' || k === 'j') ? 1 : (k === 'ArrowLeft' || k === 'k') ? -1 : 0;
    if (!dir) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector('.sheet:target') || location.hash === '#contact') return;
    const r = deck.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    e.preventDefault();
    show(cur + dir, dir);
  });

  let p = null;
  deck.addEventListener('dragstart', e => { if (!e.target.closest || !e.target.closest('.is-front .deck-doc')) e.preventDefault(); });
  deck.addEventListener('pointerdown', e => {
    if (e.button !== 0 || p) return;
    const card = e.target.closest('.deck-card');
    if (!card) return;
    p = { id: e.pointerId, x: e.clientX, y: e.clientY, card, drag: false, moved: 0,
          w: deck.clientWidth, link: !!e.target.closest('a, button, input, summary'),
          mouse: e.pointerType === 'mouse' };
  });
  deck.addEventListener('pointermove', e => {
    if (!p || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.moved = Math.max(p.moved, Math.hypot(dx, dy));
    if (!p.drag) {
      if (p.dead || p.moved < 10) return;
      if (p.mouse || p.card !== cards[cur] || p.link || Math.abs(dx) < Math.abs(dy) * 1.2) { p.dead = true; return; }
      p.drag = true;
      p.card.classList.add('deck-drag');
      try { deck.setPointerCapture(e.pointerId); } catch (err) {}
    }
    p.dx = dx;
    p.card.style.setProperty('--dx', dx + 'px');
    p.card.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / p.w * 0.9));
  });
  const end = (e, cancel) => {
    if (!p || e.pointerId !== p.id) return;
    const q = p; p = null;
    if (q.drag) {
      const far = Math.abs(q.dx) > Math.min(90, q.w * 0.22);
      if (!cancel && far) {
        q.card.style.removeProperty('opacity');
        if (q.dx < 0) show(cur + 1, 1, true);
        else show(cur - 1, -1, true);
      } else settle(q.card);
      return;
    }
    if (!cancel && q.moved < 10 && q.card !== cards[cur]) show(cards.indexOf(q.card), 0);
  };
  deck.addEventListener('pointerup', e => end(e, false));
  deck.addEventListener('pointercancel', e => end(e, true));
  deck.addEventListener('click', e => {
    const card = e.target.closest('.deck-card');
    if (card && card !== cards[cur]) e.preventDefault();
  }, true);

  const fromHash = () => cards.findIndex(c => '#' + c.id === location.hash);
  addEventListener('hashchange', () => {
    const i = fromHash();
    if (i >= 0) { if (i !== cur) show(i, 0); return; }
    if (chosen) setTimeout(() => {
      if (!location.hash) history.replaceState(history.state, '', '#' + cards[cur].id);
    }, 0);
  });
  const start = fromHash();
  if (start > 0) {
    cur = start;
    chosen = true;
    cards.forEach(c => c.classList.add('deck-snap'));
    place();
    reflow(deck);
    cards.forEach(c => c.classList.remove('deck-snap'));
    requestAnimationFrame(() => sec.scrollIntoView({ block: 'start' }));
  } else {
    if (start === 0) chosen = true;
    place();
  }
})();
