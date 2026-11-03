

(() => {
const deck = document.querySelector('[data-deck]');
const src = [...document.querySelectorAll('.ps-group .ps-card')];
if (!deck || !src.length) return;

const copyFigure = fig => {
const c = fig.cloneNode(true);
c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
c.querySelectorAll('[aria-labelledby],[aria-describedby]').forEach(e => { e.removeAttribute('aria-labelledby'); e.removeAttribute('aria-describedby'); });
c.querySelectorAll('.vis-control, figcaption, button, input').forEach(e => e.remove());
c.removeAttribute('id');
c.setAttribute('aria-hidden', 'true');
return c;
};
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const cite = (details, group) => {
const cut = details.indexOf(' · ');
let authors = cut < 0 ? details : details.slice(0, cut), rest = cut < 0 ? '' : details.slice(cut + 3);
const many = authors.match(/\((\d+) authors\)/);
if (many) authors = authors.split(', ').slice(0, 2).join(', ') + ', … Herytash, S., … (' + many[1] + ' authors)';
const g = group.toLowerCase(), stage = g.charAt(0).toUpperCase() + g.slice(1);
let venue = g === 'in preparation' ? null : (rest.match(/\b(?:at|to)\s+([A-Z][^.(,]*?)\s*(?:\(|,|\.|$)/) || [])[1];
if (!venue && g !== 'in preparation') { const v = (rest.match(/^([A-Za-z][^.(:]*?)\s*[(.:]/) || [])[1]; if (v && !/paper/i.test(v)) venue = v; }
const p = el('p', 'pc-cite');
p.append(el('span', null, authors), el('span', 'pc-stage', venue ? stage + ', ' + venue : stage));
return p;
};

const cards = src.map((li, k) => {
const group = li.closest('.ps-group')?.querySelector('h2')?.textContent.trim() || '';
const h3 = li.querySelector('h3'), link = h3.querySelector('a'), mark = h3.querySelector('.cv-cl');
const bare = h3.cloneNode(true);
bare.querySelectorAll('.cv-cl').forEach(e => e.remove());
const title = (bare.querySelector('i') || bare).textContent.trim();
const meta = li.querySelector('.ps-meta'), fig = li.querySelector('.vis');

const card = el('div', 'pc');
card.setAttribute('role', 'group');
card.setAttribute('aria-label', title);
const inner = el('div', 'pc-inner');
const front = el('div', 'pc-face pc-front');
const eyebrow = el('p', 'pc-eye');
if (mark) { const mk = mark.cloneNode(true); mk.querySelectorAll('.vh').forEach(e => e.remove()); eyebrow.append(mk, el('span', null, mark.title)); }
front.append(eyebrow, el('p', 'pc-title', title), cite(meta ? meta.textContent.trim() : '', group));
if (fig) front.appendChild(copyFigure(fig));
const back = el('div', 'pc-face pc-back');
back.append(el('p', 'pc-title pc-title-s', title));
if (meta) back.appendChild(el('p', 'pc-meta', meta.innerHTML));
if (link) { const a = el('a', 'pc-open', 'More about this paper <span aria-hidden="true">&rarr;</span>'); a.href = link.href; back.appendChild(a); }
inner.append(front, back);
const turn = el('button', 'pc-turn');
turn.type = 'button';
turn.setAttribute('aria-pressed', 'false');
turn.setAttribute('aria-label', 'Turn over: ' + title);
card.append(inner, turn);
deck.querySelector('.deck-table').appendChild(card);
return { card, turn, k };
});

const order = cards.map((_, i) => i);
let open = null;
const fan = (list, from, span) => list.forEach((ci, pos) => {
const n = list.length, t = n > 1 ? pos / (n - 1) - 0.5 : 0, c = cards[ci];
const x = from + (t + 0.5) * span, r = t * 14, y = Math.pow(Math.abs(t) * 2, 2) * 0.11 * c.card.offsetWidth;
c.card.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
c.card.style.zIndex = list.length - pos;
});
const place = () => {
const table = deck.querySelector('.deck-table');
const W = table.clientWidth, s = Math.min(1, W / (2.44 * 240));
table.style.setProperty('--s', s.toFixed(3));
const w = cards[0].card.offsetWidth, pad = w * 0.22;
const k = Math.max(1.08, Math.min(0.8 * W, 260) / w);
table.style.height = (open === null ? 1.62 * w : Math.max(2 * w, 1.4 * w * k + 0.15 * w)) + 'px';
if (open === null) {
const span = Math.min(W - w - 2 * pad, (order.length - 1) * 0.71 * w);
return fan(order, (W - w - span) / 2, span);
}
const c = cards[open], rest = order.filter(ci => ci !== open), mid = (W - w) / 2, drop = 0.4 * w;
const lay = (ci, x, z) => {
const t = (x - mid) / Math.max(W - w, 1), el = cards[ci].card;
el.style.transform = `translate(${x}px, ${drop + Math.pow(Math.abs(t) * 2, 2) * 0.11 * w}px) rotate(${t * 14}deg)`;
el.style.zIndex = z;
};
const m = w * 0.22, edge = mid - w * 0.33;
if (edge > m + 0.17 * w) {
const L = rest.slice(0, Math.ceil(rest.length / 2)), R = rest.slice(L.length);
const reach = Math.min(edge - m, 0.62 * w * (L.length - 1)), step = n => n > 1 ? reach / (n - 1) : 0, sL = step(L.length), sR = step(R.length);
L.forEach((ci, k) => lay(ci, edge - (L.length - 1 - k) * sL, k + 1));
R.forEach((ci, k) => lay(ci, W - w - edge + k * sR, R.length - k));
} else {
const all = Math.min(W - w - 2 * pad, (order.length - 1) * 0.71 * w);
fan(order, (W - w - all) / 2, all);
}
c.card.style.transform = `translate(${mid}px, ${1.68 * w * (k - 1) + 0.04 * w}px) rotate(0deg) scale(${k})`;
c.card.style.zIndex = 100;
};
const setOpen = ci => {
open = ci;
cards.forEach((c, i) => {
const on = i === ci;
c.card.classList.toggle('is-open', on);
c.turn.setAttribute('aria-pressed', on ? 'true' : 'false');
c.card.querySelectorAll('.pc-open').forEach(a => { a.tabIndex = on ? 0 : -1; });
});
place();
};
cards.forEach((c, i) => c.turn.addEventListener('click', () => setOpen(open === i ? null : i)));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && open !== null) { const c = cards[open]; setOpen(null); c.turn.focus(); } });
document.addEventListener('click', e => { if (open !== null && !deck.contains(e.target)) setOpen(null); });
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(place, 120); });
deck.hidden = false;
setOpen(null);
requestAnimationFrame(() => deck.classList.add('ready'));
})();
