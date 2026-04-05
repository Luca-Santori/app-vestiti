/* ═══════════════════════════════════════════════════════
   ChromaMe — Modulo 3: Virtual Try-On (AI — IDM-VTON)
   Chiama il server locale → HuggingFace IDM-VTON (gratuito)
   ═══════════════════════════════════════════════════════ */

(function() {

var initProgress = CM.initProgress, setStep = CM.setStep, setLog = CM.setLog, wait = CM.wait;

var SERVER = 'http://localhost:3000';

/* ── Connessione ────────────────────────────────────── */

async function checkServer() {
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 3000);
    var r = await fetch(SERVER + '/api/health', { signal: ctrl.signal });
    clearTimeout(tid);
    return r.ok;
  } catch (e) {
    return false;
  }
}

/* ── Pipeline principale ────────────────────────────── */

var ACCESSOR_TYPES = ['acc_hat','acc_glasses','acc_scarf','acc_necklace','acc_earring','acc_belt','acc_bag'];

async function runTryon() {
  var category = document.getElementById('tryon-category').value;

  if (ACCESSOR_TYPES.indexOf(category) !== -1) {
    return runTryonAccessory(category);
  }
  var description = (document.getElementById('tryon-desc').value || '').trim() || 'a garment';
  var totalSteps  = 4;

  initProgress('tryon', totalSteps);

  // STEP 1 — Verifica server
  setStep('tryon', 1, totalSteps);
  setLog('tryon', 'Connessione al server AI…');
  await wait(80);

  var serverOk = await checkServer();
  if (!serverOk) {
    document.getElementById('tryon-progress').classList.remove('active');
    setLog('tryon', '');
    renderTryonError();
    return;
  }
  setLog('tryon', 'Server connesso ✓');
  await wait(300);

  // STEP 2 — Prepara immagini
  setStep('tryon', 2, totalSteps);
  setLog('tryon', 'Preparazione immagini…');
  await wait(80);

  var personCanvas  = document.getElementById('tryon-person-canvas');
  var garmentCanvas = document.getElementById('tryon-garment-canvas');

  var personBlob  = await canvasToBlob(personCanvas);
  var garmentBlob = await canvasToBlob(garmentCanvas);

  setLog('tryon', 'Immagini pronte ✓');
  await wait(300);

  // STEP 3 — Elaborazione AI
  setStep('tryon', 3, totalSteps);
  setLog('tryon', 'Elaborazione IDM-VTON su HuggingFace… (1–3 min, sii paziente)');
  await wait(80);

  var fd = new FormData();
  fd.append('person',      personBlob,  'person.jpg');
  fd.append('garment',     garmentBlob, 'garment.jpg');
  fd.append('category',    category);
  fd.append('garmentDesc', description);

  var resp = await fetch(SERVER + '/api/tryon', { method: 'POST', body: fd });
  if (!resp.ok) {
    var errJson = await resp.json().catch(function() { return {}; });
    var msg = errJson.error || 'Errore server ' + resp.status;
    throw new Error(msg);
  }
  var data = await resp.json();
  if (!data.success || !data.resultUrl) throw new Error(data.error || 'Risposta non valida dal server');

  // STEP 4 — Mostra risultato
  setStep('tryon', 4, totalSteps);
  setLog('tryon', 'Risultato pronto ✓');
  await wait(200);

  renderTryonResults(data.resultUrl, category, description);
  document.getElementById('tryon-progress').classList.remove('active');
  setLog('tryon', 'Prova completata ✓');
}

/* ── Accessori (bg removal + canvas overlay) ─────────── */

async function runTryonAccessory(category) {
  var totalSteps = 3;
  initProgress('tryon', totalSteps);

  // STEP 1 — Verifica server
  setStep('tryon', 1, totalSteps);
  setLog('tryon', 'Connessione al server AI…');
  var serverOk = await checkServer();
  if (!serverOk) {
    document.getElementById('tryon-progress').classList.remove('active');
    renderTryonError(null);
    return;
  }
  setLog('tryon', 'Server connesso ✓');
  await wait(200);

  // STEP 2 — Rimuovi sfondo dall'accessorio
  setStep('tryon', 2, totalSteps);
  setLog('tryon', 'Rimozione sfondo accessorio con AI… (5–15 sec)');

  var garmentCanvas = document.getElementById('tryon-garment-canvas');
  var garmentBlob   = await canvasToBlob(garmentCanvas);
  var fd = new FormData();
  fd.append('image', garmentBlob, 'garment.jpg');

  var resp = await fetch(SERVER + '/api/remove-bg', { method: 'POST', body: fd });
  if (!resp.ok) {
    var err = await resp.json().catch(function() { return {}; });
    throw new Error(err.error || 'Errore rimozione sfondo');
  }
  var bgData = await resp.json();
  if (!bgData.success) throw new Error(bgData.error || 'Rimozione sfondo fallita');
  setLog('tryon', 'Sfondo rimosso ✓');
  await wait(200);

  // STEP 3 — Compositing con landmark AI
  setStep('tryon', 3, totalSteps);
  setLog('tryon', 'Posizionamento AI con MediaPipe (rilevamento punti corporei)…');

  var personCanvas = document.getElementById('tryon-person-canvas');
  var resultUrl;
  if (typeof CM.compositeAccessoryLandmarks === 'function') {
    resultUrl = await CM.compositeAccessoryLandmarks(personCanvas, bgData.resultUrl, category);
  } else {
    resultUrl = await compositeAccessory(personCanvas, bgData.resultUrl, category);
  }

  setLog('tryon', 'Pronto ✓');
  await wait(200);

  renderTryonResults(resultUrl, category, document.getElementById('tryon-desc').value || category);
  document.getElementById('tryon-progress').classList.remove('active');
  setLog('tryon', 'Prova completata ✓');
}

/* posizioni relative rispetto all'altezza dell'immagine */
var ACC_PLACEMENT = {
  acc_hat:      { yRel: 0.01, xRel: 0.5, wRel: 0.55, anchor: 'top' },
  acc_glasses:  { yRel: 0.20, xRel: 0.5, wRel: 0.38, anchor: 'center' },
  acc_scarf:    { yRel: 0.22, xRel: 0.5, wRel: 0.60, anchor: 'center' },
  acc_necklace: { yRel: 0.27, xRel: 0.5, wRel: 0.35, anchor: 'center' },
  acc_earring:  { yRel: 0.20, xRel: 0.5, wRel: 0.55, anchor: 'center' },
  acc_belt:     { yRel: 0.50, xRel: 0.5, wRel: 0.65, anchor: 'center' },
  acc_bag:      { yRel: 0.55, xRel: 0.75, wRel: 0.35, anchor: 'center' }
};

function compositeAccessory(personCanvas, accDataUrl, category) {
  return new Promise(function(resolve, reject) {
    var out   = document.createElement('canvas');
    out.width  = personCanvas.width;
    out.height = personCanvas.height;
    var ctx = out.getContext('2d');

    // Disegna persona
    ctx.drawImage(personCanvas, 0, 0);

    // Carica accessorio trasparente
    var accImg = new Image();
    accImg.onload = function() {
      var p  = ACC_PLACEMENT[category] || ACC_PLACEMENT['acc_hat'];
      var W  = out.width;
      var H  = out.height;

      var accW = Math.round(W * p.wRel);
      var accH = Math.round(accImg.naturalHeight * (accW / accImg.naturalWidth));
      var x    = Math.round(W * p.xRel - accW / 2);
      var y;
      if (p.anchor === 'top') {
        y = Math.round(H * p.yRel);
      } else {
        y = Math.round(H * p.yRel - accH / 2);
      }

      ctx.drawImage(accImg, x, y, accW, accH);
      resolve(out.toDataURL('image/jpeg', 0.92));
    };
    accImg.onerror = function() { reject(new Error('Caricamento accessorio fallito')); };
    accImg.src = accDataUrl;
  });
}

/* ── Helpers ────────────────────────────────────────── */

function canvasToBlob(canvas) {
  return new Promise(function(resolve) {
    canvas.toBlob(resolve, 'image/jpeg', 0.95);
  });
}

/* ── Render ─────────────────────────────────────────── */

function renderTryonError(msg) {
  var el = document.getElementById('tryon-results');
  if (!msg || msg === 'false') {
    el.innerHTML = [
      '<div class="tip-card full-width" style="text-align:center;">',
      '<strong>⚠ Server non avviato</strong>',
      '<p class="mt-8 text-sm">Il Virtual Try-On AI richiede il server locale. Segui questi passi:</p>',
      '<ol class="text-sm" style="text-align:left;margin-top:14px;padding-left:22px;line-height:2;">',
      '<li>Fai doppio click su <strong>start.bat</strong> nella cartella chromame</li>',
      '<li>Lascia la finestra aperta</li>',
      '<li>Apri <strong>http://localhost:3000/index.html</strong> nel browser (non da file://)</li>',
      '</ol>',
      '</div>'
    ].join('');
  } else {
    el.innerHTML = [
      '<div class="tip-card full-width" style="text-align:center;">',
      '<strong>⚠ Errore elaborazione AI</strong>',
      '<p class="mt-8 text-sm">' + msg + '</p>',
      '<p class="mt-8 text-sm">Riprova. Se persiste, usa foto diverse:</p>',
      '<ul class="text-sm" style="text-align:left;margin-top:8px;padding-left:22px;line-height:2;">',
      '<li>Persona: <strong>full-body</strong> in piedi, frontale, sfondo neutro</li>',
      '<li>Capo: solo il vestito su sfondo bianco</li>',
      '</ul>',
      '</div>'
    ].join('');
  }
  el.classList.add('visible');
}

function renderTryonResults(resultUrl, category, description) {
  var labels = {
    upper_body: 'Parte superiore', lower_body: 'Parte inferiore', dresses: 'Abito intero',
    acc_hat: 'Cappello', acc_glasses: 'Occhiali', acc_scarf: 'Sciarpa',
    acc_necklace: 'Collana', acc_earring: 'Orecchini', acc_belt: 'Cintura', acc_bag: 'Borsa'
  };
  var el = document.getElementById('tryon-results');
  el.innerHTML = [
    '<div style="text-align:center;">',
    '<img src="' + resultUrl + '" alt="Virtual Try-On" ',
    'style="max-width:100%;border-radius:16px;box-shadow:0 8px 40px rgba(44,36,32,0.18);">',
    '</div>',
    '<div class="results-grid mt-16">',
    '<div class="card">',
    '<p class="text-xs text-muted mb-8">Categoria</p>',
    '<div style="font-size:18px;font-weight:500;">' + (labels[category] || category) + '</div>',
    '</div>',
    '<div class="card">',
    '<p class="text-xs text-muted mb-8">Capo</p>',
    '<div style="font-size:16px;">' + description + '</div>',
    '</div>',
    '<div class="full-width" style="text-align:center;margin-top:12px;">',
    '<a href="' + resultUrl + '" download="chromame-tryon.png" class="btn-secondary" style="display:inline-block;text-decoration:none;">',
    'Scarica risultato ⬇</a>',
    '</div>',
    '<div class="tip-card full-width">',
    '<strong>Consiglio per risultati migliori</strong>',
    '<p class="mt-8 text-sm">Usa foto della persona in posa frontale, dritta, con sfondo neutro. ',
    'Per il capo usa foto su sfondo bianco o manichino. Più le foto sono pulite, più il risultato è realistico.</p>',
    '</div>',
    '</div>'
  ].join('');
  el.classList.add('visible');
}

CM.runTryon = runTryon;
CM.renderTryonError = renderTryonError;

})();
