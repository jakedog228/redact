import { subscribe, getState } from '../state.js';
import { updateBox, deleteBox, duplicateBox, getSelectedBox } from './box-manager.js';
import { formatTime } from '../utils.js';
import { BOX_TYPES } from '../constants.js';
import { pushHistory } from './history.js';

let panelContent;

export function initPropertyPanel() {
  panelContent = document.getElementById('property-content');

  subscribe('SELECT_BOX', render);
  subscribe('UPDATE_BOX', render);
  subscribe('SET_BOXES', render);
  subscribe('DELETE_BOX', render);
}

function render() {
  const selectedId = getState('selectedBoxId');
  if (!selectedId) {
    panelContent.className = 'no-selection';
    panelContent.innerHTML = '<p class="hint">Select a box to edit</p>';
    return;
  }

  const box = getState('boxes').find(b => b.id === selectedId);
  if (!box) {
    panelContent.className = 'no-selection';
    panelContent.innerHTML = '<p class="hint">Select a box to edit</p>';
    return;
  }

  const isVideo = getState('mediaType') === 'video';

  panelContent.className = 'has-selection';
  panelContent.innerHTML = `
    <div class="prop-group">
      <label>X: <input type="number" id="prop-x" min="0" max="1" step="0.01" value="${box.x.toFixed(3)}" /></label>
      <label>Y: <input type="number" id="prop-y" min="0" max="1" step="0.01" value="${box.y.toFixed(3)}" /></label>
      <label>W: <input type="number" id="prop-w" min="0.01" max="1" step="0.01" value="${box.width.toFixed(3)}" /></label>
      <label>H: <input type="number" id="prop-h" min="0.01" max="1" step="0.01" value="${box.height.toFixed(3)}" /></label>
    </div>
    ${isVideo ? `
    <div class="prop-group">
      <label>Start: <input type="number" id="prop-start" min="0" step="0.1" value="${box.startTime.toFixed(2)}" /></label>
      <label>End: <input type="number" id="prop-end" min="0" step="0.1" value="${box.endTime.toFixed(2)}" /></label>
    </div>
    ` : ''}
    <div class="prop-group">
      <label>Type:
        <select id="prop-type">
          <option value="solid" ${box.type === 'solid' ? 'selected' : ''}>Solid</option>
          <option value="blur" ${box.type === 'blur' ? 'selected' : ''}>Blur</option>
          <option value="pixel" ${box.type === 'pixel' ? 'selected' : ''}>Pixel</option>
          <option value="anti" ${box.type === 'anti' ? 'selected' : ''}>Anti-Redaction</option>
        </select>
      </label>
    </div>
    <div class="prop-group" id="prop-color-group" style="${box.type !== 'solid' ? 'display:none' : ''}">
      <label>Color: <input type="color" id="prop-color" value="${box.color}" /></label>
    </div>
    <div class="prop-group" id="prop-blur-group" style="${(box.type !== 'blur' && box.type !== 'pixel') ? 'display:none' : ''}">
      <label>Intensity: <input type="range" id="prop-blur" min="1" max="20" value="${box.blurIntensity}" /></label>
    </div>
    <div class="prop-group prop-actions">
      <button id="prop-duplicate" class="secondary-btn">Duplicate</button>
      <button id="prop-delete" class="danger-btn">Delete</button>
    </div>
  `;

  // Bind events
  bindInput('prop-x', 'x', parseFloat);
  bindInput('prop-y', 'y', parseFloat);
  bindInput('prop-w', 'width', parseFloat);
  bindInput('prop-h', 'height', parseFloat);
  bindInput('prop-start', 'startTime', parseFloat);
  bindInput('prop-end', 'endTime', parseFloat);
  bindInput('prop-color', 'color', String);
  bindInput('prop-blur', 'blurIntensity', parseInt);

  document.getElementById('prop-type').addEventListener('change', (e) => {
    pushHistory();
    updateBox(box.id, { type: e.target.value });
  });

  document.getElementById('prop-duplicate').addEventListener('click', () => {
    pushHistory();
    duplicateBox(box);
  });

  document.getElementById('prop-delete').addEventListener('click', () => {
    pushHistory();
    deleteBox(box.id);
  });
}

function bindInput(elemId, prop, parser) {
  const el = document.getElementById(elemId);
  if (!el) return;
  el.addEventListener('change', (e) => {
    const val = parser(e.target.value);
    if (isNaN(val)) return;
    const selectedId = getState('selectedBoxId');
    if (selectedId) {
      pushHistory();
      updateBox(selectedId, { [prop]: val });
    }
  });
}
