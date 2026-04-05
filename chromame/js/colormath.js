/* ═══════════════════════════════════════════════════════
   ChromaMe — Color Math (pure functions, no DOM)
   Full sRGB → CIE LAB + Delta-E CIE2000
   ═══════════════════════════════════════════════════════ */

/**
 * Convert HEX string to RGB object.
 * @param {string} hex - e.g. "#3A5A8C"
 * @returns {{r:number,g:number,b:number}}
 */
export function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
}

/**
 * Convert RGB to HEX string (clamped 0–255).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Convert RGB to HSL.
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{h:number,s:number,l:number}} h 0-360, s/l 0-100
 */
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL back to RGB.
 * @param {number} h 0-360
 * @param {number} s 0-100
 * @param {number} l 0-100
 * @returns {{r:number,g:number,b:number}}
 */
export function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

/**
 * Convert RGB to CIE LAB (D65 illuminant, full sRGB pipeline).
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{L:number,a:number,b:number}}
 */
export function rgbToLab(r, g, b) {
  // Step 1: sRGB linearization (IEC 61966-2-1)
  let rr = r / 255, gg = g / 255, bb = b / 255;
  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;
  // Step 2: sRGB to XYZ (D65)
  let x = rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375;
  let y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.0721750;
  let z = rr * 0.0193339 + gg * 0.1191920 + bb * 0.9503041;
  // Step 3: Normalize by D65 whitepoint
  x /= 0.95047; y /= 1.00000; z /= 1.08883;
  // Step 4: CIE f() function
  const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  // Step 5: LAB
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

/**
 * Delta-E CIE2000 between two LAB colors.
 * Full formula with chroma correction, hue angle, weighting functions, rotation term.
 * @param {{L:number,a:number,b:number}} lab1
 * @param {{L:number,a:number,b:number}} lab2
 * @returns {number}
 */
export function deltaECIE2000(lab1, lab2) {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  const kL = 1, kC = 1, kH = 1;
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;
  const Cab7 = Math.pow(Cab, 7);
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * deg;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * deg;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * rad / 2);

  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;

  let hpm;
  if (C1p * C2p === 0) {
    hpm = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hpm = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hpm = (h1p + h2p + 360) / 2;
  } else {
    hpm = (h1p + h2p - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((hpm - 30) * rad)
    + 0.24 * Math.cos(2 * hpm * rad)
    + 0.32 * Math.cos((3 * hpm + 6) * rad)
    - 0.20 * Math.cos((4 * hpm - 63) * rad);

  const SL = 1 + 0.015 * Math.pow(Lpm - 50, 2) / Math.sqrt(20 + Math.pow(Lpm - 50, 2));
  const SC = 1 + 0.045 * Cpm;
  const SH = 1 + 0.015 * Cpm * T;

  const Cpm7 = Math.pow(Cpm, 7);
  const RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + Math.pow(25, 7)));
  const dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
  const RT = -Math.sin(2 * dTheta * rad) * RC;

  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}

/**
 * Get perceptual luminance from RGB (0–255 scale).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function getLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Fitzpatrick scale from L* (LAB luminosity).
 * @param {number} L
 * @returns {string}
 */
export function fitzpatrick(L) {
  if (L > 80) return 'I';
  if (L > 70) return 'II';
  if (L > 58) return 'III';
  if (L > 45) return 'IV';
  if (L > 30) return 'V';
  return 'VI';
}

/**
 * Choose dark or light text color for a given background hex.
 * @param {string} hex
 * @returns {string}
 */
export function textColorFor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return getLuminance(r, g, b) > 140 ? '#2C2420' : '#FAF7F2';
}
