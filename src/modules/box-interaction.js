import { dispatch, getState } from '../state.js';
import { getCanvasElement, canvasToNormalized, setDrawPreview, getCanvasSize } from './canvas-overlay.js';
import { createBox, updateBox } from './box-manager.js';
import { pointInRect, getHandle, clamp } from '../utils.js';
import { TOOLS, MIN_BOX_SIZE, HANDLE_SIZE } from '../constants.js';
import { pushHistory } from './history.js';

let dragging = false;
let dragType = null; // 'draw' | 'move' | 'resize'
let dragHandle = null;
let dragStart = { x: 0, y: 0 };
let dragBoxStart = null;

export function initBoxInteraction() {
  const canvas = getCanvasElement();

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  // mouseup and mousemove during drag are handled at window level
  // to allow dragging outside canvas bounds
}

function getMouseNormalized(e, clampToBounds = false) {
  const canvas = getCanvasElement();
  const rect = canvas.getBoundingClientRect();
  let x = (e.clientX - rect.left) * (canvas.width / rect.width);
  let y = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (clampToBounds) {
    x = clamp(x, 0, canvas.width);
    y = clamp(y, 0, canvas.height);
  }

  return canvasToNormalized(x, y);
}

function onMouseDown(e) {
  const pos = getMouseNormalized(e);
  const tool = getState('tool');

  if (tool === TOOLS.DRAW) {
    dragging = true;
    dragType = 'draw';
    dragStart = pos;
    setDrawPreview(null);
    startWindowDragListeners();
    return;
  }

  // Select mode: check handles first, then body
  const boxes = getState('boxes');
  const currentTime = getState('currentTime');
  const selectedId = getState('selectedBoxId');
  const { width: cw, height: ch } = getCanvasSize();
  const handleNormSize = HANDLE_SIZE / Math.min(cw, ch);

  // Check selected box handles first
  if (selectedId) {
    const selected = boxes.find(b => b.id === selectedId);
    if (selected) {
      const handle = getHandle(pos.x, pos.y, selected, handleNormSize);
      if (handle) {
        dragging = true;
        dragType = 'resize';
        dragHandle = handle;
        dragStart = pos;
        dragBoxStart = { ...selected };
        pushHistory();
        startWindowDragListeners();
        return;
      }
    }
  }

  // Check if clicking on a visible box
  const activeBoxes = boxes.filter(b => currentTime >= b.startTime && currentTime <= b.endTime);
  // Iterate in reverse so topmost box is selected first
  for (let i = activeBoxes.length - 1; i >= 0; i--) {
    const box = activeBoxes[i];
    if (pointInRect(pos.x, pos.y, box)) {
      dispatch('SELECT_BOX', box.id);
      dragging = true;
      dragType = 'move';
      dragStart = pos;
      dragBoxStart = { ...box };
      pushHistory();
      startWindowDragListeners();
      return;
    }
  }

  // Clicked empty space - deselect
  dispatch('SELECT_BOX', null);
}

function startWindowDragListeners() {
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
}

function stopWindowDragListeners() {
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
}

function onWindowMouseMove(e) {
  if (!dragging) return;
  // Use clamped coordinates so dragging outside canvas clamps to edge
  const pos = getMouseNormalized(e, true);
  handleDragMove(pos);
}

function onWindowMouseUp(e) {
  if (!dragging) return;
  // Use clamped coordinates for final position
  const pos = getMouseNormalized(e, true);
  handleDragEnd(pos);
  stopWindowDragListeners();
}

function onMouseMove(e) {
  if (!dragging) {
    updateCursor(e);
    return;
  }
  // During drag, the window handler handles this
}

function handleDragMove(pos) {
  if (dragType === 'draw') {
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const w = Math.abs(pos.x - dragStart.x);
    const h = Math.abs(pos.y - dragStart.y);
    setDrawPreview({ x, y, width: w, height: h });
    return;
  }

  if (dragType === 'move' && dragBoxStart) {
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    updateBox(dragBoxStart.id, {
      x: clamp(dragBoxStart.x + dx, 0, 1 - dragBoxStart.width),
      y: clamp(dragBoxStart.y + dy, 0, 1 - dragBoxStart.height),
    });
    return;
  }

  if (dragType === 'resize' && dragBoxStart && dragHandle) {
    resizeBox(pos);
  }
}

function handleDragEnd(pos) {
  if (dragType === 'draw') {
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    const w = Math.abs(pos.x - dragStart.x);
    const h = Math.abs(pos.y - dragStart.y);

    const { width: cw, height: ch } = getCanvasSize();
    if (w * cw >= MIN_BOX_SIZE && h * ch >= MIN_BOX_SIZE) {
      pushHistory();
      createBox({ x, y, width: w, height: h });
      dispatch('SET_TOOL', TOOLS.SELECT);
    }
    setDrawPreview(null);
  }

  dragging = false;
  dragType = null;
  dragHandle = null;
  dragBoxStart = null;
}

function resizeBox(pos) {
  const b = dragBoxStart;
  let newX = b.x, newY = b.y, newW = b.width, newH = b.height;

  const dx = pos.x - dragStart.x;
  const dy = pos.y - dragStart.y;

  if (dragHandle.includes('w')) {
    newX = clamp(b.x + dx, 0, b.x + b.width - 0.01);
    newW = b.width - (newX - b.x);
  }
  if (dragHandle.includes('e')) {
    newW = clamp(b.width + dx, 0.01, 1 - b.x);
  }
  if (dragHandle.includes('n')) {
    newY = clamp(b.y + dy, 0, b.y + b.height - 0.01);
    newH = b.height - (newY - b.y);
  }
  if (dragHandle.includes('s')) {
    newH = clamp(b.height + dy, 0.01, 1 - b.y);
  }

  updateBox(b.id, { x: newX, y: newY, width: newW, height: newH });
}

function updateCursor(e) {
  const canvas = getCanvasElement();
  const tool = getState('tool');

  if (tool === TOOLS.DRAW) {
    canvas.style.cursor = 'crosshair';
    return;
  }

  const pos = getMouseNormalized(e);
  const selectedId = getState('selectedBoxId');
  const boxes = getState('boxes');
  const { width: cw, height: ch } = getCanvasSize();
  const handleNormSize = HANDLE_SIZE / Math.min(cw, ch);

  if (selectedId) {
    const selected = boxes.find(b => b.id === selectedId);
    if (selected) {
      const handle = getHandle(pos.x, pos.y, selected, handleNormSize);
      if (handle) {
        const cursors = {
          nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
          e: 'e-resize', se: 'se-resize', s: 's-resize',
          sw: 'sw-resize', w: 'w-resize',
        };
        canvas.style.cursor = cursors[handle];
        return;
      }
    }
  }

  const currentTime = getState('currentTime');
  const activeBoxes = boxes.filter(b => currentTime >= b.startTime && currentTime <= b.endTime);
  for (const box of activeBoxes) {
    if (pointInRect(pos.x, pos.y, box)) {
      canvas.style.cursor = 'move';
      return;
    }
  }

  canvas.style.cursor = 'default';
}
