/* ═══════════════════════════════════════════════════════
   ChromaMe — Accessory & Garment Placement
   FaceMesh (468 punti) + Pose (33 punti) → compositing
   Background Removal: canvas threshold istantaneo (zero download)
   ═══════════════════════════════════════════════════════ */

(function () {

/* ── Rimozione sfondo istantanea via canvas ─────────────
   Funziona per qualsiasi colore di sfondo uniforme:
   bianco, grigio, viola, azzurro ecc. (tipico e-commerce)
   < 5ms, zero network, zero dipendenze.
   ──────────────────────────────────────────────────── */

CM.removeBgInstant = function (sourceCanvas) {
  var W = sourceCanvas.width;
  var H = sourceCanvas.height;

  var tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  var ctx = tmp.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  var img = ctx.getImageData(0, 0, W, H);
  var d   = img.data;

  // 1. Campiona i bordi (top+bottom row, left+right col) per rilevare il colore di sfondo
  var rSum = 0, gSum = 0, bSum = 0, cnt = 0;
  var addSample = function(x, y) {
    var i = (y * W + x) * 4;
    rSum += d[i]; gSum += d[i+1]; bSum += d[i+2]; cnt++;
  };
  for (var x = 0; x < W; x++) { addSample(x, 0); addSample(x, H-1); }
  for (var y = 1; y < H-1; y++) { addSample(0, y); addSample(W-1, y); }
  var bgR = rSum/cnt, bgG = gSum/cnt, bgB = bSum/cnt;

  // 2. Rimuovi pixel vicini al colore di sfondo con soglia adattiva
  //    threshold base: 50 su scala 0-441 (max dist euclidea tra colori)
  var thr = 55;
  for (var i = 0; i < d.length; i += 4) {
    var dr = d[i]   - bgR;
    var dg = d[i+1] - bgG;
    var db = d[i+2] - bgB;
    var dist = Math.sqrt(dr*dr + dg*dg + db*db);
    if (dist < thr) {
      d[i+3] = 0; // trasparente
    } else if (dist < thr * 2.2) {
      // Bordo morbido (anti-aliasing)
      d[i+3] = Math.round(255 * (dist - thr) / (thr * 1.2));
    }
    // altrimenti alpha rimane 255 (opaco)
  }

  ctx.putImageData(img, 0, 0);
  return tmp.toDataURL('image/png');
};

// Alias per compatibilità con vecchio codice che usava removeBackgroundBrowser
CM.removeBackgroundBrowser = function (canvas, onProgress) {
  if (onProgress) onProgress('Rimozione sfondo istantanea…');
  return Promise.resolve(CM.removeBgInstant(canvas));
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

/* ── Try-On capi (RMBG-1.4 + MediaPipe Pose) ──────────
   Funziona 100% nel browser, zero server, zero token.
   Qualità visiva buona per foto frontali su sfondo neutro.
   ──────────────────────────────────────────────────── */

CM.compositeGarmentLandmarks = async function (personCanvas, garmentDataUrl, category) {
  var W = personCanvas.width;
  var H = personCanvas.height;

  // Rileva pose per posizionamento capo
  var poseLms = await runPose(personCanvas);

  var garmentImg = await loadImage(garmentDataUrl);

  var out = document.createElement('canvas');
  out.width  = W;
  out.height = H;
  var ctx = out.getContext('2d');
  ctx.drawImage(personCanvas, 0, 0);

  var placement = computeGarmentPlacement(category, poseLms, W, H, garmentImg);

  // Disegna il capo con lieve ombra per realismo
  ctx.save();
  ctx.globalAlpha = 0.97;
  ctx.drawImage(garmentImg, placement.x, placement.y, placement.w, placement.h);
  ctx.restore();

  return out.toDataURL('image/jpeg', 0.93);
};

function computeGarmentPlacement(category, pose, W, H, img) {
  var ratio = img.naturalWidth / img.naturalHeight;

  // Estrai landmark di riferimento (con fallback proporzionale)
  var lSh, rSh, lHip, rHip, lAnk, rAnk;

  if (pose) {
    lSh  = { x: pose[11].x * W, y: pose[11].y * H };
    rSh  = { x: pose[12].x * W, y: pose[12].y * H };
    lHip = { x: pose[23].x * W, y: pose[23].y * H };
    rHip = { x: pose[24].x * W, y: pose[24].y * H };
    // Ankle: landmark 27 (sinistra) e 28 (destra)
    lAnk = pose[27] ? { x: pose[27].x * W, y: pose[27].y * H } : null;
    rAnk = pose[28] ? { x: pose[28].x * W, y: pose[28].y * H } : null;
  } else {
    // Fallback proporzionale senza pose
    lSh  = { x: W * 0.32, y: H * 0.20 };
    rSh  = { x: W * 0.68, y: H * 0.20 };
    lHip = { x: W * 0.35, y: H * 0.52 };
    rHip = { x: W * 0.65, y: H * 0.52 };
    lAnk = { x: W * 0.37, y: H * 0.90 };
    rAnk = { x: W * 0.63, y: H * 0.90 };
  }

  var shoulderW = Math.abs(rSh.x - lSh.x);
  var hipW      = Math.abs(rHip.x - lHip.x);
  var centerX   = (lSh.x + rSh.x) / 2;
  var hipCenterX = (lHip.x + rHip.x) / 2;
  var ankleY    = lAnk && rAnk ? (lAnk.y + rAnk.y) / 2 : H * 0.92;

  if (category === 'upper') {
    // Parte superiore: spalle → fianchi
    var w = shoulderW * 1.25;
    var h = w / ratio;
    var yTop = Math.min(lSh.y, rSh.y) - h * 0.08;
    var yBot = (lHip.y + rHip.y) / 2;
    // Se l'immagine del capo è troppo corta/lunga, adatta all'altezza
    if (h < (yBot - yTop) * 0.7) {
      h = (yBot - yTop) * 1.05;
      w = h * ratio;
    }
    return { x: centerX - w/2, y: yTop, w: w, h: h };
  }

  if (category === 'lower') {
    // Parte inferiore: fianchi → caviglie
    var w = hipW * 1.30;
    var h = w / ratio;
    var yTop = (lHip.y + rHip.y) / 2 - h * 0.04;
    var targetH = ankleY - yTop;
    if (h < targetH * 0.7) {
      h = targetH * 1.05;
      w = h * ratio;
    }
    return { x: hipCenterX - w/2, y: yTop, w: w, h: h };
  }

  if (category === 'dress' || category === 'full') {
    // Vestito intero / tuta: spalle → caviglie
    var w = shoulderW * 1.25;
    var h = w / ratio;
    var yTop = Math.min(lSh.y, rSh.y) - h * 0.05;
    var targetH = ankleY - yTop;
    if (h < targetH * 0.85) {
      h = targetH * 1.05;
      w = h * ratio;
    }
    return { x: centerX - w/2, y: yTop, w: w, h: h };
  }

  // Fallback generico: centra nella metà inferiore
  var w = W * 0.7;
  var h = w / ratio;
  return { x: centerX - w/2, y: H * 0.18, w: w, h: h };
}

})();
