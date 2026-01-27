/**
 * Format seconds into MM:SS.mm
 */
export function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const frac = Math.floor((secs - whole) * 100);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(frac).padStart(2, '0')}`;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generate a unique ID.
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Check if a point (px, py) is inside a rect {x, y, width, height} (all normalized 0-1).
 */
export function pointInRect(px, py, rect) {
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * Get which resize handle (if any) the point is near.
 * Returns handle name: 'nw','n','ne','e','se','s','sw','w' or null.
 */
export function getHandle(px, py, rect, handleSize) {
  const hs = handleSize;
  const corners = {
    nw: { x: rect.x, y: rect.y },
    n: { x: rect.x + rect.width / 2, y: rect.y },
    ne: { x: rect.x + rect.width, y: rect.y },
    e: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
    se: { x: rect.x + rect.width, y: rect.y + rect.height },
    s: { x: rect.x + rect.width / 2, y: rect.y + rect.height },
    sw: { x: rect.x, y: rect.y + rect.height },
    w: { x: rect.x, y: rect.y + rect.height / 2 },
  };

  for (const [name, pos] of Object.entries(corners)) {
    if (Math.abs(px - pos.x) <= hs && Math.abs(py - pos.y) <= hs) {
      return name;
    }
  }
  return null;
}

/**
 * Debounce a function.
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
