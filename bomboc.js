// bomboc.lat — beat-reactive bomboclat over a fire-particle field.
//
// Audio: bombo.wav, 110.41 BPM, 174.8 s, loops. The visual clock is derived
// from BPM (not live audio analysis), same approach as main.js — audio plays
// alongside, kept locked because bombo.wav loops cleanly at integer beats.
// Image: bomboclat.png, 1254x1254 (square). Sized responsively to the smaller
// viewport axis. Pulses on every beat (scale envelope) + crashes briefly on
// every 4th beat (downbeat) with a stronger pulse.
// Fire: GPU-cheap canvas particle system across the full viewport, denser
// behind the image. Each beat triggers a flame burst.

import { configFor } from "/sites.js";

const BPM       = 110.41;
const BEAT_S    = 60 / BPM;          // ≈ 0.5434 s

const PULSE_PEAK   = 0.10;            // +10% scale at peak of an off-beat pulse
const DOWNBEAT_PEAK = 0.22;           // +22% scale on every 4th beat
const PULSE_ATTACK = 0.04;            // s — snap up fast
const PULSE_DECAY  = 0.42;            // s — relax slow

const FIRE_BASE_RATE   = 90;          // particles spawned per second, baseline
const FIRE_BEAT_BURST  = 50;          // extra particles dropped on each beat
const FIRE_PARTICLE_MAX = 600;        // hard cap to keep render time bounded

// Song length in seconds — fallback used until the audio buffer decodes; once
// preloadAudio() finishes we switch to audioBuf.duration (174.8065 for the
// current bombo.opus). Using the hardcoded value for wrap math drifts the
// visual song-time off the audio by ~6.5 ms per wrap (≈ 0.65 s after 100 wraps),
// which makes BOMBOCLAT drops fire visibly ahead of the vocal on long sessions.
let songDur = 174.80;

// Drop timestamps in seconds (relative to song start) where the vocal hits
// "BOMBOCLAT". Whisper hallucinated the lyric (heard "gangster / fool /
// smoking" loops) so these were derived from two signals:
//   1. RMS-onset peaks above the 95th percentile (audio drops).
//   2. Whisper word boundaries with high prob — same beats whisper actually
//      latched onto, just with the wrong tokens.
// First pass set — Markus can nudge any of these by ear. The pattern repeats
// every songDur (audio loops seamlessly).
const BOMBOCLAT_DROPS = [
  23.4, 27.8, 30.0, 41.0, 76.2, 80.65, 87.25,
  119.3, 127.15, 137.9, 142.3, 153.3, 169.55,
];

const FLASH_DUR_S    = 0.55;          // visible window per drop
const FLASH_PEAK_SCALE = 1.45;        // snap-in scale at drop onset

const canvas    = document.getElementById("stage");
const ctx       = canvas.getContext("2d");
const overlay   = document.getElementById("overlay");
const attractEl = document.getElementById("attract");

const cfg = configFor(location.hostname);
if (cfg.title) document.title = cfg.title;

// Hide the hover.dog overlay completely — bomboc has no headline/owner block.
overlay.style.display = "none";

// Inject the bomboclat image element (sits above the canvas).
const img = document.createElement("img");
img.id = "bombo";
img.src = "/assets/bomboclat.png";
img.alt = "bomboclat";
img.draggable = false;
document.body.appendChild(img);

// BOMBOCLAT shout text — flashes in over the image on each drop, ages out
// fast. The shadow stack keeps it readable over the busy fire field.
const shout = document.createElement("div");
shout.id = "shout";
shout.textContent = "BOMBOCLAT";
document.body.appendChild(shout);

// Style: centered, square, sized to the smaller viewport axis with padding so
// flames have room to breathe around the edges.
const css = document.createElement("style");
css.textContent = `
  #bombo {
    position: fixed; left: 50%; top: 50%;
    transform: translate(-50%, -50%) scale(1);
    width: min(72vw, 72vh);
    height: min(72vw, 72vh);
    object-fit: contain;
    z-index: 3;
    pointer-events: none;
    image-rendering: -webkit-optimize-contrast;
    will-change: transform;
    /* Drop-shadow gives the image a hot rim — green inner / red outer to
       match the rasta-palette fire. */
    filter: drop-shadow(0 0 18px rgba(80, 220, 80, 0.5))
            drop-shadow(0 0 40px rgba(220, 40, 30, 0.4));
  }
  /* Recolor the attract prompt to match the fire palette so it doesn't read
     as the hover.dog page. */
  #attract { color: #ffd60a; text-shadow: 0 0 14px rgba(255, 200, 40, 0.7); }
  html, body { background: #0a0503; }
  /* BOMBOCLAT shout — rasta gradient text that snaps in on each drop. */
  #shout {
    position: fixed; left: 50%; top: 50%;
    transform: translate(-50%, -50%) scale(1);
    z-index: 6;
    pointer-events: none;
    font-family: "Press Start 2P", ui-monospace, monospace;
    font-size: clamp(28px, 9vw, 120px);
    letter-spacing: 0.05em;
    line-height: 1;
    white-space: nowrap;
    opacity: 0;
    /* Rasta tricolor gradient: green → yellow → red, clipped to text. */
    background: linear-gradient(180deg, #2ecc40 0%, #ffdc00 50%, #ff2a18 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    text-shadow:
      0 0 12px rgba(0, 0, 0, 0.85),
      0 0 28px rgba(255, 180, 40, 0.65);
    will-change: transform, opacity;
    /* Black outline via filter so the gradient text stays legible on fire. */
    filter: drop-shadow(0 2px 0 #000) drop-shadow(0 0 6px rgba(0,0,0,0.9));
  }
`;
document.head.appendChild(css);

// ─── Canvas sizing ────────────────────────────────────────────────────────
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width  = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

// ─── Audio gate state machine ────────────────────────────────────────────
// Mirrors main.js, simpler because bomboc has a single looping buffer (no
// intro→loop handoff). States:
//
//   audioCtx.state   audioStarted   meaning
//   ──────────────   ────────────   ────────────────────────────────────────
//   "suspended"      false          ATTRACT  — boot done, awaiting gesture
//   "running"        true           PLAYING  — buffer scheduled, audible
//   "suspended"      true           BACKGROUND — browser/OS re-suspended the
//                                   running context (tab hidden, OS sleep).
//                                   Auto-resumes when foregrounded; bfcache
//                                   restore is the only path that needs help
//                                   (handled by the pageshow listener below).
//   any              false (init)   PRE-BOOT — audioCtx not yet constructed
//
// startAudio() is called inside begin() and is idempotent (early-returns once
// audioStarted is set). audioCtx.resume() is called separately in begin() —
// it must happen inside the user-gesture stack for browser autoplay policy.
let audioCtx = null;
let audioBuf = null;
let audioT0  = null;          // audioCtx.currentTime mapped to visual t=0
let audioStarted = false;

// bfcache restore: see main.js for the full rationale. Registered at module
// load (not inside async boot) so a pageshow event delivered mid-preload still
// triggers the reload.
addEventListener("pageshow", (e) => { if (e.persisted) location.reload(); });

async function preloadAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const res = await fetch("/assets/audio/bombo.opus");
  const arr = await res.arrayBuffer();
  audioBuf = await audioCtx.decodeAudioData(arr);
  // Snap the wrap reference to the actual decoded length so visual songT and
  // the audio's loop position stay in sync forever.
  songDur = audioBuf.duration;
}

function startAudio() {
  if (audioStarted || !audioBuf) return;
  audioStarted = true;
  const startAt = audioCtx.currentTime + 0.02;
  audioT0 = startAt;
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuf;
  src.loop = true;
  src.connect(audioCtx.destination);
  src.start(startAt);
}

// ─── Beat clock ───────────────────────────────────────────────────────────
let startMs = 0;
let lastBeat = -1;

function visualT() {
  if (audioStarted && audioT0 != null) return audioCtx.currentTime - audioT0;
  return (performance.now() - startMs) / 1000;
}

// envelope for the on-beat scale pulse: snap up over PULSE_ATTACK, ease down
// over PULSE_DECAY, zero after that.
function pulseEnv(tSinceBeat) {
  if (tSinceBeat < 0) return 0;
  if (tSinceBeat < PULSE_ATTACK) return tSinceBeat / PULSE_ATTACK;
  const td = tSinceBeat - PULSE_ATTACK;
  if (td < PULSE_DECAY) return 1 - td / PULSE_DECAY;
  return 0;
}

// ─── Fire particles ───────────────────────────────────────────────────────
const particles = [];

function spawnParticle(burstK = 1) {
  if (particles.length >= FIRE_PARTICLE_MAX) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Bias spawns toward the bottom-center band so flames frame the image.
  // 60% from a center-weighted distribution, 40% across the full width.
  const cx = w / 2;
  const x = Math.random() < 0.6
    ? cx + (Math.random() - 0.5) * w * 0.55
    : Math.random() * w;
  const baseSpeed = (180 + Math.random() * 140) * burstK;
  particles.push({
    x,
    y: h + 12,
    vx: (Math.random() - 0.5) * 60,
    vy: -baseSpeed,
    age: 0,
    life: 1.1 + Math.random() * 1.0,
    size: 22 + Math.random() * 46,
  });
}

function drawFire(dt) {
  // Update + cull
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 40 * dt;                  // heat acceleration upward
    p.vx *= 0.985;                    // damp horizontal jitter
  }
  // Render with additive blending so overlapping particles brighten.
  // Rasta stratification: each particle ages green → yellow → red over its
  // lifetime, so the flame field reads as vertical stripes — fresh green at
  // the base, yellow mid-rise, red at the cooling tips.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const lerp = (a, b, k) => [
    Math.round(a[0] + k * (b[0] - a[0])),
    Math.round(a[1] + k * (b[1] - a[1])),
    Math.round(a[2] + k * (b[2] - a[2])),
  ];
  const GREEN  = [60,  220, 70];
  const YELLOW = [255, 215, 40];
  const RED    = [225, 40,  28];
  for (const p of particles) {
    const t = p.age / p.life;
    const alpha = (1 - t) * 0.55;
    const r = p.size * (1 + t * 0.6);
    const [cr, cg, cb] = t < 0.5
      ? lerp(GREEN, YELLOW, t * 2)
      : lerp(YELLOW, RED, (t - 0.5) * 2);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0,    `rgba(${cr + 25}, ${cg + 25}, ${cb + 20}, ${alpha})`);
    g.addColorStop(0.4,  `rgba(${cr}, ${cg}, ${cb}, ${alpha * 0.85})`);
    const dr = Math.max(0, cr - 60), dg = Math.max(0, cg - 60), db = Math.max(0, cb - 30);
    g.addColorStop(0.8,  `rgba(${dr}, ${dg}, ${db}, ${alpha * 0.4})`);
    g.addColorStop(1,    "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Render loop ──────────────────────────────────────────────────────────
let visualsStarted = false;
let lastFrameT     = 0;
let lastShoutT     = -1e9;        // visual-time of most recent BOMBOCLAT flash
let prevSongT      = 0;           // for detecting song-loop wrap
let dropCursor     = 0;           // next drop index to fire within the song

function tick(now) {
  const t  = visualT();
  const dt = Math.min(0.05, (now - lastFrameT) / 1000);  // clamp on tab refocus
  lastFrameT = now;

  // Clear with a slight residue so fire trails carry a tiny ghost frame.
  ctx.fillStyle = "rgba(10, 5, 3, 0.32)";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  // Steady-rate fire spawns.
  const want = FIRE_BASE_RATE * dt;
  for (let i = 0; i < Math.floor(want); i++) spawnParticle();
  if (Math.random() < (want - Math.floor(want))) spawnParticle();

  // Detect beat crossings (and downbeats) for burst spawns + pulse phase.
  const beatIdx = Math.floor(t / BEAT_S);
  if (beatIdx > lastBeat) {
    lastBeat = beatIdx;
    const isDownbeat = beatIdx % 4 === 0;
    const burstK = isDownbeat ? 1.5 : 1;
    const burst  = Math.floor(FIRE_BEAT_BURST * burstK);
    for (let i = 0; i < burst; i++) spawnParticle(burstK);
  }

  // Pulse the image: scale envelope from the most recent beat onset.
  const tSinceBeat = t - lastBeat * BEAT_S;
  const isDown     = lastBeat % 4 === 0;
  const peak       = isDown ? DOWNBEAT_PEAK : PULSE_PEAK;
  const scale      = 1 + peak * pulseEnv(tSinceBeat);
  img.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;

  // BOMBOCLAT flash. Map visual t to song time via modulo (audio loops).
  // When songT wraps back to ~0, reset the drop cursor for the next loop.
  const songT = t % songDur;
  if (songT < prevSongT) dropCursor = 0;       // wrap → start of drop list
  while (dropCursor < BOMBOCLAT_DROPS.length && songT >= BOMBOCLAT_DROPS[dropCursor]) {
    lastShoutT = t;
    dropCursor++;
  }
  prevSongT = songT;
  const shoutAge = t - lastShoutT;
  if (shoutAge < FLASH_DUR_S) {
    const k = shoutAge / FLASH_DUR_S;          // 0 → 1 across the window
    // Snap in fast, decay slow: attack over first 8% of the window.
    const env = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92;
    const sc  = 1 + (FLASH_PEAK_SCALE - 1) * env;
    shout.style.opacity   = env.toFixed(3);
    shout.style.transform = `translate(-50%, -50%) scale(${sc.toFixed(3)})`;
  } else if (shout.style.opacity !== "0") {
    shout.style.opacity = "0";
  }

  drawFire(dt);

  requestAnimationFrame(tick);
}

// ─── Boot: arcade gate, then start everything atomically ──────────────────
async function boot() {
  attractEl.textContent = "ENTER 1 CLICK(S) TO PLAY";
  try { await preloadAudio(); } catch (e) { /* fall through to silent visuals */ }

  // Wait for image to decode so the first painted frame has it. Surface
  // failures (404, corrupt PNG) in DevTools — the page boots either way but
  // would otherwise render fire with no center image and zero feedback.
  if (img.decode) { try { await img.decode(); } catch (e) { console.warn("bomboclat decode:", e); } }

  function begin() {
    if (visualsStarted) return;
    if (audioCtx && audioCtx.state !== "running") {
      audioCtx.resume().catch(() => {});
    }
    startAudio();
    startMs = performance.now();
    lastFrameT = startMs;
    visualsStarted = true;
    attractEl.classList.add("hidden");
    requestAnimationFrame(tick);
  }

  // Same pointer/keyboard/touch event set as main.js so the gate unlocks
  // consistently across input modalities. {once: true} (not used in main.js)
  // is fine here because begin() sets visualsStarted synchronously before any
  // await, so a second gesture of a different type that fires before begin()
  // returns sees the flag and early-returns — the once self-detach just saves
  // the second listener call.
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    addEventListener(ev, begin, { passive: true, once: true })
  );
}

boot();
