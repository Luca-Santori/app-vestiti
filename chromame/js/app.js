/* ══════════════════════════════════════════════════════
   EVENT HANDLERS & UX
   ══════════════════════════════════════════════════════ */

/** Tab switching */
document.querySelectorAll('.tab-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.tab-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const panel = document.getElementById('panel-' + pill.dataset.tab);
    // Force reflow for animation
    panel.style.display = 'block';
    requestAnimationFrame(() => panel.classList.add('active'));
  });
});

/** Generic upload zone setup */
function setupUploadZone(zoneId, fileInputId, fnameId, canvasId, stateKey, legendId) {
  const zone = document.getElementById(zoneId);
  const fileInput = document.getElementById(fileInputId);
  const fnameEl = document.getElementById(fnameId);
  const canvas = document.getElementById(canvasId);

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      fileInput.dispatchEvent(new Event('change'));
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const img = await loadImage(file);
      STATE[stateKey] = img;
      drawImageScaled(img, canvas, MAX_IMG_WIDTH);
      canvas.style.display = 'block';
      zone.classList.add('done');
      fnameEl.textContent = '✓ ' + file.name;
      if (legendId) document.getElementById(legendId).style.display = 'flex';
      updateButtonStates();
    } catch(err) {
      fnameEl.textContent = 'Errore: ' + err.message;
    }
  });
}

/** Set up all upload zones */
setupUploadZone('armo-upload', 'armo-file', 'armo-fname', 'armo-canvas', 'armoImage');
setupUploadZone('face-upload', 'face-file', 'face-fname', 'face-canvas', 'faceImage', 'face-legend');
setupUploadZone('tryon-person-upload', 'tryon-person-file', 'tryon-person-fname', 'tryon-person-canvas', 'tryonPersonImage');
setupUploadZone('tryon-garment-upload', 'tryon-garment-file', 'tryon-garment-fname', 'tryon-garment-canvas', 'tryonGarmentImage');

/** Color picker sync */
const armoColor = document.getElementById('armo-color');
const armoHex = document.getElementById('armo-hex');
armoColor.addEventListener('input', () => { armoHex.value = armoColor.value.toUpperCase(); });
armoHex.addEventListener('input', () => {
  let v = armoHex.value;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) armoColor.value = v;
});

/** Slider labels */
document.getElementById('tryon-opacity').addEventListener('input', e => {
  document.getElementById('tryon-opacity-val').textContent = e.target.value + '%';
});
document.getElementById('tryon-contrast').addEventListener('input', e => {
  document.getElementById('tryon-contrast-val').textContent = e.target.value + '%';
});

/** Button states */
function updateButtonStates() {
  document.getElementById('armo-btn').disabled = !STATE.armoImage;
  document.getElementById('face-btn').disabled = !STATE.faceImage;
  document.getElementById('tryon-btn').disabled = !(STATE.tryonPersonImage && STATE.tryonGarmentImage);
}

/** Analysis buttons */
document.getElementById('armo-btn').addEventListener('click', async () => {
  const btn = document.getElementById('armo-btn');
  btn.disabled = true;
  document.getElementById('armo-results').classList.remove('visible');
  document.getElementById('armo-results').innerHTML = '';
  try {
    await runArmocromia();
  } catch(err) {
    setLog('armo', '❌ Errore durante l\'analisi: ' + err.message);
    console.error(err);
  }
  btn.disabled = false;
});

document.getElementById('face-btn').addEventListener('click', async () => {
  const btn = document.getElementById('face-btn');
  btn.disabled = true;
  document.getElementById('face-results').classList.remove('visible');
  document.getElementById('face-results').innerHTML = '';
  try {
    await runFaceAnalysis();
  } catch(err) {
    setLog('face', '❌ Errore durante l\'analisi: ' + err.message);
    console.error(err);
  }
  btn.disabled = false;
});

document.getElementById('tryon-btn').addEventListener('click', async () => {
  const btn = document.getElementById('tryon-btn');
  btn.disabled = true;
  document.getElementById('tryon-results').classList.remove('visible');
  document.getElementById('tryon-results').innerHTML = '';
  try {
    await runTryon();
  } catch(err) {
    setLog('tryon', '❌ Errore durante la prova: ' + err.message);
    console.error(err);
  }
  btn.disabled = false;
});

