require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const cors    = require('cors');

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.static('.'));

/* ── OOTDiffusion (HuggingFace, gratuito, no API key) ── */

const SPACE_URL = 'https://levihsu-ootdiffusion.hf.space';

async function uploadImage(buffer, mime, filename) {
  const fd = new FormData();
  fd.append('files', new File([buffer], filename, { type: mime }));
  const resp = await fetch(`${SPACE_URL}/upload`, { method: 'POST', body: fd });
  if (!resp.ok) throw new Error(`Upload fallito: ${resp.status} ${await resp.text()}`);
  const [path] = await resp.json();
  return path;
}

async function submitPrediction(personPath, garmentPath) {
  const makeFileData = (path, name) => ({
    path,
    meta: { _type: 'gradio.FileData' },
    orig_name: name,
    url: `${SPACE_URL}/file=${path}`
  });

  const resp = await fetch(`${SPACE_URL}/call/process_hd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        makeFileData(personPath, 'person.jpg'),  // Model (persona)
        makeFileData(garmentPath, 'garment.jpg'), // Garment (capo)
        1,   // Images (quante generare)
        20,  // Steps
        2,   // Guidance scale
        -1   // Seed (-1 = random)
      ]
    })
  });
  if (!resp.ok) throw new Error(`Submit fallito: ${resp.status} ${await resp.text()}`);
  const body = await resp.json();
  return body.event_id;
}

async function waitForResult(eventId) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 300_000); // 5 min

  try {
    const resp = await fetch(`${SPACE_URL}/call/process_hd/${eventId}`, {
      signal: ctrl.signal
    });
    if (!resp.ok) throw new Error(`SSE fallito: ${resp.status}`);

    const decoder = new TextDecoder();
    let buffer = '';
    let lastEvent = '';

    for await (const rawChunk of resp.body) {
      buffer += decoder.decode(rawChunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // riga incompleta, rimandata

      for (const line of lines) {
        // Gradio 4.x: righe "event: complete" / "event: error" / "event: generating"
        if (line.startsWith('event: ')) {
          lastEvent = line.slice(7).trim();
          console.log('  SSE event:', lastEvent);
          continue;
        }
        if (!line.startsWith('data: ')) continue;

        const rawData = line.slice(6);

        // Gradio 4.x — event: error
        if (lastEvent === 'error') {
          let errMsg = rawData;
          console.log('  SSE error raw data:', rawData.slice(0, 200));
          try {
            const parsed = JSON.parse(rawData);
            errMsg = (parsed && parsed.error) ? parsed.error : (parsed !== null ? String(parsed) : 'Errore dal modello');
          } catch {}
          if (!errMsg || errMsg === 'null' || errMsg === 'undefined') errMsg = 'Errore temporaneo HuggingFace. Riprova.';
          clearTimeout(tid);
          throw new Error(errMsg);
        }

        // Gradio 4.x — event: complete → data = [Gallery]
        // OOTDiffusion Gallery: [ [{image:{url,path}}, ...] ]
        if (lastEvent === 'complete') {
          clearTimeout(tid);
          let data;
          try { data = JSON.parse(rawData); } catch { throw new Error('Output non valido'); }
          console.log('  complete data:', JSON.stringify(data).slice(0, 300));
          // data[0] = array della gallery
          const gallery = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : [data];
          const item = gallery[0];
          if (!item) throw new Error('Gallery vuota');
          if (item?.image?.url) return item.image.url;
          if (item?.image?.path) return `${SPACE_URL}/file=${item.image.path}`;
          if (item?.url) return item.url;
          if (item?.path) return `${SPACE_URL}/file=${item.path}`;
          return String(item);
        }

        // Gradio 3.x — data: {"msg": "process_completed", "output": {...}}
        let msg;
        try { msg = JSON.parse(rawData); } catch { continue; }
        if (!msg || typeof msg !== 'object' || Array.isArray(msg)) continue;
        console.log('  SSE msg:', msg.msg ?? '(no msg)');

        if (msg.msg === 'process_errored') {
          clearTimeout(tid);
          throw new Error(msg.output?.error || 'Errore elaborazione');
        }
        if (msg.msg === 'process_completed') {
          clearTimeout(tid);
          // OOTDiffusion returns Gallery: [{image:{url,path}}, ...]
          const data = msg.output?.data ?? (Array.isArray(msg.output) ? msg.output : null);
          if (!data) throw new Error('Output vuoto');
          const gallery = Array.isArray(data[0]) ? data[0] : data;
          const item = gallery[0];
          if (!item) throw new Error('Nessuna immagine');
          if (item?.image?.url) return item.image.url;
          if (item?.image?.path) return `${SPACE_URL}/file=${item.image.path}`;
          if (item?.url) return item.url;
          if (item?.path) return `${SPACE_URL}/file=${item.path}`;
          return String(item);
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

/* ── Background Removal (Gradio 5.x) for accessories ── */

const RMBG_SPACE = 'https://not-lain-background-removal.hf.space';

async function waitForGradio5(spaceBase, endpoint, eventId) {
  const resp = await fetch(`${spaceBase}/gradio_api/call/${endpoint}/${eventId}`);
  if (!resp.ok) throw new Error(`SSE fallito ${resp.status}`);
  const decoder = new TextDecoder();
  let buf = '', lastEvent = '';
  for await (const chunk of resp.body) {
    buf += decoder.decode(chunk, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (line.startsWith('event: ')) { lastEvent = line.slice(7).trim(); continue; }
      if (!line.startsWith('data: ')) continue;
      if (lastEvent === 'error') throw new Error('Errore rimozione sfondo');
      if (lastEvent === 'complete') {
        let data; try { data = JSON.parse(line.slice(6)); } catch { throw new Error('Output non valido'); }
        const img = Array.isArray(data) ? data[0] : data;
        if (img?.url)  return img.url;
        if (img?.path) return `${spaceBase}/gradio_api/file=${img.path}`;
        return String(img);
      }
    }
  }
  throw new Error('Stream chiuso senza risultato');
}

app.post('/api/remove-bg',
  (req, res, next) => { req.setTimeout(120_000); res.setTimeout(120_000); next(); },
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Immagine richiesta' });
      const buf  = req.file.buffer;
      const mime = req.file.mimetype || 'image/jpeg';

      console.log('\n→ Rimozione sfondo accessorio...');
      // Gradio 5.x: upload endpoint è /gradio_api/upload
      const fd = new FormData();
      fd.append('files', new File([buf], 'garment.jpg', { type: mime }));
      const upResp = await fetch(`${RMBG_SPACE}/gradio_api/upload`, { method: 'POST', body: fd });
      if (!upResp.ok) throw new Error('Upload fallito: ' + upResp.status);
      const upJson = await upResp.json();
      // Gradio 5.x può restituire [{path:...}] oppure [{url:...}]
      const uploaded = Array.isArray(upJson) ? upJson[0] : upJson;
      const path = uploaded?.path ?? uploaded?.url ?? uploaded;

      const callResp = await fetch(`${RMBG_SPACE}/gradio_api/call/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ path, meta: { _type: 'gradio.FileData' }, orig_name: 'garment.jpg' }] })
      });
      if (!callResp.ok) throw new Error('Call fallita: ' + callResp.status + ' ' + await callResp.text());
      const { event_id } = await callResp.json();

      const resultUrl = await waitForGradio5(RMBG_SPACE, 'image', event_id);
      console.log('  ✓ Sfondo rimosso:', resultUrl);

      // Scarica e ritorna come data URL per evitare problemi CORS
      const imgResp = await fetch(resultUrl);
      const imgBuf  = Buffer.from(await imgResp.arrayBuffer());
      res.json({ success: true, resultUrl: `data:image/png;base64,${imgBuf.toString('base64')}` });

    } catch (err) {
      console.error('Errore bg removal:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

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

      console.log(`\n→ Try-On OOTDiffusion | "${description}"`);

      // Retry automatico fino a 3 volte
      let resultUrl, lastErr;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`  Tentativo ${attempt}/3 tra 15 sec...`);
            await new Promise(r => setTimeout(r, 15000));
          }
          console.log(`  [1/3] Upload immagini su OOTDiffusion... (tentativo ${attempt})`);
          const [personPath, garmentPath] = await Promise.all([
            uploadImage(personBuf, personMime, 'person.jpg'),
            uploadImage(garmentBuf, garmentMime, 'garment.jpg')
          ]);
          console.log('  Upload OK ✓');

          console.log('  [2/3] Submit a OOTDiffusion...');
          const eventId = await submitPrediction(personPath, garmentPath);
          console.log(`  In coda — event_id: ${eventId}`);

          console.log('  [3/3] Attesa risultato (30–90 sec)...');
          resultUrl = await waitForResult(eventId);
          console.log('  ✓ Risultato:', resultUrl);
          break;
        } catch (e) {
          lastErr = e;
          console.error(`  Tentativo ${attempt} fallito:`, e.message);
        }
      }
      if (!resultUrl) throw lastErr;

      res.json({ success: true, resultUrl });

    } catch (err) {
      console.error('Errore OOTDiffusion:', err.message);
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
  console.log('║   Gratuito — OOTDiffusion (HuggingFace)  ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
