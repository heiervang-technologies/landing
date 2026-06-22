import { configFor } from "/sites.js";

const PALETTE = [
  "#ff006e", // hot magenta
  "#00e5ff", // cyan
  "#ffd600", // acid yellow
  "#76ff03", // lime
  "#7b2d8e", // deep violet
  "#ff1744", // red
];

const TRAIL_LEN = 7;
const REFRACTORY_MS = 160;
const BEAT_THRESHOLD = 1.45;

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const enterBtn = document.getElementById("enter");
const card = document.getElementById("card");

const cfg = configFor(location.hostname);
if (cfg.title) document.title = cfg.title;
if (cfg.blurb) {
  card.innerHTML = `<span class="host">${location.hostname}</span><span class="blurb">${cfg.blurb}</span>`;
  card.hidden = false;
}

let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
addEventListener("resize", resize);

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function bakeSilhouette(mask, color) {
  const off = document.createElement("canvas");
  off.width = mask.width;
  off.height = mask.height;
  const octx = off.getContext("2d");
  octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = color;
  octx.fillRect(0, 0, off.width, off.height);
  return off;
}

const mascot = { x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0 };
const trail = []; // {x, y, colorIdx, age}
let colorIdx = 0;
let beatPulse = 0;     // 0..1, decays per frame
let beatTintIdx = 0;

let silhouettes = [];
let mascotImg = null;

async function loadAssets() {
  mascotImg = await loadImage("/assets/hei/hei_mask_original.png");
  silhouettes = PALETTE.map((c) => bakeSilhouette(mascotImg, c));

  const targetH = Math.min(innerHeight, innerWidth) * 0.28;
  const scale = targetH / mascotImg.height;
  mascot.w = mascotImg.width * scale;
  mascot.h = mascotImg.height * scale;
  mascot.x = (innerWidth - mascot.w) / 2;
  mascot.y = (innerHeight - mascot.h) / 2;
  const speed = 0.18;
  const a = Math.random() * Math.PI * 2;
  mascot.vx = Math.cos(a) * speed * innerWidth * 0.001;
  mascot.vy = Math.sin(a) * speed * innerHeight * 0.001;
}

let audioCtx, analyser, freqData, source, gain;
let ema = 0;            // running average of low-band energy
const EMA_ALPHA = 0.04; // slow-moving baseline
let lastBeatAt = 0;

async function startAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const res = await fetch("/assets/audio/hoverboard.mp3");
  const buf = await res.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(buf);

  source = audioCtx.createBufferSource();
  source.buffer = decoded;
  source.loop = true;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.45;
  freqData = new Uint8Array(analyser.frequencyBinCount);

  gain = audioCtx.createGain();
  gain.gain.value = 0;

  source.connect(analyser);
  analyser.connect(gain);
  gain.connect(audioCtx.destination);

  source.start();
  gain.gain.linearRampToValueAtTime(0.85, audioCtx.currentTime + 0.6);
}

function sampleEnergy() {
  analyser.getByteFrequencyData(freqData);
  // Low-band: first 10 bins (~0–430 Hz at 44.1kHz, fft=1024)
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += freqData[i];
  return sum / 10;
}

function onBeat() {
  beatPulse = 1;
  beatTintIdx = (beatTintIdx + 1) % PALETTE.length;
  trail.unshift({ x: mascot.x, y: mascot.y, colorIdx, age: 0 });
  if (trail.length > TRAIL_LEN) trail.pop();
  colorIdx = (colorIdx + 1) % PALETTE.length;
  // small velocity kick
  const a = Math.random() * Math.PI * 2;
  const kick = 0.4;
  mascot.vx += Math.cos(a) * kick;
  mascot.vy += Math.sin(a) * kick;
}

function tick(now) {
  // beat detection
  if (analyser) {
    const e = sampleEnergy();
    ema = ema === 0 ? e : ema * (1 - EMA_ALPHA) + e * EMA_ALPHA;
    if (e > ema * BEAT_THRESHOLD && now - lastBeatAt > REFRACTORY_MS && e > 30) {
      lastBeatAt = now;
      onBeat();
    }
  }

  // physics
  mascot.x += mascot.vx;
  mascot.y += mascot.vy;
  // friction
  mascot.vx *= 0.985;
  mascot.vy *= 0.985;
  // floor minimum speed so it never stalls
  const minSpeed = 0.4;
  const v = Math.hypot(mascot.vx, mascot.vy);
  if (v < minSpeed) {
    const a = Math.random() * Math.PI * 2;
    mascot.vx = Math.cos(a) * minSpeed;
    mascot.vy = Math.sin(a) * minSpeed;
  }
  // bounce
  if (mascot.x < 0)                       { mascot.x = 0; mascot.vx = Math.abs(mascot.vx); }
  if (mascot.x + mascot.w > innerWidth)   { mascot.x = innerWidth - mascot.w; mascot.vx = -Math.abs(mascot.vx); }
  if (mascot.y < 0)                       { mascot.y = 0; mascot.vy = Math.abs(mascot.vy); }
  if (mascot.y + mascot.h > innerHeight)  { mascot.y = innerHeight - mascot.h; mascot.vy = -Math.abs(mascot.vy); }

  // render: hard clear to deep black
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  // background beat tint
  if (beatPulse > 0.01) {
    ctx.globalAlpha = beatPulse * 0.32;
    ctx.fillStyle = PALETTE[beatTintIdx];
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.globalAlpha = 1;
    beatPulse *= 0.85;
  }

  // trail: oldest-to-newest with fading alpha
  for (let i = trail.length - 1; i >= 0; i--) {
    const t = trail[i];
    const a = (1 - i / TRAIL_LEN) * 0.55;
    ctx.globalAlpha = a;
    ctx.drawImage(silhouettes[t.colorIdx], t.x, t.y, mascot.w, mascot.h);
  }
  ctx.globalAlpha = 1;

  // foreground mascot
  ctx.drawImage(mascotImg, mascot.x, mascot.y, mascot.w, mascot.h);

  requestAnimationFrame(tick);
}

enterBtn.addEventListener("click", async () => {
  enterBtn.hidden = true;
  await loadAssets();
  await startAudio();
  requestAnimationFrame(tick);
}, { once: true });
