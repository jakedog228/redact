import { getState, dispatch, subscribe } from '../state.js';
import { MAX_UNDO_HISTORY } from '../constants.js';

let undoStack = [];
let redoStack = [];

export function initHistory() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  subscribe('SET_BOXES', updateButtons);
  subscribe('ADD_BOX', updateButtons);
  subscribe('UPDATE_BOX', updateButtons);
  subscribe('DELETE_BOX', updateButtons);

  updateButtons();
}

/**
 * Push current box state onto undo stack. Call before mutations.
 */
export function pushHistory() {
  const snapshot = JSON.parse(JSON.stringify(getState('boxes')));
  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO_HISTORY) {
    undoStack.shift();
  }
  redoStack = [];
  updateButtons();
}

export function undo() {
  if (undoStack.length === 0) return;
  const currentSnapshot = JSON.parse(JSON.stringify(getState('boxes')));
  redoStack.push(currentSnapshot);
  const prev = undoStack.pop();
  dispatch('SET_BOXES', prev);
  updateButtons();
}

export function redo() {
  if (redoStack.length === 0) return;
  const currentSnapshot = JSON.parse(JSON.stringify(getState('boxes')));
  undoStack.push(currentSnapshot);
  const next = redoStack.pop();
  dispatch('SET_BOXES', next);
  updateButtons();
}

/**
 * Clear all history (for new file import).
 */
export function clearHistory() {
  undoStack = [];
  redoStack = [];
  updateButtons();
}

function updateButtons() {
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}
