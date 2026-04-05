/* ── CONSTANTS ───────────────────────────────────────── */
const MAX_IMG_WIDTH = 800;
const FACE_SCORE_THRESHOLD = 0.4;
const TRYON_WIDTH = 600;
const TRYON_HEIGHT = 750;
const BG_REMOVAL_THRESHOLD = 40;
const SHARPENING_STRENGTH = 0.3;
const SAT_BOOST = 0.10;
const FACE_API_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/* ── GLOBAL STATE ────────────────────────────────────── */
const STATE = {
  faceModelsLoaded: false,
  armoImage: null,
  faceImage: null,
  tryonPersonImage: null,
  tryonGarmentImage: null,
};
