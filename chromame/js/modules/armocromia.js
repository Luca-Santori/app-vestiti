/* ══════════════════════════════════════════════════════
   MODULE 1 — ARMOCROMIA
   ══════════════════════════════════════════════════════ */

import { hexToRgb, rgbToLab, rgbToHex, fitzpatrick } from '../utils/color.js';
import { drawEllipse, sampleEllipse } from '../utils/image.js';
import { SEASONS } from '../data/seasons.js';
import { initProgress, setStep, setLog, wait } from '../ui/progress.js';
import { ensureFaceApi } from '../faceApi.js';
import { FACE_SCORE_THRESHOLD } from '../config.js';
import { deltaECIE2000 } from '../utils/color.js';

/**
 * Map undertone + skin L* + hair contrast to a 12-season.
 * @param {string} undertone - 'warm'|'cool'|'neutral'
 * @param {number} skinL - skin L* (0-100)
 * @param {number} deltaL - |skinL - estimatedHairL|
 * @returns {string} season name
 */
export function mapSeasonSimple(undertone, skinL, deltaL) {
  const contrast = deltaL > 30 ? 'high' : deltaL > 15 ? 'medium' : 'low';
  if (undertone === 'warm') {
    if (skinL > 70) return contrast === 'low' ? 'Light Spring' : 'True Spring';
    if (skinL > 58) return contrast === 'high' ? 'True Spring' : 'Warm Spring';
    if (skinL > 45) return contrast === 'high' ? 'True Autumn' : 'Soft Autumn';
    return contrast === 'high' ? 'Dark Autumn' : 'True Autumn';
  }
  if (undertone === 'cool') {
    if (skinL > 70) return contrast === 'low' ? 'Light Summer' : 'True Summer';
    if (skinL > 58) return contrast === 'low' ? 'Soft Summer' : 'True Summer';
    if (skinL > 45) return contrast === 'high' ? 'True Winter' : 'Dark Winter';
    return contrast === 'high' ? 'Bright Winter' : 'Dark Winter';
  }
  // neutral
  if (skinL > 65) return contrast === 'low' ? 'Light Summer' : 'Soft Summer';
  if (skinL > 52) return 'Soft Autumn';
  return contrast === 'high' ? 'True Winter' : 'Soft Autumn';
}

/**
 * Full armocromia analysis pipeline (6 steps).
 */
export async function runArmocromia() {
  const canvas = document.getElementById('armo-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const garmentHex = document.getElementById('armo-hex').value;
  const totalSteps = 6;

  initProgress('armo', totalSteps);

  // STEP 1 — Face detection
  setStep('armo', 1, totalSteps);
  setLog('armo', 'Rilevamento viso con AI...');
  await wait(80);

  let faceCx = w / 2, faceCy = h * 0.35;
  let faceDetected = false;
  try {
    await ensureFaceApi();
    const detection = await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: FACE_SCORE_THRESHOLD }));
    if (detection) {
      const box = detection.box;
      faceCx = box.x + box.width / 2;
      faceCy = box.y + box.height / 2;
      faceDetected = true;
      // Draw detection rect
      ctx.save();
      ctx.strokeStyle = 'rgba(200,129,138,0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.restore();
    }
  } catch(e) {
    console.warn('Face detection fallback:', e);
  }
  setLog('armo', faceDetected ? 'Viso rilevato ✓' : 'Viso non rilevato, uso centro immagine');
  await wait(300);

  // STEP 2 — Skin pixel extraction
  setStep('armo', 2, totalSteps);
  setLog('armo', 'Estrazione colore pelle...');
  await wait(80);

  const imgData = ctx.getImageData(0, 0, w, h);
  const cheekCy = faceCy + h * 0.05;
  const rx = w * 0.08, ry = h * 0.05;

  // Draw sampling ellipse
  drawEllipse(ctx, faceCx, cheekCy, rx, ry, 'rgba(200,129,138,0.6)');

  let skin = sampleEllipse(imgData, faceCx, cheekCy, rx, ry, { minAlpha: 128, minLum: 30, maxLum: 230 });
  if (!skin) skin = { r: 210, g: 180, b: 160, count: 0 };

  setLog('armo', `Pelle: RGB(${skin.r}, ${skin.g}, ${skin.b}) — ${skin.count} pixel`);
  await wait(300);

  // STEP 3 — LAB conversion + undertone
  setStep('armo', 3, totalSteps);
  setLog('armo', 'Conversione CIE LAB e analisi sottotono...');
  await wait(80);

  const skinLab = rgbToLab(skin.r, skin.g, skin.b);
  let undertone, undertoneLabel;
  if (skinLab.a > 8 && skinLab.b > 12) { undertone = 'warm'; undertoneLabel = 'Caldo'; }
  else if (skinLab.a < 6 && skinLab.b < 10) { undertone = 'cool'; undertoneLabel = 'Freddo'; }
  else { undertone = 'neutral'; undertoneLabel = 'Neutro'; }

  setLog('armo', `Sottotono: ${undertoneLabel} (a*=${skinLab.a.toFixed(1)}, b*=${skinLab.b.toFixed(1)})`);
  await wait(300);

  // STEP 4 — Season mapping
  setStep('armo', 4, totalSteps);
  setLog('armo', 'Mappatura stagione cromatica...');
  await wait(80);

  const estimatedHairDelta = skinLab.L > 60 ? 25 : 15;
  const season = mapSeasonSimple(undertone, skinLab.L, estimatedHairDelta);
  const seasonData = SEASONS[season];

  setLog('armo', `Stagione: ${season}`);
  await wait(300);

  // STEP 5 — Delta-E CIE2000
  setStep('armo', 5, totalSteps);
  setLog('armo', 'Calcolo Delta-E CIE2000 con il capo...');
  await wait(80);

  const garmentRgb = hexToRgb(garmentHex);
  const garmentLab = rgbToLab(garmentRgb.r, garmentRgb.g, garmentRgb.b);
  let minDelta = Infinity;
  for (const pHex of seasonData.palette) {
    const pRgb = hexToRgb(pHex);
    const pLab = rgbToLab(pRgb.r, pRgb.g, pRgb.b);
    const de = deltaECIE2000(garmentLab, pLab);
    if (de < minDelta) minDelta = de;
  }
  let deltaLabel;
  if (minDelta < 10) { deltaLabel = 'Armonioso'; }
  else if (minDelta <= 25) { deltaLabel = 'Neutro'; }
  else { deltaLabel = 'In contrasto'; }

  setLog('armo', `Delta-E: ${minDelta.toFixed(1)} — ${deltaLabel}`);
  await wait(300);

  // STEP 6 — Render results
  setStep('armo', 6, totalSteps);
  setLog('armo', 'Generazione risultati...');
  await wait(200);

  const fitz = fitzpatrick(skinLab.L);
  const skinHex = rgbToHex(skin.r, skin.g, skin.b);

  // Delta-E ring
  const circumference = 175.9;
  const deltaPercent = Math.min(minDelta / 50, 1);
  const offset = circumference * (1 - deltaPercent);

  const resultsEl = document.getElementById('armo-results');
  resultsEl.innerHTML = `
    <div class="results-grid">
      <div class="card">
        <p class="text-xs text-muted mb-8">Colore pelle rilevato</p>
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="swatch-circle" style="width:44px;height:44px;background:${skinHex};"></div>
          <div>
            <div style="font-weight:500;">${skinHex}</div>
            <div class="text-xs text-muted">RGB(${skin.r}, ${skin.g}, ${skin.b})</div>
          </div>
        </div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Sottotono</p>
        <div style="font-size:22px;" class="heading-display">${undertoneLabel}</div>
        <div class="text-xs text-muted mt-8">L*=${skinLab.L.toFixed(1)} a*=${skinLab.a.toFixed(1)} b*=${skinLab.b.toFixed(1)}</div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Stagione</p>
        <div style="font-size:22px;" class="heading-display">${season}</div>
        <span class="pill mt-8">${seasonData.desc}</span>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Scala Fitzpatrick</p>
        <div style="font-size:28px;" class="heading-display">Tipo ${fitz}</div>
        <div class="text-xs text-muted mt-8">Basato su luminosità L*=${skinLab.L.toFixed(1)}</div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Palette stagione</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${seasonData.palette.map(c => `<div class="swatch-sq" style="background:${c};" title="${c}"></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Delta-E CIE2000</p>
        <div class="delta-ring-container">
          <svg class="delta-ring-svg" viewBox="0 0 64 64">
            <circle class="delta-ring-bg" cx="32" cy="32" r="28"/>
            <circle class="delta-ring-fill" cx="32" cy="32" r="28"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div>
            <div style="font-size:22px;font-weight:500;">${minDelta.toFixed(1)}</div>
            <span class="pill">${deltaLabel}</span>
          </div>
        </div>
      </div>
      <div class="card full-width">
        <p class="text-xs text-muted mb-8">Metriche dettagliate</p>
        <table class="metrics-table">
          <tr><td>L* (luminosità)</td><td>${skinLab.L.toFixed(1)}</td></tr>
          <tr><td>a* (rosso-verde)</td><td>${skinLab.a.toFixed(1)}</td></tr>
          <tr><td>b* (giallo-blu)</td><td>${skinLab.b.toFixed(1)}</td></tr>
          <tr><td>Fitzpatrick</td><td>Tipo ${fitz}</td></tr>
          <tr><td>Delta-E (capo)</td><td>${minDelta.toFixed(1)} — ${deltaLabel}</td></tr>
          <tr><td>Colore capo</td><td>${garmentHex}</td></tr>
        </table>
      </div>
      <div class="tip-card full-width">
        <strong>${season}</strong>
        <p class="mt-8 text-sm">${seasonData.tip}</p>
      </div>
    </div>
  `;
  resultsEl.classList.add('visible');

  document.getElementById('armo-progress').classList.remove('active');
  setLog('armo', 'Analisi completata ✓');
}
