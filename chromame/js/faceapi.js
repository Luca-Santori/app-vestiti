/* ═══════════════════════════════════════════════════════
   ChromaMe — Face-API.js Loader
   ═══════════════════════════════════════════════════════ */

(function() {

async function ensureFaceApi() {
  if (typeof faceapi === 'undefined') {
    await new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js';
      s.onload = resolve;
      s.onerror = function() { reject(new Error('Impossibile caricare face-api.js')); };
      document.head.appendChild(s);
    });
  }
  if (!CM.STATE.faceModelsLoaded) {
    await faceapi.nets.tinyFaceDetector.loadFromUri(CM.FACE_API_MODEL_URL);
    CM.STATE.faceModelsLoaded = true;
  }
}

CM.ensureFaceApi = ensureFaceApi;

})();
