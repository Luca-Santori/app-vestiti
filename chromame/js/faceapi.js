/* ═══════════════════════════════════════════════════════
   ChromaMe — Face-API.js Loader
   ═══════════════════════════════════════════════════════ */

import { FACE_API_MODEL_URL } from './constants.js';
import { STATE } from './utils.js';

/**
 * Ensure face-api.js is loaded from CDN and models are downloaded.
 * Models are cached in STATE.faceModelsLoaded to avoid redundant loads.
 */
export async function ensureFaceApi() {
  if (typeof faceapi === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Impossibile caricare face-api.js'));
      document.head.appendChild(s);
    });
  }
  if (!STATE.faceModelsLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL);
    STATE.faceModelsLoaded = true;
  }
}
