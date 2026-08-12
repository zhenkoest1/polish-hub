// Most do Firebase: logowanie, zapis wynikow, odczyt profili.
// Cala logika czysta zyje w konto.js / wyniki.js — tu tylko klej.
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache,
  doc, getDoc, setDoc, addDoc, collection, getDocs, serverTimestamp,
  query, orderBy, limit,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';
import { emailOsoby, pinNaHaslo, osobaZeSluga, poprawnyPin } from './konto.js';
import { lepszyWynik } from './wyniki.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// persistentLocalCache: wyniki zapisane offline dolatuja same po powrocie sieci
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

const KTO_KEY = 'pk_kto_v1'; // cache dla chipa w nawigacji (bez ladowania SDK)

function zapamietajKogo(user) {
  try {
    if (!user) { localStorage.removeItem(KTO_KEY); return; }
    const slug = user.email.split('@')[0];
    const osoba = osobaZeSluga(slug);
    if (osoba) localStorage.setItem(KTO_KEY, JSON.stringify(osoba));
  } catch { /* prywatny tryb — trudno */ }
}

onAuthStateChanged(auth, zapamietajKogo);

// cb dostaje osobe ({slug,name,emoji}) albo null
export function obserwujOsobe(cb) {
  return onAuthStateChanged(auth, (user) => {
    cb(user ? osobaZeSluga(user.email.split('@')[0]) ?? null : null);
  });
}

export async function zaloguj(slug, pin) {
  // Ochrona przed nieznanym slugiem: bez tego pierwsze logowanie zalozyloby
  // osierocone konto w Auth i wywalilo sie na osoba.name (uwaga z code review)
  const osoba = osobaZeSluga(slug);
  if (!osoba) throw new Error('Nieznana osoba.');
  if (!poprawnyPin(pin)) throw new Error('PIN to 4 cyfry.');
  const email = emailOsoby(slug);
  const haslo = pinNaHaslo(slug, pin);
  try {
    await signInWithEmailAndPassword(auth, email, haslo);
  } catch (e) {
    // Konto moze jeszcze nie istniec — pierwsze logowanie je zaklada.
    // Firebase zwraca ten sam kod dla "brak konta" i "zle haslo"
    // (ochrona przed enumeracja), wiec probujemy zalozyc: jesli email
    // juz zajety — to byl po prostu zly PIN.
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, haslo);
        await setDoc(doc(db, 'users', cred.user.uid), {
          slug, name: osoba.name, emoji: osoba.emoji, best: {},
        });
      } catch (e2) {
        if (e2.code === 'auth/email-already-in-use') throw new Error('Zły PIN.');
        throw e2;
      }
    } else {
      throw e;
    }
  }
}

export function wyloguj() {
  zapamietajKogo(null);
  return signOut(auth);
}

// Zwraca true gdy zapisano, false gdy nikt nie jest zalogowany.
export async function zapiszWynik(quizId, wynik) {
  // Nie ufaj currentUser tuz po zaladowaniu modulu: sesja wstaje z IndexedDB
  // asynchronicznie (quiz laduje chmura.js dopiero przy wynikach)
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return false;
  const ref = doc(db, 'users', user.uid);
  let best = {};
  try {
    const snap = await getDoc(ref);
    best = (snap.exists() && snap.data().best) || {};
  } catch { /* zimny cache offline — piszemy sam nowy wynik, waski merge to udzwignie */ }
  // ts: Date.now() — lepszyWynik porownuje ts po stronie klienta; serverTimestamp to sentinel az do potwierdzenia
  const nowy = { ...wynik, ts: Date.now() };
  best[quizId] = lepszyWynik(best[quizId], nowy);
  const osoba = osobaZeSluga(user.email.split('@')[0]);
  // Wyslij obie operacje przed oczekiwaniem: offline nie zawieszaj addDoc
  const p1 = setDoc(ref, { ...(osoba ?? {}), best: { [quizId]: best[quizId] } }, { merge: true });
  const p2 = addDoc(collection(db, 'users', user.uid, 'attempts'), {
    quiz: quizId, ...wynik, ts: serverTimestamp(),
  });
  await Promise.all([p1, p2]);
  return true;
}

// Zapis pracy pisemnej do zeszytu. true = zapisano, false = nikt niezalogowany.
export async function zapiszDoZeszytu({ lekcja, zadanie, wpisy }) {
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return false;
  await addDoc(collection(db, 'users', user.uid, 'zeszyt'), {
    lekcja, zadanie, wpisy, ts: serverTimestamp(),
  });
  return true;
}

// Ostatnie prace pisemne zalogowanej osoby (domyslnie 30, od najnowszej).
export async function pobierzZeszyt(ile = 30) {
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return [];
  const q = query(collection(db, 'users', user.uid, 'zeszyt'), orderBy('ts', 'desc'), limit(ile));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Stan Leitnera w profilu — jedno pole, jeden zapis; kolizje godzi polacz().
// Zwraca true gdy zapisano, false gdy nikt nie jest zalogowany.
export async function zapiszLeitner(stan) {
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return false;
  await setDoc(doc(db, 'users', user.uid), { leitner: stan }, { merge: true });
  return true;
}

// Stan Leitnera z chmury; {} gdy nikt niezalogowany albo profil go nie ma.
export async function pobierzLeitner() {
  const user = auth.currentUser ?? await gotowyUzytkownik();
  if (!user) return {};
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return (snap.exists() && snap.data().leitner) || {};
  } catch {
    // Zimny cache offline — lepiej uczyc sie na stanie lokalnym niz wywalic strone.
    return {};
  }
}

// Profil zalogowanej osoby (z best) albo null.
export async function mojProfil() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? snap.data() : null;
}

// Wszystkie profile — dashboard "kto co przeszedl" (3 odczyty).
export async function pobierzProfile() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => d.data());
}

// Czeka na ustalenie stanu logowania (pierwszy strzal onAuthStateChanged).
export function gotowyUzytkownik() {
  return new Promise((res) => {
    const stop = onAuthStateChanged(auth, (u) => { stop(); res(u); });
  });
}
