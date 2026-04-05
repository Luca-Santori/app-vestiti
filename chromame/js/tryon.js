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

async function runTryon() {
  var category    = document.getElementById('tryon-category').value;
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
    // Messaggio user-friendly per il rate limit
    if (msg.includes('429') || msg.includes('throttled') || msg.includes('rate limit') || msg.includes('Too Many')) {
      throw new Error('RATE_LIMIT');
    }
    throw new Error(msg);
  }
  var data = await resp.json();
  if (!data.success || !data.resultUrl) throw new Error('Risposta non valida dal server');

  // STEP 4 — Mostra risultato
  setStep('tryon', 4, totalSteps);
  setLog('tryon', 'Risultato pronto ✓');
  await wait(200);

  renderTryonResults(data.resultUrl, category, description);
  document.getElementById('tryon-progress').classList.remove('active');
  setLog('tryon', 'Prova completata ✓');
}

/* ── Helpers ────────────────────────────────────────── */

function canvasToBlob(canvas) {
  return new Promise(function(resolve) {
    canvas.toBlob(resolve, 'image/jpeg', 0.95);
  });
}

/* ── Render ─────────────────────────────────────────── */

function renderTryonError(isRateLimit) {
  var el = document.getElementById('tryon-results');
  if (isRateLimit) {
    el.innerHTML = [
      '<div class="tip-card full-width" style="text-align:center;">',
      '<strong>⚠ Errore HuggingFace IDM-VTON</strong>',
      '<p class="mt-8 text-sm">Il modello ha restituito un errore. Riprova tra qualche secondo.</p>',
      '<p class="mt-8 text-xs text-muted">Se il problema persiste lo Space HuggingFace potrebbe essere in manutenzione.</p>',
      '</div>'
    ].join('');
  } else {
    el.innerHTML = [
      '<div class="tip-card full-width" style="text-align:center;">',
      '<strong>⚠ Server non avviato</strong>',
      '<p class="mt-8 text-sm">Il Virtual Try-On AI richiede il server locale. Segui questi passi:</p>',
      '<ol class="text-sm" style="text-align:left;margin-top:14px;padding-left:22px;line-height:2;">',
      '<li>Fai doppio click su <strong>start.bat</strong> nella cartella chromame</li>',
      '<li>Lascia la finestra aperta</li>',
      '<li>Apri <strong>http://localhost:3000/index.html</strong> nel browser (non da file://)</li>',
      '</ol>',
      '<p class="mt-8 text-xs text-muted">Completamente gratuito — nessun API key richiesto.</p>',
      '</div>'
    ].join('');
  }
  el.classList.add('visible');
}

function renderTryonResults(resultUrl, category, description) {
  var labels = { upper_body: 'Parte superiore', lower_body: 'Parte inferiore', dresses: 'Abito intero' };
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
