/* ══════════════════════════════════════════════════════
   MODULE 2 — ANALISI VOLTO
   ══════════════════════════════════════════════════════ */

/**
 * Hair tone classification by L*.
 * @param {number} L
 * @returns {string}
 */
function classifyHair(L) {
  if (L <= 20) return 'Nero corvino';
  if (L <= 32) return 'Castano scuro';
  if (L <= 42) return 'Castano medio';
  if (L <= 55) return 'Castano chiaro';
  if (L <= 65) return 'Biondo scuro';
  if (L <= 75) return 'Biondo medio';
  if (L <= 85) return 'Biondo chiaro';
  return 'Biondo platino / Grigio';
}

/**
 * Eye color classification by HSL hue + saturation.
 * @param {number} h 0-360
 * @param {number} s 0-100
 * @returns {string}
 */
function classifyEye(h, s) {
  if (s < 15) return 'Grigio / Nocciola neutro';
  if (h >= 0 && h < 30) return 'Ambra / Marrone caldo';
  if (h >= 30 && h < 70) return 'Verde nocciola';
  if (h >= 70 && h < 160) return 'Verde';
  if (h >= 160 && h < 250) return 'Blu / Azzurro';
  if (h >= 250 && h < 320) return 'Grigio';
  return 'Marrone rossastro';
}

/**
 * Full 12-season decision tree using multi-zone data.
 * @param {string} undertone 'warm'|'cool'|'neutral'
 * @param {string} contrast 'low'|'medium'|'high'
 * @param {number} skinL
 * @param {number} hairL
 * @returns {string}
 */
function seasonDecisionTree(undertone, contrast, skinL, hairL) {
  if (undertone === 'warm') {
    if (hairL > 65) {
      return skinL > 68 ? 'Light Spring' : 'True Spring';
    }
    if (hairL > 45) {
      if (skinL > 62) return 'True Spring';
      if (skinL > 52) return 'Warm Spring';
      return 'Soft Autumn';
    }
    if (hairL > 30) {
      if (skinL > 55) return 'Warm Spring';
      if (contrast === 'high') return 'True Autumn';
      return 'Soft Autumn';
    }
    return contrast === 'high' ? 'Dark Autumn' : 'True Autumn';
  }

  if (undertone === 'cool') {
    if (hairL > 65) {
      if (skinL > 68) return 'Light Summer';
      return contrast === 'low' ? 'Light Summer' : 'True Summer';
    }
    if (hairL > 45) {
      if (contrast === 'low') return 'Soft Summer';
      return skinL > 58 ? 'True Summer' : 'True Winter';
    }
    if (hairL > 25) {
      return contrast === 'high' ? 'True Winter' : 'Dark Winter';
    }
    return contrast === 'high' ? 'Bright Winter' : 'Dark Winter';
  }

  // neutral
  if (skinL > 65 && hairL > 60) {
    return contrast === 'low' ? 'Light Summer' : 'Soft Summer';
  }
  if (skinL > 55) return 'Soft Autumn';
  if (hairL < 35 && contrast === 'high') return 'True Winter';
  return 'Soft Autumn';
}

/**
 * Compute confidence score.
 * @param {string} undertone
 * @param {string} contrast
 * @param {number} skinL
 * @param {string} seasonName
 * @returns {number} 0–97
 */
function computeConfidence(undertone, contrast, skinL, seasonName) {
  const sd = SEASONS[seasonName];
  if (!sd) return 50;
  let score = 0;

  // Undertone match
  const uMap = { warm: 'caldo', cool: 'freddo', neutral: 'neutro-caldo' };
  const seasonU = sd.undertones[0];
  if (seasonU === uMap[undertone]) { score += 40; }
  else if (seasonU.includes('neutro') || uMap[undertone]?.includes('neutro')) { score += 25; }
  else { score += 10; }

  // Contrast match
  const cMap = { low: 'basso', medium: 'medio', high: 'alto' };
  const seasonC = sd.contrast;
  if (seasonC === cMap[contrast] || seasonC.includes(cMap[contrast])) { score += 35; }
  else if (Math.abs(['basso','medio-basso','medio','medio-alto','alto'].indexOf(seasonC) - ['basso','medio-basso','medio','medio-alto','alto'].indexOf(cMap[contrast] || 'medio')) <= 1) { score += 18; }

  // Skin clarity bonus
  score += Math.min(25, Math.round(skinL / 4));

  return Math.min(97, score);
}

/**
 * Full face analysis pipeline (8 steps).
 */
async function runFaceAnalysis() {
  const canvas = document.getElementById('face-canvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const totalSteps = 8;

  initProgress('face', totalSteps);

  // STEP 1 — Multi-zone skin sampling
  setStep('face', 1, totalSteps);
  setLog('face', 'Campionamento multi-zona pelle...');
  await wait(80);

  const imgData = ctx.getImageData(0, 0, w, h);

  const skinZones = [
    { name: 'guancia', cx: 0.50*w, cy: 0.52*h, rx: 0.10*w, ry: 0.06*h },
    { name: 'mento',   cx: 0.50*w, cy: 0.60*h, rx: 0.07*w, ry: 0.04*h },
    { name: 'zigomo sx',cx: 0.38*w, cy: 0.48*h, rx: 0.05*w, ry: 0.04*h },
    { name: 'zigomo dx',cx: 0.62*w, cy: 0.48*h, rx: 0.05*w, ry: 0.04*h },
  ];
  const skinOpts = { minAlpha: 100, minLum: 25, maxLum: 235 };

  let skinTotal = { r: 0, g: 0, b: 0, count: 0 };
  for (const z of skinZones) {
    drawEllipse(ctx, z.cx, z.cy, z.rx, z.ry, 'rgba(200,129,138,0.55)');
    const s = sampleEllipse(imgData, z.cx, z.cy, z.rx, z.ry, skinOpts);
    if (s) { skinTotal.r += s.r * s.count; skinTotal.g += s.g * s.count; skinTotal.b += s.b * s.count; skinTotal.count += s.count; }
  }
  let skinRgb;
  if (skinTotal.count > 0) {
    skinRgb = { r: Math.round(skinTotal.r/skinTotal.count), g: Math.round(skinTotal.g/skinTotal.count), b: Math.round(skinTotal.b/skinTotal.count) };
  } else {
    skinRgb = { r: 210, g: 180, b: 160 };
  }
  setLog('face', `Pelle: RGB(${skinRgb.r}, ${skinRgb.g}, ${skinRgb.b}) — ${skinTotal.count} pixel`);
  await wait(300);

  // STEP 2 — Hair sampling
  setStep('face', 2, totalSteps);
  setLog('face', 'Campionamento capelli...');
  await wait(80);

  const hairZones = [
    { name: 'top',    cx: 0.50*w, cy: 0.12*h, rx: 0.14*w, ry: 0.07*h },
    { name: 'left',   cx: 0.22*w, cy: 0.25*h, rx: 0.06*w, ry: 0.05*h },
    { name: 'right',  cx: 0.78*w, cy: 0.25*h, rx: 0.06*w, ry: 0.05*h },
  ];
  const hairOpts = { minAlpha: 100, minLum: 0, maxLum: 235, skipLowLum: false };

  let hairTotal = { r: 0, g: 0, b: 0, count: 0 };
  for (const z of hairZones) {
    drawEllipse(ctx, z.cx, z.cy, z.rx, z.ry, 'rgba(139,105,20,0.55)');
    const s = sampleEllipse(imgData, z.cx, z.cy, z.rx, z.ry, hairOpts);
    if (s) { hairTotal.r += s.r * s.count; hairTotal.g += s.g * s.count; hairTotal.b += s.b * s.count; hairTotal.count += s.count; }
  }
  let hairRgb;
  if (hairTotal.count > 0) {
    hairRgb = { r: Math.round(hairTotal.r/hairTotal.count), g: Math.round(hairTotal.g/hairTotal.count), b: Math.round(hairTotal.b/hairTotal.count) };
  } else {
    hairRgb = { r: 80, g: 60, b: 45 };
  }
  setLog('face', `Capelli: RGB(${hairRgb.r}, ${hairRgb.g}, ${hairRgb.b})`);
  await wait(300);

  // STEP 3 — Eye sampling
  setStep('face', 3, totalSteps);
  setLog('face', 'Campionamento occhi...');
  await wait(80);

  const eyeZones = [
    { name: 'occhio sx', cx: 0.37*w, cy: 0.38*h, rx: 0.05*w, ry: 0.025*h },
    { name: 'occhio dx', cx: 0.63*w, cy: 0.38*h, rx: 0.05*w, ry: 0.025*h },
  ];
  const eyeOpts = { minAlpha: 100, minLum: 25, maxLum: 235 };

  let eyeTotal = { r: 0, g: 0, b: 0, count: 0 };
  for (const z of eyeZones) {
    drawEllipse(ctx, z.cx, z.cy, z.rx, z.ry, 'rgba(74,127,181,0.55)');
    const s = sampleEllipse(imgData, z.cx, z.cy, z.rx, z.ry, eyeOpts);
    if (s) { eyeTotal.r += s.r * s.count; eyeTotal.g += s.g * s.count; eyeTotal.b += s.b * s.count; eyeTotal.count += s.count; }
  }
  let eyeRgb;
  if (eyeTotal.count > 0) {
    eyeRgb = { r: Math.round(eyeTotal.r/eyeTotal.count), g: Math.round(eyeTotal.g/eyeTotal.count), b: Math.round(eyeTotal.b/eyeTotal.count) };
  } else {
    eyeRgb = { r: 120, g: 100, b: 80 };
  }
  setLog('face', `Occhi: RGB(${eyeRgb.r}, ${eyeRgb.g}, ${eyeRgb.b})`);
  await wait(300);

  // STEP 4 — LAB conversion
  setStep('face', 4, totalSteps);
  setLog('face', 'Conversione CIE LAB...');
  await wait(80);

  const skinLab = rgbToLab(skinRgb.r, skinRgb.g, skinRgb.b);
  const hairLab = rgbToLab(hairRgb.r, hairRgb.g, hairRgb.b);
  const eyeHsl = rgbToHsl(eyeRgb.r, eyeRgb.g, eyeRgb.b);

  setLog('face', `LAB pelle: L*=${skinLab.L.toFixed(1)} | LAB capelli: L*=${hairLab.L.toFixed(1)}`);
  await wait(300);

  // STEP 5 — Undertone
  setStep('face', 5, totalSteps);
  setLog('face', 'Determinazione sottotono...');
  await wait(80);

  const undertoneScore = (skinLab.a * 1.5 + skinLab.b * 1.0) / 2.5;
  let undertone, undertoneLabel;
  if (undertoneScore > 7) { undertone = 'warm'; undertoneLabel = 'Caldo'; }
  else if (undertoneScore < 2) { undertone = 'cool'; undertoneLabel = 'Freddo'; }
  else { undertone = 'neutral'; undertoneLabel = 'Neutro'; }

  setLog('face', `Sottotono: ${undertoneLabel} (score: ${undertoneScore.toFixed(1)})`);
  await wait(300);

  // STEP 6 — Natural contrast
  setStep('face', 6, totalSteps);
  setLog('face', 'Calcolo contrasto naturale...');
  await wait(80);

  const deltaL = Math.abs(skinLab.L - hairLab.L);
  let contrast, contrastLabel;
  if (deltaL < 15) { contrast = 'low'; contrastLabel = 'Basso'; }
  else if (deltaL <= 30) { contrast = 'medium'; contrastLabel = 'Medio'; }
  else { contrast = 'high'; contrastLabel = 'Alto'; }

  setLog('face', `Contrasto: ${contrastLabel} (ΔL*=${deltaL.toFixed(1)})`);
  await wait(300);

  // STEP 7 — Season decision tree
  setStep('face', 7, totalSteps);
  setLog('face', 'Determinazione stagione con albero decisionale...');
  await wait(80);

  const season = seasonDecisionTree(undertone, contrast, skinLab.L, hairLab.L);
  const seasonData = SEASONS[season];

  setLog('face', `Stagione: ${season}`);
  await wait(300);

  // STEP 8 — Confidence + render
  setStep('face', 8, totalSteps);
  setLog('face', 'Calcolo confidenza e generazione risultati...');
  await wait(200);

  const confidence = computeConfidence(undertone, contrast, skinLab.L, season);
  const fitz = fitzpatrick(skinLab.L);
  const skinHex = rgbToHex(skinRgb.r, skinRgb.g, skinRgb.b);
  const hairHex = rgbToHex(hairRgb.r, hairRgb.g, hairRgb.b);
  const eyeHex = rgbToHex(eyeRgb.r, eyeRgb.g, eyeRgb.b);
  const hairClass = classifyHair(hairLab.L);
  const eyeClass = classifyEye(eyeHsl.h, eyeHsl.s);

  // Confidence dots
  const confDots = Array.from({length:10}, (_, i) =>
    `<div class="conf-dot${i < Math.round(confidence/10) ? ' on' : ''}"></div>`
  ).join('');

  // Contrast grid — pick 4 colors from palette
  const palette = seasonData.palette;
  const contrastLabels = ['Principale', 'Secondario', 'Accento', 'Neutro'];
  const contrastCells = [palette[0], palette[1], palette[4], palette[6]].map((c, i) =>
    `<div class="contrast-cell" style="background:${c};color:${textColorFor(c)};">${contrastLabels[i]}<br><span class="text-xs">${c}</span></div>`
  ).join('');

  const resultsEl = document.getElementById('face-results');
  resultsEl.innerHTML = `
    <div class="results-grid">
      <!-- Row 1: Big season card -->
      <div class="card full-width" style="text-align:center;">
        <div class="heading-display" style="font-size:28px;">${season}</div>
        <p class="text-sm text-muted mt-8">${seasonData.desc}</p>
        <span class="pill mt-8">${undertoneLabel} · Contrasto ${contrastLabel}</span>
        <div style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:14px;">
          <div style="font-size:24px;font-weight:500;">${confidence}%</div>
          <div class="conf-dots">${confDots}</div>
        </div>
      </div>

      <!-- Row 2: Zone cards -->
      <div class="card">
        <p class="text-xs text-muted mb-8">Pelle</p>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="swatch-circle" style="width:44px;height:44px;background:${skinHex};"></div>
          <div>
            <div style="font-weight:500;">${skinHex}</div>
            <div class="text-xs text-muted">Fitzpatrick Tipo ${fitz}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Capelli</p>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="swatch-circle" style="width:44px;height:44px;background:${hairHex};"></div>
          <div>
            <div style="font-weight:500;">${hairHex}</div>
            <div class="text-xs text-muted">${hairClass}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Occhi</p>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="swatch-circle" style="width:44px;height:44px;background:${eyeHex};"></div>
          <div>
            <div style="font-weight:500;">${eyeHex}</div>
            <div class="text-xs text-muted">${eyeClass}</div>
          </div>
        </div>
      </div>

      <!-- Row 3: Undertone + Contrast -->
      <div class="card">
        <p class="text-xs text-muted mb-8">Sottotono</p>
        <div style="font-size:22px;" class="heading-display">${undertoneLabel}</div>
        <div class="text-xs text-muted mt-8">L*=${skinLab.L.toFixed(1)} a*=${skinLab.a.toFixed(1)} b*=${skinLab.b.toFixed(1)}</div>
        <div class="text-xs text-muted">Score: ${undertoneScore.toFixed(1)}</div>
      </div>
      <div class="card">
        <p class="text-xs text-muted mb-8">Contrasto Naturale</p>
        <div style="font-size:22px;" class="heading-display">${contrastLabel}</div>
        <div class="text-xs text-muted mt-8">ΔL* = ${deltaL.toFixed(1)}</div>
        <div class="text-xs text-muted">Pelle L*=${skinLab.L.toFixed(1)} — Capelli L*=${hairLab.L.toFixed(1)}</div>
      </div>

      <!-- Row 4: Palette -->
      <div class="card full-width">
        <p class="text-xs text-muted mb-8">Palette ideale</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${seasonData.palette.map(c => `<div class="swatch-sq" style="background:${c};" title="${c}"></div>`).join('')}
        </div>
      </div>

      <!-- Row 5: Avoid -->
      <div class="card full-width">
        <p class="text-xs text-muted mb-8">Colori da evitare</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${seasonData.avoid.map(c => `<div class="swatch-sq avoid" style="background:${c};" title="${c}"></div>`).join('')}
        </div>
      </div>

      <!-- Row 6: Contrast grid -->
      <div class="card full-width">
        <p class="text-xs text-muted mb-8">Test contrasto stagionale</p>
        <div class="contrast-grid">${contrastCells}</div>
      </div>

      <!-- Row 7: Tip -->
      <div class="tip-card full-width">
        <strong>${season}</strong>
        <p class="mt-8 text-sm">${seasonData.tip}</p>
      </div>
    </div>
  `;
  resultsEl.classList.add('visible');
  document.getElementById('face-progress').classList.remove('active');
  setLog('face', 'Analisi completata ✓');
}
