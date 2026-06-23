import { configFor } from "/sites.js";

// Track BPM derived from the original loop master: 86 beats in 45.96s →
// 112.27 BPM. The shipped loop.wav has the false-ending breakdown spliced
// out (now 31.02s), so it carries ~58 of the original 86 beats — the tempo
// is identical, just shorter. Visuals are scripted off BPM, no live audio
// analysis. Audio plays alongside; timing stays locked across the loop seam
// because the splice is integer-beat-aligned + crossfaded.
const BPM         = 112.27;
const BEAT_S      = 60 / BPM;            // ~0.537 s
const COLOR_S     = BEAT_S / 2;          // 8th-note color advance — also the ripple emit rate

// Drop landmark. Aubio's beat-tracker shows the kick locking to the main
// 111.78 BPM grid at t≈5.735s, but the *perceived* drop (full instrumentation
// in) sits one bar later. Snapping to step 26 of the 8th-note grid →
// INTRO_END_S = 26 * COLOR_S ≈ 6.98 s, lining up with Markus's "6/7 s in".
const DROP_STEP   = 25;
const INTRO_END_S = DROP_STEP * COLOR_S; // ≈ 6.713 s
// Beat-pulse CSS animation kicks in 0.36s after the slam (delay matches the
// slam-keyframe duration) and runs at BEAT_S. Text color advances at every
// cycle start so it lands on the same frame as the bounce.
const BOUNCE_OFFSET = INTRO_END_S + 0.36;

// During the build, the dog bobs and the trail drifts at 2× pace; on the
// drop step both relax to the steady-state values.
const BOB_HZ_NORM  = (BPM / 60) / 4;     // ~0.47 Hz — slow swim, post-drop
const BOB_HZ_INTRO = BOB_HZ_NORM * 2;    // ~0.93 Hz — twice as fast pre-drop
const DRIFT_NORM   = 460;                // px/sec rightward, post-drop
const DRIFT_INTRO  = DRIFT_NORM * 2;     // px/sec rightward, pre-drop

const RIPPLE_LIFE  = 2.4;                // seconds before the silhouette-ripple is dropped
const RIPPLE_END   = 2.8;                // steady-state scale multiplier at end of life

// Spiraling segment — the named [42 s, 50 s] window in the song where the
// trail visibly intensifies. Inside this segment the silhouette emit rate
// doubles to 16th-notes AND each emitted ripple grows to ~2× the steady-state
// end scale (i.e. larger heads, faster). Everything else (bob, drift, tilt)
// stays at the steady-state values.
const SPIRAL_START   = 42.0;
const SPIRAL_END     = 50.0;
const SPIRAL_END_SCALE = 1 + 2 * (RIPPLE_END - 1);  // grows 2× the size delta — ≈ 4.6

const PALETTE = [
  "#ff006e", // hot magenta
  "#00e5ff", // cyan
  "#ffd600", // acid yellow
  "#76ff03", // lime
  "#7b2d8e", // deep violet
  "#ff1744", // red
];

const canvas   = document.getElementById("stage");
const ctx      = canvas.getContext("2d");
const overlay  = document.getElementById("overlay");
const elHead   = document.getElementById("headline");
const elDom    = document.getElementById("domain");
const elOwner  = document.getElementById("owner");
const attractEl = document.getElementById("attract");

// Arcade attract gate. Until a user gesture (or browser-granted autoplay)
// succeeds, the visual clock has NOT started — we render one static frame of
// the mascot under the "ENTER 1 CLICK(S) TO PLAY" prompt, and the tick() rAF
// loop is not kicked. When beginPlay() succeeds, audio + visuals both start
// from t=0 atomically, so they stay aligned across the session.
let visualsStarted = false;

const cfg = configFor(location.hostname);
if (cfg.title) document.title = cfg.title;
if (cfg.headline) { elHead.textContent = cfg.headline; elHead.dataset.text = cfg.headline; }
if (cfg.domain)   elDom.textContent   = cfg.domain;
if (cfg.owner)    elOwner.textContent = cfg.owner;

// Length-aware fit. The headline is `white-space: nowrap`, so the CSS clamp
// only bounds font-size — long hostnames (opensourcefriendly.dev) overflow
// horizontally. Shrink until it fits ~92% of the viewport.
function fitHeadline() {
  if (!cfg.headline) return;
  elHead.style.fontSize = "";
  const max = innerWidth * 0.92;
  let size = parseFloat(getComputedStyle(elHead).fontSize);
  while (elHead.scrollWidth > max && size > 24) {
    size *= 0.93;
    elHead.style.fontSize = size + "px";
  }
}
// Force-load the headline face up-front; otherwise `font-display: block` keeps
// the headline invisible (scrollWidth=0) until the slam drop, and fitHeadline
// would never measure correctly during the intro. Once the face is in, fit.
if (document.fonts?.load) {
  document.fonts.load('400 5rem "Press Start 2P"').then(fitHeadline, fitHeadline);
} else {
  fitHeadline();
}

let dpr = 1;
function resize() {
  // Cap at 1: the mascot is pixel-art and the silhouettes/tintedDogs are
  // pre-baked at the source PNG's resolution, so 2× DPR is 4× the fill
  // cost per frame for no visible benefit (smoothing is off — see below).
  dpr = 1;
  canvas.width  = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width  = innerWidth  + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Pixel-art aesthetic: no bilinear filtering on scaled drawImage calls.
  // Also skips an interpolation pass per ripple paint, modest CPU/GPU win.
  ctx.imageSmoothingEnabled = false;
  if (mascotImg) layout();
  // Attract is canvas-painted (not DOM) — a resize wipes the canvas, so
  // re-blit the static frame until the user starts the show.
  if (!visualsStarted && mascotImg) drawAttractFrame();
}
addEventListener("resize", () => { resize(); fitHeadline(); });

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload  = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function bakeSilhouette(mask, color) {
  const c = document.createElement("canvas");
  c.width  = mask.width;
  c.height = mask.height;
  const k = c.getContext("2d");
  k.drawImage(mask, 0, 0);
  k.globalCompositeOperation = "source-in";
  k.fillStyle = color;
  k.fillRect(0, 0, c.width, c.height);
  return c;
}

// Pre-bake the full tinted-dog composite (base mascot + overlay tint + screen
// tint) once per palette color. Per-frame this lets us blit ONE finished
// canvas instead of running two `globalCompositeOperation` passes (overlay +
// screen) on the live stage every frame — those are the expensive ones, since
// each requires reading the destination pixels under the dog's bounding box
// at DPR×DPR resolution and rewriting them. Pre-baking is pixel-identical to
// the previous live composite because the tilt/scale is applied identically
// to the original and the tint (same translate→rotate→drawImage sequence).
function bakeTintedDog(base, tintColor) {
  const c = document.createElement("canvas");
  c.width  = base.width;
  c.height = base.height;
  const k = c.getContext("2d");
  const tint = bakeSilhouette(base, tintColor);
  k.drawImage(base, 0, 0);
  k.globalAlpha = 0.55;
  k.globalCompositeOperation = "overlay";
  k.drawImage(tint, 0, 0);
  k.globalAlpha = 0.28;
  k.globalCompositeOperation = "screen";
  k.drawImage(tint, 0, 0);
  return c;
}

let mascotImg = null;           // pose 0 — used by resize() to know when to lay out
let mascotImgs = [];            // [poseA, poseB] — same length as poses (length 1 if no alt)
// silhouettes[pose][colorIdx] / tintedDogs[pose][colorIdx]: per-pose canvases.
// Single-mascot sites have a length-1 outer array; the renderer just clamps.
let silhouettes = [];
let tintedDogs  = [];   // pre-composed base + overlay-tint + screen-tint per (pose,color)
let poseDims    = [{w: 0, h: 0}];  // each pose has its own aspect ratio
const ripples = [];   // {x, y, w, h, tilt, colorIdx, t0, pose}  — pose frozen at emission

const mascot = {
  centerX: 0, centerY: 0,
  bobAmp: 0,
};

function layout() {
  // Inflated, central-ish. Scaled larger and lifted up so GET BARKED + the
  // domain block can sit underneath without the dog overlapping them.
  // Each pose preserves its native aspect ratio — the hoverboard variants are
  // shaped differently (one is taller, one is wider with arms out), and
  // stretching either to match the other would distort the artwork.
  const minDim  = Math.min(innerHeight, innerWidth);
  const targetH = minDim * 0.46;
  poseDims = mascotImgs.map((img) => ({
    w: img.width * (targetH / img.height),
    h: targetH,
  }));
  mascot.centerX = innerWidth * 0.5;
  mascot.centerY = innerHeight * 0.30;     // higher up — text block lives below
  mascot.bobAmp  = minDim * 0.073;          // 66% of previous 0.11
}

// ─── Animated favicon ────────────────────────────────────────────────────
// Most browsers (Chrome/Safari/Edge) show only the FIRST frame of an animated
// GIF favicon, so the static <link> in index.html only animates in Firefox.
// To get motion everywhere we drive a small offscreen canvas from inside the
// tick() loop and write its data URL back to a dedicated favicon <link>.
// Throttled to ~8 Hz — toDataURL on a 64×64 canvas is sub-millisecond, and the
// tab-strip repaint that follows is cheap (compositor, not main thread).
const FAV_SIZE = 64;
const FAV_HZ   = 8;
let favCanvas = null, favCtx = null, favLink = null, favLastT = -1;
function setupFavicon() {
  favCanvas = document.createElement("canvas");
  favCanvas.width = FAV_SIZE; favCanvas.height = FAV_SIZE;
  favCtx = favCanvas.getContext("2d");
  favCtx.imageSmoothingEnabled = false;   // crisp pixel-art downscale
  favLink = document.createElement("link");
  favLink.rel = "icon";
  document.head.appendChild(favLink);     // appended last → takes precedence over the static GIF
}
function paintFavicon(t, pose, tilt) {
  if (!favCtx || document.hidden) return;     // skip work for hidden tabs
  if (t - favLastT < 1 / FAV_HZ) return;
  favLastT = t;
  favCtx.clearRect(0, 0, FAV_SIZE, FAV_SIZE);
  // Bob amp scaled to 12% of the favicon side so the dog stays in frame at 64px.
  const dy = Math.sin(bobPhase(t)) * (FAV_SIZE * 0.12);
  favCtx.save();
  favCtx.translate(FAV_SIZE / 2, FAV_SIZE / 2 + dy);
  favCtx.rotate(tilt);
  favCtx.drawImage(tintedDogs[pose][colorIdx], -FAV_SIZE / 2, -FAV_SIZE / 2, FAV_SIZE, FAV_SIZE);
  favCtx.restore();
  favLink.href = favCanvas.toDataURL("image/png");
}

async function preload() {
  // Per-site mascot override (see sites.js): hover.dog / hoverboard.dog ship
  // a hoverboarding variant with two alternating poses; everything else uses
  // a single mascot. When `cfg.mascotAlt` is set, the two poses are toggled
  // via a 2π rotation flip on intro / spiral boundaries (see currentPose()).
  const srcA = cfg.mascot    || "/assets/hei/hei_mask_original.png";
  const srcs = cfg.mascotAlt ? [srcA, cfg.mascotAlt] : [srcA];
  mascotImgs  = await Promise.all(srcs.map(loadImage));
  mascotImg   = mascotImgs[0];
  silhouettes = mascotImgs.map((img) => PALETTE.map((c) => bakeSilhouette(img, c)));
  tintedDogs  = mascotImgs.map((img) => PALETTE.map((c) => bakeTintedDog(img, c)));
  resize();
}

let audioCtx;
let audioT0 = null;     // audioCtx.currentTime that maps to visual t=0
let audioStarted = false;
let introBuf = null, loopBuf = null, audioGain = null;
async function decodeUrl(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return audioCtx.decodeAudioData(buf);
}
// Decode the audio up-front so the first user gesture can start playback
// instantly with no fetch/decode delay. Creates a suspended AudioContext;
// browser autoplay policy will refuse to actually emit sound until a gesture.
async function prepareAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0.85;
    audioGain.connect(audioCtx.destination);
    [introBuf, loopBuf] = await Promise.all([
      decodeUrl("/assets/audio/intro.wav"),
      decodeUrl("/assets/audio/loop.wav"),
    ]);
  } catch (_) {
    // Audio is non-essential to the visual. Swallow failures (e.g. headless).
  }
}
// Kick off audio aligned to the visual clock already in progress. We compute
// the current visual t (rAF-based) and start the intro/loop with a buffer
// offset that matches, so audio joins mid-song without resetting the visuals.
// Raw WAV (uncompressed PCM) is used so there is ZERO encoder padding — Opus/
// MP3 add silent samples at stream boundaries that decodeAudioData doesn't
// always strip, which creates an audible silence-blip at each loop wrap.
async function startAudioAt(visualT) {
  if (audioStarted || !audioCtx || !introBuf || !loopBuf) return false;
  // Browser autoplay policy: resume() is rejected (or no-op) without a user
  // gesture. Don't claim the schedule slot until AFTER the resume — otherwise
  // a still-pending optimistic resume() (no gesture, will fail) blocks the
  // real user-gesture caller from scheduling, leaving audio muted.
  // Race-safety: JS is single-threaded between awaits, so the post-resume
  // {check audioStarted → set true → schedule} block runs atomically, and a
  // second concurrent caller that reaches its own post-resume check will see
  // the flag set and return without double-scheduling.
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch (_) { return false; }
  }
  if (audioCtx.state !== "running") return false;
  if (audioStarted) return false;
  audioStarted = true;

  const startAt = audioCtx.currentTime + 0.02;
  // audioT0 is the audioCtx time that corresponds to visual t=0.
  audioT0 = startAt - visualT;

  if (visualT < introBuf.duration) {
    const firstSrc = audioCtx.createBufferSource();
    firstSrc.buffer = introBuf;
    firstSrc.connect(audioGain);
    firstSrc.start(startAt, visualT);

    const loopSrc = audioCtx.createBufferSource();
    loopSrc.buffer = loopBuf;
    loopSrc.loop = true;
    // Skip the first 3 samples on each wrap so the loop boundary lands on a
    // sample where the waveform matches the file's last sample within 0.002
    // (sub-audible). The full loop still plays once on the first iteration;
    // only subsequent wraps use loopStart.
    loopSrc.loopStart = 3 / loopBuf.sampleRate;
    loopSrc.loopEnd   = loopBuf.duration;
    loopSrc.connect(audioGain);
    loopSrc.start(startAt + (introBuf.duration - visualT));
  } else {
    // Past the intro already — start the loop directly at the right phase.
    const loopOffset = (visualT - introBuf.duration) % loopBuf.duration;
    const loopSrc = audioCtx.createBufferSource();
    loopSrc.buffer = loopBuf;
    loopSrc.loop = true;
    loopSrc.loopStart = 3 / loopBuf.sampleRate;
    loopSrc.loopEnd   = loopBuf.duration;
    loopSrc.connect(audioGain);
    loopSrc.start(startAt, loopOffset);
  }
  return true;
}

let startMs = 0;
let lastBeat = -1;
let lastColor = -1;
let lastBounce = -1;
let colorIdx = 0;
let dropped = false;          // toggles true on the first tick past INTRO_END_S

function drawSilhouette(img, x, y, w, h, tilt, scaleX = 1) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  // Paper-Mario card flip: horizontal squash applied in SCREEN space (before
  // the tilt rotation) so the squash axis stays vertical regardless of the
  // bob tilt — sprite reads as a 2D card pivoting on its vertical center.
  if (scaleX !== 1) ctx.scale(scaleX, 1);
  ctx.rotate(tilt);
  // Always left-facing (no flip); PNG is natively left-facing.
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Piecewise-integrated bob phase so the up/down speed can step down at the
// drop without the dog "teleporting" mid-cycle. φ(t) = 2π · ∫₀ᵗ f(τ) dτ.
function bobPhase(t) {
  if (t <= INTRO_END_S) return 2 * Math.PI * BOB_HZ_INTRO * t;
  return 2 * Math.PI * (BOB_HZ_INTRO * INTRO_END_S + BOB_HZ_NORM * (t - INTRO_END_S));
}

// Piecewise-integrated emission count. Outside the spiraling segment the rate
// is 1/COLOR_S (8th-note); inside the segment it's 2/COLOR_S (16th-note). The
// integral gives a monotonic step counter, so crossing the boundary never
// emits twice or skips a beat.
function emitStep(t) {
  if (t <= SPIRAL_START) return Math.floor(t / COLOR_S);
  const baseSteps = SPIRAL_START / COLOR_S;
  if (t <= SPIRAL_END) {
    return Math.floor(baseSteps + (t - SPIRAL_START) * 2 / COLOR_S);
  }
  const spiralSteps = (SPIRAL_END - SPIRAL_START) * 2 / COLOR_S;
  return Math.floor(baseSteps + spiralSteps + (t - SPIRAL_END) / COLOR_S);
}

function inSpiral(t) { return t >= SPIRAL_START && t < SPIRAL_END; }

// ─── Pose schedule (hover.dog / hoverboard.dog only) ─────────────────────
// Pose 1 = arms-wide "hype" frame. Pose 0 = the cruise frame. The schedule
// flips on three boundaries: drop (intro → cruise), spiral start (cruise →
// hype), spiral end (hype → cruise). For single-pose sites the function is
// a no-op (poseCount=1 → result clamped to 0).
const FLIP_DUR     = 0.36;   // matches the slam keyframe duration
const FLIP_TIMES   = [INTRO_END_S, SPIRAL_START, SPIRAL_END];
function currentPose(t) {
  if (mascotImgs.length < 2) return 0;
  // Pose 1 during the intro hype AND during the spiral; pose 0 otherwise.
  if (t < INTRO_END_S) return 1;
  if (t >= SPIRAL_START && t < SPIRAL_END) return 1;
  return 0;
}
// Centered on each FLIP_TIME so the swap happens AT the beat boundary, with
// half the rotation playing before and half after. Returns null outside any
// flip window (live dog drawn untilted by the flip — the bob tilt still runs).
function flipProgress(t) {
  if (mascotImgs.length < 2) return null;
  for (const ft of FLIP_TIMES) {
    const s = ft - FLIP_DUR / 2, e = ft + FLIP_DUR / 2;
    if (t >= s && t < e) return (t - s) / FLIP_DUR;
  }
  return null;
}

function tick(nowMs) {
  if (startMs === 0) startMs = nowMs;
  // Once audio is running, derive t from the AudioContext clock so visuals
  // and audio can't drift across long sessions. Pre-audio (or if audio
  // failed), fall back to the rAF clock — same numbers, no jump.
  const t = (audioCtx && audioT0 !== null)
    ? audioCtx.currentTime - audioT0
    : (nowMs - startMs) / 1000;

  // Pose for the live dog this frame. Note: ripples freeze the pose they were
  // emitted with (see r.pose below), so the trail does NOT flip retroactively.
  const pose    = currentPose(t);
  const flipP   = flipProgress(t);
  // Paper-Mario flip: squash horizontally from 1 → 0 → 1 as flipP goes 0→1.
  // |cos(π·flipP)| gives that exact curve. The sprite hits scaleX=0 (edge-on,
  // invisible) at flipP=0.5, which is the same instant currentPose(t) crosses
  // its threshold — so the image swap lands inside the invisible frame.
  const flipScaleX = flipP !== null ? Math.abs(Math.cos(flipP * Math.PI)) : 1;
  const dims    = poseDims[pose];

  // bob + tilt — dog stays at center X, only oscillates vertically.
  const phase = bobPhase(t);
  const dogX  = mascot.centerX - dims.w / 2;
  const dogY  = mascot.centerY - dims.h / 2 + Math.sin(phase) * mascot.bobAmp;
  // Nose down when descending (cos > 0 → tilt < 0 ≈ CCW for a left-facing head).
  const tiltAmp = 0.30;
  const tilt    = -Math.cos(phase) * tiltAmp;

  // beat (every 0.537s) — tracked but not used directly; ripples are tied to color steps.
  const beatN = Math.floor(t / BEAT_S);
  if (beatN > lastBeat) lastBeat = beatN;

  // First frame past the drop: reveal the text overlay with a slam.
  if (!dropped && t >= INTRO_END_S) {
    dropped = true;
    overlay.classList.add("dropped");
  }

  // On each 8th-note: emit a dog-shaped ripple at the dog's current pose,
  // in the current palette color. It scales outward forever, fades, drops.
  const colorN = emitStep(t);
  if (colorN > lastColor) {
    lastColor = colorN;
    colorIdx = (colorIdx + 1) % PALETTE.length;
    // Per-ripple drift, frozen at emission — keeps the pre-drop trail moving
    // at 2× and the post-drop trail at 1× without retroactively slowing the
    // older ripples when the drop hits.
    const drift = t < INTRO_END_S ? DRIFT_INTRO : DRIFT_NORM;
    const endScale = inSpiral(t) ? SPIRAL_END_SCALE : RIPPLE_END;
    ripples.push({
      x: dogX, y: dogY, w: dims.w, h: dims.h, tilt,
      colorIdx, t0: t, drift, endScale, pose,
    });
    // Drive the silhouette-locked glow (used by domain shadow, slam keyframe).
    document.documentElement.style.setProperty("--tick-color", PALETTE[colorIdx]);
  }

  // Headline text color: locked to the beat-pulse animation's cycle start so
  // the color change lands on the same frame as the bounce. The beat-pulse
  // CSS animation begins at INTRO_END_S + 0.36s (after the slam) and runs at
  // BEAT_S, so bounce N starts at BOUNCE_OFFSET + N * BEAT_S. On each new
  // bounce, snap the text to whatever color the silhouette is showing now —
  // "in sync but at half the rate" of the 8th-note silhouette tick.
  if (t >= BOUNCE_OFFSET) {
    const bounceN = Math.floor((t - BOUNCE_OFFSET) / BEAT_S);
    if (bounceN > lastBounce) {
      lastBounce = bounceN;
      document.documentElement.style.setProperty("--text-color", PALETTE[colorIdx]);
    }
  }

  // ─── render ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#080012";
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  // Drop expired ripples first.
  for (let i = ripples.length - 1; i >= 0; i--) {
    if (t - ripples[i].t0 > RIPPLE_LIFE) ripples.splice(i, 1);
  }

  // Silhouette-shaped ripples: same dog shape, scaling outward AND drifting
  // rightward — the rightward bias sells leftward motion of the dog.
  // Oldest first (biggest, drawn underneath); newest on top (smallest).
  for (let i = 0; i < ripples.length; i++) {
    const r = ripples[i];
    const age   = t - r.t0;
    const k     = age / RIPPLE_LIFE;
    const scale = 1 + (r.endScale - 1) * Math.pow(k, 0.7);
    const alpha = Math.pow(1 - k, 1.1) * 0.9;
    const dx    = r.drift * age;
    drawRippleSilhouette(silhouettes[r.pose ?? 0][r.colorIdx], r.x + dx, r.y, r.w, r.h, r.tilt, scale, alpha);
  }
  ctx.globalAlpha = 1;

  // Foreground: full-color hei pre-blended with the current palette tint.
  // The base mascot + overlay-tint + screen-tint composite is baked at startup
  // (see bakeTintedDog) so the per-frame draw is a single rotated blit instead
  // of three drawImage calls plus two `globalCompositeOperation` mode switches
  // — eliminates the per-frame full-dog-area pixel read/write that was the
  // dominant canvas cost on slower GPUs after the drop.
  // During a pose flip the sprite squashes horizontally (Paper Mario card
  // flip); the swap lands at flipScaleX=0 so the image change is hidden in
  // the edge-on frame.
  drawSilhouette(tintedDogs[pose][colorIdx], dogX, dogY, dims.w, dims.h, tilt, flipScaleX);

  paintFavicon(t, pose, tilt);

  requestAnimationFrame(tick);
}

// Arcade attract frame: a single static blit of the mascot. No bob, no tilt,
// no flip — the dog stands still under the blinking prompt. The pose mirrors
// what currentPose(0) would pick for the live show's first frame (pose 1
// "hype" for hover.dog, pose 0 otherwise), so click-to-play has zero visual
// jump. Palette index 0 (magenta) matches colorIdx at t=0.
function drawAttractFrame() {
  if (!mascotImg) return;
  ctx.fillStyle = "#080012";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  const pose = currentPose(0);
  const dims = poseDims[pose];
  const dogX = mascot.centerX - dims.w / 2;
  const dogY = mascot.centerY - dims.h / 2;
  drawSilhouette(tintedDogs[pose][0], dogX, dogY, dims.w, dims.h, 0, 1);
}

function drawRippleSilhouette(img, x, y, w, h, tilt, scale, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(scale, scale);
  ctx.rotate(tilt);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

// Boot: arcade attract → click → play. After preload we paint ONE static
// frame and show the "ENTER 1 CLICK(S) TO PLAY" prompt. Audio decode races in
// parallel. The visual clock (startMs) and the rAF loop don't start until
// beginPlay() confirms the AudioContext actually transitioned to "running" —
// so audio and visuals start from t=0 atomically with no drift.
//
// Browser autoplay policy: AudioContext.resume() only takes effect inside a
// user gesture (or with enough Media Engagement Index on repeat visits). The
// optimistic beginPlay() below covers the MEI case (returning visitors fly
// past attract with no click); the gesture listeners cover everyone else.
(async function boot() {
  await preload();
  setupFavicon();
  drawAttractFrame();
  const audioReady = prepareAudio();

  const beginPlay = async () => {
    if (visualsStarted) return;
    await audioReady;
    if (visualsStarted) return;
    // startAudioAt returns true only when it actually scheduled the buffer
    // sources (resume() succeeded + this caller won the schedule race). If it
    // returns false, our caller wasn't the one to start audio — either the
    // browser refused (no gesture yet) OR a concurrent caller scheduled first.
    // In either case, DON'T claim the visuals slot; leave attract showing so
    // the next real gesture can drive a fresh attempt.
    const ok = await startAudioAt(0);
    if (!ok) return;
    // Re-check AFTER the await — multiple concurrent beginPlay() callers can
    // all reach this point; only one should claim the rAF kick.
    if (visualsStarted) return;
    visualsStarted = true;
    attractEl?.classList.add("hidden");
    startMs = performance.now();
    requestAnimationFrame(tick);
  };

  beginPlay();
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    addEventListener(ev, beginPlay, { passive: true })
  );
})();
