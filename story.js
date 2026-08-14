// ---------------------------------------------------------
// SCROLL DETECTION — bare minimum for now.
// ---------------------------------------------------------

const frames = document.querySelectorAll(".frame");

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-active");
    } else {
      entry.target.classList.remove("is-active");
    }
  });
}, { threshold: 0.5 });

frames.forEach(frame => observer.observe(frame));

// ---------------------------------------------------------
// FRAME 2 — swaps which .visual-state is shown.
// ---------------------------------------------------------

const beatCards = document.querySelectorAll(".beat-card");
const visualStates = document.querySelectorAll(".visual-state");

const beatObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const activeState = entry.target.dataset.state;
    visualStates.forEach(visual => {
      visual.classList.toggle("is-active", visual.dataset.state === activeState);
    });
  });
}, { threshold: 0.6 });

beatCards.forEach(card => beatObserver.observe(card));

// ---------------------------------------------------------
// FRAME 2b — image carousel.
// ---------------------------------------------------------

const carouselTriggers = document.querySelectorAll(".carousel-trigger");
const carouselTrack = document.querySelector(".carousel-track");
const dots = document.querySelectorAll(".dot");

//added this
const carouselObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const activeIndex = entry.target.dataset.index;
    carouselTrack.dataset.active = activeIndex;
    dots.forEach(dot => {
      dot.classList.toggle("is-active", dot.dataset.dot === activeIndex);
    });
  });
}, { threshold: 0.6 });

carouselTriggers.forEach(trigger => carouselObserver.observe(trigger));

// ---------------------------------------------------------
// FRAME 3 — weight-guess tool.
// ---------------------------------------------------------

const MIN_G = 0.01;
const MAX_G = 60000000;
const logMin = Math.log10(MIN_G);
const logMax = Math.log10(MAX_G);

function sliderToGrams(sliderVal) {
  const t = sliderVal / 1000;
  const logVal = logMin + t * (logMax - logMin);
  return Math.pow(10, logVal);
}

function gramsToPercent(grams) {
  const logVal = Math.log10(grams);
  return ((logVal - logMin) / (logMax - logMin)) * 100;
}

function formatMass(g) {
  if (g < 1) return g.toFixed(2) + ' g';
  if (g < 1000) return Math.round(g) + ' g';
  if (g < 1000000) return (g / 1000).toFixed(1) + ' kg';
  return (g / 1000000).toFixed(1) + ' t';
}

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

const guessSlider = document.getElementById('guess-slider');
const guessValueEl = document.getElementById('guess-value');

function updateGuessReadout() {
  const grams = sliderToGrams(parseInt(guessSlider.value));
  guessValueEl.textContent = formatMass(grams);
  window.userGuess = grams;
}

guessSlider.addEventListener('input', updateGuessReadout);
updateGuessReadout();

// ---------------------------------------------------------
// LOCK FRAME 3 until "Check results" is clicked.
// ---------------------------------------------------------

let frame3Confirmed = false;
const frame3El = document.getElementById('frame-3');

function isFrame3Active() {
  return frame3El.classList.contains('is-active');
}

window.addEventListener('wheel', (e) => {
  if (isFrame3Active() && !frame3Confirmed && e.deltaY > 0) e.preventDefault();
}, { passive: false });

window.addEventListener('keydown', (e) => {
  const forwardKeys = ['ArrowDown', 'PageDown', ' '];
  if (isFrame3Active() && !frame3Confirmed && forwardKeys.includes(e.key)) e.preventDefault();
});

let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  const deltaY = touchStartY - e.touches[0].clientY;
  if (isFrame3Active() && !frame3Confirmed && deltaY > 0) e.preventDefault();
}, { passive: false });

const checkResultsBtn = document.getElementById('check-results-btn');
checkResultsBtn.addEventListener('click', () => {
  frame3Confirmed = true;
  document.getElementById('frame-4').scrollIntoView({ behavior: 'smooth' });
});

// ---------------------------------------------------------
// DATA LOADING — shared by Frame 4 and Frame 5. Loaded once,
// binned once, both frames read the same binCounts/maxBinCount.
// ---------------------------------------------------------

function generateSampleMasses(n) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const logVal = logMin + Math.pow(Math.random(), 2.2) * (logMax - logMin);
    samples.push(Math.pow(10, logVal));
  }
  return samples;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const normalize = h => h.toLowerCase().replace(/\s+/g, '');

  let massIndex = headers.findIndex(h => normalize(h) === 'mass(g)');
  if (massIndex === -1) {
    console.warn('No exact "mass(g)" column found — falling back to first column containing "mass".');
    massIndex = headers.findIndex(h => normalize(h).includes('mass'));
  }

  console.log(`Mass column detected: "${headers[massIndex]}" (column index ${massIndex})`);

  const masses = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const val = parseFloat(cols[massIndex]);
    if (!isNaN(val) && val > 0) masses.push(val);
  }
  console.log(`Total valid mass values: ${masses.length}`);
  return masses;
}

let allMasses = [];
const BIN_COUNT = 40;
let binCounts = [];
let maxBinCount = 0;
let dataReady = false;

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
    console.warn('Could not load data/data.csv — using sample data for now.', err);
    allMasses = generateSampleMasses(3000);
  })
  .then(() => {
    binCounts = new Array(BIN_COUNT).fill(0);
    allMasses.forEach(g => {
      const t = (Math.log10(g) - logMin) / (logMax - logMin);
      const bin = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(t * BIN_COUNT)));
      binCounts[bin]++;
    });
    maxBinCount = Math.max(...binCounts);
    dataReady = true;
    startReveal();      // Frame 4
    startZoomReveal();  // Frame 5
    updateFrame5And6();
  });

// which grams-value a bin's CENTER represents, on the shared
// full logMin/logMax scale
function binCenterGrams(binIndex) {
  const t = (binIndex + 0.5) / BIN_COUNT;
  const logVal = logMin + t * (logMax - logMin);
  return Math.pow(10, logVal);
}

// resizes ANY canvas's actual pixel buffer to match its current
// on-screen size — called immediately before every draw, on
// BOTH charts, so neither can ever go stale relative to layout
function resizeCanvasFor(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------------------------------------------------
// SHARED HISTOGRAM DRAWING — the ONE place this logic lives.
// Both Frame 4 and Frame 5 call this exact function, on their
// own canvas, with different options — this is what guarantees
// they can never visually drift apart from each other again.
//
// opts:
//   showGuessLine     — draw the reader's guess marker (Frame 4)
//   highlightBelowGrams — color bars below this value teal (Frame 5)
//   showSmallestArrow  — draw the "smallest ever" arrow, once fully revealed (Frame 5)
// ---------------------------------------------------------
function drawHistogram(ctx, canvas, upToBin, opts = {}) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const leftPad = 44;
  const chartW = w - leftPad;
  ctx.clearRect(0, 0, w, h);

  // y-axis numbers
  ctx.fillStyle = '#888';
  ctx.font = '11px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const value = Math.round((maxBinCount / 4) * i);
    const y = h - (i / 4) * (h - 10);
    ctx.fillText(value.toLocaleString(), leftPad - 8, y);
  }

  // bars
  const barW = chartW / BIN_COUNT;
  for (let i = 0; i <= upToBin && i < BIN_COUNT; i++) {
    const barH = maxBinCount ? (binCounts[i] / maxBinCount) * (h - 10) : 0;
    let color = '#ddd';
    if (opts.highlightBelowGrams && binCenterGrams(i) < opts.highlightBelowGrams) {
      color = '#3F6B6B';
    }
    ctx.fillStyle = color;
    ctx.fillRect(leftPad + i * barW + 1, h - barH, barW - 2, barH);
  }

  // reference lines — Coin/Brick/Car/Boulder, always drawn,
  // identical on both charts since both use the same full scale
  ctx.strokeStyle = '#E85D9C';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.fillStyle = '#333';
  ctx.font = '10px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const refLabels = { 'ref-coin': 'Coin ~5g', 'ref-brick': 'Brick ~2kg', 'ref-car': 'Car ~1500kg', 'ref-boulder': 'Boulder ~60000kg' };
  Object.entries(referencePoints).forEach(([id, grams]) => {
    const x = leftPad + (gramsToPercent(grams) / 100) * chartW;
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.textAlign = (x > leftPad + chartW - 50) ? 'right' : 'center';
    ctx.fillText(refLabels[id], x, 10);
  });
  ctx.setLineDash([]);

  // guess marker — Frame 4 only
  if (opts.showGuessLine && window.userGuess) {
    const x = leftPad + (gramsToPercent(window.userGuess) / 100) * chartW;
    ctx.strokeStyle = '#E85D9C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // smallest-specimen hint — Frame 5 only, once fully revealed.
  // No arrow — just short text sitting directly above the
  // leftmost bar itself, which is naturally short (very few
  // meteorites are that tiny), leaving clear space above it
  // with nothing else to collide with.
  if (opts.showSmallestArrow && upToBin >= BIN_COUNT - 1) {
    const barX = leftPad + barW / 2;
    const firstBarH = maxBinCount ? (binCounts[0] / maxBinCount) * (h - 10) : 0;
    const hintY = h - firstBarH - 10;

    ctx.fillStyle = '#1C1C1C';
    ctx.font = 'bold 10px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Click to see smallest meteorite →', barX + 8, hintY);
  }
}

// ---------------------------------------------------------
// FRAME 4 — reveal sequence. Calls the SHARED drawHistogram().
// ---------------------------------------------------------

const histCanvas = document.getElementById('mass-histogram');
const histCtx = histCanvas.getContext('2d');
let revealed = false;
let frame4InView = false;

function startReveal() {
  if (revealed || !frame4InView || !dataReady) return;
  revealed = true;

  let bin = 0;
  function revealNext() {
    resizeCanvasFor(histCanvas, histCtx);
    drawHistogram(histCtx, histCanvas, bin, { showGuessLine: false });
    bin++;
    if (bin < BIN_COUNT) {
      const progress = bin / BIN_COUNT;
      setTimeout(revealNext, 40 * (1 - progress) + 4);
    } else {
      updateGuessDisplay();
    }
  }
  revealNext();
}

function updateGuessDisplay() {
  resizeCanvasFor(histCanvas, histCtx);
  drawHistogram(histCtx, histCanvas, BIN_COUNT, { showGuessLine: true });
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
  calloutBox.classList.add('is-visible');
}

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

// ---------------------------------------------------------
// FRAME 5 — reveal sequence. Calls the SAME shared
// drawHistogram() as Frame 4 — same bars, same reference
// lines, same axis — with bars below "Brick" colored teal
// and an arrow pointing at the smallest specimen.
// ---------------------------------------------------------

const zoomCanvas = document.getElementById('mass-histogram-zoom');
const zoomCtx = zoomCanvas.getContext('2d');
const BRICK_G = referencePoints['ref-brick'];
let zoomRevealed = false;
let frame5InView = false;

function drawZoomFinal() {
  resizeCanvasFor(zoomCanvas, zoomCtx);
  drawHistogram(zoomCtx, zoomCanvas, BIN_COUNT, {
    highlightBelowGrams: BRICK_G,
    showSmallestArrow: true
  });
}

function startZoomReveal() {
  if (zoomRevealed || !frame5InView || !dataReady) return;
  zoomRevealed = true;

  let bin = 0;
  function revealNext() {
    resizeCanvasFor(zoomCanvas, zoomCtx);
    drawHistogram(zoomCtx, zoomCanvas, bin, { highlightBelowGrams: BRICK_G });
    bin++;
    if (bin < BIN_COUNT) {
      const progress = bin / BIN_COUNT;
      setTimeout(revealNext, 40 * (1 - progress) + 4);
    } else {
      drawZoomFinal();
      // safety re-check in case layout shifts right after (late-loading fonts, etc.)
      setTimeout(drawZoomFinal, 200);
    }
  }
  revealNext();
}

const frame5Observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      frame5InView = true;
      if (!zoomRevealed) {
        startZoomReveal();
      } else {
        drawZoomFinal();
      }
    }
  });
}, { threshold: 0.4 });

frame5Observer.observe(document.getElementById('frame-5'));

zoomCanvas.addEventListener('click', (event) => {
  const rect = zoomCanvas.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const leftPad = 44;
  const barW = (rect.width - leftPad) / BIN_COUNT;
  if (clickX >= leftPad && clickX <= leftPad + barW) {
    document.getElementById('smallest-popup').classList.add('is-visible');
  }
});

// ---------------------------------------------------------
// FRAME 5 & 6 — stats computed once from the real data.
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

  const brickThreshold = referencePoints['ref-brick'];
  const lighterThanBrick = allMasses.filter(g => g < brickThreshold).length;
  const brickPct = Math.round((lighterThanBrick / allMasses.length) * 100);
  const brickPctEl = document.getElementById('brick-pct-2');
  if (brickPctEl) brickPctEl.textContent = brickPct;

  const median = getMedian(allMasses);
  const HOBA_MASS = 60000000;
  const multiplier = Math.round(HOBA_MASS / median);

  const multEl = document.getElementById('hoba-multiplier');
  const medEl = document.getElementById('median-value-label');
  if (multEl) multEl.textContent = multiplier.toLocaleString();
  if (medEl) medEl.textContent = formatMass(median);

  const medianMarker = document.getElementById('marker-median');
  const hobaMarker = document.getElementById('marker-hoba');
  if (medianMarker) medianMarker.style.left = gramsToPercent(median) + '%';
  if (hobaMarker) hobaMarker.style.left = gramsToPercent(HOBA_MASS) + '%';
}

// ---------------------------------------------------------
// RESIZE — redraws whichever chart(s) have already revealed
// ---------------------------------------------------------
window.addEventListener('resize', () => {
  if (revealed) {
    resizeCanvasFor(histCanvas, histCtx);
    drawHistogram(histCtx, histCanvas, BIN_COUNT, { showGuessLine: true });
  }
  if (zoomRevealed) {
    drawZoomFinal();
  }
});