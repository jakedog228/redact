import { dispatch, subscribe, getState } from '../state.js';
import { TOOLS, BOX_TYPES } from '../constants.js';
import { triggerFileSelect } from './upload.js';

export function initToolbar() {
  const toolSelect = document.getElementById('tool-select');
  const toolDraw = document.getElementById('tool-draw');
  const typeSolid = document.getElementById('type-solid');
  const typeBlur = document.getElementById('type-blur');
  const typePixel = document.getElementById('type-pixel');
  const typeAnti = document.getElementById('type-anti');
  const boxColor = document.getElementById('box-color');
  const blurIntensity = document.getElementById('blur-intensity');
  const blurGroup = document.getElementById('blur-intensity-group');
  const colorGroup = boxColor.closest('.toolbar-label');

  toolSelect.addEventListener('click', () => dispatch('SET_TOOL', TOOLS.SELECT));
  toolDraw.addEventListener('click', () => dispatch('SET_TOOL', TOOLS.DRAW));

  typeSolid.addEventListener('click', () => dispatch('SET_BOX_TYPE', BOX_TYPES.SOLID));
  typeBlur.addEventListener('click', () => dispatch('SET_BOX_TYPE', BOX_TYPES.BLUR));
  typePixel.addEventListener('click', () => dispatch('SET_BOX_TYPE', BOX_TYPES.PIXEL));
  typeAnti.addEventListener('click', () => dispatch('SET_BOX_TYPE', BOX_TYPES.ANTI));

  boxColor.addEventListener('input', (e) => dispatch('SET_BOX_COLOR', e.target.value));
  blurIntensity.addEventListener('input', (e) => dispatch('SET_BLUR_INTENSITY', parseInt(e.target.value)));

  subscribe('SET_TOOL', (state) => {
    toolSelect.classList.toggle('active', state.tool === TOOLS.SELECT);
    toolDraw.classList.toggle('active', state.tool === TOOLS.DRAW);
  });

  subscribe('SET_BOX_TYPE', (state) => {
    typeSolid.classList.toggle('active', state.boxType === BOX_TYPES.SOLID);
    typeBlur.classList.toggle('active', state.boxType === BOX_TYPES.BLUR);
    typePixel.classList.toggle('active', state.boxType === BOX_TYPES.PIXEL);
    typeAnti.classList.toggle('active', state.boxType === BOX_TYPES.ANTI);
    // Show color only for solid, blur/pixel intensity for blur or pixel, hide both for anti
    colorGroup.style.display = state.boxType === BOX_TYPES.SOLID ? '' : 'none';
    blurGroup.style.display = (state.boxType === BOX_TYPES.BLUR || state.boxType === BOX_TYPES.PIXEL) ? '' : 'none';
  });

  // Editing mode toggle
  const editingModeBtn = document.getElementById('editing-mode-btn');
  editingModeBtn.addEventListener('click', () => {
    dispatch('SET_EDITING_MODE', !getState('editingMode'));
  });

  subscribe('SET_EDITING_MODE', (state) => {
    editingModeBtn.classList.toggle('active', state.editingMode);
  });

  // Initial state
  const initialType = getState('boxType');
  colorGroup.style.display = initialType === BOX_TYPES.SOLID ? '' : 'none';
  blurGroup.style.display = (initialType === BOX_TYPES.BLUR || initialType === BOX_TYPES.PIXEL) ? '' : 'none';

  // Import button
  const importBtn = document.getElementById('import-btn');
  importBtn.addEventListener('click', handleImport);
}

function handleImport() {
  const boxes = getState('boxes');

  if (boxes.length > 0) {
    // Show confirmation dialog
    showConfirm(
      'Import New Media',
      'You have unsaved redaction boxes. Importing a new file will discard all current work. Continue?',
      () => {
        triggerFileSelect();
      }
    );
  } else {
    triggerFileSelect();
  }
}

function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const messageEl = document.getElementById('confirm-message');
  const cancelBtn = document.getElementById('confirm-cancel');
  const okBtn = document.getElementById('confirm-ok');

  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.hidden = false;

  const cleanup = () => {
    modal.hidden = true;
    cancelBtn.removeEventListener('click', handleCancel);
    okBtn.removeEventListener('click', handleOk);
    modal.removeEventListener('click', handleBackdrop);
  };

  const handleCancel = () => cleanup();
  const handleOk = () => {
    cleanup();
    onConfirm();
  };
  const handleBackdrop = (e) => {
    if (e.target === modal) cleanup();
  };

  cancelBtn.addEventListener('click', handleCancel);
  okBtn.addEventListener('click', handleOk);
  modal.addEventListener('click', handleBackdrop);
}
