import { dispatch, getState } from '../state.js';
import { uid } from '../utils.js';
import { DEFAULT_DURATION, BOX_TYPES } from '../constants.js';

/**
 * Create a new redaction box.
 */
export function createBox({ x, y, width, height }) {
  const mediaType = getState('mediaType');
  const currentTime = getState('currentTime');
  const duration = getState('videoDuration');
  const boxType = getState('boxType');
  const color = getState('boxColor');
  const blurIntensity = getState('blurIntensity');

  // For images, time range is irrelevant - use 0 to Infinity
  const isImage = mediaType === 'image';
  const startTime = isImage ? 0 : currentTime;
  const endTime = isImage ? Infinity : Math.min(currentTime + DEFAULT_DURATION, duration);

  const box = {
    id: uid(),
    x,
    y,
    width,
    height,
    startTime,
    endTime,
    type: boxType,
    color: boxType === BOX_TYPES.SOLID ? color : '#000000',
    blurIntensity: boxType === BOX_TYPES.BLUR ? blurIntensity : 10,
  };

  dispatch('ADD_BOX', box);
  dispatch('SELECT_BOX', box.id);
  return box;
}

/**
 * Update a box's properties.
 */
export function updateBox(id, props) {
  dispatch('UPDATE_BOX', { id, ...props });
}

/**
 * Delete a box.
 */
export function deleteBox(id) {
  dispatch('DELETE_BOX', id);
}

/**
 * Get the currently selected box.
 */
export function getSelectedBox() {
  const id = getState('selectedBoxId');
  if (!id) return null;
  return getState('boxes').find(b => b.id === id) || null;
}

/**
 * Duplicate a box with a slight offset.
 */
export function duplicateBox(sourceBox, offset = 0.02) {
  if (!sourceBox) return null;

  const newBox = {
    ...sourceBox,
    id: uid(),
    x: Math.min(sourceBox.x + offset, 1 - sourceBox.width),
    y: Math.min(sourceBox.y + offset, 1 - sourceBox.height),
  };

  dispatch('ADD_BOX', newBox);
  dispatch('SELECT_BOX', newBox.id);
  return newBox;
}
