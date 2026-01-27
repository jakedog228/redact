import { getState, subscribe } from '../state.js';
import { renderBoxes, renderAntiRedactions, renderSelectionHandles, renderEditingOutlines } from './box-renderer.js';

let canvas, ctx, video;
let animFrameId = null;
let useVideoFrameCallback = false;
// Buffer canvas to hold the last valid video frame, preventing flicker during seeks
let frameBuffer, frameCtx;
let hasFrame = false;

export function initCanvasOverlay() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  video = document.getElementById('video');

  frameBuffer = document.createElement('canvas');
  frameCtx = frameBuffer.getContext('2d');

  useVideoFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  subscribe('SET_VIDEO', () => {
    hasFrame = false;
    resizeCanvas();
    startRenderLoop();
  });

  subscribe('SET_IMAGE', () => {
    hasFrame = false;
    resizeCanvas();
    startRenderLoop();
  });

  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const area = document.getElementById('canvas-area');
  if (!area) return;

  const mediaWidth = getState('mediaWidth');
  const mediaHeight = getState('mediaHeight');
  if (!mediaWidth || !mediaHeight) return;

  const aspect = mediaWidth / mediaHeight;
  const maxW = area.clientWidth;
  const maxH = area.clientHeight;

  let w, h;
  if (maxW / maxH > aspect) {
    h = maxH;
    w = h * aspect;
  } else {
    w = maxW;
    h = w / aspect;
  }

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  frameBuffer.width = w;
  frameBuffer.height = h;
  hasFrame = false;
}

function startRenderLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  const mediaType = getState('mediaType');
  if (mediaType === 'video' && useVideoFrameCallback) {
    video.requestVideoFrameCallback(onVideoFrame);
  }
  renderLoop();
}

function onVideoFrame() {
  if (getState('mediaType') === 'video') {
    video.requestVideoFrameCallback(onVideoFrame);
  }
}

function renderLoop() {
  renderFrame();
  animFrameId = requestAnimationFrame(renderLoop);
}

function renderFrame() {
  if (!canvas.width || !canvas.height) return;

  const w = canvas.width;
  const h = canvas.height;
  const mediaType = getState('mediaType');

  // Draw media source to buffer
  if (mediaType === 'video') {
    // Capture video frame to buffer when available
    if (video.readyState >= 2) {
      frameCtx.clearRect(0, 0, w, h);
      frameCtx.drawImage(video, 0, 0, w, h);
      hasFrame = true;
    }
  } else if (mediaType === 'image') {
    const img = getState('imageElement');
    if (img && !hasFrame) {
      frameCtx.clearRect(0, 0, w, h);
      frameCtx.drawImage(img, 0, 0, w, h);
      hasFrame = true;
    }
  }

  // Draw buffered frame (keeps last valid frame during seeks)
  ctx.clearRect(0, 0, w, h);
  if (hasFrame) {
    ctx.drawImage(frameBuffer, 0, 0);
  }

  // Get active boxes - for images, all boxes are always active
  const boxes = getState('boxes');
  let activeBoxes;
  if (mediaType === 'image') {
    activeBoxes = boxes;
  } else {
    const currentTime = getState('currentTime');
    activeBoxes = boxes.filter(b => currentTime >= b.startTime && currentTime <= b.endTime);
  }

  const mediaW = getState('mediaWidth');
  const mediaH = getState('mediaHeight');
  renderBoxes(ctx, activeBoxes, w, h, mediaW, mediaH);

  // Render anti-redaction boxes (restore original content in those regions)
  renderAntiRedactions(ctx, activeBoxes, w, h, frameBuffer);

  // Draw editing mode outlines for all active boxes
  if (getState('editingMode')) {
    renderEditingOutlines(ctx, activeBoxes, w, h, getState('selectedBoxId'));
  }

  // Draw selection handles on selected box
  const selectedId = getState('selectedBoxId');
  if (selectedId) {
    const selected = boxes.find(b => b.id === selectedId);
    if (selected) {
      // For images, selected box is always active
      const isActive = mediaType === 'image' ||
        (getState('currentTime') >= selected.startTime && getState('currentTime') <= selected.endTime);
      renderSelectionHandles(ctx, selected, w, h, isActive);
    }
  }

  // Draw preview box if drawing
  const preview = getDrawPreview();
  if (preview) {
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      preview.x * w,
      preview.y * h,
      preview.width * w,
      preview.height * h
    );
    ctx.setLineDash([]);
  }
}

let drawPreview = null;

export function setDrawPreview(rect) {
  drawPreview = rect;
}

function getDrawPreview() {
  return drawPreview;
}

export function getCanvasElement() {
  return canvas;
}

export function canvasToNormalized(canvasX, canvasY) {
  return {
    x: canvasX / canvas.width,
    y: canvasY / canvas.height,
  };
}

export function getCanvasSize() {
  return { width: canvas.width, height: canvas.height };
}
