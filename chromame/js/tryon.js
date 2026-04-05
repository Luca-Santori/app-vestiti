/* ═══════════════════════════════════════════════════════
   ChromaMe — Modulo 3: Virtual Try-On
   Composizione persona + capo con effetti di blending
   ═══════════════════════════════════════════════════════ */

(function() {

var TRYON_WIDTH = CM.TRYON_WIDTH, TRYON_HEIGHT = CM.TRYON_HEIGHT;
var BG_REMOVAL_THRESHOLD = CM.BG_REMOVAL_THRESHOLD;
var SHARPENING_STRENGTH = CM.SHARPENING_STRENGTH, SAT_BOOST = CM.SAT_BOOST;
var rgbToHsl = CM.rgbToHsl, hslToRgb = CM.hslToRgb;
var initProgress = CM.initProgress, setStep = CM.setStep, setLog = CM.setLog, wait = CM.wait;

/**
 * Remove background from garment image data (in-place).
 * Samples 5 corner pixels, averages as BG, sets similar pixels to transparent.
 * Applies 3px edge feathering.
 * @param {ImageData} data
 */
function removeBackground(data) {
  const d = data.data;
  const w = data.width;
  // Sample 5 corner pixels from top-left 20x20
  const sampleCoords = [[2, 2], [5, 8], [12, 3], [17, 15], [8, 18]];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [sx, sy] of sampleCoords) {
    const x = Math.min(sx, w - 1);
    const y = Math.min(sy, data.height - 1);
    const i = (y * w + x) * 4;
    bgR += d[i]; bgG += d[i + 1]; bgB += d[i + 2];
  }
  bgR = Math.round(bgR / 5); bgG = Math.round(bgG / 5); bgB = Math.round(bgB / 5);

  // Remove pixels close to background
  for (let i = 0; i < d.length; i += 4) {
    const diff = Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB);
    if (diff < BG_REMOVAL_THRESHOLD) d[i + 3] = 0;
  }

  // 3px edge feathering
  const alpha = new Uint8Array(data.width * data.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
  for (let y = 0; y < data.height; y++) {
    for (let x = 0; x < data.width; x++) {
      const idx = y * data.width + x;
      if (alpha[idx] === 0) continue;
      let nearEdge = false;
      for (let dy = -3; dy <= 3 && !nearEdge; dy++) {
        for (let dx = -3; dx <= 3 && !nearEdge; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < data.width && ny >= 0 && ny < data.height) {
            if (alpha[ny * data.width + nx] === 0) nearEdge = true;
          }
        }
      }
      if (nearEdge) {
        let minD = 3;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < data.width && ny >= 0 && ny < data.height) {
              if (alpha[ny * data.width + nx] === 0) {
                const dd = Math.sqrt(dx * dx + dy * dy);
                if (dd < minD) minD = dd;
              }
            }
          }
        }
        d[idx * 4 + 3] = Math.round(d[idx * 4 + 3] * (minD / 3));
      }
    }
  }
}

/**
 * Apply sharpening via 3x3 unsharp mask.
 * @param {ImageData} data
 * @param {number} strength
 */
function applySharpen(data, strength) {
  const d = data.data;
  const w = data.width, h = data.height;
  const orig = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const neighbors =
          orig[((y - 1) * w + x - 1) * 4 + c] + orig[((y - 1) * w + x) * 4 + c] + orig[((y - 1) * w + x + 1) * 4 + c] +
          orig[(y * w + x - 1) * 4 + c] + orig[(y * w + x + 1) * 4 + c] +
          orig[((y + 1) * w + x - 1) * 4 + c] + orig[((y + 1) * w + x) * 4 + c] + orig[((y + 1) * w + x + 1) * 4 + c];
        const avg = neighbors / 8;
        const diff = orig[i + c] - avg;
        d[i + c] = Math.max(0, Math.min(255, Math.round(orig[i + c] + diff * strength)));
      }
    }
  }
}

/**
 * Boost saturation of ImageData by a percentage.
 * @param {ImageData} data
 * @param {number} boost - e.g. 0.10 for +10%
 */
function boostSaturation(data, boost) {
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const hsl = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    hsl.s = Math.min(100, hsl.s * (1 + boost));
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    d[i] = rgb.r; d[i + 1] = rgb.g; d[i + 2] = rgb.b;
  }
}

/**
 * Full try-on pipeline (5 steps).
 */
async function runTryon() {
  var STATE = CM.STATE;
  const opacityVal = parseInt(document.getElementById('tryon-opacity').value) / 100;
  const contrastVal = parseInt(document.getElementById('tryon-contrast').value) / 100;
  const blendMode = document.getElementById('tryon-blend').value;
  const totalSteps = 5;

  initProgress('tryon', totalSteps);

  // STEP 1 — Normalize
  setStep('tryon', 1, totalSteps);
  setLog('tryon', 'Normalizzazione immagini...');
  await wait(80);

  const personCanvas = document.createElement('canvas');
  personCanvas.width = TRYON_WIDTH; personCanvas.height = TRYON_HEIGHT;
  personCanvas.getContext('2d').drawImage(STATE.tryonPersonImage, 0, 0, TRYON_WIDTH, TRYON_HEIGHT);

  const garmentCanvas = document.createElement('canvas');
  garmentCanvas.width = TRYON_WIDTH; garmentCanvas.height = TRYON_HEIGHT;
  const gCtx = garmentCanvas.getContext('2d');
  gCtx.drawImage(STATE.tryonGarmentImage, 0, 0, TRYON_WIDTH, TRYON_HEIGHT);

  setLog('tryon', `Normalizzato a ${TRYON_WIDTH}×${TRYON_HEIGHT}px`);
  await wait(300);

  // STEP 2 — Background removal
  setStep('tryon', 2, totalSteps);
  setLog('tryon', 'Rimozione sfondo capo...');
  await wait(80);

  const gData = gCtx.getImageData(0, 0, TRYON_WIDTH, TRYON_HEIGHT);
  removeBackground(gData);
  gCtx.putImageData(gData, 0, 0);

  setLog('tryon', 'Sfondo rimosso con feathering bordi');
  await wait(300);

  // STEP 3 — Contrast correction
  setStep('tryon', 3, totalSteps);
  setLog('tryon', `Correzione contrasto (${Math.round(contrastVal * 100)}%)...`);
  await wait(80);

  const contrastCanvas = document.createElement('canvas');
  contrastCanvas.width = TRYON_WIDTH; contrastCanvas.height = TRYON_HEIGHT;
  const ccCtx = contrastCanvas.getContext('2d');
  ccCtx.filter = `contrast(${contrastVal})`;
  ccCtx.drawImage(garmentCanvas, 0, 0);
  ccCtx.filter = 'none';

  setLog('tryon', 'Contrasto applicato');
  await wait(300);

  // STEP 4 — Composite
  setStep('tryon', 4, totalSteps);
  setLog('tryon', `Composizione con blend mode: ${blendMode}...`);
  await wait(80);

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = TRYON_WIDTH; resultCanvas.height = TRYON_HEIGHT;
  const rCtx = resultCanvas.getContext('2d');

  rCtx.globalAlpha = 1;
  rCtx.drawImage(personCanvas, 0, 0);
  rCtx.globalAlpha = opacityVal;
  rCtx.globalCompositeOperation = blendMode;
  rCtx.drawImage(contrastCanvas, 0, 0);
  rCtx.globalAlpha = 1;
  rCtx.globalCompositeOperation = 'source-over';

  setLog('tryon', 'Composizione completata');
  await wait(300);

  // STEP 5 — Post-processing
  setStep('tryon', 5, totalSteps);
  setLog('tryon', 'Post-processing (sharpening + saturazione)...');
  await wait(80);

  const finalData = rCtx.getImageData(0, 0, TRYON_WIDTH, TRYON_HEIGHT);
  applySharpen(finalData, SHARPENING_STRENGTH);
  boostSaturation(finalData, SAT_BOOST);
  rCtx.putImageData(finalData, 0, 0);

  setLog('tryon', 'Post-processing completato ✓');
  await wait(200);

  renderTryonResults(resultCanvas, blendMode, opacityVal);

  document.getElementById('tryon-progress').classList.remove('active');
  setLog('tryon', 'Prova completata ✓');
}

/**
 * Render try-on results into DOM.
 * @param {HTMLCanvasElement} resultCanvas
 * @param {string} blendMode
 * @param {number} opacityVal 0-1
 */
function renderTryonResults(resultCanvas, blendMode, opacityVal) {
  const el = document.getElementById('tryon-results');
  el.innerHTML = '';

  const displayCanvas = document.createElement('canvas');
  displayCanvas.className = 'result-canvas';
  displayCanvas.width = TRYON_WIDTH;
  displayCanvas.height = TRYON_HEIGHT;
  displayCanvas.getContext('2d').drawImage(resultCanvas, 0, 0);
  el.appendChild(displayCanvas);

  const metricsGrid = document.createElement('div');
  metricsGrid.className = 'results-grid mt-16';
  metricsGrid.innerHTML = `
    <div class="card">
      <p class="text-xs text-muted mb-8">Blend mode</p>
      <div style="font-size:18px;font-weight:500;">${blendMode}</div>
    </div>
    <div class="card">
      <p class="text-xs text-muted mb-8">Opacità applicata</p>
      <div style="font-size:18px;font-weight:500;">${Math.round(opacityVal * 100)}%</div>
    </div>
    <div class="full-width" style="text-align:center;margin-top:12px;">
      <button class="btn-secondary" id="tryon-download">Scarica risultato ⬇</button>
    </div>
    <div class="tip-card full-width">
      <strong>Consiglio fotografico</strong>
      <p class="mt-8 text-sm">Per risultati migliori, usa foto con sfondo uniforme e il capo su sfondo bianco o chiaro. L'illuminazione naturale garantisce colori più accurati.</p>
    </div>
  `;
  el.appendChild(metricsGrid);

  document.getElementById('tryon-download').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'chromame-tryon.png';
    link.href = displayCanvas.toDataURL('image/png');
    link.click();
  });

  el.classList.add('visible');
}

CM.runTryon = runTryon;

})();
