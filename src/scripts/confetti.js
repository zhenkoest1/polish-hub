// Polski Klub — konfetti (bez zależności)
// Prosty canvas na cały ekran, sam się sprząta po animacji.

const COLORS = ['#fdcb6e', '#e8a13c', '#e05252', '#00b894', '#efeaff'];

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function confetti({
  count = 90,
  origin = { x: 0.5, y: 0.32 },
  spread = 1.1,   // rozrzut w radianach
  power = 13,     // prędkość startowa
  gravity = 0.32,
  drag = 0.992,
} = {}) {
  if (reduceMotion()) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;

  const resize = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const ox = origin.x * w;
  const oy = origin.y * h;
  const parts = [];
  for (let i = 0; i < count; i++) {
    // stożek skierowany do góry (-PI/2) o szerokości `spread`
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2 * spread;
    const speed = power * (0.55 + Math.random() * 0.65);
    parts.push({
      x: ox + (Math.random() - 0.5) * 40,
      y: oy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  let raf = 0;
  const done = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    canvas.remove();
  };

  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    let alive = 0;

    for (const p of parts) {
      if (p.y > h + 40) continue;
      alive++;

      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.wobble += 0.1;
      p.x += p.vx + Math.sin(p.wobble) * 0.6;
      p.y += p.vy;
      p.rot += p.vrot;

      // „obrót” paska: ściskamy szerokość cosinusem
      const squash = Math.abs(Math.cos(p.rot));
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.wobble * 0.2);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w * squash + 1, p.h);
      ctx.restore();
    }

    if (alive === 0) done();
    else raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
}

/** Mały strzał z konkretnego elementu — np. po zaliczonej rundzie. */
export function confettiFrom(el, opts = {}) {
  if (reduceMotion() || !el) return;
  const r = el.getBoundingClientRect();
  confetti({
    count: 40,
    power: 10,
    origin: {
      x: (r.left + r.width / 2) / window.innerWidth,
      y: (r.top + r.height / 2) / window.innerHeight,
    },
    ...opts,
  });
}
