// Silnik cwiczen w lekcjach: znajduje bloki ```cwiczenie (JSON) i zamienia je
// na interaktywne rundy z przyciskiem Sprawdz. Zepsuty JSON NIE psuje strony —
// blok zostaje jak byl, a walidator w `npm test` i tak go wylapie.
import { parsujCwiczenie, sprawdzWybor, sprawdzWpisz } from './cwiczenia-logika.js';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Slug tytulu do klucza szkicu: litery i cyfry (tez polskie) zostaja, reszta -> "-".
function slugTytulu(s) {
  return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

function znajdzBloki() {
  // Shiki NIE zna jezyka "cwiczenie" i renderuje go jako data-language="plaintext"
  // (sprawdzone w dist). Szukamy wiec plaintext-blokow wygladajacych jak nasz JSON;
  // pelna walidacja schematu w parsujCwiczenie i tak odsiewa przypadkowe trafienia.
  return [...document.querySelectorAll('pre[data-language="plaintext"] > code')]
    .filter((c) => c.textContent.trim().startsWith('{') && c.textContent.includes('"typ"'))
    .map((c) => c.parentElement);
}

function zbuduj(pre, dane) {
  const box = document.createElement('section');
  box.className = 'cw-box';
  const zdaniaHtml = dane.zdania.map((z, i) => {
    // pisanie: wolny tekst, nie ma czego sprawdzac — zero .cw-wynik, czemu jako podpowiedz
    if (dane.typ === 'pisanie') {
      return `<li class="cw-zdanie cw-pisanie-li" data-i="${i}">
      <span class="cw-tekst">${esc(z.przed)}${esc(z.po)}</span>
      <textarea class="cw-pisanie" data-i="${i}" rows="3"></textarea>
      ${z.czemu ? `<span class="cw-podpowiedz">${esc(z.czemu)}</span>` : ''}
    </li>`;
    }
    const srodek = dane.typ === 'wybor'
      ? `<span class="cw-opcje" data-i="${i}">${z.opcje.map((o, oi) =>
          `<button type="button" class="cw-opcja" data-oi="${oi}">${esc(o)}</button>`).join('')}</span>`
      : `<input class="cw-input" data-i="${i}" autocomplete="off" autocapitalize="off" />`;
    return `<li class="cw-zdanie" data-i="${i}">
      <span class="cw-tekst">${esc(z.przed)}${srodek}${esc(z.po)}</span>
      <span class="cw-wynik" hidden></span>
    </li>`;
  }).join('');
  const dol = dane.typ === 'pisanie'
    ? `<button type="button" class="cw-zapisz btn">💾 Zapisz w zeszycie</button>
    <p class="cw-status" hidden></p>`
    : '<button type="button" class="cw-sprawdz btn">Sprawdź</button>';
  box.innerHTML = `
    ${dane.tytul ? `<p class="cw-tytul">${esc(dane.tytul)}</p>` : ''}
    ${dane.instrukcja ? `<p class="cw-instrukcja">${esc(dane.instrukcja)}</p>` : ''}
    <ol class="cw-lista">${zdaniaHtml}</ol>
    ${dol}
  `;
  pre.replaceWith(box);
  podepnij(box, dane);
}

// pisanie: szkic w localStorage + zapis do zeszytu w chmurze
function podepnijPisanie(box, dane) {
  const pola = [...box.querySelectorAll('.cw-pisanie')];
  const status = box.querySelector('.cw-status');
  const lekcja = document.querySelector('[data-lekcja]')?.dataset.lekcja ?? location.pathname;
  const klucz = `pk_szkic_${lekcja}_${slugTytulu(dane.tytul)}`;

  // szkic przezywa odswiezenie strony; localStorage w prywatnym trybie rzuca — stad try/catch
  try {
    const szkic = JSON.parse(localStorage.getItem(klucz) ?? 'null');
    if (Array.isArray(szkic)) {
      pola.forEach((el, i) => { if (typeof szkic[i] === 'string') el.value = szkic[i]; });
    }
  } catch { /* brak szkicu albo smiec w kluczu — trudno */ }

  const zapiszSzkic = () => {
    try { localStorage.setItem(klucz, JSON.stringify(pola.map((el) => el.value))); } catch { /* prywatny tryb */ }
  };
  pola.forEach((el) => el.addEventListener('input', zapiszSzkic));

  box.querySelector('.cw-zapisz').addEventListener('click', () => {
    const wpisy = pola.map((el) => el.value.trim());
    if (wpisy.every((w) => !w)) {
      pola.forEach((el) => { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); });
      return;
    }
    status.hidden = false;
    status.textContent = '⏳ zapisuję…';

    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    // Firestore offline: promise wisi do powrotu sieci — po 4 s uznajemy "zapisze sie pozniej"
    // (persistentLocalCache dowiezie). .catch na wewnetrznym promise: gdy timeout wygra wyscig,
    // pozniejszy reject nie moze zostac unhandled rejection.
    const zapis = import('./chmura.js').then(({ zapiszDoZeszytu }) =>
      zapiszDoZeszytu({ lekcja, zadanie: dane.tytul ?? '', wpisy }));
    zapis.catch(() => {});
    Promise.race([zapis, new Promise((res) => setTimeout(() => res('timeout'), 4000))])
      .then((r) => {
        if (r === true) {
          status.textContent = '✓ Zapisano w zeszycie';
          // praca jest juz w chmurze — szkic niepotrzebny
          try { localStorage.removeItem(klucz); } catch { /* prywatny tryb */ }
        } else if (r === 'timeout') status.textContent = '✓ Zapisze się, gdy wróci internet';
        else status.innerHTML = `<a href="${base}/profil/">Zaloguj się</a>, żeby zapisywać w zeszycie`;
      })
      .catch(() => { status.textContent = '⚠️ Nie udało się zapisać'; });
  });
}

function podepnij(box, dane) {
  if (dane.typ === 'pisanie') { podepnijPisanie(box, dane); return; }

  const wybory = new Map(); // i -> wybrany index (tylko wybor)

  box.querySelectorAll('.cw-opcja').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (box.dataset.sprawdzone) return;
      const grupa = btn.closest('.cw-opcje');
      grupa.querySelectorAll('.cw-opcja').forEach((x) => x.classList.remove('on'));
      btn.classList.add('on');
      wybory.set(Number(grupa.dataset.i), Number(btn.dataset.oi));
      odswiezSprawdz();
    });
  });

  const sprawdzBtn = box.querySelector('.cw-sprawdz');
  const odswiezSprawdz = () => {
    if (dane.typ === 'wybor') sprawdzBtn.disabled = wybory.size < dane.zdania.length;
  };
  odswiezSprawdz();

  sprawdzBtn.addEventListener('click', () => {
    if (box.dataset.sprawdzone) { resetuj(); return; }

    if (dane.typ === 'wpisz') {
      // puste pola: potrzasnij i nie sprawdzaj
      const puste = [...box.querySelectorAll('.cw-input')].filter((el) => !el.value.trim());
      if (puste.length) {
        puste.forEach((el) => { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); });
        return;
      }
    }

    dane.zdania.forEach((z, i) => {
      const li = box.querySelector(`.cw-zdanie[data-i="${i}"]`);
      const wynikEl = li.querySelector('.cw-wynik');
      let stan; // 'dobrze' | 'prawie' | 'zle'
      if (dane.typ === 'wybor') {
        stan = sprawdzWybor(z, wybory.get(i)) ? 'dobrze' : 'zle';
        li.querySelectorAll('.cw-opcja').forEach((b, oi) => {
          b.disabled = true;
          if (oi === z.dobra) b.classList.add('dobra');
          else if (b.classList.contains('on')) b.classList.add('zla');
        });
      } else {
        const input = li.querySelector('.cw-input');
        stan = sprawdzWpisz(z, input.value);
        input.disabled = true;
        input.classList.add(`cw-${stan}`); // spojny sygnal: dobrze/prawie/zle
      }
      li.classList.add(`cw-${stan}`);
      wynikEl.hidden = false;
      wynikEl.innerHTML = stan === 'dobrze'
        ? '✓'
        : stan === 'prawie'
          ? `≈ prawie! poprawnie: <strong>${esc(z.odpowiedz[0])}</strong> — polskie znaki!`
          : `✗ poprawnie: <strong>${esc(dane.typ === 'wybor' ? z.opcje[z.dobra] : z.odpowiedz[0])}</strong>${z.czemu ? ` · ${esc(z.czemu)}` : ''}`;
    });

    box.dataset.sprawdzone = '1';
    sprawdzBtn.textContent = '🔁 Jeszcze raz';
  });

  const resetuj = () => {
    delete box.dataset.sprawdzone;
    wybory.clear();
    sprawdzBtn.textContent = 'Sprawdź';
    box.querySelectorAll('.cw-zdanie').forEach((li) => li.classList.remove('cw-dobrze', 'cw-prawie', 'cw-zle'));
    box.querySelectorAll('.cw-wynik').forEach((el) => { el.hidden = true; el.innerHTML = ''; });
    box.querySelectorAll('.cw-opcja').forEach((b) => { b.disabled = false; b.classList.remove('on', 'dobra', 'zla'); });
    box.querySelectorAll('.cw-input').forEach((el) => { el.disabled = false; el.value = ''; el.classList.remove('cw-dobrze', 'cw-prawie', 'cw-zle'); });
    odswiezSprawdz();
  };
}

znajdzBloki().forEach((pre) => {
  const wynik = parsujCwiczenie(pre.textContent);
  if (!wynik.ok) { console.warn('cwiczenie: pomijam zepsuty blok —', wynik.blad); return; }
  zbuduj(pre, wynik.dane);
});
