/* ── APPLICATION CONSTANTS ───────────────────────────── */
export const MAX_IMG_WIDTH = 800;
export const FACE_SCORE_THRESHOLD = 0.4;
export const TRYON_WIDTH = 600;
export const TRYON_HEIGHT = 750;
export const BG_REMOVAL_THRESHOLD = 40;
export const SHARPENING_STRENGTH = 0.3;
export const SAT_BOOST = 0.10;
export const FACE_API_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/* ── GLOBAL STATE ────────────────────────────────────── */
export const STATE = {
  faceModelsLoaded: false,
  armoImage: null,
  faceImage: null,
  tryonPersonImage: null,
  tryonGarmentImage: null,
};
