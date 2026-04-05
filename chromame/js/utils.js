/* ═══════════════════════════════════════════════════════
   ChromaMe — Utilities (image, canvas, progress, sampling)
   ═══════════════════════════════════════════════════════ */

(function() {

/* ── Global State ───────────────────────────────────── */
// STATE is already defined in constants.js as CM.STATE

/* ── Image Loading ──────────────────────────────────── */

/**
 * Load image from File object.
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Impossibile caricare l\'immagine'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Errore di lettura file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Draw image onto canvas, auto-downscale to max width.
 * @param {HTMLImageElement} img
 * @param {HTMLCanvasElement} canvas
 * @param {number} [maxW=MAX_IMG_WIDTH]
 * @returns {{width:number,height:number}}
 */
function drawImageScaled(img, canvas, maxW) {
  maxW = maxW || CM.MAX_IMG_WIDTH;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > maxW) {
    const ratio = maxW / w;
    w = maxW; h = Math.round(h * ratio);
  }
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return { width: w, height: h };
}

/* ── Elliptical Pixel Sampling ──────────────────────── */

/**
 * Sample pixels within an elliptical region from ImageData.
 * @param {ImageData} imgData
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {number} rx - radius x
 * @param {number} ry - radius y
 * @param {object} opts - {minAlpha, minLum, maxLum, skipLowLum}
 * @returns {{r:number,g:number,b:number,count:number}|null}
 */
function sampleEllipse(imgData, cx, cy, rx, ry, opts) {
  opts = opts || {};
  const { minAlpha = 128, minLum = 30, maxLum = 230, skipLowLum = true } = opts;
  const { data, width } = imgData;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(imgData.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(imgData.height - 1, Math.ceil(cy + ry));
  let sr = 0, sg = 0, sb = 0, count = 0;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = (px - cx) / rx;
      const dy = (py - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const i = (py * width + px) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < minAlpha) continue;
      const lum = CM.getLuminance(r, g, b);
      if (skipLowLum && lum < minLum) continue;
      if (lum > maxLum) continue;
      sr += r; sg += g; sb += b; count++;
    }
  }
  if (count < 5) return null;
  return { r: Math.round(sr / count), g: Math.round(sg / count), b: Math.round(sb / count), count };
}

/**
 * Draw a dashed ellipse outline on a canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {string} color
 */
function drawEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ── Progress System ────────────────────────────────── */

/**
 * Initialize step dots for a progress area.
 * @param {string} prefix - e.g. 'armo'
 * @param {number} totalSteps
 */
function initProgress(prefix, totalSteps) {
  const dotsEl = document.getElementById(`${prefix}-dots`);
  dotsEl.innerHTML = '';
  for (let i = 0; i < totalSteps; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dotsEl.appendChild(dot);
  }
  document.getElementById(`${prefix}-bar`).style.width = '0%';
  document.getElementById(`${prefix}-log`).textContent = '';
  document.getElementById(`${prefix}-progress`).classList.add('active');
}

/**
 * Update step progress (fill dots + bar).
 * @param {string} prefix
 * @param {number} step - current (1-based)
 * @param {number} total
 */
function setStep(prefix, step, total) {
  const dots = document.getElementById(`${prefix}-dots`).children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('filled', i < step);
  }
  document.getElementById(`${prefix}-bar`).style.width = `${Math.round(step / total * 100)}%`;
}

/**
 * Set log message in progress area.
 * @param {string} prefix
 * @param {string} msg
 */
function setLog(prefix, msg) {
  document.getElementById(`${prefix}-log`).textContent = msg;
}

/**
 * Small async delay for UI responsiveness.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

// Expose on global namespace
CM.loadImage = loadImage;
CM.drawImageScaled = drawImageScaled;
CM.sampleEllipse = sampleEllipse;
CM.drawEllipse = drawEllipse;
CM.initProgress = initProgress;
CM.setStep = setStep;
CM.setLog = setLog;
CM.wait = wait;

})();
