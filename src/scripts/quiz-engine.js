// Polski Klub — quiz engine
// Typy pytań: tf | mc | typein | tap_fill | match
import '../styles/quiz.css';
import { confetti, confettiFrom } from './confetti.js';

const dataEl = document.getElementById('quiz-data');
const root = document.getElementById('quiz-root');
const splash = document.getElementById('quiz-splash');
const startBtn = document.getElementById('quiz-start');

if (dataEl && root && startBtn) {
  const quiz = JSON.parse(dataEl.textContent);
  startBtn.addEventListener('click', () => {
    splash.hidden = true;
    root.hidden = false;
    new QuizRun(quiz, root).start();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stripDiacritics(s) {
  return s
    .toLowerCase()
    .replaceAll('ą', 'a').replaceAll('ć', 'c').replaceAll('ę', 'e')
    .replaceAll('ł', 'l').replaceAll('ń', 'n').replaceAll('ó', 'o')
    .replaceAll('ś', 's').replaceAll('ż', 'z').replaceAll('ź', 'z');
}

function norm(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

class QuizRun {
  constructor(quiz, root) {
    this.quiz = quiz;
    this.root = root;
    // spłaszczamy sekcje do listy pytań
    this.items = [];
    quiz.sections.forEach((sec, si) => {
      sec.questions.forEach((q) => this.items.push({ sec, si, q }));
    });
    this.i = 0;
    this.scores = quiz.sections.map(() => ({ got: 0, max: 0 }));
    this.almost = 0;
  }

  start() {
    this.renderCurrent();
  }

  get total() {
    return this.items.length;
  }

  addScore(si, got, max = 1) {
    this.scores[si].got += got;
    this.scores[si].max += max;
  }

  next() {
    this.i += 1;
    if (this.i >= this.items.length) this.renderResults();
    else this.renderCurrent();
  }

  frame(item, innerHTML) {
    const pct = Math.round((this.i / this.total) * 100);
    this.root.innerHTML = `
      <div class="q-top">
        <span class="q-section">${esc(item.sec.emoji || '')} ${esc(item.sec.title)}</span>
        <span class="q-count">${this.i + 1} / ${this.total}</span>
      </div>
      <div class="q-bar"><div class="q-bar-fill" style="width:${pct}%"></div></div>
      <div class="q-body">${innerHTML}</div>
      <div class="q-feedback" id="q-feedback"></div>
    `;
  }

  feedback(ok, html, { almost = false } = {}) {
    const fb = this.root.querySelector('#q-feedback');
    fb.className = 'q-feedback show ' + (ok ? (almost ? 'almost' : 'ok') : 'bad');
    fb.innerHTML = `
      <div>${html}</div>
      <button class="btn" id="q-next">Dalej →</button>
    `;
    fb.querySelector('#q-next').addEventListener('click', () => this.next());
    fb.querySelector('#q-next').focus();
  }

  lockButtons() {
    this.root.querySelectorAll('.q-opt').forEach((b) => (b.disabled = true));
  }

  /* ── render dispatch ── */
  renderCurrent() {
    const item = this.items[this.i];
    const t = item.sec.type;
    if (t === 'tf') this.renderTF(item);
    else if (t === 'mc') this.renderMC(item);
    else if (t === 'typein') this.renderTypein(item);
    else if (t === 'tap_fill') this.renderTapFill(item);
    else if (t === 'match') this.renderMatch(item);
  }

  /* ── prawda / fałsz ── */
  renderTF(item) {
    const { q } = item;
    this.frame(item, `
      <p class="q-question">${esc(q.q)}</p>
      <div class="q-options q-options-row">
        <button class="q-opt" data-v="true">✅ Prawda</button>
        <button class="q-opt" data-v="false">❌ Fałsz</button>
      </div>
    `);
    this.root.querySelectorAll('.q-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ok = String(q.answer) === btn.dataset.v;
        this.lockButtons();
        btn.classList.add(ok ? 'correct' : 'incorrect', ok ? 'pop' : 'shake');
        this.addScore(item.si, ok ? 1 : 0);
        this.feedback(ok, ok
          ? `<strong>Dobrze!</strong> ${q.explain ? esc(q.explain) : ''}`
          : `<strong>Niestety.</strong> ${q.explain ? esc(q.explain) : `Poprawna odpowiedź: ${q.answer ? 'Prawda' : 'Fałsz'}.`}`);
      });
    });
  }

  /* ── wybór ── */
  renderMC(item) {
    const { q } = item;
    const opts = shuffle(q.options);
    this.frame(item, `
      <p class="q-question">${esc(q.q)}</p>
      <div class="q-options">
        ${opts.map((o) => `<button class="q-opt">${esc(o)}</button>`).join('')}
      </div>
    `);
    this.root.querySelectorAll('.q-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ok = norm(btn.textContent) === norm(q.answer);
        this.lockButtons();
        btn.classList.add(ok ? 'correct' : 'incorrect', ok ? 'pop' : 'shake');
        if (!ok) {
          this.root.querySelectorAll('.q-opt').forEach((b) => {
            if (norm(b.textContent) === norm(q.answer)) b.classList.add('correct');
          });
        }
        this.addScore(item.si, ok ? 1 : 0);
        this.feedback(ok, ok
          ? `<strong>Dobrze!</strong> ${q.explain ? esc(q.explain) : ''}`
          : `<strong>Niestety.</strong> Poprawnie: <strong>${esc(q.answer)}</strong>. ${q.explain ? esc(q.explain) : ''}`);
      });
    });
  }

  /* ── wpisywanie ── */
  renderTypein(item) {
    const { q } = item;
    const hasBlank = /_{3,}/.test(q.q);
    const sentence = hasBlank
      ? esc(q.q).replace(/_{3,}/, `<input class="q-input" id="q-in" autocomplete="off" autocapitalize="off" />`)
      : `${esc(q.q)}<br/><input class="q-input" id="q-in" autocomplete="off" autocapitalize="off" />`;
    this.frame(item, `
      <p class="q-question q-question-fill">${sentence}</p>
      ${q.hint ? `<p class="q-hint">(${esc(q.hint)})</p>` : ''}
      <button class="btn" id="q-check">Sprawdź</button>
    `);
    const input = this.root.querySelector('#q-in');
    const check = () => {
      const val = norm(input.value);
      if (!val) { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); return; }
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
      const exact = answers.some((a) => norm(a) === val);
      const almost = !exact && answers.some((a) => stripDiacritics(a) === stripDiacritics(val));
      const ok = exact || almost;
      input.disabled = true;
      this.root.querySelector('#q-check').disabled = true;
      input.classList.add(ok ? 'correct' : 'incorrect', ok ? 'pop' : 'shake');
      if (almost) this.almost += 1;
      this.addScore(item.si, ok ? 1 : 0);
      this.feedback(ok, exact
        ? `<strong>Dobrze!</strong> ${q.explain ? esc(q.explain) : ''}`
        : almost
          ? `<strong>Prawie!</strong> Poprawnie: <strong>${esc(answers[0])}</strong> — pamiętaj o polskich znakach (ą, ę, ż…).`
          : `<strong>Niestety.</strong> Poprawnie: <strong>${esc(answers[0])}</strong>. ${q.explain ? esc(q.explain) : ''}`,
        { almost });
    };
    this.root.querySelector('#q-check').addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    input.focus();
  }

  /* ── tap-to-place: słowa do luk ── */
  renderTapFill(item) {
    const { q } = item;
    const parts = q.text.split(/\{(\d+)\}/); // tekst przeplatany indeksami luk
    let html = '';
    for (let k = 0; k < parts.length; k++) {
      if (k % 2 === 0) html += esc(parts[k]);
      else html += `<button class="q-gap" data-gap="${parts[k]}">…</button>`;
    }
    const bank = shuffle(q.answers.map((w, wi) => ({ w, wi })));
    this.frame(item, `
      <p class="q-tap-help">👆 Kliknij słowo, potem lukę. Kliknij wstawione słowo, żeby je cofnąć.</p>
      <p class="q-question q-tap-text">${html}</p>
      <div class="q-bank">
        ${bank.map((b) => `<button class="q-word" data-w="${esc(b.w)}">${esc(b.w)}</button>`).join('')}
      </div>
      <button class="btn" id="q-check" disabled>Sprawdź</button>
    `);

    let selected = null;
    const gaps = [...this.root.querySelectorAll('.q-gap')];
    const words = [...this.root.querySelectorAll('.q-word')];
    const checkBtn = this.root.querySelector('#q-check');

    const refresh = () => {
      checkBtn.disabled = !gaps.every((g) => g.dataset.filled);
    };

    words.forEach((w) => {
      w.addEventListener('click', () => {
        if (w.classList.contains('used')) return;
        words.forEach((x) => x.classList.remove('selected'));
        selected = selected === w ? null : w;
        if (selected) w.classList.add('selected');
      });
    });

    gaps.forEach((g) => {
      g.addEventListener('click', () => {
        if (g.dataset.filled) {
          // cofnij słowo do banku
          const word = words.find((x) => x.dataset.w === g.dataset.filled && x.classList.contains('used'));
          if (word) word.classList.remove('used');
          delete g.dataset.filled;
          g.textContent = '…';
          g.classList.remove('filled');
          refresh();
          return;
        }
        if (!selected) return;
        g.dataset.filled = selected.dataset.w;
        g.textContent = selected.dataset.w;
        g.classList.add('filled');
        selected.classList.add('used');
        selected.classList.remove('selected');
        selected = null;
        refresh();
      });
    });

    checkBtn.addEventListener('click', () => {
      let got = 0;
      gaps.forEach((g) => {
        const ok = g.dataset.filled === q.answers[Number(g.dataset.gap)];
        g.classList.add(ok ? 'correct' : 'incorrect', ok ? 'pop' : 'shake');
        if (ok) got += 1;
      });
      gaps.forEach((g) => (g.disabled = true));
      words.forEach((w) => (w.disabled = true));
      checkBtn.disabled = true;
      this.addScore(item.si, got, q.answers.length);
      const all = got === q.answers.length;
      this.feedback(all,
        all
          ? `<strong>Perfekcyjnie!</strong> Wszystkie ${q.answers.length} słów na miejscu.`
          : `<strong>${got} / ${q.answers.length}.</strong> Czerwone luki — spójrz na poprawny tekst w lekcji wyżej.`);
    });
  }

  /* ── soedini pary: dwie kolumny ── */
  renderMatch(item) {
    const { q } = item;
    const pairs = q.pairs.map(([l, r], pi) => ({ l, r, pi }));
    const colL = shuffle(pairs);
    const colR = shuffle(pairs);
    const cell = (p, side) =>
      `<button class="q-match-item" data-side="${side}" data-pi="${p.pi}">${esc(side === 'l' ? p.l : p.r)}</button>`;

    this.frame(item, `
      <p class="q-tap-help">👆 Kliknij słowo z lewej, potem pasujące z prawej.</p>
      ${q.q ? `<p class="q-question">${esc(q.q)}</p>` : ''}
      <div class="q-match">
        <div class="q-match-col">${colL.map((p) => cell(p, 'l')).join('')}</div>
        <div class="q-match-col">${colR.map((p) => cell(p, 'r')).join('')}</div>
      </div>
    `);

    const items = [...this.root.querySelectorAll('.q-match-item')];
    const sel = { l: null, r: null };
    const missed = new Set(); // pary, przy których był błąd — nie liczą się do punktów
    let solved = 0;
    let busy = false;

    const clearSel = () => {
      items.forEach((x) => x.classList.remove('selected'));
      sel.l = null;
      sel.r = null;
    };

    const resolve = () => {
      const a = sel.l;
      const b = sel.r;
      if (a.dataset.pi === b.dataset.pi) {
        [a, b].forEach((x) => {
          x.classList.remove('selected');
          x.classList.add('matched', 'pop');
          x.disabled = true;
        });
        clearSel();
        solved += 1;
        if (solved === pairs.length) finish();
        return;
      }

      // pudło: para z lewej idzie na listę „nie liczy się"
      missed.add(a.dataset.pi);
      busy = true;
      [a, b].forEach((x) => x.classList.add('incorrect', 'shake'));
      setTimeout(() => {
        [a, b].forEach((x) => x.classList.remove('incorrect', 'shake'));
        clearSel();
        busy = false;
      }, 600);
    };

    const finish = () => {
      const got = pairs.length - missed.size;
      this.addScore(item.si, got, pairs.length);
      const all = got === pairs.length;
      if (all) confettiFrom(this.root.querySelector('.q-match'), { count: 55 });
      this.feedback(all,
        all
          ? `<strong>Perfekcyjnie!</strong> Wszystkie ${pairs.length} par za pierwszym razem.`
          : `<strong>${got} / ${pairs.length}.</strong> Wszystko połączone, ale przy ${missed.size === 1 ? 'jednej parze' : `${missed.size} parach`} było pudło.`);
    };

    items.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (busy || btn.disabled) return;
        const side = btn.dataset.side;

        // ponowne kliknięcie = odznaczenie
        if (sel[side] === btn) {
          btn.classList.remove('selected');
          sel[side] = null;
          return;
        }
        if (sel[side]) sel[side].classList.remove('selected');
        sel[side] = btn;
        btn.classList.add('selected');

        if (sel.l && sel.r) resolve();
      });
    });
  }

  /* ── wyniki ── */
  renderResults() {
    const got = this.scores.reduce((s, x) => s + x.got, 0);
    const max = this.scores.reduce((s, x) => s + x.max, 0);
    const pct = max ? Math.round((got / max) * 100) : 0;
    const verdict = pct >= 90 ? '🏆 Mistrzostwo!'
      : pct >= 70 ? '🌟 Bardzo dobrze!'
      : pct >= 50 ? '💪 Nieźle — ale zrób powtórkę.'
      : '📚 Trzeba powtórzyć. Dacie radę!';

    this.root.innerHTML = `
      <div class="q-results pop">
        <p class="q-results-pct" style="--pct-color:${pct >= 70 ? 'var(--correct)' : pct >= 50 ? 'var(--amber)' : 'var(--incorrect)'}">${pct}%</p>
        <p class="q-results-verdict">${verdict}</p>
        <p class="q-results-score">${got} / ${max} punktów${this.almost ? ` · ${this.almost}× „prawie" (polskie znaki!)` : ''}</p>
        <ul class="q-results-secs">
          ${this.quiz.sections.map((s, si) => `
            <li>
              <span>${esc(s.emoji || '')} ${esc(s.title)}</span>
              <span class="q-sec-score">${this.scores[si].got}/${this.scores[si].max}</span>
            </li>`).join('')}
        </ul>
        <button class="btn btn-big" id="q-again">🔁 Jeszcze raz</button>
      </div>
    `;
    this.root.querySelector('#q-again').addEventListener('click', () => {
      new QuizRun(this.quiz, this.root).start();
    });
    this.root.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (pct >= 70) {
      const big = pct >= 90;
      setTimeout(() => confetti({ count: big ? 140 : 90, power: big ? 15 : 12 }), 350);
      if (big) setTimeout(() => confetti({ count: 90, origin: { x: 0.2, y: 0.45 }, power: 13 }), 750);
    }
  }
}
