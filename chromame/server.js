require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const cors     = require('cors');
const Replicate = require('replicate');

/* ── Setup ──────────────────────────────────────────── */

const app     = express();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

app.use(cors());
app.use(express.static('.'));   // serve index.html direttamente da qui

/* ── Health check ──────────────────────────────────── */

app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ── Virtual Try-On ────────────────────────────────── */

app.post('/api/tryon',
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

      const category    = req.body.category    || 'upper_body';
      const description = req.body.garmentDesc || 'a garment';

      const personUri  = `data:${personMime};base64,${personBuf.toString('base64')}`;
      const garmentUri = `data:${garmentMime};base64,${garmentBuf.toString('base64')}`;

      console.log(`\n→ Try-On | categoria: ${category} | "${description}"`);
      console.log('  Invio a IDM-VTON (Replicate)...');

      // IDM-VTON con version hash obbligatorio per i modelli community
      const output = await replicate.run(
        'cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
        {
          input: {
            human_img:        personUri,
            garm_img:         garmentUri,
            garment_des:      description,
            category:         category,   // 'upper_body' | 'lower_body' | 'dresses'
            is_checked:       true,
            is_checked_crop:  false,
            denoise_steps:    30,
            seed:             42
          }
        }
      );

      // In replicate v1.x il risultato è un FileOutput con .url() sincrono
      let resultUrl;
      if (output && typeof output.url === 'function') {
        resultUrl = output.url().toString();
      } else if (Array.isArray(output)) {
        const item = output[1] ?? output[0];
        resultUrl = (item && typeof item.url === 'function') ? item.url().toString() : String(item);
      } else {
        resultUrl = String(output);
      }

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
  console.log('║   Apri chromame/index.html nel browser   ║');
  console.log('║   o vai su http://localhost:3000         ║');
  console.log('╚══════════════════════════════════════════╝\n');
});
