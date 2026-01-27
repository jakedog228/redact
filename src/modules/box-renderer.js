import { HANDLE_SIZE, BOX_TYPES } from '../constants.js';

/**
 * Render all active redaction boxes on the canvas (solid and blur only).
 * Anti-redaction boxes are handled separately via renderAntiRedactions.
 * mediaW/mediaH are the native resolution; used to scale blur/pixel so the
 * preview matches the export regardless of display size.
 */
export function renderBoxes(ctx, boxes, canvasW, canvasH, mediaW, mediaH) {
  // Scale factor: when canvas is smaller than native, shrink effect radius to match
  const scale = mediaW ? (canvasW / mediaW) : 1;

  for (const box of boxes) {
    // Skip anti-redaction boxes - they're rendered separately
    if (box.type === BOX_TYPES.ANTI) continue;

    const px = Math.round(box.x * canvasW);
    const py = Math.round(box.y * canvasH);
    const pw = Math.round(box.width * canvasW);
    const ph = Math.round(box.height * canvasH);

    if (pw <= 0 || ph <= 0) continue;

    if (box.type === BOX_TYPES.SOLID) {
      ctx.fillStyle = box.color;
      ctx.fillRect(px, py, pw, ph);
    } else if (box.type === BOX_TYPES.BLUR) {
      applyBlur(ctx, px, py, pw, ph, box.blurIntensity, canvasW, canvasH, scale);
    } else if (box.type === BOX_TYPES.PIXEL) {
      applyPixelate(ctx, px, py, pw, ph, box.blurIntensity, canvasW, canvasH, scale);
    }
  }
}

/**
 * Render anti-redaction boxes by restoring original content from the frame buffer.
 * Call this AFTER renderBoxes to "punch holes" in the redaction layer.
 */
export function renderAntiRedactions(ctx, boxes, canvasW, canvasH, frameBuffer) {
  const antiBoxes = boxes.filter(b => b.type === BOX_TYPES.ANTI);
  if (antiBoxes.length === 0) return;

  for (const box of antiBoxes) {
    const px = Math.round(box.x * canvasW);
    const py = Math.round(box.y * canvasH);
    const pw = Math.round(box.width * canvasW);
    const ph = Math.round(box.height * canvasH);

    if (pw <= 0 || ph <= 0) continue;

    // Clamp to canvas bounds
    const sx = Math.max(0, px);
    const sy = Math.max(0, py);
    const sw = Math.min(pw, canvasW - sx);
    const sh = Math.min(ph, canvasH - sy);

    if (sw <= 0 || sh <= 0) continue;

    // Copy the original frame region back, overwriting any redactions
    ctx.drawImage(frameBuffer, sx, sy, sw, sh, sx, sy, sw, sh);
  }
}

/**
 * Apply box blur to a region using getImageData/putImageData.
 * scale adjusts the radius so the preview matches export at native resolution.
 */
function applyBlur(ctx, x, y, w, h, intensity, canvasW, canvasH, scale) {
  // Clamp region to canvas bounds
  const sx = Math.max(0, x);
  const sy = Math.max(0, y);
  const sw = Math.min(w, canvasW - sx);
  const sh = Math.min(h, canvasH - sy);

  if (sw <= 0 || sh <= 0) return;

  const radius = Math.max(1, Math.round(intensity * scale));
  const passes = Math.min(3, Math.max(1, Math.ceil(intensity / 7)));

  let imageData;
  try {
    imageData = ctx.getImageData(sx, sy, sw, sh);
  } catch (e) {
    // Fallback: just draw a semi-transparent black box
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx, sy, sw, sh);
    return;
  }

  const data = imageData.data;

  for (let pass = 0; pass < passes; pass++) {
    boxBlurH(data, sw, sh, radius);
    boxBlurV(data, sw, sh, radius);
  }

  ctx.putImageData(imageData, sx, sy);
}

/**
 * Apply pixelation to a region by scaling down then back up with nearest neighbor.
 * scale adjusts the block size so the preview matches export at native resolution.
 */
function applyPixelate(ctx, x, y, w, h, intensity, canvasW, canvasH, scale) {
  const sx = Math.max(0, x);
  const sy = Math.max(0, y);
  const sw = Math.min(w, canvasW - sx);
  const sh = Math.min(h, canvasH - sy);

  if (sw <= 0 || sh <= 0) return;

  const factor = Math.max(2, Math.round(intensity * 1.5 * scale));
  const smallW = Math.max(1, Math.round(sw / factor));
  const smallH = Math.max(1, Math.round(sh / factor));

  // Save current smoothing state
  const prevSmoothing = ctx.imageSmoothingEnabled;

  // Scale down (with smoothing to average pixels)
  ctx.imageSmoothingEnabled = true;
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = smallW;
  tmpCanvas.height = smallH;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, smallW, smallH);

  // Scale back up (nearest neighbor for blocky look)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmpCanvas, 0, 0, smallW, smallH, sx, sy, sw, sh);

  // Restore smoothing state
  ctx.imageSmoothingEnabled = prevSmoothing;
}

/**
 * Horizontal box blur pass using running sum.
 */
function boxBlurH(data, w, h, radius) {
  const diam = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let ri = 0, gi = 0, bi = 0;
    const rowOffset = y * w * 4;

    // Initialize sum for first pixel
    for (let x = -radius; x <= radius; x++) {
      const idx = rowOffset + Math.min(Math.max(x, 0), w - 1) * 4;
      ri += data[idx];
      gi += data[idx + 1];
      bi += data[idx + 2];
    }

    for (let x = 0; x < w; x++) {
      const idx = rowOffset + x * 4;
      data[idx] = (ri / diam) | 0;
      data[idx + 1] = (gi / diam) | 0;
      data[idx + 2] = (bi / diam) | 0;

      // Slide window
      const addIdx = rowOffset + Math.min(x + radius + 1, w - 1) * 4;
      const removeIdx = rowOffset + Math.max(x - radius, 0) * 4;
      ri += data[addIdx] - data[removeIdx];
      gi += data[addIdx + 1] - data[removeIdx + 1];
      bi += data[addIdx + 2] - data[removeIdx + 2];
    }
  }
}

/**
 * Vertical box blur pass using running sum.
 */
function boxBlurV(data, w, h, radius) {
  const diam = radius * 2 + 1;
  for (let x = 0; x < w; x++) {
    let ri = 0, gi = 0, bi = 0;

    for (let y = -radius; y <= radius; y++) {
      const idx = Math.min(Math.max(y, 0), h - 1) * w * 4 + x * 4;
      ri += data[idx];
      gi += data[idx + 1];
      bi += data[idx + 2];
    }

    for (let y = 0; y < h; y++) {
      const idx = y * w * 4 + x * 4;
      data[idx] = (ri / diam) | 0;
      data[idx + 1] = (gi / diam) | 0;
      data[idx + 2] = (bi / diam) | 0;

      const addIdx = Math.min(y + radius + 1, h - 1) * w * 4 + x * 4;
      const removeIdx = Math.max(y - radius, 0) * w * 4 + x * 4;
      ri += data[addIdx] - data[removeIdx];
      gi += data[addIdx + 1] - data[removeIdx + 1];
      bi += data[addIdx + 2] - data[removeIdx + 2];
    }
  }
}

/**
 * Render selection handles around a box.
 * If isActive is false, renders a dashed outline instead of solid + handles.
 */
export function renderSelectionHandles(ctx, box, canvasW, canvasH, isActive = true) {
  const px = box.x * canvasW;
  const py = box.y * canvasH;
  const pw = box.width * canvasW;
  const ph = box.height * canvasH;

  // Read accent color from CSS variables
  const style = getComputedStyle(document.documentElement);
  const accentColor = style.getPropertyValue('--accent').trim() || '#C9A882';
  const bgColor = style.getPropertyValue('--bg-card').trim() || '#252320';

  if (!isActive) {
    // Dashed outline for selected but inactive box
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.6;
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }

  // Draw solid border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  // Draw handles
  const hs = HANDLE_SIZE;
  const handles = [
    { x: px, y: py },                             // nw
    { x: px + pw / 2, y: py },                    // n
    { x: px + pw, y: py },                        // ne
    { x: px + pw, y: py + ph / 2 },               // e
    { x: px + pw, y: py + ph },                   // se
    { x: px + pw / 2, y: py + ph },               // s
    { x: px, y: py + ph },                        // sw
    { x: px, y: py + ph / 2 },                    // w
  ];

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  for (const h of handles) {
    ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
    ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
  }
}

/**
 * Render outlines for all active boxes in editing mode.
 */
export function renderEditingOutlines(ctx, activeBoxes, canvasW, canvasH, selectedId) {
  for (const box of activeBoxes) {
    if (box.id === selectedId) continue; // selected box already has its own outline
    const px = box.x * canvasW;
    const py = box.y * canvasH;
    const pw = box.width * canvasW;
    const ph = box.height * canvasH;

    // Use warm, muted colors for editing outlines
    const outlineColors = {
      blur: '#9B8AC4',   // soft purple
      pixel: '#E8A87C', // soft orange
      anti: '#8BC49A',  // soft green
    };
    ctx.strokeStyle = outlineColors[box.type] || (box.color === '#000000' ? '#7A756E' : box.color);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
}
