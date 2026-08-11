// Silnik cwiczen w lekcjach: znajduje bloki ```cwiczenie (JSON) i zamienia je
// na interaktywne rundy z przyciskiem Sprawdz. Zepsuty JSON NIE psuje strony —
// blok zostaje jak byl, a walidator w `npm test` i tak go wylapie.
import { parsujCwiczenie, sprawdzWybor, sprawdzWpisz } from './cwiczenia-logika.js';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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
    const srodek = dane.typ === 'wybor'
      ? `<span class="cw-opcje" data-i="${i}">${z.opcje.map((o, oi) =>
          `<button type="button" class="cw-opcja" data-oi="${oi}">${esc(o)}</button>`).join('')}</span>`
      : `<input class="cw-input" data-i="${i}" autocomplete="off" autocapitalize="off" />`;
    return `<li class="cw-zdanie" data-i="${i}">
      <span class="cw-tekst">${esc(z.przed)}${srodek}${esc(z.po)}</span>
      <span class="cw-wynik" hidden></span>
    </li>`;
  }).join('');
  box.innerHTML = `
    ${dane.tytul ? `<p class="cw-tytul">${esc(dane.tytul)}</p>` : ''}
    ${dane.instrukcja ? `<p class="cw-instrukcja">${esc(dane.instrukcja)}</p>` : ''}
    <ol class="cw-lista">${zdaniaHtml}</ol>
    <button type="button" class="cw-sprawdz btn">Sprawdź</button>
  `;
  pre.replaceWith(box);
  podepnij(box, dane);
}

function podepnij(box, dane) {
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
