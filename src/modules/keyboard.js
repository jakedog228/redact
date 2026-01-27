import { dispatch, getState } from '../state.js';
import { togglePlay, stepTime, seekTo } from './player.js';
import { deleteBox, updateBox, getSelectedBox, duplicateBox } from './box-manager.js';
import { undo, redo, pushHistory } from './history.js';
import { TOOLS, BOX_TYPES, FRAME_STEP } from '../constants.js';
import { matchesKeybind } from './settings.js';

// Clipboard for copy/paste
let clipboard = null;

export function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in an input or recording keybind
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Don't handle if no media loaded
    const mediaType = getState('mediaType');
    if (!mediaType) return;

    const isVideo = mediaType === 'video';

    // Play/Pause (video only)
    if (matchesKeybind(e, 'playPause')) {
      if (isVideo) {
        e.preventDefault();
        togglePlay();
      }
      return;
    }

    // Tool selection
    if (matchesKeybind(e, 'draw')) {
      e.preventDefault();
      dispatch('SET_TOOL', TOOLS.DRAW);
      return;
    }

    if (matchesKeybind(e, 'select')) {
      // Check for paste first (Ctrl+V)
      if (matchesKeybind(e, 'paste') && clipboard) {
        e.preventDefault();
        pushHistory();
        duplicateBox(clipboard);
        return;
      }
      e.preventDefault();
      dispatch('SET_TOOL', TOOLS.SELECT);
      return;
    }

    // Box types
    if (matchesKeybind(e, 'typeSolid')) {
      e.preventDefault();
      dispatch('SET_BOX_TYPE', BOX_TYPES.SOLID);
      return;
    }

    if (matchesKeybind(e, 'typeBlur')) {
      e.preventDefault();
      dispatch('SET_BOX_TYPE', BOX_TYPES.BLUR);
      return;
    }

    if (matchesKeybind(e, 'typePixel')) {
      e.preventDefault();
      dispatch('SET_BOX_TYPE', BOX_TYPES.PIXEL);
      return;
    }

    if (matchesKeybind(e, 'typeAnti')) {
      e.preventDefault();
      dispatch('SET_BOX_TYPE', BOX_TYPES.ANTI);
      return;
    }

    // Editing mode
    if (matchesKeybind(e, 'editingMode')) {
      e.preventDefault();
      dispatch('SET_EDITING_MODE', !getState('editingMode'));
      return;
    }

    // Copy
    if (matchesKeybind(e, 'copy')) {
      e.preventDefault();
      const selected = getSelectedBox();
      if (selected) {
        clipboard = { ...selected };
      }
      return;
    }

    // Paste
    if (matchesKeybind(e, 'paste')) {
      e.preventDefault();
      if (clipboard) {
        pushHistory();
        duplicateBox(clipboard);
      }
      return;
    }

    // Step back (video only)
    if (matchesKeybind(e, 'stepBack')) {
      if (isVideo) {
        e.preventDefault();
        stepTime(e.shiftKey ? -1 : -FRAME_STEP);
      }
      return;
    }

    // Step forward (video only)
    if (matchesKeybind(e, 'stepForward')) {
      if (isVideo) {
        e.preventDefault();
        stepTime(e.shiftKey ? 1 : FRAME_STEP);
      }
      return;
    }

    // Delete
    if (matchesKeybind(e, 'delete') || e.key === 'Backspace') {
      const selectedId = getState('selectedBoxId');
      if (selectedId) {
        e.preventDefault();
        pushHistory();
        deleteBox(selectedId);
      }
      return;
    }

    // Undo
    if (matchesKeybind(e, 'undo')) {
      e.preventDefault();
      undo();
      return;
    }

    // Redo
    if (matchesKeybind(e, 'redo')) {
      e.preventDefault();
      redo();
      return;
    }

    // Set start time (video only)
    if (matchesKeybind(e, 'setStart')) {
      if (isVideo) {
        const id = getState('selectedBoxId');
        if (id) {
          e.preventDefault();
          pushHistory();
          updateBox(id, { startTime: getState('currentTime') });
        }
      }
      return;
    }

    // Set end time (video only)
    if (matchesKeybind(e, 'setEnd')) {
      if (isVideo) {
        const id = getState('selectedBoxId');
        if (id) {
          e.preventDefault();
          pushHistory();
          updateBox(id, { endTime: getState('currentTime') });
        }
      }
      return;
    }
  });
}
