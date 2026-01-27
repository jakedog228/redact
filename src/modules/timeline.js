import { dispatch, subscribe, getState } from '../state.js';
import { seekTo } from './player.js';
import { formatTime, clamp } from '../utils.js';
import { TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM, TIMELINE_TICK_MIN_SPACING } from '../constants.js';

let rulerCanvas, rulerCtx;
let timelineBody;
let playhead;
let scrubbing = false;

export function initTimeline() {
  rulerCanvas = document.getElementById('timeline-ruler');
  rulerCtx = rulerCanvas.getContext('2d');
  timelineBody = document.getElementById('timeline-body');
  playhead = document.getElementById('timeline-playhead');

  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');

  zoomIn.addEventListener('click', () => {
    dispatch('SET_ZOOM', clamp(getState('timelineZoom') * 1.5, TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM));
  });

  zoomOut.addEventListener('click', () => {
    dispatch('SET_ZOOM', clamp(getState('timelineZoom') / 1.5, TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM));
  });

  timelineBody.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      dispatch('SET_ZOOM', clamp(getState('timelineZoom') * factor, TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM));
    }
  }, { passive: false });

  // Scrubbing
  rulerCanvas.addEventListener('mousedown', startScrub);
  document.addEventListener('mousemove', doScrub);
  document.addEventListener('mouseup', endScrub);

  subscribe('SET_TIME', updatePlayhead);
  subscribe('SET_ZOOM', () => { drawRuler(); updatePlayhead(); });
  subscribe('SET_VIDEO', () => { resizeRuler(); drawRuler(); });
  subscribe('SET_TIMELINE_SCROLL', () => { drawRuler(); updatePlayhead(); });

  timelineBody.addEventListener('scroll', () => {
    dispatch('SET_TIMELINE_SCROLL', timelineBody.scrollLeft);
  });

  window.addEventListener('resize', () => { resizeRuler(); drawRuler(); });
}

function resizeRuler() {
  const duration = getState('videoDuration');
  const zoom = getState('timelineZoom');
  const bodyWidth = timelineBody.clientWidth;
  const totalWidth = Math.max(bodyWidth, bodyWidth * zoom);

  rulerCanvas.width = totalWidth;
  rulerCanvas.height = 30;
  rulerCanvas.style.width = totalWidth + 'px';
}

function drawRuler() {
  const duration = getState('videoDuration');
  if (!duration) return;

  const zoom = getState('timelineZoom');
  const bodyWidth = timelineBody.clientWidth;
  const totalWidth = Math.max(bodyWidth, bodyWidth * zoom);

  rulerCanvas.width = totalWidth;
  rulerCanvas.style.width = totalWidth + 'px';

  const ctx = rulerCtx;
  ctx.clearRect(0, 0, totalWidth, 30);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, totalWidth, 30);

  // Calculate tick interval
  const pxPerSec = totalWidth / duration;
  let tickInterval = 1;
  const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
  for (const iv of intervals) {
    if (iv * pxPerSec >= TIMELINE_TICK_MIN_SPACING) {
      tickInterval = iv;
      break;
    }
  }

  ctx.strokeStyle = '#444';
  ctx.fillStyle = '#aaa';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';

  for (let t = 0; t <= duration; t += tickInterval) {
    const x = (t / duration) * totalWidth;
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, 30);
    ctx.stroke();
    ctx.fillText(formatTime(t), x, 14);
  }

  // Minor ticks
  const minorInterval = tickInterval / 4;
  if (minorInterval * pxPerSec >= 5) {
    ctx.strokeStyle = '#333';
    for (let t = 0; t <= duration; t += minorInterval) {
      const x = (t / duration) * totalWidth;
      ctx.beginPath();
      ctx.moveTo(x, 25);
      ctx.lineTo(x, 30);
      ctx.stroke();
    }
  }
}

function updatePlayhead() {
  const duration = getState('videoDuration');
  const currentTime = getState('currentTime');
  if (!duration) return;

  const zoom = getState('timelineZoom');
  const bodyWidth = timelineBody.clientWidth;
  const totalWidth = Math.max(bodyWidth, bodyWidth * zoom);
  const x = (currentTime / duration) * totalWidth;

  playhead.style.left = x + 'px';
}

function startScrub(e) {
  scrubbing = true;
  scrubTo(e);
}

function doScrub(e) {
  if (!scrubbing) return;
  scrubTo(e);
}

function endScrub() {
  scrubbing = false;
}

function scrubTo(e) {
  const rect = rulerCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const duration = getState('videoDuration');
  const zoom = getState('timelineZoom');
  const bodyWidth = timelineBody.clientWidth;
  const totalWidth = Math.max(bodyWidth, bodyWidth * zoom);
  const time = clamp((x / totalWidth) * duration, 0, duration);
  seekTo(time);
}

export function getTimelineWidth() {
  const zoom = getState('timelineZoom');
  const bodyWidth = document.getElementById('timeline-body')?.clientWidth || 800;
  return Math.max(bodyWidth, bodyWidth * zoom);
}
