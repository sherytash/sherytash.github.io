

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
if (mark) eyebrow.appendChild(mark.cloneNode(true));
eyebrow.appendChild(el('span', null, group));
front.append(eyebrow, el('p', 'pc-title', title));
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

let order = cards.map((_, i) => i), open = null;
const wide = () => matchMedia('(min-width:720px)').matches;
const fan = (list, from, span) => list.forEach((ci, pos) => {
const n = list.length, t = n > 1 ? pos / (n - 1) - 0.5 : 0, c = cards[ci];
const x = from + (t + 0.5) * span, r = t * 14, y = Math.pow(Math.abs(t) * 2, 2) * 26;
c.card.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
c.card.style.zIndex = list.length - pos;
});
const place = () => {
const table = deck.querySelector('.deck-table');
if (!wide()) { cards.forEach(c => { c.card.style.transform = ''; c.card.style.zIndex = ''; }); return; }
const W = table.clientWidth, w = cards[0].card.offsetWidth;
if (open === null) {
const span = Math.min(W - w * 1.35, (order.length - 1) * 170);
return fan(order, (W - w - span) / 2, span);
}
const c = cards[open], rest = order.filter(ci => ci !== open), mid = (W - w) / 2;
const lay = (ci, x, z) => {
const t = (x - mid) / Math.max(W - w, 1), el = cards[ci].card;
el.style.transform = `translate(${x}px, ${36 + Math.pow(Math.abs(t) * 2, 2) * 26}px) rotate(${t * 14}deg)`;
el.style.zIndex = z;
};
const m = w * 0.2, edge = mid - w * 0.06 - 64;
if (edge > m + 40) {
const L = rest.slice(0, Math.ceil(rest.length / 2)), R = rest.slice(L.length);
const step = n => n > 1 ? Math.min((edge - m) / (n - 1), 150) : 0, sL = step(L.length), sR = step(R.length);
L.forEach((ci, k) => lay(ci, edge - (L.length - 1 - k) * sL, k + 1));
R.forEach((ci, k) => lay(ci, W - w - edge + k * sR, R.length - k));
} else {
const all = Math.min(W - w * 1.35, (order.length - 1) * 170);
fan(order, (W - w - all) / 2, all);
}
c.card.style.transform = `translate(${mid}px, -64px) rotate(0deg) scale(1.08)`;
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
deck.querySelector('.deck-shuffle').addEventListener('click', () => {
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
deck.classList.remove('dealt'); void deck.offsetWidth; deck.classList.add('dealt');
setOpen(null);
});
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(place, 120); });
deck.hidden = false;
setOpen(null);
requestAnimationFrame(() => deck.classList.add('ready'));
})();
