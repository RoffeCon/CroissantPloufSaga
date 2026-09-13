// Game shell markup, extracted from the original index.html.
export const GAME_MARKUP = `<div class="app">

  <div class="topbar">
    <div class="goals-panel">
      <div class="goals-label" data-i18n="goalsLabel">Mål</div>
      <div class="goals-row" id="goalsRow"></div>
    </div>

    <div class="title-wrap">
      <div class="eyebrow" id="levelLabel">Nivå 1</div>
      <h1>Croissant<br><span>Plouf</span> Saga</h1>
      <button id="mapBtn" aria-label="Öppna nivåkartan" data-i18n="levelMapBtn" style="margin-top:2px; border:none; background:var(--cream); color:var(--burgundy); font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; cursor:pointer;">🗺️ Nivåkarta</button>
    </div>

    <div>
      <div class="score-panel">
        <div class="lbl" data-i18n="scoreLabel">Poäng</div>
        <div class="val" id="scoreVal">0</div>
      </div>
      <button class="mute-btn" id="settingsBtn" title="Inställningar" aria-label="Inställningar">⚙️</button>
      <button class="mute-btn" id="regionMapTopBtn" title="Frankrikes hjärta" aria-label="Frankrikes hjärta" style="position:relative;">🇫🇷<span id="regionProgressBadge" style="position:absolute; bottom:-4px; right:-4px; background:var(--sage); color:#fff; font-size:8px; font-weight:800; border-radius:8px; padding:1px 3px; line-height:1;"></span></button>
    </div>
  </div>

  <div class="board-shell">
    <div class="board" id="board"></div>
  </div>

  <div class="bottombar">
    <div><span data-i18n="bestLabel">⭐ Bästa:</span> <span id="bestVal">0</span></div>
    <div class="steg"><span data-i18n="movesLeftLabel">Steg kvar:</span> <span id="movesVal">0</span></div>
  </div>

  <div class="action-row">
    <button id="hintBtn" class="action-btn" data-i18n="hintBtn">💡 Tips</button>
    <button id="repositionBtn" class="action-btn"><span data-i18n="repositionBtn">↔️ Förflytta</span> <span class="cost-badge" id="repoCostBadge">3 kvar</span></button>
    <button id="shuffleBtn" class="action-btn"><span data-i18n="shuffleBtn">🔀 Blanda om</span> <span class="cost-badge" data-i18n="shuffleCost">−1 drag</span></button>
  </div>

  <div class="booster-row" aria-label="Boosters">
    <button id="extraMovesBoosterBtn" class="booster-btn" type="button"><span aria-hidden="true">＋</span><span data-i18n="extraMovesBooster">Extra drag</span><strong id="extraMovesBoosterCount">0</strong></button>
    <button id="shuffleBoosterBtn" class="booster-btn" type="button"><span aria-hidden="true">🔀</span><span data-i18n="shuffleBooster">Gratis blandning</span><strong id="shuffleBoosterCount">0</strong></button>
    <button id="removeBoosterBtn" class="booster-btn" type="button"><span aria-hidden="true">✕</span><span data-i18n="removeBooster">Ta bort bricka</span><strong id="removeBoosterCount">0</strong></button>
  </div>

  <button id="currentCharRow" style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:6px; border:none; background:transparent; cursor:pointer; padding:4px;">
    <img id="currentCharThumb" src="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;">
    <span id="currentCharText" style="font-size:12px; font-weight:800; color:var(--burgundy);"></span>
  </button>
</div>

<div class="modal-overlay show" id="mapOverlay" style="z-index:60;">
  <div class="modal-card" style="max-width:420px; max-height:88vh; overflow-y:auto; position:relative;">
    <button class="modal-close-x" id="mapBackBtn" aria-label="Tillbaka" title="Tillbaka till spelet" style="display:none;">✕</button>
    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
      <h2 style="margin:0;" data-i18n="levelMapTitle">Nivåkarta</h2>
      <button id="openCharSelectBtn" style="border:none; background:var(--cream); border-radius:20px; padding:4px 10px; font-size:11px; font-weight:800; color:var(--burgundy); cursor:pointer; display:flex; align-items:center; gap:5px;">
        <img id="charSelectThumb" src="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;display:none;"> <span data-i18n="charBtnLabel">Karaktär</span>
      </button>
    </div>
    <p style="margin-top:2px;" data-i18n="levelMapSubtitle">Spela klarade nivåer om igen när du vill — inget låses fast.</p>
    <div id="levelGrid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;"></div>
  </div>
</div>

<div class="modal-overlay" id="charSelectOverlay" style="z-index:65;">
  <div class="modal-card" style="max-width:420px; max-height:88vh; overflow-y:auto;">
    <h2 style="margin-top:0;" data-i18n="charSelectTitle">Välj din karaktär</h2>
    <p style="margin-top:-6px;" data-i18n="charSelectSubtitle">Kosmetiskt val — syns som din avatar.</p>
    <div id="charGrid" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:10px;"></div>
    <button id="closeCharSelectBtn" data-i18n="doneBtn" style="width:100%; margin-top:14px; border:none; background:var(--cream); color:var(--burgundy); font-weight:800; padding:9px; border-radius:12px; cursor:pointer;">Klar</button>
  </div>
</div>

<div class="modal-overlay" id="regionMapOverlay" style="z-index:65;">
  <div class="modal-card region-map-card">
    <h2 style="margin-top:0;" data-i18n="regionMapTitle">Frankrikes hjärta</h2>
    <p style="margin-top:-6px;" data-i18n="regionMapIntro">Arbeta mot en region i taget. Poäng du tjänar i nivåerna går till ditt valda mål.</p>
    <div id="currentTargetLine" class="current-target-line"></div>
    <p class="region-save-note" data-i18n="regionSaveNote">Du kan byta när du vill — tidigare poäng sparas.</p>
    <div id="regionGrid" style="display:flex; flex-direction:column; gap:8px; margin-top:10px;"></div>
    <div class="region-actions">
      <button id="noRegionBtn" class="button-secondary" data-i18n="noRegionBtn">Spela utan regionmål</button>
      <button id="closeRegionMapBtn" class="button-primary" data-i18n="confirmRegionBtn">Fortsätt</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="landmarkModalOverlay" style="z-index:70;">
  <div class="modal-card landmark-card" id="landmarkCard" style="position:relative; max-width:460px;">
    <button class="modal-close-x" id="landmarkCloseX" aria-label="Stäng">✕</button>
    <div class="festival-banner" id="landmarkFestivalBanner" style="display:none;">
      <strong id="landmarkFestivalTitle">Regionen är din!</strong>
      <span id="landmarkFestivalCount" class="festival-count"></span>
    </div>
    <h2 id="landmarkRegionName" style="margin-top:0;">Region</h2>
    <div class="landmark-frame" id="landmarkFrame">
      <img id="landmarkImg" loading="lazy" decoding="async" src="" alt="">
      <div class="landmark-scaffold" aria-hidden="true"></div>
    </div>
    <div id="landmarkMonumentName" class="landmark-monument"></div>
    <div id="landmarkFestivalPoints" class="festival-points" style="display:none;"></div>
    <p id="landmarkCaption" style="font-style:italic; color:var(--sage); margin:0 0 12px;"></p>
    <button id="landmarkCloseBtn" data-i18n="closeBtn" style="width:100%; border:none; background:var(--cream); color:var(--burgundy); font-weight:800; padding:12px; border-radius:12px; cursor:pointer; min-height:48px;">Stäng</button>
  </div>
</div>

<div class="modal-overlay" id="charFoundOverlay" style="z-index:75;">
  <div class="modal-card" style="position:relative; max-width:420px; text-align:center;">
    <button class="modal-close-x" id="charFoundCloseX" aria-label="Stäng">✕</button>
    <h2 id="charFoundName" style="margin-top:0;">Personnage</h2>
    <img id="charFoundImg" loading="lazy" decoding="async" src="" alt="" class="char-found-img">
    <p id="charFoundPhrase" style="font-weight:700; color:var(--burgundy);"></p>
    <button id="charFoundCloseBtn" data-i18n="closeBtn" style="width:100%; border:none; background:var(--sage); color:#fff; font-weight:800; padding:9px; border-radius:12px; cursor:pointer;">Stäng</button>
  </div>
</div>

<div class="modal-overlay" id="settingsOverlay" style="z-index:80;">
  <div class="modal-card" style="position:relative; max-width:420px; max-height:88vh; overflow-y:auto;">
    <button class="modal-close-x" id="settingsCloseX" aria-label="Stäng">✕</button>
    <h2 style="margin-top:0;" data-i18n="settingsTitle">Inställningar</h2>

    <div class="settings-section">
      <div class="settings-section-label" data-i18n="langBtnLabel">Språk</div>
      <div style="display:flex; gap:8px;">
        <button class="lang-pick-btn" data-lang="sv">🇸🇪 Svenska</button>
        <button class="lang-pick-btn" data-lang="en">🇬🇧 English</button>
        <button class="lang-pick-btn" data-lang="fr">🇫🇷 Français</button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-label" data-i18n="audioSectionLabel">Ljud &amp; musik</div>
      <label class="settings-toggle-row">
        <span data-i18n="soundLabel">🔊 Ljudeffekter</span>
        <input type="checkbox" id="soundToggle">
      </label>
      <label class="settings-slider-row">
        <span data-i18n="sfxVolumeLabel">Effektvolym</span>
        <input type="range" id="sfxVolume" min="0" max="100" step="5" value="70">
      </label>
      <label class="settings-toggle-row">
        <span data-i18n="musicLabel">🎼 Musik</span>
        <input type="checkbox" id="musicToggle">
      </label>
      <label class="settings-slider-row">
        <span data-i18n="musicVolumeLabel">Musikvolym</span>
        <input type="range" id="musicVolume" min="0" max="100" step="5" value="45">
      </label>
      <label class="settings-toggle-row">
        <span data-i18n="hapticsLabel">📳 Vibration</span>
        <input type="checkbox" id="hapticsToggle">
      </label>
    </div>
    <label class="settings-toggle-row">
      <span data-i18n="debugIdToggle">Visa bricka-ID (felsökning)</span>
      <input type="checkbox" id="debugToggleBtn">
    </label>

    <div class="settings-section">
      <div class="settings-section-label" data-i18n="howToPlayLabel">Hur man spelar</div>
      <p style="font-size:12px; line-height:1.5;" data-i18n="instructions">Klicka en bricka, sen en granne, för att byta plats. Flytta en <em>annan</em> ikon till en plats så att tre likadana hamnar i rad/kolumn — att byta två likadana ändrar inget. 4 i rad ⇒ specialbricka som rensar hela raden/kolumnen. <strong>Förflytta</strong> (begränsat antal) skjuter en bricka längs sin rad/kolumn utan att kräva en matchning — kostar 2 drag.</p>
    </div>

    <button id="settingsCloseBtn" data-i18n="closeBtn" style="width:100%; margin-top:8px; border:none; background:var(--cream); color:var(--burgundy); font-weight:800; padding:9px; border-radius:12px; cursor:pointer;">Stäng</button>
  </div>
</div>

<div class="modal-overlay" id="levelSetupOverlay" style="z-index:66;">
  <div class="modal-card" style="max-width:420px; max-height:88vh; overflow-y:auto;">
    <h2 style="margin-top:0;" id="setupLevelTitle">Nivå</h2>
    <p style="margin-top:-6px;" data-i18n="levelSetupSubtitle">Välj mål och svårighetsgrad, eller kör standard.</p>
    <div id="setupGoalPicker" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;"></div>
    <label id="hardModeRow" style="display:flex; align-items:center; gap:8px; background:#2c2440; color:#f4cf7a; border-radius:10px; padding:8px 10px; margin-top:10px; font-size:12px; font-weight:800; cursor:pointer;">
      <input type="checkbox" id="hardModeCheck">
      ☠️ Mode Merde Alors ! <span style="font-weight:600; opacity:.85; font-size:11px;" data-i18n="hardModeDesc">— ikoner som liknar varandra tillåtna samtidigt. Mycket svårare, inte omöjligt (i teorin).</span>
    </label>
    <label class="obstacle-row" style="display:flex; align-items:center; gap:8px; background:#3a3a3a; color:#dfe; border-radius:10px; padding:8px 10px; margin-top:8px; font-size:12px; font-weight:800; cursor:pointer;">
      <input type="checkbox" id="lockedObstacleCheck">
      🔒 <span data-i18n="lockedObstacleLabel">Låsta brickor</span> <span style="font-weight:600; opacity:.85; font-size:11px;" data-i18n="lockedObstacleDesc">— går inte att röra förrän en granne rensas.</span>
    </label>
    <label class="obstacle-row" style="display:flex; align-items:center; gap:8px; background:#2a4a5a; color:#dff; border-radius:10px; padding:8px 10px; margin-top:8px; font-size:12px; font-weight:800; cursor:pointer;">
      <input type="checkbox" id="twoHitObstacleCheck">
      ❄️ <span data-i18n="twoHitObstacleLabel">Dubbelträff-brickor</span> <span style="font-weight:600; opacity:.85; font-size:11px;" data-i18n="twoHitObstacleDesc">— måste matchas två gånger för att rensas.</span>
    </label>
    <label class="obstacle-row" style="display:flex; align-items:center; gap:8px; background:#3a4a2a; color:#efd; border-radius:10px; padding:8px 10px; margin-top:8px; font-size:12px; font-weight:800; cursor:pointer;">
      <input type="checkbox" id="spreaderObstacleCheck">
      🍫 <span data-i18n="spreaderObstacleLabel">Spridande hot</span> <span style="font-weight:600; opacity:.85; font-size:11px;" data-i18n="spreaderObstacleDesc">— sprider sig till grannar om den inte rensas snabbt.</span>
    </label>
    <div style="display:flex; gap:8px; margin-top:12px;">
      <button id="setupResetBtn" data-i18n="resetBtn" style="flex:1; border:none; background:var(--cream); color:var(--burgundy); font-weight:800; padding:9px; border-radius:12px; cursor:pointer;">Standard</button>
      <button id="setupStartBtn" data-i18n="startLevelBtn" style="flex:1; border:none; background:var(--sage); color:#fff; font-weight:800; padding:9px; border-radius:12px; cursor:pointer;">Starta nivå</button>
    </div>
    <button id="setupCancelBtn" data-i18n="cancelBtn" style="width:100%; margin-top:8px; border:none; background:transparent; color:var(--burgundy); font-weight:700; padding:6px; cursor:pointer; text-decoration:underline; font-size:12px;">Avbryt</button>
  </div>
</div>

<div class="modal-overlay" id="modalOverlay">
  <div class="modal-card result-card" style="position:relative;">
    <button class="modal-close-x" id="modalCloseX" aria-label="Stäng">✕</button>
    <div class="big-emoji" id="modalEmoji">🥐</div>
    <h2 id="modalTitle">Plouf!</h2>
    <p id="modalText"></p>
    <div id="resultDetails" class="result-details" style="display:none;">
      <div id="resultLevel" class="result-level"></div>
      <div id="resultStars" class="result-stars"></div>
      <div id="resultScore" class="result-score"></div>
      <div class="result-section-title" data-i18n="resultGoalsTitle">Mål</div>
      <div id="resultGoals" class="result-goals"></div>
      <div class="result-summary-row"><span id="resultMoves"></span><span id="resultBonus"></span></div>
      <div id="resultRegion" class="result-region"></div>
    </div>
    <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
      <button id="modalBtn" data-i18n="playAgainBtn">Spela igen</button>
      <button id="modalNextBtn" data-i18n="nextLevelBtn" style="display:none; background:var(--sage); box-shadow:0 3px 0 #4d6d4e;">Nästa nivå →</button>
      <button id="modalMapBtn" data-i18n="levelMapBtn" style="background:var(--board); box-shadow:0 3px 0 #1c3049;">Nivåkarta</button>
    </div>
  </div>
</div>`;
