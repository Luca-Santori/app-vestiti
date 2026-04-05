require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const cors    = require('cors');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.static('.'));

/* ── HuggingFace Gradio Space (gratuito, no API key) ── */

const SPACE_URL = 'https://yisol-idm-vton.hf.space';

async function uploadImage(buffer, mime, filename) {
  const fd = new FormData();
  fd.append('files', new File([buffer], filename, { type: mime }));
  const resp = await fetch(`${SPACE_URL}/upload`, { method: 'POST', body: fd });
  if (!resp.ok) throw new Error(`Upload fallito: ${resp.status} ${await resp.text()}`);
  const [path] = await resp.json();
  return path;
}

async function submitPrediction(personPath, garmentPath, description) {
  const resp = await fetch(`${SPACE_URL}/call/tryon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        { path: personPath },  // human_img
        { path: garmentPath }, // garm_img
        description,           // garment_des
        true,                  // is_checked (auto-masking)
        false,                 // is_checked_crop
        30,                    // denoise_steps
        42                     // seed
      ]
    })
  });
  if (!resp.ok) throw new Error(`Submit fallito: ${resp.status} ${await resp.text()}`);
  const { event_id } = await resp.json();
  return event_id;
}

async function waitForResult(eventId) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 300_000); // 5 min

  try {
    const resp = await fetch(`${SPACE_URL}/call/tryon/${eventId}`, {
      signal: ctrl.signal
    });
    if (!resp.ok) throw new Error(`SSE fallito: ${resp.status}`);

    // Legge lo stream SSE riga per riga
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const rawChunk of resp.body) {
      buffer += decoder.decode(rawChunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // ultima riga incompleta, teniamola

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let msg;
        try { msg = JSON.parse(line.slice(6)); } catch { continue; }
        if (!msg || typeof msg !== 'object') continue;

        console.log('  SSE msg:', msg.msg ?? '(no msg field)');

        if (msg.msg === 'process_errored') {
          clearTimeout(tid);
          throw new Error(msg.output?.error || 'Errore durante l\'elaborazione');
        }
        if (msg.msg === 'process_completed') {
          clearTimeout(tid);
          const data = msg.output?.data ?? (Array.isArray(msg.output) ? msg.output : null);
          if (!data) throw new Error('Output vuoto dal modello');
          const img = data[data.length - 1] ?? data[0];
          if (!img) throw new Error('Nessuna immagine nell\'output');
          if (img?.url)  return img.url;
          if (img?.path) return `${SPACE_URL}/file=${img.path}`;
          if (typeof img === 'string' && img.startsWith('http')) return img;
          return String(img);
        }
      }
    }

    clearTimeout(tid);
    throw new Error('Stream SSE chiuso senza risultato');
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

/* ── Routes ─────────────────────────────────────────── */

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/tryon',
  (req, res, next) => { req.setTimeout(320_000); res.setTimeout(320_000); next(); },
  upload.fields([{ name: 'person', maxCount: 1 }, { name: 'garment', maxCount: 1 }]),
  async (req, res) => {
    try {
      if (!req.files?.person?.[0] || !req.files?.garment?.[0]) {
        return res.status(400).json({ error: 'Immagini persona e capo richieste' });
      }

      const personBuf   = req.files.person[0].buffer;
      const garmentBuf  = req.files.garment[0].buffer;
      const personMime  = req.files.person[0].mimetype  || 'image/jpeg';
      const garmentMime = req.files.garment[0].mimetype || 'image/jpeg';
      const description = req.body.garmentDesc || 'a garment';

      console.log(`\n→ Try-On | "${description}"`);
      console.log('  [1/3] Upload immagini su HuggingFace...');
      const [personPath, garmentPath] = await Promise.all([
        uploadImage(personBuf, personMime, 'person.jpg'),
        uploadImage(garmentBuf, garmentMime, 'garment.jpg')
      ]);
      console.log('  Upload OK ✓');

      console.log('  [2/3] Submit a IDM-VTON...');
      const eventId = await submitPrediction(personPath, garmentPath, description);
      console.log(`  In coda — event_id: ${eventId}`);

      console.log('  [3/3] Attesa risultato (1–3 min)...');
      const resultUrl = await waitForResult(eventId);
      console.log('  ✓ Risultato:', resultUrl);

      res.json({ success: true, resultUrl });

    } catch (err) {
      console.error('Errore IDM-VTON:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/* ── Start ─────────────────────────────────────────── */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   ChromaMe — Try-On AI Server avviato   ║');
  console.log(`║   http://localhost:${PORT}                  ║`);
  console.log('║                                          ║');
  console.log('║   Apri: http://localhost:3000/index.html ║');
  console.log('║   Gratuito — HuggingFace IDM-VTON        ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
