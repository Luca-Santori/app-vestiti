/* ══════════════════════════════════════════════════════
   FACE-API.JS LOADER
   ══════════════════════════════════════════════════════ */

import { STATE, FACE_API_MODEL_URL } from './config.js';

/**
 * Ensure face-api.js is loaded and models downloaded.
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
