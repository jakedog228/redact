import { initUpload } from './modules/upload.js';
import { initPlayer } from './modules/player.js';
import { initCanvasOverlay } from './modules/canvas-overlay.js';
import { initBoxInteraction } from './modules/box-interaction.js';
import { initToolbar } from './modules/toolbar.js';
import { initPropertyPanel } from './modules/property-panel.js';
import { initTimeline } from './modules/timeline.js';
import { initTimelineSpans } from './modules/timeline-spans.js';
import { initExport } from './modules/export.js';
import { initKeyboard } from './modules/keyboard.js';
import { initHistory } from './modules/history.js';
import { initSettings } from './modules/settings.js';
import { subscribe } from './state.js';

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// When media is loaded, switch to editor
subscribe('SET_VIDEO', () => {
  showScreen('editor-screen');
  setVideoMode(true);
});

subscribe('SET_IMAGE', () => {
  showScreen('editor-screen');
  setVideoMode(false);
});

function setVideoMode(isVideo) {
  // Show/hide video-only UI elements
  document.getElementById('playback-controls').style.display = isVideo ? '' : 'none';
  document.getElementById('timeline').style.display = isVideo ? '' : 'none';
}

// Initialize all modules
initUpload();
initPlayer();
initCanvasOverlay();
initBoxInteraction();
initToolbar();
initPropertyPanel();
initTimeline();
initTimelineSpans();
initExport();
initSettings();  // Must be before keyboard for keybind config
initKeyboard();
initHistory();
