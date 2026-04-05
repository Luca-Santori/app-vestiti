/* ══════════════════════════════════════════════════════
   PROGRESS SYSTEM
   ══════════════════════════════════════════════════════ */

/**
 * Initialize step dots for a progress area.
 * @param {string} prefix - e.g. 'armo'
 * @param {number} totalSteps
 */
export function initProgress(prefix, totalSteps) {
  const dotsEl = document.getElementById(`${prefix}-dots`);
  dotsEl.innerHTML = '';
  for (let i = 0; i < totalSteps; i++) {
    const dot = document.createElement('div');
    dot.className = 'step-dot';
    dotsEl.appendChild(dot);
  }
  document.getElementById(`${prefix}-bar`).style.width = '0%';
  document.getElementById(`${prefix}-log`).textContent = '';
  const area = document.getElementById(`${prefix}-progress`);
  area.classList.add('active');
}

/**
 * Update step progress.
 * @param {string} prefix
 * @param {number} step - current (1-based)
 * @param {number} total
 */
export function setStep(prefix, step, total) {
  const dots = document.getElementById(`${prefix}-dots`).children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('filled', i < step);
  }
  document.getElementById(`${prefix}-bar`).style.width = `${Math.round(step/total*100)}%`;
}

/**
 * Set log message in progress area.
 * @param {string} prefix
 * @param {string} msg
 */
export function setLog(prefix, msg) {
  document.getElementById(`${prefix}-log`).textContent = msg;
}

/** Small async delay for UI updates. */
export function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
