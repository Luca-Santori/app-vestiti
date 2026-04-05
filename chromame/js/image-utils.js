/* ══════════════════════════════════════════════════════
   IMAGE UTILITIES
   ══════════════════════════════════════════════════════ */

/**
 * Load image from File, downscale to MAX_IMG_WIDTH.
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
 * @param {number} maxW
 * @returns {{width:number, height:number}}
 */
function drawImageScaled(img, canvas, maxW) {
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

/**
 * Sample pixels within an elliptical region from ImageData.
 * Returns average RGB or null if too few valid pixels.
 * @param {ImageData} imgData
 * @param {number} cx - center x
 * @param {number} cy - center y
 * @param {number} rx - radius x
 * @param {number} ry - radius y
 * @param {object} opts - {minAlpha, minLum, maxLum, skipLowLum}
 * @returns {{r:number,g:number,b:number,count:number}|null}
 */
function sampleEllipse(imgData, cx, cy, rx, ry, opts = {}) {
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
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a < minAlpha) continue;
      const lum = getLuminance(r, g, b);
      if (skipLowLum && lum < minLum) continue;
      if (lum > maxLum) continue;
      sr += r; sg += g; sb += b; count++;
    }
  }
  if (count < 5) return null;
  return { r: Math.round(sr/count), g: Math.round(sg/count), b: Math.round(sb/count), count };
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
