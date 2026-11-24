

(() => {
const papers = document.querySelector('.ab-papers');
if (!papers) return;
const groups = [...papers.querySelectorAll('.ps-group')];
const sup = n => { const s = document.createElement('sup'); s.className = 'mx-n'; s.textContent = '(' + n + ')'; return s; };

const h = papers.querySelector(':scope > h2');
const total = papers.querySelectorAll('.ps-card').length;
if (h) h.append(sup(total));
groups.forEach(g => g.querySelector('h2')?.append(sup(g.querySelectorAll('.ps-card').length)));

const view = document.createElement('div');
view.className = 'mx-view'; view.setAttribute('role', 'group'); view.setAttribute('aria-label', 'Show papers as');
['List', 'Deck'].forEach(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = t.toLowerCase(); view.append(b); });
const setView = v => { papers.classList.toggle('mx-list', v === 'list'); papers.classList.toggle('mx-deck', v === 'deck');
view.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); };
view.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
(papers.querySelector('.cv-key') || h).after(view);
setView('list');

const bar = document.createElement('div');
bar.className = 'mx-filter'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Show papers by status');
const mk = (label, n, key) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = key;
b.setAttribute('aria-pressed', key === 'all'); b.textContent = label; const s = document.createElement('sup'); s.textContent = n; b.append(s); return b; };
bar.append(mk('All', total, 'all'));
groups.forEach((g, i) => bar.append(mk(g.querySelector('h2').firstChild.textContent.trim(), g.querySelectorAll('.ps-card').length, String(i))));
bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
bar.querySelectorAll('button').forEach(o => o.setAttribute('aria-pressed', o === b));
groups.forEach((g, i) => g.classList.toggle('mx-off', b.dataset.k !== 'all' && b.dataset.k !== String(i))); });
document.body.append(bar);
const first = groups[0], last = groups[groups.length - 1];
const io = new IntersectionObserver(() => {
const a = first.getBoundingClientRect().top, z = last.getBoundingClientRect().bottom;
bar.classList.toggle('on', a < innerHeight * 0.85 && z > innerHeight * 0.3);
}, { threshold: [0, 0.25, 0.5, 0.75, 1] });
groups.forEach(g => io.observe(g));
addEventListener('scroll', () => { const a = first.getBoundingClientRect().top, z = last.getBoundingClientRect().bottom;
bar.classList.toggle('on', a < innerHeight * 0.85 && z > innerHeight * 0.3); }, { passive: true });
})();
