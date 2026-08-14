// ---------------------------------------------------------
// SCROLL DETECTION — bare minimum for now.
// Watches each <section class="frame"> and marks it "active"
// when it's substantially in view. This is the foundation
// every later per-frame animation (particle field, slider,
// histogram) will hook into — nothing frame-specific lives
// here yet, just the mechanism.
// ---------------------------------------------------------

const frames = document.querySelectorAll(".frame");

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-active");
      console.log(`Frame ${entry.target.dataset.frame} is now active`);
    } else {
      entry.target.classList.remove("is-active");
    }
  });
}, {
  threshold: 0.5 // a frame counts as "active" once 50% of it is visible
});

frames.forEach(frame => observer.observe(frame));

// ---------------------------------------------------------
// FRAME 2 — swaps which .visual-state is shown, based on
// which .beat-card is currently in view. Both sides share the
// same data-state value ("meteoroid" / "meteor" / "meteorite"),
// which is how this code knows which image goes with which card
// — it never hardcodes card 1 → image 1, it matches by name.
// ---------------------------------------------------------

const beatCards = document.querySelectorAll(".beat-card");
const visualStates = document.querySelectorAll(".visual-state");

const beatObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return; // only react when a card comes INTO view

    const activeState = entry.target.dataset.state;

    visualStates.forEach(visual => {
      visual.classList.toggle("is-active", visual.dataset.state === activeState);
    });
  });
}, {
  threshold: 0.6 // switch once a card is clearly the one in focus
  // no "root" specified — defaults to the browser viewport itself,
  // since this now watches the page's own scroll, not a nested one
});

beatCards.forEach(card => beatObserver.observe(card));

// ---------------------------------------------------------
// FRAME 2b — image carousel. Watches the 3 invisible
// .carousel-trigger divs; whichever one is in view sets
// data-active on .carousel-track (which CSS uses to slide
// horizontally — see story.css) and highlights the matching
// dot. Uses data-index (a number) instead of a name like
// Frame 2's data-state, since these slides don't have a
// meaningful label — just a position, 0/1/2.
// ---------------------------------------------------------

const carouselTriggers = document.querySelectorAll(".carousel-trigger");
const carouselTrack = document.querySelector(".carousel-track");
const dots = document.querySelectorAll(".dot");

const carouselObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    const activeIndex = entry.target.dataset.index;

    carouselTrack.dataset.active = activeIndex; // triggers the CSS slide

    dots.forEach(dot => {
      dot.classList.toggle("is-active", dot.dataset.dot === activeIndex);
    });
  });
}, {
  threshold: 0.6
});

carouselTriggers.forEach(trigger => carouselObserver.observe(trigger));


// ---------------------------------------------------------
// FRAME 3 — weight-guess tool.
// Real data bounds: 0.01g (LaPaz Icefield 04531, smallest
// recorded) to 60,000,000g (Hoba, largest recorded).
// ---------------------------------------------------------

const MIN_G = 0.01;
const MAX_G = 60000000;
const logMin = Math.log10(MIN_G);
const logMax = Math.log10(MAX_G);

// converts the slider's raw 0–1000 linear position into an
// actual gram value, spread across the log scale
function sliderToGrams(sliderVal) {
  const t = sliderVal / 1000;
  const logVal = logMin + t * (logMax - logMin);
  return Math.pow(10, logVal);
}

// the reverse — given a real gram value, where should it sit
// on the axis, as a percentage from left to right? Used to
// position the 4 fixed reference lines (Coin/Brick/Car/Boulder)
function gramsToPercent(grams) {
  const logVal = Math.log10(grams);
  return ((logVal - logMin) / (logMax - logMin)) * 100;
}

// auto-switches units so huge/tiny numbers stay readable —
// nobody wants to read "60000000 g"
function formatMass(g) {
  if (g < 1) return g.toFixed(2) + ' g';
  if (g < 1000) return Math.round(g) + ' g';
  if (g < 1000000) return (g / 1000).toFixed(1) + ' kg';
  return (g / 1000000).toFixed(1) + ' kg';
}

// position the 4 reference lines at their TRUE log-scale
// locations — not evenly spaced, matching real relative mass
const referencePoints = {
  'ref-coin': 5,
  'ref-brick': 2000,
  'ref-car': 1500000,
  'ref-boulder': 60000000
};

Object.entries(referencePoints).forEach(([id, grams]) => {
  const el = document.getElementById(id);
  if (el) el.style.left = gramsToPercent(grams) + '%';
});

// wire up the slider itself
const guessSlider = document.getElementById('guess-slider');
const guessValueEl = document.getElementById('guess-value');

function updateGuessReadout() {
  const grams = sliderToGrams(parseInt(guessSlider.value));
  guessValueEl.textContent = formatMass(grams);
  window.userGuess = grams; // stored here so Frame 4 can read it later
}

guessSlider.addEventListener('input', updateGuessReadout);
updateGuessReadout(); // set the initial readout on page load

// ---------------------------------------------------------
// LOCK FRAME 3 until "Check results" is clicked.
// Blocks forward scrolling (wheel, touch, and keyboard) while
// Frame 3 is the active frame AND the reader hasn't confirmed
// their guess yet. Backward scrolling (going back up) is never
// blocked — only progressing past Frame 3 is.
// ---------------------------------------------------------

let frame3Confirmed = false;
const frame3El = document.getElementById('frame-3');

function isFrame3Active() {
  return frame3El.classList.contains('is-active');
}

window.addEventListener('wheel', (e) => {
  if (isFrame3Active() && !frame3Confirmed && e.deltaY > 0) {
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener('keydown', (e) => {
  const forwardKeys = ['ArrowDown', 'PageDown', ' '];
  if (isFrame3Active() && !frame3Confirmed && forwardKeys.includes(e.key)) {
    e.preventDefault();
  }
});

let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  const deltaY = touchStartY - e.touches[0].clientY; // positive = swiping up = scrolling forward
  if (isFrame3Active() && !frame3Confirmed && deltaY > 0) {
    e.preventDefault();
  }
}, { passive: false });

// "Check results" — unlocks Frame 3 and scrolls to Frame 4.
// The guess text/stat no longer update here — per the new
// sequencing, they're revealed together (inside .guess-callout)
// only once the bar animation finishes, not immediately.
const checkResultsBtn = document.getElementById('check-results-btn');
checkResultsBtn.addEventListener('click', () => {
  frame3Confirmed = true;
  document.getElementById('frame-4').scrollIntoView({ behavior: 'smooth' });
});


// ---------------------------------------------------------
// FRAME 4 — mass histogram + guess marker + stat callout.
// Tries your real CSV first; falls back to illustrative
// sample data (same shape, not your real numbers) if the
// file isn't in data/ yet, so nothing breaks in the meantime.
// ---------------------------------------------------------

function generateSampleMasses(n) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const logVal = logMin + Math.pow(Math.random(), 2.2) * (logMax - logMin);
    samples.push(Math.pow(10, logVal));
  }
  return samples;
}

// minimal manual CSV parser (no external library).
// Your real headers: name,recclass,mass(kg),mass(g),fall,year,lat,long,GeoLocation
// IMPORTANT: your file has BOTH mass(kg) and mass(g) — everything
// in this project (the slider, the reference points, the axis)
// is calibrated in GRAMS, so this must specifically target
// "mass(g)", not just any header containing "mass" (which would
// grab mass(kg) first, since it appears earlier in your columns).
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  // normalize away ALL whitespace before comparing, in case your
  // real header has a space in it somewhere ("mass (g)" vs "mass(g)")
  // that would silently defeat an exact string match
  const normalize = h => h.toLowerCase().replace(/\s+/g, '');

  let massIndex = headers.findIndex(h => normalize(h) === 'mass(g)');
  if (massIndex === -1) {
    console.warn('No exact "mass(g)" column found — falling back to first column containing "mass". Check this is actually grams, not kg.');
    massIndex = headers.findIndex(h => normalize(h).includes('mass'));
  }

  // DIAGNOSTIC — check your browser console after loading the
  // page. This tells you EXACTLY which column is being read as
  // mass, and shows the first 5 real values pulled from it, so
  // you can confirm they look like real gram values (not kg).
  console.log(`Mass column detected: "${headers[massIndex]}" (column index ${massIndex})`);

  const masses = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const val = parseFloat(cols[massIndex]);
    if (!isNaN(val) && val > 0) masses.push(val);
  }

  console.log('First 5 parsed mass values:', masses.slice(0, 5));
  console.log(`Total valid mass values: ${masses.length}`);

  return masses;
}

let allMasses = [];
const histCanvas = document.getElementById('mass-histogram');
const histCtx = histCanvas.getContext('2d');
const BIN_COUNT = 40;
let binCounts = [];
let maxBinCount = 0;

fetch('data/data.csv')
  .then(res => {
    if (!res.ok) throw new Error('File not found');
    return res.text();
  })
  .then(text => {
    allMasses = parseCSV(text);
    console.log(`Loaded ${allMasses.length} real meteorite records.`);
  })
  .catch(err => {
    console.warn('Could not load data/meteorites_clean.csv — using sample data for now.', err);
    allMasses = generateSampleMasses(3000);
  })
  .then(() => {
    // bin the data once, regardless of which source it came from
    binCounts = new Array(BIN_COUNT).fill(0);
    allMasses.forEach(g => {
      const t = (Math.log10(g) - logMin) / (logMax - logMin);
      const bin = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(t * BIN_COUNT)));
      binCounts[bin]++;
    });
    maxBinCount = Math.max(...binCounts);
    resizeHistCanvas();
    dataReady = true;
    startReveal(); // in case the reader already scrolled to Frame 4 while this was loading
    updateFrame5And6(); // these don't need an animation gate — just compute once data's ready
  });

// ---------------------------------------------------------
// FRAME 5 — the SAME chart as Frame 4 (same full range, same
// bins — literally reuses binCounts/maxBinCount computed for
// Frame 4, not a separate calculation). The only differences:
// bars lighter than "Brick" are colored, the rest stay gray,
// and a labeled arrow points at the smallest recorded specimen.
// ---------------------------------------------------------

const zoomCanvas = document.getElementById('mass-histogram-zoom');
const zoomCtx = zoomCanvas.getContext('2d');
const BRICK_G = referencePoints['ref-brick']; // 2000g — same threshold used everywhere

function resizeZoomCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = zoomCanvas.getBoundingClientRect();
  zoomCanvas.width = rect.width * dpr;
  zoomCanvas.height = rect.height * dpr;
  zoomCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildZoomAxisTicks() {
  const ticksEl = document.getElementById('axis-ticks-zoom');
  ticksEl.innerHTML = '';
  [-2, 0, 2, 4, 6, 8].forEach(exp => {
    const span = document.createElement('span');
    span.innerHTML = `10<sup>${exp}</sup>`;
    ticksEl.appendChild(span);
  });
}

// which grams-value a bin's CENTER represents, on the full
// logMin/logMax scale (same one Frame 4 uses) — used to decide
// whether that bar counts as "lighter than a brick"
function binCenterGrams(binIndex) {
  const t = (binIndex + 0.5) / BIN_COUNT;
  const logVal = logMin + t * (logMax - logMin);
  return Math.pow(10, logVal);
}

function drawColoredChart(upToBin) {
  const rect = zoomCanvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const leftPad = 44;
  const chartW = w - leftPad;
  zoomCtx.clearRect(0, 0, w, h);

  // y-axis numbers — same maxBinCount Frame 4 already computed
  zoomCtx.fillStyle = '#888';
  zoomCtx.font = '11px Helvetica, Arial, sans-serif';
  zoomCtx.textAlign = 'right';
  zoomCtx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const value = Math.round((maxBinCount / 4) * i);
    const y = h - (i / 4) * (h - 10);
    zoomCtx.fillText(value.toLocaleString(), leftPad - 8, y);
  }

  // bars — colored teal if lighter than a brick, gray otherwise
  const barW = chartW / BIN_COUNT;
  for (let i = 0; i <= upToBin && i < BIN_COUNT; i++) {
    const barH = maxBinCount ? (binCounts[i] / maxBinCount) * (h - 10) : 0;
    zoomCtx.fillStyle = (binCenterGrams(i) < BRICK_G) ? '#3F6B6B' : '#ddd';
    zoomCtx.fillRect(leftPad + i * barW + 1, h - barH, barW - 2, barH);
  }

  // Brick reference line, for orientation (same position Frame 4 shows it at)
  zoomCtx.strokeStyle = '#E85D9C';
  zoomCtx.lineWidth = 1;
  zoomCtx.setLineDash([4, 3]);
  const brickX = leftPad + (gramsToPercent(BRICK_G) / 100) * chartW;
  zoomCtx.beginPath();
  zoomCtx.moveTo(brickX, 12);
  zoomCtx.lineTo(brickX, h);
  zoomCtx.stroke();
  zoomCtx.setLineDash([]);
  zoomCtx.fillStyle = '#333';
  zoomCtx.font = '10px Helvetica, Arial, sans-serif';
  zoomCtx.textAlign = 'center';
  zoomCtx.textBaseline = 'bottom';
  zoomCtx.fillText('Brick (2kg)', brickX, 10);

  // arrow + label pointing at the leftmost bar (smallest specimen)
  if (upToBin >= BIN_COUNT - 1) {
    const barX = leftPad + barW / 2; // center of the first bar
    const labelX = leftPad + 90;
    const labelY = 40;

    zoomCtx.strokeStyle = '#1C1C1C';
    zoomCtx.lineWidth = 1.5;
    zoomCtx.beginPath();
    zoomCtx.moveTo(labelX, labelY);
    zoomCtx.lineTo(barX + 6, labelY + 24);
    zoomCtx.stroke();

    // arrowhead
    zoomCtx.beginPath();
    zoomCtx.moveTo(barX + 6, labelY + 24);
    zoomCtx.lineTo(barX + 1, labelY + 16);
    zoomCtx.lineTo(barX + 11, labelY + 18);
    zoomCtx.closePath();
    zoomCtx.fillStyle = '#1C1C1C';
    zoomCtx.fill();

    zoomCtx.fillStyle = '#1C1C1C';
    zoomCtx.font = 'bold 11px Helvetica, Arial, sans-serif';
    zoomCtx.textAlign = 'left';
    zoomCtx.textBaseline = 'bottom';
    zoomCtx.fillText('Smallest ever recorded:', labelX, labelY - 4);
    zoomCtx.font = '11px Helvetica, Arial, sans-serif';
    zoomCtx.fillText('LaPaz Icefield 04531 — 0.01g', labelX, labelY + 10);
  }
}

let zoomRevealed = false;
let frame5InView = false;

function startZoomReveal() {
  if (zoomRevealed || !frame5InView || binCounts.length === 0) return;
  zoomRevealed = true;

  resizeZoomCanvas();
  buildZoomAxisTicks();

  let bin = 0;
  function revealNext() {
    drawColoredChart(bin);
    bin++;
    if (bin < BIN_COUNT) {
      const progress = bin / BIN_COUNT;
      const delay = 40 * (1 - progress) + 4;
      setTimeout(revealNext, delay);
    } else {
      drawColoredChart(BIN_COUNT); // final frame — triggers the arrow to draw too
    }
  }
  revealNext();
}

const frame5Observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      frame5InView = true;
      startZoomReveal();
    }
  });
}, { threshold: 0.4 });

frame5Observer.observe(document.getElementById('frame-5'));

// click-to-reveal the smallest specimen's popup — the arrow
// already labels it, this is just a bonus interaction
zoomCanvas.addEventListener('click', (event) => {
  const rect = zoomCanvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const leftPad = 44;
  const barW = (rect.width - leftPad) / BIN_COUNT;

  if (clickX >= leftPad && clickX <= leftPad + barW) {
    document.getElementById('smallest-popup').classList.add('is-visible');
  }
});

window.addEventListener('resize', () => {
  if (zoomRevealed) {
    resizeZoomCanvas();
    drawColoredChart(BIN_COUNT);
  }
});

// ---------------------------------------------------------
// FRAME 5 & 6 — stats computed once from the real data:
// brick %, the median, and how many times heavier Hoba is
// than that median. No IntersectionObserver needed here —
// unlike Frame 4's animated reveal, these are just text/
// position updates, cheap enough to do as soon as data loads,
// regardless of which frame the reader is currently on.
// ---------------------------------------------------------

function getMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function updateFrame5And6() {
  if (allMasses.length === 0) return;

  // --- Frame 5: brick percentage ---
  const brickThreshold = referencePoints['ref-brick']; // reuse the SAME 2000g value used everywhere else
  const lighterThanBrick = allMasses.filter(g => g < brickThreshold).length;
  const brickPct = Math.round((lighterThanBrick / allMasses.length) * 100);
  document.getElementById('brick-pct-2').textContent = brickPct;

  // --- Frame 6: median vs. Hoba ---
  const median = getMedian(allMasses);
  const HOBA_MASS = 60000000;
  const multiplier = Math.round(HOBA_MASS / median);

  document.getElementById('hoba-multiplier').textContent = multiplier.toLocaleString();
  document.getElementById('median-value-label').textContent = formatMass(median);

  // position the two markers on the axis using the SAME
  // gramsToPercent() function already used for Frame 3/4
  const medianMarker = document.getElementById('marker-median');
  const hobaMarker = document.getElementById('marker-hoba');
  if (medianMarker) medianMarker.style.left = gramsToPercent(median) + '%';
  if (hobaMarker) hobaMarker.style.left = gramsToPercent(HOBA_MASS) + '%';
}

function resizeHistCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = histCanvas.getBoundingClientRect();
  histCanvas.width = rect.width * dpr;
  histCanvas.height = rect.height * dpr;
  histCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawBars(upToBin, showGuessLine) {
  const rect = histCanvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const leftPad = 44; // room for y-axis number labels on the left
  const chartW = w - leftPad;
  histCtx.clearRect(0, 0, w, h);

  // --- Y-AXIS: 5 evenly spaced tick marks (0 to maxBinCount) ---
  histCtx.fillStyle = '#888';
  histCtx.font = '11px Helvetica, Arial, sans-serif';
  histCtx.textAlign = 'right';
  histCtx.textBaseline = 'middle';

  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const value = Math.round((maxBinCount / tickCount) * i);
    const y = h - (i / tickCount) * (h - 10);
    histCtx.fillText(value.toLocaleString(), leftPad - 8, y);
  }

  // --- BARS (shifted right by leftPad to make room for the labels) ---
  const barW = chartW / BIN_COUNT;
  histCtx.fillStyle = '#ddd';
  for (let i = 0; i <= upToBin && i < BIN_COUNT; i++) {
    const barH = maxBinCount ? (binCounts[i] / maxBinCount) * (h - 10) : 0;
    histCtx.fillRect(leftPad + i * barW + 1, h - barH, barW - 2, barH);
  }

  // --- REFERENCE LINES (Coin/Brick/Car/Boulder) — same points
  // used in Frame 3's slider, drawn here as dashed guides so
  // the reader can compare the real distribution against the
  // same vocabulary they guessed with ---
  histCtx.strokeStyle = '#E85D9C';
  histCtx.lineWidth = 1;
  histCtx.setLineDash([4, 3]);
  histCtx.fillStyle = '#333';
  histCtx.font = '10px Helvetica, Arial, sans-serif';
  histCtx.textAlign = 'center';
  histCtx.textBaseline = 'bottom';

  const refLabels = { 'ref-coin': 'Coin ~5g', 'ref-brick': 'Brick ~2kg', 'ref-car': 'Car ~1500kg', 'ref-boulder': 'Boulder ~60000kg' };
  Object.entries(referencePoints).forEach(([id, grams]) => {
    const x = leftPad + (gramsToPercent(grams) / 100) * chartW;
    histCtx.beginPath();
    histCtx.moveTo(x, 12);
    histCtx.lineTo(x, h);
    histCtx.stroke();
    histCtx.fillText(refLabels[id], x, 10);
  });
  histCtx.setLineDash([]); // reset — otherwise the guess line below would ALSO be dashed

  // guess marker drawn LAST so it's always on top — bold and
  // solid, deliberately more visually dominant than the bars
  // and the (dashed, muted) reference lines above
  if (showGuessLine && window.userGuess) {
    const x = leftPad + (gramsToPercent(window.userGuess) / 100) * chartW;
    histCtx.strokeStyle = '#E85D9C';
    histCtx.lineWidth = 3;
    histCtx.beginPath();
    histCtx.moveTo(x, 0);
    histCtx.lineTo(x, h);
    histCtx.stroke();
  }
}

// accelerating reveal (the "Speed-Up" pattern) — delay between
// bars SHRINKS as it progresses: starts ~40ms apart, ends ~4ms
// apart, so it feels like it's rushing toward the full picture
let revealed = false;
let frame4InView = false;      // true once the reader has scrolled to Frame 4
let dataReady = false;         // true once binCounts has been computed

function startReveal() {
  // only proceed once BOTH conditions are true — whichever one
  // finishes last is what actually kicks off the reveal. This
  // fixes the original bug: previously, if this ran before the
  // data had loaded, it gave up permanently and never tried
  // again once the data DID arrive.
  if (revealed || !frame4InView || !dataReady) return;
  revealed = true;

  let bin = 0;
  function revealNext() {
    drawBars(bin, false);
    bin++;
    if (bin < BIN_COUNT) {
      const progress = bin / BIN_COUNT;
      const delay = 40 * (1 - progress) + 4;
      setTimeout(revealNext, delay);
    } else {
      updateGuessDisplay(); // draws final bars+line AND fills the callout
    }
  }
  revealNext();
}

// draws the full chart (bars + guess line) using whatever
// window.userGuess currently is, and refreshes the callout
// text to match. Separated from startReveal() so it can be
// called again LATER without replaying the bar animation —
// e.g. if the reader goes back, changes their guess, and
// scrolls down to Frame 4 a second time.
function updateGuessDisplay() {
  drawBars(BIN_COUNT, true);
  showStatCallout();
}

function showStatCallout() {
  const guess = window.userGuess;
  const statEl = document.getElementById('stat-callout');
  const guessEl = document.getElementById('reveal-guess');
  const calloutBox = document.getElementById('guess-callout');

  if (!guess) {
    statEl.textContent = 'Scroll back up and make a guess first.';
    calloutBox.classList.add('is-visible');
    return;
  }

  guessEl.textContent = formatMass(guess);

  const lighterCount = allMasses.filter(g => g < guess).length;
  const pct = Math.round((lighterCount / allMasses.length) * 100);
  statEl.textContent = `${pct}% of recorded meteorites are lighter than this.`;

  // reveal the box NOW — after both lines are already filled in,
  // so it never flashes empty/placeholder text before fading in
  calloutBox.classList.add('is-visible');
}

// mark Frame 4 as "in view". First time: play the full animated
// reveal. Every time AFTER that: skip the animation (it already
// played once) but still refresh the guess line + callout text,
// in case the reader changed their guess and came back.
const frame4Observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      frame4InView = true;
      if (!revealed) {
        startReveal();
      } else if (dataReady) {
        updateGuessDisplay();
      }
    }
  });
}, { threshold: 0.4 });

frame4Observer.observe(document.getElementById('frame-4'));

window.addEventListener('resize', () => {
  resizeHistCanvas();
  if (revealed) drawBars(BIN_COUNT, true);
});