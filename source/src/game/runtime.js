// Game controller ported from the original single-file build.
import {
  ROWS,
  COLS,
  makeTile,
  createGrid,
  isAdjacent,
  inBounds,
  cloneGrid,
  swapCells,
  findMatches,
  wouldMatch,
  computeSpecials,
  expandSpecials,
  specialSwapEffect,
  applyGravity,
  refill,
  hasAnyMove,
  findAnyMove,
  repositionMove,
} from "./engine";
import { GAME_ASSETS } from "./assets";
import { TILE_DEFS, SIMILARITY_GROUPS, expandPoolForHardMode } from "./data/tiles";
import { LEVELS } from "./data/levels";
import { CHARACTERS, CHARACTER_ICON_MAP } from "./data/characters";
import { REGIONS, REGION_BAR_POS, MAP_IMG, monumentImage } from "./data/regions";
import { STRINGS, translate } from "./data/strings";
import { buildLevelResult, starsForScore } from "./results";
import { SAVE_VERSION, addBoosters, migrateSave, spendBooster } from "./progress";

export function startGame() {
  "use strict";

  /* =========================================================
   2) STORAGE — window.storage -> localStorage -> memory
   ========================================================= */
  const memoryStore = {};
  async function storageGet(key) {
    try {
      if (window.storage && window.storage.get) {
        const res = await window.storage.get(key);
        return res ? res.value : null;
      }
    } catch (e) {
      /* fall through */
    }
    try {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    } catch (e) {
      /* fall through */
    }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  }
  async function storageSet(key, value) {
    try {
      if (window.storage && window.storage.set) {
        await window.storage.set(key, value);
        return;
      }
    } catch (e) {
      /* fall through */
    }
    try {
      localStorage.setItem(key, value);
      return;
    } catch (e) {
      /* fall through */
    }
    memoryStore[key] = value;
  }

  /* =========================================================
   3) SOUND — tiny WebAudio synth, no external files
   Two separate buses: sound effects and music, each with its own
   on/off switch and volume slider in the settings panel.
   ========================================================= */
  let audioCtx = null;
  let sfxBus = null;
  let musicBus = null;
  let muted = false; // sound effects off
  let musicOn = true;
  let sfxVolume = 0.7;
  let musicVolume = 0.45;
  function ensureCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        sfxBus = audioCtx.createGain();
        sfxBus.gain.value = sfxVolume;
        sfxBus.connect(audioCtx.destination);
        musicBus = audioCtx.createGain();
        musicBus.gain.value = musicOn ? musicVolume : 0;
        musicBus.connect(audioCtx.destination);
      } catch (e) {}
    }
    if (audioCtx && audioCtx.state === "suspended") {
      try {
        audioCtx.resume();
      } catch (e) {}
    }
    return audioCtx;
  }
  function applyVolumes() {
    if (!audioCtx) return;
    if (sfxBus) sfxBus.gain.value = muted ? 0 : sfxVolume;
    if (musicBus) musicBus.gain.value = musicOn ? musicVolume : 0;
  }
  // bus: "sfx" (default) or "music"
  function beep(freq, dur, type, vol, delay, bus) {
    const isMusic = bus === "music";
    if (isMusic ? !musicOn : muted) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const out = isMusic ? musicBus : sfxBus;
    if (!out) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  const sfx = {
    select: () => beep(520, 0.08, "triangle", 0.1),
    invalid: () => {
      beep(160, 0.12, "sawtooth", 0.12);
      beep(120, 0.14, "sawtooth", 0.1, 0.06);
    },
    match: (combo) => {
      const base = 440 + Math.min(combo, 6) * 60;
      beep(base, 0.16, "sine", 0.16);
      beep(base * 1.5, 0.14, "sine", 0.1, 0.04);
    },
    special: () => {
      beep(300, 0.1, "square", 0.12);
      beep(600, 0.16, "square", 0.12, 0.05);
      beep(900, 0.18, "square", 0.1, 0.1);
    },
    win: () => {
      [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.22, "triangle", 0.15, i * 0.12));
    },
    lose: () => {
      [400, 340, 280].forEach((f, i) => beep(f, 0.3, "sawtooth", 0.12, i * 0.14));
    },
  };

  /* ---------- Haptics (mobile) ----------
   Short vibration patterns that mirror the sound effects. Opt-out via the
   settings toggle; silently does nothing where the API is unavailable. */
  let hapticsOn = true;
  function vibrate(pattern) {
    if (!hapticsOn) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {
      /* unsupported */
    }
  }
  const haptic = {
    select: () => vibrate(8),
    invalid: () => vibrate([18, 40, 18]),
    match: (combo) => vibrate(Math.min(10 + (combo || 1) * 4, 34)),
    special: () => vibrate([14, 30, 26]),
    win: () => vibrate([20, 50, 20, 50, 60]),
    lose: () => vibrate([40, 60, 40]),
  };

  // Real note frequencies (Hz), equal temperament, A4=440.
  const NOTE_FREQ = {
    c4: 261.63,
    "c#4": 277.18,
    d4: 293.66,
    "d#4": 311.13,
    e4: 329.63,
    f4: 349.23,
    "f#4": 369.99,
    g4: 392.0,
    "g#4": 415.3,
    a4: 440.0,
    "a#4": 466.16,
    b4: 493.88,
    c5: 523.25,
    "c#5": 554.37,
    d5: 587.33,
    "d#5": 622.25,
    e5: 659.25,
    f5: 698.46,
    "f#5": 739.99,
    g5: 783.99,
    a5: 880.0,
    b5: 987.77,
  };

  // La Marseillaise — opening phrase ("Allons enfants de la Patrie, le jour de
  // gloire est arrivé, contre nous de la tyrannie..."), transcribed from an
  // actual letter-note reference rather than recalled from memory, after an
  // earlier attempt in this project got the tune wrong. Octave placement is a
  // reasonable reconstruction (the source's octave markers didn't survive
  // extraction cleanly), but the note-to-note melodic shape follows the source.
  const MARSEILLAISE_NOTES = [
    "d4",
    "d4",
    "d4",
    "g4",
    "g4",
    "a4",
    "a4",
    "d5",
    "b4",
    "g4",
    "g4",
    "b4",
    "g4",
    "c5",
    "a4",
    "f#4",
    "g4",
    "g4",
    "a4",
    "b4",
    "b4",
    "b4",
    "c5",
    "b4",
    "b4",
    "a4",
    "a4",
    "b4",
    "c5",
    "c5",
    "c5",
    "d5",
  ];
  function playMarseillaise(onDone) {
    if (!musicOn) {
      if (onDone) setTimeout(onDone, 50);
      return;
    }
    duckMusic(MARSEILLAISE_NOTES.length * 0.24 + 0.6);
    const noteDur = 0.24;
    MARSEILLAISE_NOTES.forEach((n, i) => {
      const isPhraseEnd = (i + 1) % 8 === 0;
      beep(
        NOTE_FREQ[n],
        isPhraseEnd ? noteDur * 1.8 : noteDur,
        "triangle",
        0.2,
        i * noteDur,
        "music",
      );
    });
    if (onDone) setTimeout(onDone, MARSEILLAISE_NOTES.length * noteDur * 1000 + 500);
  }

  /* ---------- Background music ----------
   A gentle accordion-flavoured café waltz, built from the same little synth so
   nothing has to be downloaded. It loops bar by bar, is scheduled slightly
   ahead of time, pauses when the tab is hidden and steps aside (duckMusic)
   while the fanfare or La Marseillaise plays. */
  const WALTZ_BARS = [
    { bass: "g4", chord: ["b4", "d5"], melody: ["d5", "b4", "g4"] },
    { bass: "c4", chord: ["e4", "g4"], melody: ["e5", "c5", "g4"] },
    { bass: "a4", chord: ["c5", "e5"], melody: ["c5", "a4", "e5"] },
    { bass: "d4", chord: ["f#4", "a4"], melody: ["d5", "a4", "f#4"] },
    { bass: "g4", chord: ["b4", "d5"], melody: ["b4", "d5", "g4"] },
    { bass: "e4", chord: ["g4", "b4"], melody: ["g4", "b4", "e5"] },
    { bass: "a4", chord: ["c5", "e5"], melody: ["a4", "e5", "c5"] },
    { bass: "d4", chord: ["f#4", "a4"], melody: ["a4", "f#4", "d5"] },
  ];
  const BEAT = 0.42; // one waltz beat, three per bar
  let musicBarIndex = 0;
  let musicTimer = null;
  let musicDuckedUntil = 0;

  function scheduleWaltzBar(bar, at) {
    beep(NOTE_FREQ[bar.bass] / 2, BEAT * 0.9, "sine", 0.12, at, "music");
    bar.chord.forEach((n) => {
      beep(NOTE_FREQ[n], BEAT * 0.55, "triangle", 0.05, at + BEAT, "music");
      beep(NOTE_FREQ[n], BEAT * 0.55, "triangle", 0.045, at + BEAT * 2, "music");
    });
    bar.melody.forEach((n, i) => {
      beep(NOTE_FREQ[n], BEAT * 0.7, "sine", 0.07, at + i * BEAT, "music");
    });
  }

  function musicTick() {
    if (!musicOn) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.currentTime >= musicDuckedUntil) {
      scheduleWaltzBar(WALTZ_BARS[musicBarIndex % WALTZ_BARS.length], 0.05);
      musicBarIndex++;
    }
  }

  function startMusic() {
    if (musicTimer || !musicOn) return;
    ensureCtx();
    musicTick();
    musicTimer = setInterval(musicTick, BEAT * 3 * 1000);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }

  // Keeps the loop quiet for a moment so a fanfare can be heard on its own.
  function duckMusic(seconds) {
    const ctx = ensureCtx();
    if (!ctx) return;
    musicDuckedUntil = ctx.currentTime + seconds;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMusic();
    else if (musicOn) startMusic();
  });

  /* =========================================================
   4) GAME CONFIG
   ========================================================= */
  // Tiles, levels, characters, regions and text all come from ./data/* — adding
  // content means editing those files, never this one.

  // ---------- i18n ----------
  // All UI text lives in data/strings.js. Level titles, character names,
  // hommage texts and the character-found phrases stay French on purpose.

  let currentLang = "sv";

  function t(key, vars) {
    return translate(currentLang, key, vars);
  }

  function applyStaticI18n() {
    document.documentElement.lang = currentLang === "tlh" ? "en" : currentLang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    updateHud();
    if (typeof updateLevelLabel === "function") updateLevelLabel();
    if (typeof renderCharThumb === "function") renderCharThumb();
  }

  function setLanguage(lang) {
    currentLang = lang;
    storageSet("cps_lang", lang);
    applyStaticI18n();
  }

  // Characters and the tile each one hides behind live in data/characters.js.

  // Regions, monuments, the illustrated map and the measured bar positions all
  // live in data/regions.js now.

  const boardEl = document.getElementById("board");
  const goalsRowEl = document.getElementById("goalsRow");
  const scoreValEl = document.getElementById("scoreVal");
  const bestValEl = document.getElementById("bestVal");
  const movesValEl = document.getElementById("movesVal");
  const soundToggle = document.getElementById("soundToggle");
  const modalOverlay = document.getElementById("modalOverlay");
  const modalEmoji = document.getElementById("modalEmoji");
  const modalTitle = document.getElementById("modalTitle");
  const modalText = document.getElementById("modalText");
  const modalBtn = document.getElementById("modalBtn");
  const modalNextBtn = document.getElementById("modalNextBtn");
  const modalMapBtn = document.getElementById("modalMapBtn");
  const mapOverlay = document.getElementById("mapOverlay");
  const levelGrid = document.getElementById("levelGrid");
  const mapBtn = document.getElementById("mapBtn");
  const hintBtn = document.getElementById("hintBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const repositionBtn = document.getElementById("repositionBtn");
  const repoCostBadge = document.getElementById("repoCostBadge");
  const levelLabelEl = document.getElementById("levelLabel");
  const openCharSelectBtn = document.getElementById("openCharSelectBtn");
  const closeCharSelectBtn = document.getElementById("closeCharSelectBtn");
  const charSelectOverlay = document.getElementById("charSelectOverlay");
  const charGrid = document.getElementById("charGrid");
  const charSelectThumb = document.getElementById("charSelectThumb");
  const openRegionMapBtn = document.getElementById("regionMapTopBtn");
  const closeRegionMapBtn = document.getElementById("closeRegionMapBtn");
  const noRegionBtn = document.getElementById("noRegionBtn");
  const regionMapOverlay = document.getElementById("regionMapOverlay");
  const regionGrid = document.getElementById("regionGrid");
  const regionProgressBadge = document.getElementById("regionProgressBadge");
  const levelSetupOverlay = document.getElementById("levelSetupOverlay");
  const setupLevelTitle = document.getElementById("setupLevelTitle");
  const setupGoalPicker = document.getElementById("setupGoalPicker");
  const setupResetBtn = document.getElementById("setupResetBtn");
  const setupStartBtn = document.getElementById("setupStartBtn");
  const setupCancelBtn = document.getElementById("setupCancelBtn");
  const hardModeCheck = document.getElementById("hardModeCheck");
  const lockedObstacleCheck = document.getElementById("lockedObstacleCheck");
  const twoHitObstacleCheck = document.getElementById("twoHitObstacleCheck");
  const spreaderObstacleCheck = document.getElementById("spreaderObstacleCheck");
  let setupTargetLevel = null;
  const boardShell = document.querySelector(".board-shell");

  let CELL = 56,
    GAP = 5;
  function computeCellSize() {
    const vw = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const maxW = Math.min(560, vw - 48);
    const byWidth = Math.floor((maxW - GAP * (COLS + 1)) / COLS);
    // Keep the whole board visible on small phones: subtract the chrome above
    // and below the board instead of letting the board push it off-screen.
    let chrome = 0;
    document.querySelectorAll(".app > *").forEach((el) => {
      if (el.classList.contains("board-shell")) return;
      chrome += el.getBoundingClientRect().height + 10;
    });
    const availH = vh - chrome - 70; // board-shell padding + app padding
    const byHeight = Math.floor((availH - GAP * (ROWS + 1)) / ROWS);
    const size = Math.min(byWidth, byHeight > 0 ? byHeight : byWidth);
    CELL = Math.max(30, Math.min(58, size));
    boardEl.style.width = CELL * COLS + GAP * (COLS + 1) + "px";
    boardEl.style.height = CELL * ROWS + GAP * (ROWS + 1) + "px";
  }

  let grid = [];
  let view = []; // view[r][c] = DOM element
  let score = 0,
    best = 0,
    movesLeft = 0;
  let currentLevel = null; // the active LEVELS entry
  let highestUnlocked = 1; // persisted progress
  let goals = [];
  let selected = null;
  let locked = false;
  let repositionMode = false;
  let repositionSource = null;
  let repositionsLeft = 3;
  let activeGoalDefs = null;
  const REPOSITIONS_PER_LEVEL = 3;
  let levelStars = {}; // { levelId: 1..3 }
  let boosters = { extraMoves: 0, shuffle: 0, remove: 0 };
  let removeBoosterMode = false;

  // Star thresholds scale with how much the level asks of you, so they mean the
  function starRow(n) {
    return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
  }
  let pendingCarryOver = false;
  let chosenCharacter = CHARACTERS[0].key;
  let activeRegionKey = null; // which region is currently earning points
  let regionOptOut = false;
  let regionProgress = {}; // { regionKey: pointsEarnedSoFar } — persists even when not active
  let regionWon = {}; // { regionKey: true } — conquered regions keep their favour permanently
  let activePool = [];
  let hasStartedAnyGame = false;
  let hardModeActive = false;
  let hiddenCharacterResolve = null; // resolves when the "found character" modal is closed

  function cellLeft(c) {
    return GAP + c * (CELL + GAP);
  }
  function cellTop(r) {
    return GAP + r * (CELL + GAP);
  }

  function renderGoals() {
    goalsRowEl.innerHTML = "";
    goals.forEach((g) => {
      const def = TILE_DEFS[g.typeIdx];
      const chip = document.createElement("div");
      chip.className = "goal-chip" + (g.remaining <= 0 ? " done" : "");
      chip.id = "goal-" + g.typeIdx;
      const iconHtml = def.img
        ? '<img class="goal-icon" src="' + def.img + '" alt="' + def.name + '" draggable="false">'
        : '<div class="emoji">' + def.emoji + "</div>";
      chip.innerHTML = iconHtml + '<div class="num">' + Math.max(g.remaining, 0) + "</div>";
      goalsRowEl.appendChild(chip);
    });
  }

  function pulseGoal(typeIdx) {
    const chip = document.getElementById("goal-" + typeIdx);
    if (!chip) return;
    chip.classList.remove("pulse");
    void chip.offsetWidth;
    chip.classList.add("pulse");
  }

  function updateHud() {
    scoreValEl.textContent = score;
    bestValEl.textContent = best;
    movesValEl.textContent = Math.max(movesLeft, 0);
    hintBtn.disabled = locked || movesLeft <= 0;
    shuffleBtn.disabled = locked || movesLeft <= 0;
    repositionBtn.disabled = locked || movesLeft < 2 || repositionsLeft <= 0;
    repoCostBadge.textContent = repositionsLeft + " " + t("reposLeftSuffix");
    document.getElementById("extraMovesBoosterCount").textContent = boosters.extraMoves;
    document.getElementById("shuffleBoosterCount").textContent = boosters.shuffle;
    document.getElementById("removeBoosterCount").textContent = boosters.remove;
    document.getElementById("extraMovesBoosterBtn").disabled = locked || boosters.extraMoves <= 0;
    document.getElementById("shuffleBoosterBtn").disabled = locked || boosters.shuffle <= 0;
    document.getElementById("removeBoosterBtn").disabled = locked || boosters.remove <= 0;
  }

  function makeTileEl(r, c, tile) {
    const el = document.createElement("div");
    el.className = "tile";
    el.style.width = CELL + "px";
    el.style.height = CELL + "px";
    el.style.fontSize = Math.floor(CELL * 0.55) + "px";
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    paintTile(el, tile);
    el.addEventListener("pointerdown", (e) => onTilePointerDown(e, el));
    el.addEventListener("pointermove", onTilePointerMove);
    el.addEventListener("pointerup", onTilePointerUp);
    el.addEventListener("pointercancel", onTilePointerCancel);
    el.addEventListener("keydown", (event) => onTileKeyDown(event, el));
    boardEl.appendChild(el);
    positionEl(el, r, c);
    return el;
  }

  function paintTile(el, tile) {
    el.dataset.tileId = tile.id;

    const def = TILE_DEFS[tile.type];
    el.setAttribute("aria-label", def.name + (tile.special ? ", " + t("specialTileLabel") : ""));
    if (def.img) {
      el.textContent = "";
      let img = el.querySelector("img.tile-img");
      if (!img) {
        img = document.createElement("img");
        img.className = "tile-img";
        img.alt = def.name;
        img.draggable = false;
        el.appendChild(img);
      }
      img.src = def.img;
    } else {
      el.textContent = def.emoji;
    }
    el.classList.toggle("special-row", tile.special === "row");
    el.classList.toggle("special-col", tile.special === "col");
    el.classList.toggle("special-bomb", tile.special === "bomb");
    el.classList.toggle("special-area", tile.special === "area");

    let badge = el.querySelector(".debug-id");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "debug-id";
      el.appendChild(badge);
    }
    badge.textContent = "#" + tile.id;

    paintObstacleOverlay(el, tile);
  }

  function paintObstacleOverlay(el, tile) {
    el.classList.toggle("obstacle-locked", !!tile.locked);
    el.classList.toggle("obstacle-spreader", !!tile.spreader);
    el.classList.toggle("obstacle-twohit", !!tile.twoHitRemaining);

    let lockMark = el.querySelector(".obstacle-lock-mark");
    if (tile.locked) {
      if (!lockMark) {
        lockMark = document.createElement("div");
        lockMark.className = "obstacle-lock-mark";
        lockMark.textContent = "🔒";
        el.appendChild(lockMark);
      }
    } else if (lockMark) {
      lockMark.remove();
    }

    let hitBadge = el.querySelector(".obstacle-hit-badge");
    if (tile.twoHitRemaining) {
      if (!hitBadge) {
        hitBadge = document.createElement("div");
        hitBadge.className = "obstacle-hit-badge";
        el.appendChild(hitBadge);
      }
      hitBadge.textContent = tile.twoHitRemaining;
    } else if (hitBadge) {
      hitBadge.remove();
    }
  }

  function positionEl(el, r, c) {
    el.dataset.r = r;
    el.dataset.c = c;
    el.style.left = cellLeft(c) + "px";
    el.style.top = cellTop(r) + "px";
  }

  function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  /* ---------- particles / juice ---------- */
  function burstParticles(r, c, colorEmoji) {
    const cx = cellLeft(c) + CELL / 2,
      cy = cellTop(r) + CELL / 2;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 26 + Math.random() * 18;
      const dx = Math.cos(angle) * dist,
        dy = Math.sin(angle) * dist;
      p.style.setProperty("--pend", "translate(" + dx + "px," + dy + "px)");
      p.style.left = cx - 3 + "px";
      p.style.top = cy - 3 + "px";
      p.style.width = p.style.height = 4 + Math.random() * 4 + "px";
      p.style.background = i % 2 ? "var(--butter)" : "var(--burgundy)";
      boardEl.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  }

  function screenShake() {
    boardShell.classList.remove("shake");
    void boardShell.offsetWidth;
    boardShell.classList.add("shake");
  }

  function comboToast(text, info) {
    const t = document.createElement("div");
    t.className = "combo-toast" + (info ? " info-toast" : "");
    t.textContent = text;
    boardEl.appendChild(t);
    setTimeout(() => t.remove(), info ? 1550 : 750);
  }

  function sweepLine(special, r, c) {
    if (special === "bomb") {
      const flash = document.createElement("div");
      flash.className = "sweep bomb-flash";
      flash.textContent = "💥";
      flash.style.left = cellLeft(c) + "px";
      flash.style.top = cellTop(r) + "px";
      boardEl.appendChild(flash);
      setTimeout(() => flash.remove(), 520);
      return;
    }
    const emoji = special === "row" ? "🥖" : "🍷";
    const el = document.createElement("div");
    el.className = "sweep";
    el.textContent = emoji;
    if (special === "row") {
      el.style.top = cellTop(r) + "px";
      el.style.left = "0px";
      el.style.transition = "transform .45s linear";
      boardEl.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = "translateX(" + boardEl.clientWidth + "px)";
      });
    } else {
      el.style.left = cellLeft(c) + "px";
      el.style.top = "0px";
      el.style.transition = "transform .45s linear";
      boardEl.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = "translateY(" + boardEl.clientHeight + "px)";
      });
    }
    setTimeout(() => el.remove(), 480);
  }

  function confettiBurst() {
    const colors = ["#e8a33d", "#7c2338", "#6f9270", "#f4cf7a"];
    for (let i = 0; i < 40; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 1.4 + Math.random() * 1.2 + "s";
      c.style.opacity = 0.9;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3000);
    }
  }

  /* ---------- init / reset ---------- */
  function reconcilePoolForHiddenIcon(pool, iconType, hardMode, protectedTypes) {
    if (pool.includes(iconType)) return pool;
    if (!hardMode) {
      const group = SIMILARITY_GROUPS.find((g) => g.includes(iconType));
      if (group) {
        const other = group.find((t) => t !== iconType && pool.includes(t));
        if (other !== undefined && !(protectedTypes && protectedTypes.includes(other))) {
          return pool.filter((t) => t !== other).concat([iconType]);
        }
      }
    }
    return pool.concat([iconType]);
  }

  function placeObstacles(obstacleFlags) {
    if (!obstacleFlags) return;
    const OBSTACLE_COUNT = 3;
    const usedCells = new Set();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c].hiddenCharacter) usedCells.add(r + "," + c);
      }

    function placeType(flag, apply) {
      if (!flag) return;
      let placed = 0,
        guard = 0;
      while (placed < OBSTACLE_COUNT && guard < 200) {
        guard++;
        const r = Math.floor(Math.random() * ROWS),
          c = Math.floor(Math.random() * COLS);
        const key = r + "," + c;
        if (usedCells.has(key)) continue;
        apply(grid[r][c]);
        usedCells.add(key);
        placed++;
      }
    }

    placeType(obstacleFlags.locked, (tile) => {
      tile.locked = true;
    });
    placeType(obstacleFlags.twoHit, (tile) => {
      tile.twoHitRemaining = 2;
    });
    placeType(obstacleFlags.spreader, (tile) => {
      tile.spreader = true;
    });
  }

  function newGame(levelId, customGoals, hardMode, obstacleFlags) {
    hasStartedAnyGame = true;
    currentLevel = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    hardModeActive = !!hardMode;
    activePool = hardModeActive ? expandPoolForHardMode(currentLevel.pool) : currentLevel.pool;

    // Goals must always be achievable — guarantee every goal icon is on the
    // board regardless of the level's default pool or any custom selection.
    const goalDefs = customGoals && customGoals.length ? customGoals : currentLevel.goals;
    const goalTypeIdxs = goalDefs.map((g) => g.typeIdx);
    goalTypeIdxs.forEach((t) => {
      if (!activePool.includes(t)) activePool = activePool.concat([t]);
    });

    const hiddenChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    const hiddenIconType = CHARACTER_ICON_MAP[hiddenChar.key];
    activePool = reconcilePoolForHiddenIcon(
      activePool,
      hiddenIconType,
      hardModeActive,
      goalTypeIdxs,
    );

    grid = createGrid(activePool);
    let guard = 0;
    while (!hasAnyMove(grid) && guard < 50) {
      grid = createGrid(activePool);
      guard++;
    }

    // Secretly tag one ordinary tile of the character's icon type — it looks
    // completely normal until the player happens to clear it.
    const candidates = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c].type === hiddenIconType) candidates.push(grid[r][c]);
      }
    if (candidates.length) {
      candidates[Math.floor(Math.random() * candidates.length)].hiddenCharacter = hiddenChar.key;
    }

    placeObstacles(obstacleFlags);

    goals = goalDefs.map((g) => ({ typeIdx: g.typeIdx, need: g.need, remaining: g.need }));
    activeGoalDefs = goalDefs;
    score = 0;
    movesLeft = currentLevel.moves;
    selected = null;
    locked = false;
    if (pendingCarryOver) {
      pendingCarryOver = false; /* keep repositionsLeft as it was */
    } else {
      repositionsLeft = REPOSITIONS_PER_LEVEL;
    }
    repositionMode = false;
    repositionSource = null;
    boardEl.innerHTML = "";
    computeCellSize();
    view = [];
    for (let r = 0; r < ROWS; r++) {
      view.push([]);
      for (let c = 0; c < COLS; c++) {
        view[r].push(makeTileEl(r, c, grid[r][c]));
      }
    }
    renderGoals();
    updateHud();
    boardEl.classList.remove("locked");
    boardEl.classList.remove("reposition-mode");
    repositionBtn.classList.remove("mode-active");
    hideModal();
    updateLevelLabel();
  }

  function updateLevelLabel() {
    if (!currentLevel) return;
    levelLabelEl.textContent =
      (currentLevel.bonus
        ? t("levelLabelBonus", { target: currentLevel.scoreTarget })
        : t("levelLabelNormal", { id: currentLevel.id, title: currentLevel.title })) +
      (hardModeActive ? " ☠️" : "");
  }

  /* ---------- interaction ---------- */
  let pointerDrag = {
    active: false,
    el: null,
    startR: 0,
    startC: 0,
    startX: 0,
    startY: 0,
    moved: false,
    dir: null,
    pointerId: null,
  };
  const DRAG_MAX_OFFSET_FRAC = 0.42; // how far the tile visually follows the pointer, as a fraction of cell size

  function dragThreshold() {
    return Math.max(16, CELL * 0.25);
  }

  function onTilePointerDown(e, el) {
    if (locked || movesLeft <= 0) return;
    const r = parseInt(el.dataset.r, 10),
      c = parseInt(el.dataset.c, 10);
    pointerDrag = {
      active: true,
      el,
      startR: r,
      startC: c,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      dir: null,
      pointerId: e.pointerId,
    };
    el.classList.add("dragging");
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {
      /* not all environments support this */
    }
  }

  function onTilePointerMove(e) {
    if (!pointerDrag.active || e.pointerId !== pointerDrag.pointerId) return;
    const dx = e.clientX - pointerDrag.startX,
      dy = e.clientY - pointerDrag.startY;
    const dist = Math.hypot(dx, dy);
    const maxOffset = CELL * DRAG_MAX_OFFSET_FRAC;
    const clampedX = Math.max(-maxOffset, Math.min(maxOffset, dx));
    const clampedY = Math.max(-maxOffset, Math.min(maxOffset, dy));
    pointerDrag.el.style.transform = "translate(" + clampedX + "px," + clampedY + "px)";

    if (!pointerDrag.moved && dist > dragThreshold()) {
      pointerDrag.moved = true;
      pointerDrag.dir =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      highlightDragTarget();
    }
  }

  function dragTargetPos() {
    let { startR: r, startC: c, dir } = pointerDrag;
    if (dir === "right") c++;
    else if (dir === "left") c--;
    else if (dir === "down") r++;
    else if (dir === "up") r--;
    return { r, c };
  }

  function highlightDragTarget() {
    clearDragTargetHighlight();
    const { r, c } = dragTargetPos();
    if (inBounds(r, c) && view[r][c]) view[r][c].classList.add("drag-target");
  }
  function clearDragTargetHighlight() {
    const el = boardEl.querySelector(".tile.drag-target");
    if (el) el.classList.remove("drag-target");
  }

  function endDragVisual() {
    pointerDrag.el.classList.remove("dragging");
    pointerDrag.el.style.transform = "";
    clearDragTargetHighlight();
  }

  function onTilePointerUp(e) {
    if (!pointerDrag.active || e.pointerId !== pointerDrag.pointerId) return;
    const { startR, startC, moved, el } = pointerDrag;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    pointerDrag.active = false;

    if (moved) {
      const target = dragTargetPos();
      endDragVisual();
      if (inBounds(target.r, target.c)) handleDragSwap(startR, startC, target.r, target.c);
    } else {
      endDragVisual();
      onTileTap(startR, startC);
    }
  }

  function onTilePointerCancel(e) {
    if (!pointerDrag.active || e.pointerId !== pointerDrag.pointerId) return;
    pointerDrag.active = false;
    endDragVisual();
  }

  function handleDragSwap(r1, c1, r2, c2) {
    if (locked || movesLeft <= 0) return;
    // Reposition mode targets any cell on the same row/col, not just a neighbour
    // — a drag gesture doesn't map cleanly onto that, so let taps handle it there.
    if (repositionMode) return;
    if ((grid[r1][c1] && grid[r1][c1].locked) || (grid[r2][c2] && grid[r2][c2].locked)) {
      comboToast(t("lockedTileMsg"), true);
      return;
    }
    if (selected) {
      view[selected.r][selected.c].classList.remove("selected");
      selected = null;
    }
    attemptSwap({ r: r1, c: c1 }, { r: r2, c: c2 });
  }

  function onTileTap(r, c) {
    if (locked || movesLeft <= 0) return;
    const pos = { r, c };

    if (removeBoosterMode) {
      void removeTileWithBooster(pos);
      return;
    }

    if (grid[r][c] && grid[r][c].locked) {
      comboToast(t("lockedTileMsg"), true);
      return;
    }

    if (repositionMode) {
      onRepositionTileClick(pos);
      return;
    }

    if (!selected) {
      selected = pos;
      view[r][c].classList.add("selected");
      sfx.select();
      haptic.select();
      return;
    }
    if (selected.r === r && selected.c === c) {
      view[r][c].classList.remove("selected");
      selected = null;
      return;
    }
    if (!isAdjacent(selected, pos)) {
      view[selected.r][selected.c].classList.remove("selected");
      selected = pos;
      view[r][c].classList.add("selected");
      sfx.select();
      haptic.select();
      return;
    }
    const a = selected,
      b = pos;
    view[a.r][a.c].classList.remove("selected");
    selected = null;
    attemptSwap(a, b);
  }

  function onTileKeyDown(event, el) {
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTileTap(r, c);
      return;
    }
    const next = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
    }[event.key];
    if (next && inBounds(next[0], next[1])) {
      event.preventDefault();
      view[next[0]][next[1]]?.focus();
    }
  }

  async function removeTileWithBooster(pos) {
    const spent = spendBooster(boosters, "remove");
    if (!spent || locked || !grid[pos.r][pos.c]) return;
    boosters = spent;
    removeBoosterMode = false;
    document.getElementById("removeBoosterBtn").classList.remove("mode-active");
    locked = true;
    const tile = grid[pos.r][pos.c];
    burstParticles(pos.r, pos.c, TILE_DEFS[tile.type].emoji);
    view[pos.r][pos.c].classList.add("clearing");
    grid[pos.r][pos.c] = null;
    await sleep(240);
    view[pos.r][pos.c].remove();
    view[pos.r][pos.c] = null;
    const drops = applyGravity(grid);
    drops.forEach((move) => {
      const moving = view[move.from.r][move.from.c];
      view[move.to.r][move.to.c] = moving;
      view[move.from.r][move.from.c] = null;
      if (moving) positionEl(moving, move.to.r, move.to.c);
    });
    refill(grid, activePool).forEach((spawn) => {
      view[spawn.r][spawn.c] = makeTileEl(spawn.r, spawn.c, grid[spawn.r][spawn.c]);
    });
    persistSave();
    locked = false;
    updateHud();
    await resolveCascade(pos);
  }

  function clearRepositionHighlights() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (view[r][c]) {
          view[r][c].classList.remove("reposition-source", "reposition-target");
        }
      }
  }

  function highlightRepositionTargets(source) {
    for (let c = 0; c < COLS; c++) {
      if (c !== source.c) view[source.r][c].classList.add("reposition-target");
    }
    for (let r = 0; r < ROWS; r++) {
      if (r !== source.r) view[r][source.c].classList.add("reposition-target");
    }
  }

  function setRepositionMode(on) {
    repositionMode = on;
    repositionSource = null;
    clearRepositionHighlights();
    boardEl.classList.toggle("reposition-mode", on);
    repositionBtn.classList.toggle("mode-active", on);
  }

  function onRepositionTileClick(pos) {
    if (!repositionSource) {
      repositionSource = pos;
      view[pos.r][pos.c].classList.add("reposition-source");
      highlightRepositionTargets(pos);
      sfx.select();
      haptic.select();
      return;
    }
    if (repositionSource.r === pos.r && repositionSource.c === pos.c) {
      // clicked the source again — cancel just this selection, stay in mode
      clearRepositionHighlights();
      repositionSource = null;
      return;
    }
    if (repositionSource.r !== pos.r && repositionSource.c !== pos.c) {
      comboToast(t("mustSameRowCol"), true);
      clearRepositionHighlights();
      repositionSource = null;
      return;
    }
    const from = repositionSource,
      to = pos;
    clearRepositionHighlights();
    setRepositionMode(false);
    performReposition(from, to);
  }

  async function performReposition(from, to) {
    locked = true;
    boardEl.classList.add("locked");
    updateHud();
    try {
      const moves = repositionMove(grid, from, to);
      if (!moves) {
        return;
      }

      const snapshot = {};
      moves.forEach((m) => {
        const key = m.from.r + "," + m.from.c;
        if (!(key in snapshot)) snapshot[key] = view[m.from.r][m.from.c];
      });
      moves.forEach((m) => {
        const el = snapshot[m.from.r + "," + m.from.c];
        view[m.to.r][m.to.c] = el;
        positionEl(el, m.to.r, m.to.c);
      });

      sfx.select();
      haptic.select();
      await sleep(260);

      repositionsLeft--;
      movesLeft -= 2;
      updateHud();

      await resolveCascade(to);
      await spreadThreats();

      if (movesLeft <= 0 && !levelWon()) {
        endGame(false);
        return;
      }
      if (levelWon()) {
        endGame(true);
        return;
      }
      if (!hasAnyMove(grid)) {
        reshuffle();
      }
    } catch (err) {
      console.error("Croissant Plouf Saga: fel under förflyttningsdrag, återställer brädet.", err);
      resyncBoardFromModel();
    } finally {
      locked = false;
      boardEl.classList.remove("locked");
      updateHud();
    }
  }

  async function spreadThreats() {
    const spreaderCells = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && grid[r][c].spreader) spreaderCells.push({ r, c });
      }
    if (spreaderCells.length === 0) return;

    let spreadHappened = false;
    spreaderCells.forEach(({ r, c }) => {
      if (Math.random() > 0.5) return; // gives the player a fighting chance
      const candidates = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].filter(
        ([nr, nc]) =>
          nr >= 0 &&
          nr < ROWS &&
          nc >= 0 &&
          nc < COLS &&
          grid[nr][nc] &&
          !grid[nr][nc].spreader &&
          !grid[nr][nc].locked &&
          !grid[nr][nc].twoHitRemaining,
      );
      if (candidates.length === 0) return;
      const [nr, nc] = candidates[Math.floor(Math.random() * candidates.length)];
      grid[nr][nc].spreader = true;
      paintObstacleOverlay(view[nr][nc], grid[nr][nc]);
      spreadHappened = true;
    });
    if (spreadHappened) {
      comboToast(t("spreaderGrowMsg"), true);
      await sleep(200);
    }
  }

  async function attemptSwap(a, b) {
    locked = true;
    boardEl.classList.add("locked");
    updateHud();
    try {
      // Capture the actual element references ONCE, up front. Re-reading
      // view[a.r][a.c] / view[b.r][b.c] later (for a "revert") would return the
      // same objects but by then their dataset/visual position has already moved
      // — re-running the same forward transformation is a no-op, not an undo.
      const elA = view[a.r][a.c],
        elB = view[b.r][b.c];
      positionEl(elA, b.r, b.c);
      positionEl(elB, a.r, a.c);
      await sleep(220);

      const specialEffect = specialSwapEffect(grid, a, b);
      if (!specialEffect && !wouldMatch(grid, a, b)) {
        if (grid[a.r][a.c].type === grid[b.r][b.c].type) {
          // Swapping two identical tiles is always a no-op — explain why instead
          // of giving the same "wrong move" feedback as a genuinely bad swap.
          sfx.select();
          haptic.select();
          comboToast(t("sameTypeNoOp"), true);
        } else {
          sfx.invalid();
          haptic.invalid();
          screenShakeSmall();
        }
        // True revert: move the SAME two elements back to their original spots.
        positionEl(elA, a.r, a.c);
        positionEl(elB, b.r, b.c);
        await sleep(220);
        locked = false;
        boardEl.classList.remove("locked");
        updateHud();
        return;
      }

      swapCells(grid, a, b);
      // The visual swap above already moved elA->b and elB->a, so commit the
      // array to match exactly that (not a generic re-swap of whatever the
      // array currently holds).
      view[a.r][a.c] = elB;
      view[b.r][b.c] = elA;

      movesLeft--;
      updateHud();

      if (specialEffect) {
        sfx.special();
        haptic.special();
        comboToast(t("specialComboLabel"), true);
      }
      await resolveCascade(b, specialEffect);
      await spreadThreats();

      if (movesLeft <= 0 && !levelWon()) {
        endGame(false);
        return;
      }
      if (levelWon()) {
        endGame(true);
        return;
      }
      if (!hasAnyMove(grid)) {
        reshuffle();
      }
    } catch (err) {
      // Never let the board get stuck out of sync — log it and self-heal.
      console.error("Croissant Plouf Saga: fel under drag, återställer brädet.", err);
      resyncBoardFromModel();
    } finally {
      locked = false;
      boardEl.classList.remove("locked");
      updateHud();
    }
  }

  function screenShakeSmall() {
    boardShell.classList.remove("shake-invalid");
    void boardShell.offsetWidth;
    boardShell.classList.add("shake-invalid");
  }

  function goalsComplete() {
    return goals.every((g) => g.remaining <= 0);
  }
  function levelWon() {
    return goalsComplete() && (!currentLevel.bonus || score >= currentLevel.scoreTarget);
  }

  /* ---------- cascade resolution ---------- */

  // Shows the "found the character" celebration, then mass-clears every
  // remaining tile of their icon type as the reward, with a moves bonus if
  // it's the character the player picked in the character selector.
  function waitForCharacterModalClose() {
    return new Promise((resolve) => {
      hiddenCharacterResolve = resolve;
    });
  }

  async function triggerCharacterReveal(charKey, iconType) {
    const character = CHARACTERS.find((c) => c.key === charKey);
    document.getElementById("charFoundName").textContent = character.name;
    document.getElementById("charFoundImg").src = character.img;
    document.getElementById("charFoundImg").alt = character.name;
    document.getElementById("charFoundPhrase").textContent = character.foundPhrase;
    document.getElementById("charFoundOverlay").classList.add("show");
    sfx.special();
    haptic.special();

    await waitForCharacterModalClose();

    let cleared = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = grid[r][c];
        if (tile && tile.type === iconType) {
          burstParticles(r, c, TILE_DEFS[iconType].emoji);
          const g = goals.find((g) => g.typeIdx === iconType);
          if (g && g.remaining > 0) {
            g.remaining--;
            pulseGoal(iconType);
          }
          if (view[r][c]) view[r][c].classList.add("clearing");
          grid[r][c] = null;
          cleared++;
        }
      }
    }
    score += cleared * 10 + 250;
    updateHud();
    comboToast("🎉 " + character.name + " trouvé(e) ! +" + (cleared * 10 + 250) + " points", true);

    if (charKey === chosenCharacter) {
      movesLeft += 3;
      comboToast("💫 C'est ton personnage ! +3 drag !", true);
    }

    await sleep(320);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (view[r][c] && view[r][c].classList.contains("clearing")) {
          view[r][c].remove();
          view[r][c] = null;
        }
      }

    const moves = applyGravity(grid);
    moves.forEach((m) => {
      const el = view[m.from.r][m.from.c];
      view[m.to.r][m.to.c] = el;
      view[m.from.r][m.from.c] = null;
      if (el) positionEl(el, m.to.r, m.to.c);
    });
    const spawned = refill(grid, activePool);
    spawned.forEach((pos) => {
      const tile = grid[pos.r][pos.c];
      const el = makeTileEl(pos.r, pos.c, tile);
      el.style.top = -CELL * 2 + "px";
      view[pos.r][pos.c] = el;
      requestAnimationFrame(() => positionEl(el, pos.r, pos.c));
    });
    renderGoals();
    await sleep(260);
  }

  async function resolveCascade(triggerCell, initialMatched) {
    let combo = 0;
    let firstRound = true;

    while (true) {
      const found = findMatches(grid);
      const matched = firstRound && initialMatched ? new Set(initialMatched) : found.matched;
      const runs = firstRound && initialMatched ? [] : found.runs;
      if (matched.size === 0) break;

      combo++;
      const specials = computeSpecials(runs, firstRound ? triggerCell : null);
      firstRound = false;

      const specialPosKey = new Set(specials.map((s) => s.r + "," + s.c));
      const expanded = expandSpecials(grid, matched);

      // trigger sweep animation for any special caught in the blast
      let anySpecialTriggered = false;
      expanded.forEach((key) => {
        const parts = key.split(",");
        const r = +parts[0],
          c = +parts[1];
        const t = grid[r][c];
        if (t && t.special && !specialPosKey.has(key)) {
          anySpecialTriggered = true;
          sweepLine(t.special, r, c);
        }
      });
      if (anySpecialTriggered) sfx.special();
      haptic.special();

      // score + goals bookkeeping, clear cells (except where a special is being created)
      let cellsCleared = 0;
      let foundCharacter = null;
      const clearedThisRound = new Set();
      expanded.forEach((key) => {
        if (specialPosKey.has(key)) return; // becomes a special tile, doesn't clear
        const parts = key.split(",");
        const r = +parts[0],
          c = +parts[1];
        const tile = grid[r][c];
        if (!tile) return;

        if (tile.twoHitRemaining && tile.twoHitRemaining > 1) {
          // Cracks instead of clearing — stays in place, needs one more hit.
          tile.twoHitRemaining--;
          paintObstacleOverlay(view[r][c], tile);
          burstParticles(r, c, "❄️");
          return;
        }
        if (tile.twoHitRemaining) delete tile.twoHitRemaining;

        if (tile.hiddenCharacter) {
          foundCharacter = { key: tile.hiddenCharacter, type: tile.type };
        }
        cellsCleared++;
        clearedThisRound.add(key);
        burstParticles(r, c, TILE_DEFS[tile.type].emoji);
        const g = goals.find((g) => g.typeIdx === tile.type);
        if (g && g.remaining > 0) {
          g.remaining--;
          pulseGoal(tile.type);
        }
        view[r][c].classList.add("clearing");
        grid[r][c] = null;
      });

      // Any locked tile with a neighbour that was just cleared gets unlocked.
      clearedThisRound.forEach((key) => {
        const parts = key.split(",");
        const r = +parts[0],
          c = +parts[1];
        [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ].forEach(([nr, nc]) => {
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
          const nt = grid[nr][nc];
          if (nt && nt.locked) {
            nt.locked = false;
            paintObstacleOverlay(view[nr][nc], nt);
            comboToast(t("unlockedTileMsg"), true);
          }
        });
      });

      score += cellsCleared * 10 * combo;
      updateHud();

      haptic.match(combo);
      sfx.match(combo);
      if (combo >= 2)
        comboToast(
          combo === 2
            ? t("comboLabel")
            : combo === 3
              ? t("tripleLabel")
              : t("comboX", { n: combo }),
        );
      if (combo >= 3) screenShake();

      // turn special positions into special tiles visually
      specials.forEach((s) => {
        grid[s.r][s.c] = makeTile(s.type, s.special);
        paintTile(view[s.r][s.c], grid[s.r][s.c]);
        view[s.r][s.c].classList.remove("clearing");
      });

      await sleep(320);

      // remove cleared DOM elements
      expanded.forEach((key) => {
        if (specialPosKey.has(key)) return;
        const parts = key.split(",");
        const r = +parts[0],
          c = +parts[1];
        if (view[r][c] && view[r][c].classList.contains("clearing")) {
          view[r][c].remove();
          view[r][c] = null;
        }
      });

      // gravity
      const moves = applyGravity(grid);
      moves.forEach((m) => {
        const el = view[m.from.r][m.from.c];
        view[m.to.r][m.to.c] = el;
        view[m.from.r][m.from.c] = null;
        if (el) positionEl(el, m.to.r, m.to.c);
      });

      // refill from top, spawning above the board and falling in
      const spawned = refill(grid, activePool);
      spawned.forEach((pos) => {
        const tile = grid[pos.r][pos.c];
        const el = makeTileEl(pos.r, pos.c, tile);
        el.style.top = -CELL * 2 + "px";
        view[pos.r][pos.c] = el;
        requestAnimationFrame(() => positionEl(el, pos.r, pos.c));
      });

      renderGoals();
      await sleep(260);

      // A disguised character was cleared this round as an ordinary match —
      // celebrate, then mass-clear the rest of their icon type as the reward.
      if (foundCharacter) {
        await triggerCharacterReveal(foundCharacter.key, foundCharacter.type);
      }
    }
  }

  // Safety net: rebuild every tile element from scratch so the DOM can never
  // silently drift out of sync with the grid model, even after an error.
  function resyncBoardFromModel() {
    boardEl.querySelectorAll(".tile, .sweep, .particle, .combo-toast").forEach((el) => el.remove());
    view = [];
    for (let r = 0; r < ROWS; r++) {
      view.push([]);
      for (let c = 0; c < COLS; c++) {
        view[r].push(makeTileEl(r, c, grid[r][c]));
      }
    }
    renderGoals();
    updateHud();
  }

  function reshuffle(reason) {
    const tiles = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) tiles.push(grid[r][c]);

    function shuffledOnce() {
      const arr = tiles.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      const g = [];
      let k = 0;
      for (let r = 0; r < ROWS; r++) {
        g.push([]);
        for (let c = 0; c < COLS; c++) g[r].push(arr[k++]);
      }
      return g;
    }

    let g = shuffledOnce();
    let guard = 0;
    // Re-roll if the permutation happens to land on a pre-existing match or a
    // dead board — same real tiles, just try a different arrangement of them.
    while ((findMatches(g).matched.size > 0 || !hasAnyMove(g)) && guard < 100) {
      g = shuffledOnce();
      guard++;
    }
    grid = g;

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        paintTile(view[r][c], grid[r][c]);
      }
    const msg =
      reason === "manual"
        ? t("shuffledManual")
        : reason === "booster"
          ? t("shuffledBooster")
          : t("shuffledAuto");
    comboToast(msg, true);
  }

  /* ---------- end states ---------- */
  function endGame(won) {
    locked = true;
    const activeRegion = activeRegionKey ? REGIONS.find((r) => r.key === activeRegionKey) : null;
    const result = buildLevelResult({
      level: currentLevel,
      goalDefs: activeGoalDefs,
      goals,
      won,
      scoreBeforeBonus: score,
      movesLeft,
      region: activeRegion
        ? {
            key: activeRegion.key,
            name: activeRegion.name,
            required: activeRegion.required,
            before: regionPoints(activeRegion.key),
          }
        : null,
    });
    const leftoverBonus = result.moveBonus;
    if (leftoverBonus) {
      // Saved moves detonate as fireworks worth points instead of going to waste.
      score = result.finalScore;
      for (let i = 0; i < Math.min(movesLeft, 8); i++) {
        const rr = Math.floor(Math.random() * ROWS),
          cc = Math.floor(Math.random() * COLS);
        burstParticles(rr, cc, "✨");
      }
      comboToast(t("leftoverBonusMsg", { moves: movesLeft, points: leftoverBonus }), true);
    }
    if (score > best) {
      best = score;
      storageSet("cps_best", String(best));
    }
    if (activeRegionKey && !isRegionWon(activeRegionKey)) {
      addRegionProgress(activeRegionKey, score);
    }
    updateHud();
    if (won) {
      sfx.win();
      haptic.win();
      confettiBurst();
      const stars = result.stars;
      const previousStars = levelStars[currentLevel.id] || 0;
      if (stars > previousStars) {
        levelStars[currentLevel.id] = stars;
        storageSet("cps_stars", JSON.stringify(levelStars));
        if (previousStars === 0) {
          const rewardKey = ["extraMoves", "shuffle", "remove"][(currentLevel.id - 1) % 3];
          boosters = addBoosters(boosters, { [rewardKey]: 1 });
        }
      }
      const isLast = currentLevel.id >= LEVELS.length;
      if (currentLevel.id >= highestUnlocked && !isLast) {
        highestUnlocked = currentLevel.id + 1;
        storageSet("cps_unlocked", String(highestUnlocked));
      }
      if (currentLevel.bonus) {
        pendingCarryOver = true;
        showModal(
          "🎁",
          t("bonusWonTitle"),
          t("bonusWonText", {
            score: score,
            target: currentLevel.scoreTarget,
            repos: repositionsLeft,
          }),
          result,
        );
      } else {
        showModal(
          "🥐",
          t("levelWonTitle"),
          t("levelWonText", { moves: Math.max(movesLeft, 0), score: score }),
          result,
        );
      }
      modalNextBtn.style.display = isLast ? "none" : "inline-block";
    } else {
      sfx.lose();
      haptic.lose();
      if (currentLevel.bonus && goalsComplete() && score < currentLevel.scoreTarget) {
        showModal(
          "😮",
          t("bonusLostTitle"),
          t("bonusLostText", { score: score, target: currentLevel.scoreTarget }),
          result,
        );
      } else {
        showModal("😮", t("levelLostTitle"), t("levelLostText", { score: score }), result);
      }
      modalNextBtn.style.display = "none";
    }
    persistSave();
    checkActiveRegionWin();
  }

  function showModal(emoji, title, text, result) {
    modalEmoji.textContent = emoji;
    modalTitle.textContent = title;
    modalText.textContent = text;
    const resultLevel = document.getElementById("resultLevel");
    const resultStars = document.getElementById("resultStars");
    const resultScore = document.getElementById("resultScore");
    const resultGoals = document.getElementById("resultGoals");
    const resultMoves = document.getElementById("resultMoves");
    const resultBonus = document.getElementById("resultBonus");
    const resultRegion = document.getElementById("resultRegion");
    const resultDetails = document.getElementById("resultDetails");
    resultDetails.style.display = result ? "block" : "none";
    if (result) {
      resultLevel.textContent = t("resultLevelLabel", {
        id: currentLevel.id,
        title: currentLevel.title,
      });
      resultStars.textContent = starRow(result.stars);
      resultStars.setAttribute("aria-label", t("resultStarsValue", { stars: result.stars }));
      resultScore.innerHTML =
        "<span>" + t("scoreLabel") + "</span><strong>" + result.finalScore + "</strong>";
      resultGoals.innerHTML = result.goals
        .map((goal) => {
          const def = TILE_DEFS[goal.typeIdx];
          const icon = def.img
            ? '<img src="' + def.img + '" alt="' + def.name + '">'
            : "<span>" + def.emoji + "</span>";
          return (
            '<div class="result-goal ' +
            (goal.complete ? "complete" : "") +
            '">' +
            icon +
            "<strong>" +
            goal.collected +
            " / " +
            goal.need +
            "</strong><span>" +
            (goal.complete ? "✓" : "") +
            "</span></div>"
          );
        })
        .join("");
      resultMoves.textContent = t("resultMovesValue", {
        used: result.movesUsed,
        left: result.movesLeft,
      });
      resultBonus.textContent = result.moveBonus
        ? t("resultBonusValue", { points: result.moveBonus })
        : t("resultNoBonus");
      if (result.region) {
        resultRegion.innerHTML =
          '<div class="result-region-head"><span>' +
          t("resultRegionValue", { name: result.region.name }) +
          "</span><strong>+" +
          result.region.awarded +
          "</strong></div>" +
          '<div class="result-region-track"><div style="width:' +
          result.region.afterPct +
          '%"></div></div>' +
          "<small>" +
          result.region.beforePct +
          "% → " +
          result.region.afterPct +
          "% · " +
          Math.min(result.region.after, result.region.required) +
          " / " +
          result.region.required +
          "</small>";
      } else resultRegion.innerHTML = "<small>" + t("resultNoRegion") + "</small>";
    }
    modalOverlay.classList.add("show");
  }
  function hideModal() {
    modalOverlay.classList.remove("show");
  }

  modalBtn.addEventListener("click", () => {
    newGame(currentLevel.id);
  });
  document.getElementById("modalCloseX").addEventListener("click", () => {
    hideModal();
    showMap();
  });
  modalNextBtn.addEventListener("click", () => {
    newGame(currentLevel.id + 1);
  });
  modalMapBtn.addEventListener("click", () => {
    hideModal();
    showMap();
  });
  mapBtn.addEventListener("click", () => {
    showMap();
  });
  document.getElementById("mapBackBtn").addEventListener("click", () => {
    hideMap();
  });

  hintBtn.addEventListener("click", () => {
    if (locked || movesLeft <= 0) return;
    const move = findAnyMove(grid);
    if (!move) {
      // Shouldn't happen (newGame/reshuffle guarantee a move exists), but never
      // leave the player stuck silently if it somehow does.
      reshuffle();
      return;
    }
    [move.a, move.b].forEach((pos) => {
      const el = view[pos.r][pos.c];
      el.classList.remove("hint-pulse");
      void el.offsetWidth;
      el.classList.add("hint-pulse");
      setTimeout(() => el.classList.remove("hint-pulse"), 1900);
    });
    sfx.select();
    haptic.select();
  });

  shuffleBtn.addEventListener("click", () => {
    if (locked || movesLeft <= 0) return;
    movesLeft--;
    updateHud();
    reshuffle("manual");
    if (movesLeft <= 0 && !levelWon()) {
      endGame(false);
    }
  });

  document.getElementById("extraMovesBoosterBtn").addEventListener("click", () => {
    const spent = spendBooster(boosters, "extraMoves");
    if (!spent || locked) return;
    boosters = spent;
    movesLeft += 3;
    comboToast(t("extraMovesUsed"), true);
    persistSave();
    updateHud();
  });
  document.getElementById("shuffleBoosterBtn").addEventListener("click", () => {
    const spent = spendBooster(boosters, "shuffle");
    if (!spent || locked) return;
    boosters = spent;
    reshuffle("booster");
    persistSave();
    updateHud();
  });
  document.getElementById("removeBoosterBtn").addEventListener("click", () => {
    if (locked || boosters.remove <= 0) return;
    removeBoosterMode = !removeBoosterMode;
    document.getElementById("removeBoosterBtn").classList.toggle("mode-active", removeBoosterMode);
    comboToast(t(removeBoosterMode ? "removeBoosterPrompt" : "removeBoosterCancelled"), true);
  });

  repositionBtn.addEventListener("click", () => {
    if (locked || movesLeft < 2 || repositionsLeft <= 0) return;
    if (repositionMode) {
      setRepositionMode(false);
    } else {
      if (selected) {
        view[selected.r][selected.c].classList.remove("selected");
        selected = null;
      }
      setRepositionMode(true);
      comboToast(t("selectTileFirst"), true);
    }
  });

  function renderLevelMap() {
    levelGrid.innerHTML = "";
    LEVELS.forEach((lvl) => {
      const unlocked = lvl.id <= highestUnlocked;
      const completed = lvl.id < highestUnlocked;
      const card = document.createElement("div");
      card.className =
        "level-card" +
        (unlocked ? "" : " locked") +
        (completed ? " completed" : "") +
        (lvl.bonus ? " bonus-card" : "");
      const iconsHtml = lvl.pool
        .slice(0, 6)
        .map((t) => {
          const def = TILE_DEFS[t];
          return def.img ? '<img src="' + def.img + '" alt="' + def.name + '">' : "";
        })
        .join("");
      const earned = levelStars[lvl.id] || 0;
      const starHtml = earned ? '<div class="lvl-stars">' + starRow(earned) + "</div>" : "";
      const bonusBadge = lvl.bonus
        ? '<div class="bonus-badge">🎁 Bonus · ' + lvl.scoreTarget + " p</div>"
        : "";
      card.innerHTML =
        '<div class="lvl-num">' +
        (lvl.bonus ? "🎁" : lvl.id) +
        "</div>" +
        '<div class="lvl-title">' +
        lvl.title +
        "</div>" +
        bonusBadge +
        starHtml +
        '<div class="lvl-icons">' +
        iconsHtml +
        "</div>";
      if (unlocked) {
        card.addEventListener("click", () => {
          openLevelSetup(lvl);
        });
      }
      levelGrid.appendChild(card);
    });
  }
  function showMap() {
    renderLevelMap();
    renderCharThumb();
    updateRegionProgressBadge();
    document.getElementById("mapBackBtn").style.display = hasStartedAnyGame ? "" : "none";
    mapOverlay.classList.add("show");
  }

  const MAX_SETUP_GOALS = 5;
  const MIN_SETUP_GOALS = 2;

  function openLevelSetup(lvl) {
    setupTargetLevel = lvl;
    if (!activeRegionKey && !regionOptOut) {
      hideMap();
      renderRegionMap();
      regionMapOverlay.classList.add("show");
      return;
    }
    prepareLevelSetup(lvl);
  }

  function prepareLevelSetup(lvl) {
    setupLevelTitle.textContent = t("levelLabelNormal", { id: lvl.id, title: lvl.title });
    hardModeCheck.checked = false;
    lockedObstacleCheck.checked = false;
    twoHitObstacleCheck.checked = false;
    spreaderObstacleCheck.checked = false;
    buildSetupGoalPicker(lvl, lvl.goals);
    hideMap();
    levelSetupOverlay.classList.add("show");
  }

  function buildSetupGoalPicker(lvl, presetGoals) {
    setupGoalPicker.innerHTML = "";
    const presetMap = {};
    (presetGoals || []).forEach((g) => (presetMap[g.typeIdx] = g.need));

    TILE_DEFS.forEach((def, typeIdx) => {
      const isPreset = typeIdx in presetMap;
      const row = document.createElement("div");
      row.className = "setup-goal-row" + (isPreset ? "" : " disabled");
      row.dataset.typeIdx = typeIdx;
      row.innerHTML =
        '<input type="checkbox" class="setup-goal-check"' +
        (isPreset ? " checked" : "") +
        ">" +
        (def.img
          ? '<img src="' + def.img + '" alt="' + def.name + '">'
          : "<span>" + def.emoji + "</span>") +
        '<span class="setup-goal-name">' +
        def.name +
        "</span>" +
        '<input type="number" class="setup-goal-need" min="3" max="30" value="' +
        (presetMap[typeIdx] || 8) +
        '">';
      setupGoalPicker.appendChild(row);

      const check = row.querySelector(".setup-goal-check");
      check.addEventListener("change", () => {
        row.classList.toggle("disabled", !check.checked);
        validateSetupSelection();
      });
    });

    let warning = document.getElementById("setupCountWarning");
    if (!warning) {
      warning = document.createElement("div");
      warning.id = "setupCountWarning";
      warning.className = "setup-count-warning";
      setupGoalPicker.after(warning);
    }
    validateSetupSelection();
  }

  function validateSetupSelection() {
    const checked = setupGoalPicker.querySelectorAll(".setup-goal-check:checked").length;
    const warning = document.getElementById("setupCountWarning");
    if (checked < MIN_SETUP_GOALS) {
      warning.textContent = t("setupWarnMin", { n: MIN_SETUP_GOALS });
      setupStartBtn.disabled = true;
    } else if (checked > MAX_SETUP_GOALS) {
      warning.textContent = t("setupWarnMax", { n: MAX_SETUP_GOALS });
      setupStartBtn.disabled = true;
    } else {
      warning.textContent = t("setupWarnOk", { n: checked });
      setupStartBtn.disabled = false;
    }
  }

  function collectSetupGoals() {
    const goals = [];
    setupGoalPicker.querySelectorAll(".setup-goal-row").forEach((row) => {
      const check = row.querySelector(".setup-goal-check");
      if (!check.checked) return;
      const need = Math.max(
        3,
        Math.min(30, parseInt(row.querySelector(".setup-goal-need").value, 10) || 8),
      );
      goals.push({ typeIdx: parseInt(row.dataset.typeIdx, 10), need });
    });
    return goals;
  }
  function hideMap() {
    mapOverlay.classList.remove("show");
  }

  function renderCharThumb() {
    const c = CHARACTERS.find((c) => c.key === chosenCharacter) || CHARACTERS[0];
    charSelectThumb.src = c.img;
    charSelectThumb.style.display = "inline-block";
    const statusThumb = document.getElementById("currentCharThumb");
    const statusText = document.getElementById("currentCharText");
    if (statusThumb) {
      statusThumb.src = c.img;
    }
    if (statusText) {
      statusText.textContent = t("currentCharLabel", { name: c.name });
    }
  }

  function renderCharGrid() {
    charGrid.innerHTML = "";
    CHARACTERS.forEach((c) => {
      const card = document.createElement("div");
      card.className = "char-card" + (c.key === chosenCharacter ? " chosen" : "");
      card.innerHTML =
        '<img src="' + c.img + '" alt="' + c.name + '"><div class="char-name">' + c.name + "</div>";
      card.addEventListener("click", () => {
        chosenCharacter = c.key;
        storageSet("cps_character", c.key);
        renderCharGrid();
        renderCharThumb();
      });
      charGrid.appendChild(card);
    });
  }

  function regionPoints(key) {
    return regionProgress[key] || 0;
  }
  function isRegionWon(key) {
    // A won region keeps its favour forever, even though its points reset to
    // zero for the next conquest. The points fallback migrates old saves.
    const r = REGIONS.find((x) => x.key === key);
    return !!regionWon[key] || (!!r && regionPoints(key) >= r.required);
  }
  function setActiveRegion(key) {
    activeRegionKey = key;
    regionOptOut = false;
    storageSet("cps_active_region", key || "");
    persistSave();
  }
  function addRegionProgress(key, amount) {
    regionProgress[key] = regionPoints(key) + amount;
    storageSet("cps_region_progress", JSON.stringify(regionProgress));
  }

  function updateRegionProgressBadge() {
    const wonCount = REGIONS.filter((r) => isRegionWon(r.key)).length;
    regionProgressBadge.textContent = "(" + wonCount + "/" + REGIONS.length + ")";
  }

  let landmarkCelebrationQueue = [];

  function showLandmarkModal(regionKey, justBuilt) {
    const r = REGIONS.find((x) => x.key === regionKey);
    if (!r) return;
    document.getElementById("landmarkRegionName").textContent = (justBuilt ? "🎉 " : "") + r.name;
    const img = document.getElementById("landmarkImg");
    img.src = monumentImage(r);
    img.alt = (r.monument && r.monument.name) || r.name;
    document.getElementById("landmarkMonumentName").textContent = justBuilt
      ? t("festivalMonumentBuilt", { monument: (r.monument && r.monument.name) || r.name })
      : (r.monument && r.monument.name) || "";
    document.getElementById("landmarkCaption").textContent =
      (justBuilt ? "Le peuple a construit ce monument pour célébrer ta victoire ! " : "") +
      r.hommage;

    // Region festival: tricolour banner, monument-building reveal, fanfare.
    const card = document.getElementById("landmarkCard");
    const banner = document.getElementById("landmarkFestivalBanner");
    const points = document.getElementById("landmarkFestivalPoints");
    card.classList.toggle("festival", !!justBuilt);
    banner.style.display = justBuilt ? "block" : "none";
    points.style.display = justBuilt ? "block" : "none";
    if (justBuilt) {
      const wonCount = REGIONS.filter((x) => isRegionWon(x.key)).length;
      document.getElementById("landmarkFestivalTitle").textContent = t("festivalTitle");
      document.getElementById("landmarkFestivalCount").textContent = t("festivalRegionCount", {
        won: wonCount,
        total: REGIONS.length,
      });
      // Points reset at the moment of victory, so the festival shows the goal.
      points.textContent = t("festivalPoints", { points: r.required });
      document.getElementById("landmarkCloseBtn").textContent = t("festivalCloseBtn");
      haptic.win();
      setTimeout(() => confettiBurst(), 500);
      setTimeout(() => confettiBurst(), 1100);
    } else {
      document.getElementById("landmarkCloseBtn").textContent = t("closeBtn");
    }
    document.getElementById("landmarkModalOverlay").classList.add("show");
  }
  function hideLandmarkModal() {
    document.getElementById("landmarkModalOverlay").classList.remove("show");
    document.getElementById("landmarkCard").classList.remove("festival");
    if (landmarkCelebrationQueue.length > 0) setTimeout(() => celebrateNextLandmark(), 250);
  }

  function renderRegionMap() {
    const active = REGIONS.find((r) => r.key === activeRegionKey);
    const targetLine = document.getElementById("currentTargetLine");
    if (active) {
      targetLine.innerHTML =
        t("currentTargetLabel") +
        " " +
        active.name +
        " (" +
        Math.min(100, Math.round((regionPoints(active.key) / active.required) * 100)) +
        "%)";
    } else {
      targetLine.textContent = t("noTargetSelected");
    }

    let overlayHtml = "";
    REGIONS.forEach((r) => {
      const pos = REGION_BAR_POS[r.key];
      if (!pos) return;
      const won = isRegionWon(r.key);
      // Won regions show a full bar even though their points have reset to 0.
      const pct = won ? 100 : Math.max(0, Math.min(100, (regionPoints(r.key) / r.required) * 100));
      const isActive = r.key === activeRegionKey;
      overlayHtml +=
        '<button type="button" class="map-region-hit' +
        (isActive ? " active-target" : "") +
        '" data-region="' +
        r.key +
        '" aria-label="' +
        r.name +
        '" style="left:' +
        Math.max(0, pos.left - 2) +
        "%; top:" +
        Math.max(0, pos.top - 2.5) +
        "%; width:" +
        Math.max(8, pos.width + 4) +
        "%; height:" +
        Math.max(7, pos.height + 5) +
        '%;"></button>' +
        '<div class="map-bar' +
        (isActive ? " active-target" : "") +
        '" aria-hidden="true" style="left:' +
        pos.left +
        "%; top:" +
        pos.top +
        "%; width:" +
        pos.width +
        "%; height:" +
        pos.height +
        '%;">' +
        '<div class="map-bar-fill' +
        (won ? " full" : "") +
        '" style="width:' +
        pct +
        '%;"></div>' +
        "</div>" +
        (won
          ? '<div class="map-bar-heart" data-region="' +
            r.key +
            '" style="left:' +
            (pos.left + pos.width / 2) +
            "%; top:" +
            pos.top +
            '%;">❤️</div>'
          : "");
    });

    regionGrid.innerHTML =
      '<div class="map-wrap">' +
      '<img src="' +
      MAP_IMG +
      '" alt="' +
      t("regionMapTitle") +
      '" class="map-image">' +
      overlayHtml +
      "</div>" +
      '<div id="regionDetail" class="region-detail">' +
      t("regionMapHint") +
      "</div>";

    function showDetail(key) {
      const r = REGIONS.find((x) => x.key === key);
      if (!r) return;
      const detail = document.getElementById("regionDetail");

      if (isRegionWon(r.key)) {
        showLandmarkModal(r.key);
        return;
      }

      if (r.key === activeRegionKey) {
        const pct = Math.min(100, Math.round((regionPoints(r.key) / r.required) * 100));
        detail.innerHTML =
          "<strong>" +
          r.name +
          "</strong> — " +
          t("regionActiveProgress", {
            pct: pct,
            progress: regionPoints(r.key),
            required: r.required,
          });
        return;
      }

      detail.innerHTML =
        "<strong>" +
        r.name +
        "</strong> — " +
        t("switchTargetPrompt", { required: r.required }) +
        ' <button id="confirmTargetBtn" class="button-primary region-confirm-btn">' +
        t("setTargetBtn") +
        "</button>";
      document.getElementById("confirmTargetBtn").addEventListener("click", () => {
        setActiveRegion(r.key);
        renderRegionMap();
        haptic.select();
      });
    }

    regionGrid.querySelectorAll("[data-region]").forEach((el) => {
      el.addEventListener("click", () => showDetail(el.dataset.region));
    });
  }

  openCharSelectBtn.addEventListener("click", () => {
    renderCharGrid();
    charSelectOverlay.classList.add("show");
  });
  closeCharSelectBtn.addEventListener("click", () => {
    charSelectOverlay.classList.remove("show");
  });
  document.getElementById("currentCharRow").addEventListener("click", () => {
    renderCharGrid();
    charSelectOverlay.classList.add("show");
  });
  openRegionMapBtn.addEventListener("click", () => {
    setupTargetLevel = null;
    renderRegionMap();
    regionMapOverlay.classList.add("show");
  });

  setupResetBtn.addEventListener("click", () => {
    hardModeCheck.checked = false;
    lockedObstacleCheck.checked = false;
    twoHitObstacleCheck.checked = false;
    spreaderObstacleCheck.checked = false;
    buildSetupGoalPicker(setupTargetLevel, setupTargetLevel.goals);
  });
  setupCancelBtn.addEventListener("click", () => {
    levelSetupOverlay.classList.remove("show");
    showMap();
  });
  setupStartBtn.addEventListener("click", () => {
    const customGoals = collectSetupGoals();
    if (customGoals.length < MIN_SETUP_GOALS || customGoals.length > MAX_SETUP_GOALS) return;
    levelSetupOverlay.classList.remove("show");
    newGame(setupTargetLevel.id, customGoals, hardModeCheck.checked, {
      locked: lockedObstacleCheck.checked,
      twoHit: twoHitObstacleCheck.checked,
      spreader: spreaderObstacleCheck.checked,
    });
  });
  closeRegionMapBtn.addEventListener("click", () => {
    regionMapOverlay.classList.remove("show");
    if (setupTargetLevel && (activeRegionKey || regionOptOut)) prepareLevelSetup(setupTargetLevel);
  });
  noRegionBtn.addEventListener("click", () => {
    activeRegionKey = null;
    regionOptOut = true;
    storageSet("cps_active_region", "");
    persistSave();
    renderRegionMap();
    regionMapOverlay.classList.remove("show");
    if (setupTargetLevel) prepareLevelSetup(setupTargetLevel);
  });
  document.getElementById("landmarkCloseX").addEventListener("click", hideLandmarkModal);
  document.getElementById("landmarkCloseBtn").addEventListener("click", hideLandmarkModal);

  function closeCharFoundModal() {
    document.getElementById("charFoundOverlay").classList.remove("show");
    if (hiddenCharacterResolve) {
      const r = hiddenCharacterResolve;
      hiddenCharacterResolve = null;
      r();
    }
  }
  document.getElementById("charFoundCloseX").addEventListener("click", closeCharFoundModal);
  document.getElementById("charFoundCloseBtn").addEventListener("click", closeCharFoundModal);

  // Pulls the next region out of the celebration queue (there's usually just
  // one) and shows its landmark-reveal modal.
  function celebrateNextLandmark() {
    if (landmarkCelebrationQueue.length === 0) return;
    const key = landmarkCelebrationQueue.shift();
    playFanfare();
    showLandmarkModal(key, true);
  }

  // Short brass-style fanfare for a completed region (the full Marseillaise is
  // saved for conquering all of France).
  function playFanfare() {
    if (!musicOn) return;
    duckMusic(1.6);
    const notes = ["c5", "e5", "g5", "c5", "g5", "c5"];
    notes.forEach((n, i) => {
      const f = NOTE_FREQ[n] || NOTE_FREQ["c5"];
      beep(f, i === notes.length - 1 ? 0.55 : 0.16, "triangle", 0.22, i * 0.15, "music");
    });
  }

  // Dev-only hook so the region festival can be triggered from automated tests.
  if (import.meta.env && import.meta.env.DEV) {
    window.__cpsDebug = { celebrateRegion: (key) => showLandmarkModal(key, true) };
  }

  function checkActiveRegionWin() {
    if (!activeRegionKey || !isRegionWon(activeRegionKey)) return;
    const wonKey = activeRegionKey;
    // The region's favour is kept permanently, but its points reset to zero —
    // the next conquest always starts from an empty bar.
    regionWon[wonKey] = true;
    storageSet("cps_region_won", JSON.stringify(regionWon));
    regionProgress[wonKey] = 0;
    storageSet("cps_region_progress", JSON.stringify(regionProgress));
    confettiBurst();
    landmarkCelebrationQueue.push(wonKey);
    setTimeout(() => celebrateNextLandmark(), 300);
    setActiveRegion(null); // conquered — player picks a new target next time they open the map
    regionOptOut = false;

    if (REGIONS.every((r) => isRegionWon(r.key))) {
      setTimeout(() => {
        confettiBurst();
        confettiBurst();
        comboToast("🇫🇷 Toute la France t'appartient ! Vive la France !", true);
        playMarseillaise();
      }, 900);
    }
  }

  function persistSave() {
    const data = {
      version: SAVE_VERSION,
      best,
      stars: levelStars,
      highestUnlocked,
      activeRegionKey,
      regionOptOut,
      regionProgress,
      regionWon,
      chosenCharacter,
      language: currentLang,
      boosters,
      settings: { haptics: hapticsOn, sound: !muted, music: musicOn, sfxVolume, musicVolume },
    };
    storageSet("cps_save", JSON.stringify(data));
    storageSet("cps_save_version", String(SAVE_VERSION));
  }

  const hapticsToggle = document.getElementById("hapticsToggle");
  hapticsToggle.addEventListener("change", () => {
    hapticsOn = hapticsToggle.checked;
    storageSet("cps_haptics", hapticsOn ? "1" : "0");
    if (hapticsOn) haptic.select();
  });

  const musicToggle = document.getElementById("musicToggle");
  const sfxVolumeSlider = document.getElementById("sfxVolume");
  const musicVolumeSlider = document.getElementById("musicVolume");

  function refreshAudioControls() {
    sfxVolumeSlider.disabled = muted;
    sfxVolumeSlider.parentElement.classList.toggle("disabled", muted);
    musicVolumeSlider.disabled = !musicOn;
    musicVolumeSlider.parentElement.classList.toggle("disabled", !musicOn);
  }

  soundToggle.addEventListener("change", () => {
    muted = !soundToggle.checked;
    storageSet("cps_muted", muted ? "1" : "0");
    applyVolumes();
    refreshAudioControls();
    if (!muted) sfx.select();
  });

  musicToggle.addEventListener("change", () => {
    musicOn = musicToggle.checked;
    storageSet("cps_music", musicOn ? "1" : "0");
    applyVolumes();
    refreshAudioControls();
    if (musicOn) startMusic();
    else stopMusic();
  });

  sfxVolumeSlider.addEventListener("input", () => {
    sfxVolume = Number(sfxVolumeSlider.value) / 100;
    storageSet("cps_sfx_vol", String(sfxVolumeSlider.value));
    applyVolumes();
  });
  sfxVolumeSlider.addEventListener("change", () => {
    if (!muted) sfx.select();
  });

  musicVolumeSlider.addEventListener("input", () => {
    musicVolume = Number(musicVolumeSlider.value) / 100;
    storageSet("cps_music_vol", String(musicVolumeSlider.value));
    applyVolumes();
  });

  const settingsBtn = document.getElementById("settingsBtn");
  const settingsOverlay = document.getElementById("settingsOverlay");
  function openSettings() {
    document
      .querySelectorAll(".lang-pick-btn")
      .forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
    settingsOverlay.classList.add("show");
  }
  settingsBtn.addEventListener("click", openSettings);
  document
    .getElementById("settingsCloseX")
    .addEventListener("click", () => settingsOverlay.classList.remove("show"));
  document
    .getElementById("settingsCloseBtn")
    .addEventListener("click", () => settingsOverlay.classList.remove("show"));

  let langTapCount = 0;
  let langTapTimer = null;
  document.querySelectorAll(".lang-pick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const isAlreadyActive = btn.dataset.lang === currentLang;
      if (isAlreadyActive) {
        langTapCount++;
        clearTimeout(langTapTimer);
        langTapTimer = setTimeout(() => {
          langTapCount = 0;
        }, 2000);
        if (langTapCount >= 5) {
          langTapCount = 0;
          setLanguage(currentLang === "tlh" ? "sv" : "tlh");
          document
            .querySelectorAll(".lang-pick-btn")
            .forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
          return;
        }
      } else {
        langTapCount = 0;
      }
      setLanguage(btn.dataset.lang);
      document
        .querySelectorAll(".lang-pick-btn")
        .forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
    });
  });

  const debugToggleBtn = document.getElementById("debugToggleBtn");
  debugToggleBtn.addEventListener("change", () => {
    boardEl.classList.toggle("debug-mode", debugToggleBtn.checked);
  });

  function relayoutBoard() {
    computeCellSize();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const el = view[r][c];
        if (el) {
          el.style.width = CELL + "px";
          el.style.height = CELL + "px";
          el.style.fontSize = Math.floor(CELL * 0.55) + "px";
          positionEl(el, r, c);
        }
      }
  }
  let relayoutTimer = null;
  function scheduleRelayout() {
    if (relayoutTimer) clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(relayoutBoard, 80);
  }
  window.addEventListener("resize", scheduleRelayout);
  window.addEventListener("orientationchange", scheduleRelayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleRelayout);
  }

  /* ---------- boot ---------- */
  (async function init() {
    let rawSave = null;
    try {
      rawSave = JSON.parse((await storageGet("cps_save")) || "null");
    } catch (error) {
      rawSave = null;
    }
    const savedBest = await storageGet("cps_best");
    best = savedBest ? parseInt(savedBest, 10) || 0 : 0;
    const savedHaptics = await storageGet("cps_haptics");
    hapticsOn = savedHaptics !== "0";
    hapticsToggle.checked = hapticsOn;
    const savedMuted = await storageGet("cps_muted");
    muted = savedMuted === "1";
    soundToggle.checked = !muted;
    const savedMusic = await storageGet("cps_music");
    musicOn = savedMusic !== "0";
    musicToggle.checked = musicOn;
    const savedSfxVol = await storageGet("cps_sfx_vol");
    if (savedSfxVol !== null && savedSfxVol !== undefined && savedSfxVol !== "") {
      sfxVolume = (parseInt(savedSfxVol, 10) || 0) / 100;
      sfxVolumeSlider.value = String(parseInt(savedSfxVol, 10) || 0);
    }
    const savedMusicVol = await storageGet("cps_music_vol");
    if (savedMusicVol !== null && savedMusicVol !== undefined && savedMusicVol !== "") {
      musicVolume = (parseInt(savedMusicVol, 10) || 0) / 100;
      musicVolumeSlider.value = String(parseInt(savedMusicVol, 10) || 0);
    }
    refreshAudioControls();
    applyVolumes();
    // Browsers only allow audio after a gesture, so the loop waits for the
    // player's first tap.
    const kickOffMusic = () => {
      if (musicOn) startMusic();
      window.removeEventListener("pointerdown", kickOffMusic);
      window.removeEventListener("keydown", kickOffMusic);
    };
    window.addEventListener("pointerdown", kickOffMusic);
    window.addEventListener("keydown", kickOffMusic);
    const savedVersion = parseInt((await storageGet("cps_save_version")) || "1", 10);
    if (savedVersion < SAVE_VERSION) {
      storageSet("cps_save_version", String(SAVE_VERSION));
    }
    const savedStars = await storageGet("cps_stars");
    if (savedStars) {
      try {
        levelStars = JSON.parse(savedStars) || {};
      } catch (e) {
        levelStars = {};
      }
    }
    const savedUnlocked = await storageGet("cps_unlocked");
    highestUnlocked = savedUnlocked ? Math.max(1, parseInt(savedUnlocked, 10) || 1) : 1;
    const savedProgress = await storageGet("cps_region_progress");
    if (savedProgress) {
      try {
        regionProgress = JSON.parse(savedProgress) || {};
      } catch (e) {
        regionProgress = {};
      }
    }
    const savedWon = await storageGet("cps_region_won");
    if (savedWon) {
      try {
        regionWon = JSON.parse(savedWon) || {};
      } catch (e) {
        regionWon = {};
      }
    }
    // Migrate old saves: regions already past their goal are marked won and
    // their points reset, matching the new rule.
    let migrated = false;
    REGIONS.forEach((r) => {
      if (!regionWon[r.key] && regionPoints(r.key) >= r.required) {
        regionWon[r.key] = true;
        regionProgress[r.key] = 0;
        migrated = true;
      }
    });
    if (migrated) {
      storageSet("cps_region_won", JSON.stringify(regionWon));
      storageSet("cps_region_progress", JSON.stringify(regionProgress));
    }
    const savedActiveRegion = await storageGet("cps_active_region");
    activeRegionKey =
      savedActiveRegion && REGIONS.some((r) => r.key === savedActiveRegion)
        ? savedActiveRegion
        : null;
    const savedChar = await storageGet("cps_character");
    const hadSavedChar = !!(savedChar && CHARACTERS.some((c) => c.key === savedChar));
    if (hadSavedChar) chosenCharacter = savedChar;
    const savedLang = await storageGet("cps_lang");
    if (savedLang && STRINGS[savedLang]) currentLang = savedLang;
    const migratedSave = migrateSave(
      rawSave,
      {
        best,
        stars: levelStars,
        highestUnlocked,
        activeRegionKey,
        regionOptOut,
        regionProgress,
        regionWon,
        chosenCharacter,
        language: currentLang,
      },
      REGIONS,
    );
    best = migratedSave.best;
    levelStars = migratedSave.stars;
    highestUnlocked = migratedSave.highestUnlocked;
    activeRegionKey = migratedSave.activeRegionKey;
    regionOptOut = migratedSave.regionOptOut;
    regionProgress = migratedSave.regionProgress;
    regionWon = migratedSave.regionWon;
    chosenCharacter = migratedSave.chosenCharacter || chosenCharacter;
    currentLang = migratedSave.language;
    boosters = migratedSave.boosters;
    persistSave();
    currentLevel = LEVELS[0];
    applyStaticI18n();
    renderCharThumb();
    if (hadSavedChar) {
      showMap();
    } else {
      // First-ever visit: ask the player to make a deliberate choice instead
      // of silently defaulting them into one. mapOverlay defaults to visible
      // in the static HTML, so hide it explicitly first.
      hideMap();
      renderCharGrid();
      charSelectOverlay.classList.add("show");
      const onFirstChoice = () => {
        charSelectOverlay.classList.remove("show");
        closeCharSelectBtn.removeEventListener("click", onFirstChoice);
        showMap();
      };
      closeCharSelectBtn.addEventListener("click", onFirstChoice);
    }
    window.__bootDone = true;
  })();
}
