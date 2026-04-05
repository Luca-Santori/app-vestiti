/* ═══════════════════════════════════════════════════════
   ChromaMe — Accessory Placement via MediaPipe Landmarks
   FaceMesh (468 punti) + Pose (33 punti) → compositing
   Background Removal: RMBG-1.4 via Transformers.js (browser, ONNX, MIT)
   ═══════════════════════════════════════════════════════ */

(function () {

/* ── RMBG-1.4 in-browser (Transformers.js + ONNX WASM) ─ */

var _rmbgModel = null;
var _rmbgProc  = null;
var _RawImage  = null;
var _rmbgLoading = false;

CM.removeBackgroundBrowser = async function (canvas, onProgress) {
  // Lazy-load transformers.js dal CDN via dynamic import (funziona su localhost:3000)
  if (!_rmbgModel) {
    if (_rmbgLoading) {
      // Aspetta che il caricamento in corso finisca
      while (_rmbgLoading) await new Promise(function(r){ setTimeout(r, 200); });
    } else {
      _rmbgLoading = true;
      try {
        if (onProgress) onProgress('Caricamento modello RMBG-1.4… (prima volta: ~175 MB, poi è cachato)');
        var tf = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.esm.min.js');
        tf.env.allowLocalModels = false;
        _RawImage = tf.RawImage;

        _rmbgProc = await tf.AutoProcessor.from_pretrained('briaai/RMBG-1.4', {
          config: {
            do_normalize: true, do_pad: false, do_rescale: true, do_resize: true,
            image_mean: [0.5, 0.5, 0.5], image_std: [1, 1, 1],
            resample: 2, rescale_factor: 0.00392156862745098,
            size: { width: 1024, height: 1024 }
          }
        });

        _rmbgModel = await tf.AutoModel.from_pretrained('briaai/RMBG-1.4', {
          config: { model_type: 'custom' }
        });
        if (onProgress) onProgress('Modello RMBG-1.4 pronto ✓');
      } finally {
        _rmbgLoading = false;
      }
    }
  }

  // Converti canvas in RawImage
  var dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  var image   = await _RawImage.fromURL(dataUrl);

  // Inferenza ONNX nel browser
  var processed = await _rmbgProc(image);
  var result    = await _rmbgModel({ input: processed.pixel_values });

  // Crea maschera alpha e applica all'immagine originale
  var mask = await _RawImage.fromTensor(result.output[0].mul(255).to('uint8'))
                            .resize(image.width, image.height);

  var out    = document.createElement('canvas');
  out.width  = image.width;
  out.height = image.height;
  var ctx    = out.getContext('2d');
  ctx.drawImage(image.toCanvas(), 0, 0);

  var pixelData = ctx.getImageData(0, 0, image.width, image.height);
  for (var i = 0; i < mask.data.length; i++) {
    pixelData.data[4 * i + 3] = mask.data[i]; // alpha = maschera
  }
  ctx.putImageData(pixelData, 0, 0);
  return out.toDataURL('image/png');
};

/* ── FaceMesh landmarks utili ────────────────────────
   Vedi: https://github.com/google/mediapipe/blob/master/docs/solutions/face_mesh.md
   ──────────────────────────────────────────────────── */
var FACE = {
  TOP_HEAD:        10,   // centro fronte alta
  FOREHEAD_CENTER: 151,  // centro fronte bassa
  LEFT_EYE_OUTER:  33,   // cantus esterno occhio sinistro
  RIGHT_EYE_OUTER: 263,  // cantus esterno occhio destro
  LEFT_EYE_INNER:  133,
  RIGHT_EYE_INNER: 362,
  LEFT_EAR:        234,  // lobo sinistro
  RIGHT_EAR:       454,  // lobo destro
  CHIN:            152,  // mento
  NOSE_TIP:        4,
  LEFT_MOUTH:      61,
  RIGHT_MOUTH:     291
};

/* ── Pose landmarks utili ────────────────────────────
   0=nose, 11=left_shoulder, 12=right_shoulder,
   23=left_hip, 24=right_hip, 15=left_wrist, 16=right_wrist
   ──────────────────────────────────────────────────── */

/* ── Detecta landmarks su un canvas ─────────────────── */

function runFaceMesh(canvas) {
  return new Promise(function (resolve) {
    if (typeof FaceMesh === 'undefined') { resolve(null); return; }

    var mesh = new FaceMesh({
      locateFile: function (f) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/' + f;
      }
    });
    mesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    var done = false;
    mesh.onResults(function (results) {
      if (done) return;
      done = true;
      mesh.close();
      var lms = results.multiFaceLandmarks && results.multiFaceLandmarks[0];
      resolve(lms || null);
    });

    // Converte canvas → ImageData e invia
    var img = new Image();
    img.onload = function () { mesh.send({ image: img }); };
    img.src = canvas.toDataURL('image/jpeg', 0.9);

    // Timeout se nessun viso rilevato
    setTimeout(function () { if (!done) { done = true; mesh.close(); resolve(null); } }, 8000);
  });
}

function runPose(canvas) {
  return new Promise(function (resolve) {
    if (typeof Pose === 'undefined') { resolve(null); return; }

    var pose = new Pose({
      locateFile: function (f) {
        return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + f;
      }
    });
    pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    var done = false;
    pose.onResults(function (results) {
      if (done) return;
      done = true;
      pose.close();
      resolve(results.poseLandmarks || null);
    });

    var img = new Image();
    img.onload = function () { pose.send({ image: img }); };
    img.src = canvas.toDataURL('image/jpeg', 0.9);

    setTimeout(function () { if (!done) { done = true; pose.close(); resolve(null); } }, 8000);
  });
}

/* ── Compositing preciso basato su landmark ────────── */

function px(lm, W, H) {
  // MediaPipe restituisce coordinate normalizzate [0,1]
  return { x: lm.x * W, y: lm.y * H };
}

CM.compositeAccessoryLandmarks = async function (personCanvas, accDataUrl, category) {
  var W = personCanvas.width;
  var H = personCanvas.height;

  // Rilevamento parallelo face + pose
  var faceNeeded = ['acc_hat','acc_glasses','acc_earring','acc_necklace','acc_scarf'].indexOf(category) !== -1;
  var poseNeeded = ['acc_belt','acc_bag','acc_scarf'].indexOf(category) !== -1;

  var faceLms = null, poseLms = null;
  var tasks = [];
  if (faceNeeded) tasks.push(runFaceMesh(personCanvas).then(function(r){ faceLms = r; }));
  if (poseNeeded) tasks.push(runPose(personCanvas).then(function(r){ poseLms = r; }));
  await Promise.all(tasks);

  // Carica immagine accessorio (trasparente)
  var accImg = await loadImage(accDataUrl);

  var out = document.createElement('canvas');
  out.width  = W;
  out.height = H;
  var ctx = out.getContext('2d');
  ctx.drawImage(personCanvas, 0, 0);

  var placement = computePlacement(category, faceLms, poseLms, W, H, accImg);
  ctx.drawImage(accImg, placement.x, placement.y, placement.w, placement.h);

  return out.toDataURL('image/jpeg', 0.92);
};

function loadImage(src) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

function computePlacement(category, face, pose, W, H, accImg) {
  var ratio = accImg.naturalWidth / accImg.naturalHeight;

  if (category === 'acc_hat') {
    if (face) {
      var top  = px(face[FACE.TOP_HEAD], W, H);
      var lEye = px(face[FACE.LEFT_EYE_OUTER], W, H);
      var rEye = px(face[FACE.RIGHT_EYE_OUTER], W, H);
      var faceW = Math.abs(rEye.x - lEye.x) * 2.2;
      var accW  = faceW;
      var accH  = accW / ratio;
      return { x: top.x - accW/2, y: top.y - accH * 0.75, w: accW, h: accH };
    }
    return fallback(W, H, 0.5, 0.04, 0.5, ratio);
  }

  if (category === 'acc_glasses') {
    if (face) {
      var lEye = px(face[FACE.LEFT_EYE_OUTER], W, H);
      var rEye = px(face[FACE.RIGHT_EYE_OUTER], W, H);
      var eyeW = Math.abs(rEye.x - lEye.x) * 1.6;
      var eyeY = (lEye.y + rEye.y) / 2;
      var eyeX = (lEye.x + rEye.x) / 2;
      var accW  = eyeW;
      var accH  = accW / ratio;
      return { x: eyeX - accW/2, y: eyeY - accH/2, w: accW, h: accH };
    }
    return fallback(W, H, 0.5, 0.22, 0.40, ratio);
  }

  if (category === 'acc_earring') {
    if (face) {
      // Orecchino sinistro (visibile in foto frontale = destra a schermo)
      var ear  = px(face[FACE.LEFT_EAR], W, H);
      var chin = px(face[FACE.CHIN], W, H);
      var earH = Math.abs(chin.y - ear.y) * 0.5;
      var accH  = earH;
      var accW  = accH * ratio;
      return { x: ear.x - accW * 0.2, y: ear.y, w: accW, h: accH };
    }
    return fallback(W, H, 0.25, 0.22, 0.15, ratio);
  }

  if (category === 'acc_necklace') {
    if (face) {
      var lSh, rSh;
      if (pose) {
        lSh = px(pose[11], W, H);
        rSh = px(pose[12], W, H);
      }
      var chin = px(face[FACE.CHIN], W, H);
      if (lSh && rSh) {
        var shoulderW = Math.abs(rSh.x - lSh.x) * 0.85;
        var centerX   = (lSh.x + rSh.x) / 2;
        var neckY     = chin.y + (lSh.y - chin.y) * 0.3;
        var accW = shoulderW;
        var accH = accW / ratio;
        return { x: centerX - accW/2, y: neckY - accH*0.1, w: accW, h: accH };
      }
      var accW = W * 0.35;
      var accH = accW / ratio;
      return { x: W/2 - accW/2, y: chin.y + H*0.03, w: accW, h: accH };
    }
    return fallback(W, H, 0.5, 0.30, 0.38, ratio);
  }

  if (category === 'acc_scarf') {
    if (pose) {
      var lSh = px(pose[11], W, H);
      var rSh = px(pose[12], W, H);
      var shoulderW = Math.abs(rSh.x - lSh.x) * 1.1;
      var centerX   = (lSh.x + rSh.x) / 2;
      var centerY   = (lSh.y + rSh.y) / 2 - H * 0.04;
      var accW = shoulderW;
      var accH = accW / ratio;
      return { x: centerX - accW/2, y: centerY, w: accW, h: accH };
    }
    return fallback(W, H, 0.5, 0.24, 0.60, ratio);
  }

  if (category === 'acc_belt') {
    if (pose) {
      var lHip = px(pose[23], W, H);
      var rHip = px(pose[24], W, H);
      var hipW    = Math.abs(rHip.x - lHip.x) * 1.35;
      var centerX = (lHip.x + rHip.x) / 2;
      var centerY = (lHip.y + rHip.y) / 2;
      var accW = hipW;
      var accH = accW / ratio;
      return { x: centerX - accW/2, y: centerY - accH/2, w: accW, h: accH };
    }
    return fallback(W, H, 0.5, 0.50, 0.65, ratio);
  }

  if (category === 'acc_bag') {
    if (pose) {
      var rHip = px(pose[24], W, H);
      var accW  = W * 0.30;
      var accH  = accW / ratio;
      return { x: rHip.x, y: rHip.y, w: accW, h: accH };
    }
    return fallback(W, H, 0.72, 0.55, 0.32, ratio);
  }

  return fallback(W, H, 0.5, 0.3, 0.4, ratio);
}

// Fallback senza landmark: xRel, yRel, wRel rispetto a W
function fallback(W, H, xRel, yRel, wRel, ratio) {
  var accW = W * wRel;
  var accH = accW / ratio;
  return { x: W * xRel - accW/2, y: H * yRel, w: accW, h: accH };
}

})();
