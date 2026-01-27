import { getState, subscribe } from '../state.js';

const FRAME_INTERVAL = 0.2; // seconds between captured frames
const SCALE = 0.5; // resolution scale factor (0.5 = half res)

let frames = []; // { time, bitmap }
let generating = false;
let progress = 0;
let abortController = null;

export function initFilmstrip() {
  subscribe('SET_VIDEO', () => {
    generateFilmstrip();
  });
}

/**
 * Get the nearest filmstrip frame for a given time.
 * Returns an ImageBitmap or null.
 */
export function getFilmstripFrame(time) {
  if (frames.length === 0) return null;

  // Binary search for nearest frame
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  // Check if lo or lo-1 is closer
  if (lo > 0 && Math.abs(frames[lo - 1].time - time) < Math.abs(frames[lo].time - time)) {
    return frames[lo - 1].bitmap;
  }
  return frames[lo].bitmap;
}

/**
 * Get generation progress (0-1).
 */
export function getFilmstripProgress() {
  return progress;
}

export function isFilmstripReady() {
  return !generating && frames.length > 0;
}

async function generateFilmstrip() {
  // Abort any in-progress generation
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const signal = abortController.signal;

  // Clean up old frames
  for (const f of frames) {
    f.bitmap.close();
  }
  frames = [];
  generating = true;
  progress = 0;

  const videoFile = getState('videoFile');
  const duration = getState('videoDuration');
  const videoWidth = getState('videoWidth');
  const videoHeight = getState('videoHeight');

  if (!videoFile || !duration) {
    generating = false;
    return;
  }

  const captureW = Math.round(videoWidth * SCALE);
  const captureH = Math.round(videoHeight * SCALE);

  // Create a dedicated video element for frame extraction
  const extractVideo = document.createElement('video');
  extractVideo.muted = true;
  extractVideo.preload = 'auto';
  extractVideo.src = document.getElementById('video').src;

  await new Promise((resolve, reject) => {
    extractVideo.onloadeddata = resolve;
    extractVideo.onerror = reject;
  });

  if (signal.aborted) { cleanup(extractVideo); return; }

  // Create offscreen canvas for capture
  const offCanvas = document.createElement('canvas');
  offCanvas.width = captureW;
  offCanvas.height = captureH;
  const offCtx = offCanvas.getContext('2d');

  const totalFrames = Math.ceil(duration / FRAME_INTERVAL);

  for (let i = 0; i <= totalFrames; i++) {
    if (signal.aborted) { cleanup(extractVideo); return; }

    const time = Math.min(i * FRAME_INTERVAL, duration);

    // Seek and wait
    extractVideo.currentTime = time;
    await new Promise((resolve) => {
      extractVideo.onseeked = resolve;
    });

    if (signal.aborted) { cleanup(extractVideo); return; }

    // Draw and capture as ImageBitmap
    offCtx.drawImage(extractVideo, 0, 0, captureW, captureH);
    const bitmap = await createImageBitmap(offCanvas);

    frames.push({ time, bitmap });
    progress = (i + 1) / (totalFrames + 1);

    // Yield to main thread periodically
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  generating = false;
  progress = 1;
  cleanup(extractVideo);
}

function cleanup(videoEl) {
  videoEl.src = '';
  videoEl.load();
}
