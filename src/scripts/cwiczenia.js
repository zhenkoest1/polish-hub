// Silnik cwiczen w lekcjach: znajduje bloki ```cwiczenie (JSON) i zamienia je
// na interaktywne rundy z przyciskiem Sprawdz. Zepsuty JSON NIE psuje strony —
// blok zostaje jak byl, a walidator w `npm test` i tak go wylapie.
import { parsujCwiczenie, sprawdzWybor, sprawdzWpisz, sprawdzPare } from './cwiczenia-logika.js';

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

// Fisher-Yates na kopii — kolumny tasujemy niezaleznie, wiec lista wejsciowa
// musi przezyc pierwsze tasowanie w nienaruszonym stanie.
function tasuj(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// polacz: dwie kolumny przyciskow zamiast listy zdan — stad osobny builder
function zbudujPolacz(pre, dane) {
  const box = document.createElement('section');
  box.className = 'cw-box';
  box.innerHTML = `
    ${dane.tytul ? `<p class="cw-tytul">${esc(dane.tytul)}</p>` : ''}
    ${dane.instrukcja ? `<p class="cw-instrukcja">${esc(dane.instrukcja)}</p>` : ''}
    <p class="cw-podpowiedz">👆 Kliknij słowo z lewej, potem pasujące z prawej.</p>
    <div class="cw-polacz"></div>
    <p class="cw-status" hidden></p>
    <button type="button" class="cw-znowu btn" hidden>🔁 Jeszcze raz</button>
  `;
  pre.replaceWith(box);
  podepnijPolacz(box, dane);
}

// Pudlo nie konczy cwiczenia — para wraca do puli, ale wypada z punktacji
// „za pierwszym razem". Bez tego wynik zawsze wynosilby 100%, bo do konca
// mozna dojsc metoda prob i bledow.
function podepnijPolacz(box, dane) {
  const pole = box.querySelector('.cw-polacz');
  const status = box.querySelector('.cw-status');
  const znowu = box.querySelector('.cw-znowu');
  const ile = dane.pary.length;

  const start = () => {
    const pary = dane.pary.map(([lewa, prawa], i) => ({ lewa, prawa, i }));
    const komorka = (p, strona) =>
      `<button type="button" class="cw-para-item" data-strona="${strona}" data-pi="${p.i}">${
        esc(strona === 'l' ? p.lewa : p.prawa)}</button>`;
    // stary DOM (razem z jego listenerami) znika — restart zaczyna od czystego stanu
    pole.innerHTML = `
      <div class="cw-kolumna">${tasuj(pary).map((p) => komorka(p, 'l')).join('')}</div>
      <div class="cw-kolumna">${tasuj(pary).map((p) => komorka(p, 'p')).join('')}</div>`;
    status.hidden = true;
    status.textContent = '';
    znowu.hidden = true;

    const przyciski = [...pole.querySelectorAll('.cw-para-item')];
    const wybrane = { l: null, p: null };
    const pudla = new Set(); // indeksy par, przy ktorych byl blad
    let zrobione = 0;
    let czekamy = false; // trwa animacja pudla — klikniecia ignorujemy

    const odznacz = () => {
      przyciski.forEach((b) => b.classList.remove('on'));
      wybrane.l = null;
      wybrane.p = null;
    };

    const koniec = () => {
      const trafione = ile - pudla.size;
      status.hidden = false;
      status.textContent = trafione === ile
        ? `✓ Wszystkie ${ile} pary za pierwszym razem!`
        : `${trafione} / ${ile} par za pierwszym razem.`;
      znowu.hidden = false;
    };

    const rozstrzygnij = () => {
      const a = wybrane.l;
      const b = wybrane.p;
      if (sprawdzPare(dane, Number(a.dataset.pi), Number(b.dataset.pi))) {
        [a, b].forEach((x) => { x.classList.remove('on'); x.classList.add('polaczone'); x.disabled = true; });
        odznacz();
        zrobione += 1;
        if (zrobione === ile) koniec();
        return;
      }
      pudla.add(a.dataset.pi);
      czekamy = true;
      [a, b].forEach((x) => x.classList.add('zla', 'shake'));
      setTimeout(() => {
        [a, b].forEach((x) => x.classList.remove('zla', 'shake'));
        odznacz();
        czekamy = false;
      }, 600);
    };

    przyciski.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (czekamy || btn.disabled) return;
        const strona = btn.dataset.strona;
        // ponowne klikniecie w zaznaczony przycisk = odznaczenie
        if (wybrane[strona] === btn) {
          btn.classList.remove('on');
          wybrane[strona] = null;
          return;
        }
        if (wybrane[strona]) wybrane[strona].classList.remove('on');
        wybrane[strona] = btn;
        btn.classList.add('on');
        if (wybrane.l && wybrane.p) rozstrzygnij();
      });
    });
  };

  znowu.addEventListener('click', start);
  start();
}

function zbuduj(pre, dane) {
  if (dane.typ === 'polacz') { zbudujPolacz(pre, dane); return; }

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

  const przycisk = box.querySelector('.cw-zapisz');
  const odblokuj = () => { przycisk.disabled = false; };

  przycisk.addEventListener('click', () => {
    const wpisy = pola.map((el) => el.value.trim());
    if (wpisy.every((w) => !w)) {
      pola.forEach((el) => { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); });
      return;
    }
    status.hidden = false;
    status.textContent = '⏳ zapisuję…';
    // Kazde klikniecie tworzy NOWY dokument, a firestore.rules ma
    // `allow update, delete: if false` — dubla nie da sie potem usunac.
    // Stad blokada na czas zapisu; odblokowujemy tylko tam, gdzie ponowienie ma sens.
    przycisk.disabled = true;

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
          // przycisk zostaje zablokowany: drugi zapis tego samego tekstu to czysty dubel.
          // Dopiero gdy uczen cos dopisze, nowy zapis niesie nowa tresc — wtedy odblokuj.
          pola.forEach((el) => el.addEventListener('input', odblokuj, { once: true }));
        } else {
          // timeout / brak logowania — nic nie poszlo do bazy albo poszlo do kolejki offline,
          // wiec ponowienie nie grozi dublem
          if (r === 'timeout') status.textContent = '✓ Zapisze się, gdy wróci internet';
          else status.innerHTML = `<a href="${base}/profil/">Zaloguj się</a>, żeby zapisywać w zeszycie`;
          odblokuj();
        }
      })
      .catch(() => { status.textContent = '⚠️ Nie udało się zapisać'; odblokuj(); });
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
