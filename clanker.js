// clanker.lifestyle — lofi purple-moonlit typhlosion loop w/ synced lyrics.
//
// The video (typhlosion x purple ocean, 172.5s) is the ambient bed; the
// audio track (76 BPM, half-note lyric cadence) drives a beat-locked lyric
// overlay pinned via whisper word-onsets + aubio's beat grid.
//
// Timing is locked to `video.currentTime` — that's the audio clock too,
// since the lyric layer needs to be dead-nuts on the vocalist, not the
// visual clock. When the loop wraps, the next line resets from t=0.
//
// The site's stock overlay (headline/domain/owner from index.html) is
// removed at boot — this page is a lyric video, not a landing splash.

import { configFor } from "/sites.js";

const cfg = configFor(location.hostname);
if (cfg.title) document.title = cfg.title;

const overlay   = document.getElementById("overlay");
const attractEl = document.getElementById("attract");
const stage     = document.getElementById("stage");

// Kill the mascot canvas + stock overlay — the video + lyric layer take over.
stage.remove();
overlay.remove();

const video = document.createElement("video");
video.id = "bg-video";
video.src = "/assets/video/clanker.mp4?v=4";
video.poster = "/assets/video/clanker-poster.jpg?v=4";
video.loop = true;
video.muted = true;                // required for autoplay in modern browsers
video.autoplay = true;
video.playsInline = true;
video.preload = "auto";
video.setAttribute("aria-hidden", "true");
document.body.prepend(video);

// Lyric line element — sits over the video, snaps in on each cue.
const lyric = document.createElement("div");
lyric.id = "lyric";
document.body.appendChild(lyric);

// Persistent tag in the corner so the domain still reads at a glance.
const brand = document.createElement("div");
brand.id = "brand";
brand.textContent = cfg.title || "clanker.lifestyle";
document.body.appendChild(brand);

const css = document.createElement("style");
css.textContent = `
  html, body { background: #0a0518; }
  #bg-video {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
    transform-origin: 50% 50%;
    will-change: transform;
  }
  /* Wide vertical vignette so lyrics stay legible over the busy scene. */
  body::before {
    content: "";
    position: fixed; inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 50% 42%, rgba(10,5,24,0) 0%,
                                          rgba(10,5,24,0) 22%,
                                          rgba(10,5,24,0.55) 62%,
                                          rgba(10,5,24,0.85) 100%);
  }
  #lyric {
    position: fixed;
    left: 3vw; right: 3vw;
    top: 50%;
    transform: translate(0, -50%) scale(1);
    z-index: 4;
    pointer-events: none;
    text-align: center;
    font-family: "Press Start 2P", ui-monospace, monospace;
    font-weight: 400;
    /* JS auto-fit sets font-size on each cue; this is just the ceiling. */
    font-size: 5rem;
    line-height: 1;
    letter-spacing: 0.03em;
    white-space: nowrap;              /* auto-fit assumes single line */
    color: #f7ecff;
    opacity: 0;
    text-shadow:
      0 0 12px rgba(213, 180, 255, 0.9),
      0 0 26px rgba(180, 130, 255, 0.6),
      3px 3px 0 rgba(0, 0, 0, 0.78);
    will-change: transform, opacity;
  }
  #lyric.hit {
    animation: slam 0.42s cubic-bezier(0.16, 1.6, 0.36, 1) 1 forwards;
  }
  @keyframes slam {
    0%   { transform: translate(0, -50%) scale(1.9) rotate(-2deg); opacity: 0; }
    18%  { transform: translate(0, -50%) scale(0.96) rotate(0.6deg); opacity: 1; }
    32%  { transform: translate(0, -50%) scale(1.02); opacity: 1; }
    100% { transform: translate(0, -50%) scale(1);    opacity: 1; }
  }
  #brand {
    position: fixed;
    left: 0; right: 0; bottom: 3vh;
    z-index: 5;
    text-align: center;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-weight: 700;
    font-size: clamp(0.7rem, 1.4vw, 1rem);
    letter-spacing: 0.42em;
    text-transform: uppercase;
    color: #e6d7ff;
    opacity: 0.55;
    text-shadow: 0 0 10px rgba(180, 130, 255, 0.7);
    pointer-events: none;
  }
  #attract {
    color: #ffd479;
    text-shadow: 0 0 14px rgba(255, 200, 120, 0.55);
    top: 78%;
  }
  body:not(.audio-on) { cursor: pointer; }
`;
document.head.appendChild(css);

// Try muted autoplay eagerly so the poster doesn't sit dark before the click.
video.play().catch(() => { /* attract gate will retry after click */ });

// ─── Beat clock (drives video pulse) ──────────────────────────────────────
// 76 BPM song; aubio-derived beat grid median 0.3945s at 8th-note level →
// quarter-note beat = 0.789s, downbeat every 4 beats (bar = 3.156s). We
// pulse the video's scale on every beat (small) and every downbeat (big),
// enveloped with a fast attack and slow decay so it lands as a "kick"
// visual, not a wobble. Same shape as bomboc.js's pulseEnv.
const BEAT_S       = 0.789;
const PULSE_PEAK   = 0.055;    // +5.5% scale on off-beats
const DOWN_PEAK    = 0.14;     // +14% on every 4th beat (downbeat)
const PULSE_ATTACK = 0.04;     // s
const PULSE_DECAY  = 0.42;     // s

function pulseEnv(tSinceBeat) {
  if (tSinceBeat < 0) return 0;
  if (tSinceBeat < PULSE_ATTACK) return tSinceBeat / PULSE_ATTACK;
  const td = tSinceBeat - PULSE_ATTACK;
  if (td < PULSE_DECAY) return 1 - td / PULSE_DECAY;
  return 0;
}

function tickPulse() {
  if (video.readyState >= 2) {
    const t = video.currentTime;
    // Which beat are we in? Integer floor of t / beat interval.
    const beatIdx = Math.floor(t / BEAT_S);
    const tSinceBeat = t - beatIdx * BEAT_S;
    const isDown = beatIdx % 4 === 0;
    const peak = isDown ? DOWN_PEAK : PULSE_PEAK;
    const scale = 1 + peak * pulseEnv(tSinceBeat);
    // Scale from center; object-fit: cover keeps it filling the viewport.
    video.style.transform = `scale(${scale.toFixed(4)})`;
  }
  requestAnimationFrame(tickPulse);
}
requestAnimationFrame(tickPulse);

// ─── Lyric renderer ───────────────────────────────────────────────────────
let lines = [];
let cursor = 0;
let currentText = "";
let prevT = 0;

fetch("/assets/lyrics/clanker-lyrics.json")
  .then(r => r.json())
  .then(j => { lines = j.lines || []; })
  .catch(() => { lines = []; });

// Shrink font-size until the line fits ≤94vw on one line. Press Start 2P is
// fixed-width so we could compute this from char count, but measurement is
// cheap (one reflow per cue) and handles the letter-spacing headroom too.
// Ceiling is 11vw (fills the viewport on short lines like GOON IT); floor
// keeps long lines readable.
function fitLine(text) {
  const maxPx = window.innerWidth * 0.94;
  // Start high, ratchet down. 11vw ceiling, 3.4vw floor.
  const ceil = Math.floor(window.innerWidth * 0.11);
  const floor = Math.floor(window.innerWidth * 0.034);
  let size = ceil;
  lyric.style.fontSize = size + "px";
  // scrollWidth ignores overflow — measures the actual text extent.
  while (lyric.scrollWidth > maxPx && size > floor) {
    size = Math.max(floor, size - 2);
    lyric.style.fontSize = size + "px";
  }
}
window.addEventListener("resize", () => { if (currentText) fitLine(currentText); });

function tickLyrics() {
  if (!lines.length || video.readyState < 2) {
    requestAnimationFrame(tickLyrics);
    return;
  }
  const t = video.currentTime;
  // Video loop wrap — reset cursor when the play head jumps backwards.
  if (t < prevT - 1) cursor = 0;
  prevT = t;

  while (cursor < lines.length && t >= lines[cursor].t) {
    const line = lines[cursor].text || "";
    if (line !== currentText) {
      currentText = line;
      lyric.classList.remove("hit");
      // Force reflow so re-adding the class restarts the animation.
      void lyric.offsetWidth;
      lyric.textContent = line;
      if (line) {
        fitLine(line);
        lyric.classList.add("hit");
      } else {
        lyric.style.opacity = 0;
      }
    }
    cursor++;
  }
  requestAnimationFrame(tickLyrics);
}
requestAnimationFrame(tickLyrics);

// ─── Boot: click gate for audio ────────────────────────────────────────────
function begin() {
  if (document.body.classList.contains("audio-on")) return;
  document.body.classList.add("audio-on");
  video.muted = false;
  const p = video.play();
  if (p && p.catch) p.catch(() => {
    // Some browsers still refuse unmuted play — fall back to muted so the
    // lyric layer keeps ticking rather than freezing on the poster.
    video.muted = true;
    video.play().catch(() => {});
  });
  attractEl.classList.add("hidden");
}

attractEl.addEventListener("click", begin, { once: true });
document.body.addEventListener("click", begin, { once: true });
