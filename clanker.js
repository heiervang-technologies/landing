// clanker.lifestyle — lofi purple-moonlit typhlosion loop.
//
// No beat clock, no particles. The video IS the vibe: a Sora-style ambient
// loop of a trainer on Typhlosion in a purple pond, moonlit temple in the
// background. Fullscreen, `object-fit: cover`, audio-gated on first click
// (browsers block autoplay-with-sound, and the loop has a lofi track).
//
// The slam headline layer (CLANKER.LIFESTYLE / domain / owner) uses the
// shared style.css `.dropped` flow — same slam-in + beat-pulse the templated
// hover.dog uses, just recolored to lilac to sit legibly over the purple
// scene. Beat cadence here is decorative; the video has no bar grid.

import { configFor } from "/sites.js";

const cfg = configFor(location.hostname);
if (cfg.title) document.title = cfg.title;

const overlay   = document.getElementById("overlay");
const headline  = document.getElementById("headline");
const domainEl  = document.getElementById("domain");
const ownerEl   = document.getElementById("owner");
const attractEl = document.getElementById("attract");
const stage     = document.getElementById("stage");

// The mascot canvas is dead weight here — drop it out of layout so the video
// can occupy the same fixed-fullscreen box without a stacking-context race.
stage.remove();

headline.textContent = cfg.headline || "CLANKER.LIFESTYLE";
headline.dataset.text = headline.textContent;
domainEl.textContent  = cfg.domain || (cfg.title ?? "clanker.lifestyle");
ownerEl.textContent   = cfg.owner  || "";

const video = document.createElement("video");
video.id = "bg-video";
video.src = "/assets/video/clanker.mp4";
video.poster = "/assets/video/clanker-poster.jpg";
video.loop = true;
video.muted = true;               // required for autoplay in modern browsers
video.autoplay = true;
video.playsInline = true;
video.preload = "auto";
video.setAttribute("aria-hidden", "true");
document.body.prepend(video);

// Recolor the shared headline palette to the moonlit lilac range so the slam
// reads over the busy purple scene without fighting the drop-shadows. Also
// pin the vignette + video layout, and dim the arcade prompt to yellow-cream
// so it stays legible on the moon-lit water without recoloring the mascot
// site's default.
const css = document.createElement("style");
css.textContent = `
  :root {
    --tick-color: #d5b4ff;
    --text-color: #eadbff;
  }
  html, body { background: #0a0518; }
  #bg-video {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    object-fit: cover;
    z-index: 0;
    pointer-events: none;
    will-change: transform;
  }
  /* Vertical vignette: dark top for the headline, dark bottom for the owner
     line. Center is left untouched so Typhlosion + trainer stay bright. */
  body::before {
    content: "";
    position: fixed; inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(10,5,24,0.72) 0%, rgba(10,5,24,0) 26%,
                              rgba(10,5,24,0) 68%, rgba(10,5,24,0.78) 100%);
  }
  #overlay {
    inset: 8vh 0 auto 0;              /* top-anchored; owner sits below headline */
    z-index: 5;
  }
  #attract {
    color: #ffd479;
    text-shadow: 0 0 14px rgba(255, 200, 120, 0.55);
    top: 74%;
  }
  /* When the audio hasn't been unlocked, hint that clicking will do so —
     otherwise the muted-loop reads as intentional and users never click. */
  body:not(.audio-on) { cursor: pointer; }
`;
document.head.appendChild(css);

// Kick the video off silently as soon as it's ready. Modern browsers allow
// muted autoplay; if the user has muted autoplay globally we fall through to
// the click gate below (which explicitly triggers play() from a gesture).
video.play().catch(() => { /* attract gate will retry after click */ });

function begin() {
  if (document.body.classList.contains("audio-on")) return;
  document.body.classList.add("audio-on");

  // Unmute + ensure play (in case autoplay was blocked entirely).
  video.muted = false;
  const p = video.play();
  if (p && p.catch) p.catch(() => {
    // Some browsers still refuse unmuted play — fall back to muted so the
    // visual keeps looping instead of freezing on the poster.
    video.muted = true;
    video.play().catch(() => {});
  });

  attractEl.classList.add("hidden");
  overlay.classList.add("dropped");
}

attractEl.addEventListener("click", begin, { once: true });
document.body.addEventListener("click", begin, { once: true });
