import { dispatch } from '../state.js';
import { ACCEPTED_VIDEO_TYPES, ACCEPTED_IMAGE_TYPES, TOOLS, BOX_TYPES } from '../constants.js';
import { clearHistory } from './history.js';

let fileInput;

export function initUpload() {
  const dropZone = document.getElementById('drop-zone');
  fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });
}

/**
 * Trigger the file input dialog programmatically.
 * Used by the Import button in the editor.
 */
export function triggerFileSelect() {
  if (fileInput) {
    // Reset value so same file can be re-selected
    fileInput.value = '';
    fileInput.click();
  }
}

function isVideoFile(file) {
  return ACCEPTED_VIDEO_TYPES.includes(file.type) ||
         file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i);
}

function isImageFile(file) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type) ||
         file.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i);
}

function handleFile(file) {
  if (isVideoFile(file)) {
    handleVideoFile(file);
  } else if (isImageFile(file)) {
    handleImageFile(file);
  } else {
    alert('Unsupported file type. Please use MP4, WebM, MOV, MKV, or an image (JPG, PNG, WebP, GIF).');
  }
}

function handleVideoFile(file) {
  const video = document.getElementById('video');
  const url = URL.createObjectURL(file);
  video.src = url;

  video.addEventListener('loadedmetadata', () => {
    // Clear existing work
    dispatch('SET_BOXES', []);
    dispatch('SELECT_BOX', null);
    clearHistory();

    dispatch('SET_VIDEO', {
      file,
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
    });
    // Default to draw mode and blur type for new files
    dispatch('SET_TOOL', TOOLS.DRAW);
    dispatch('SET_BOX_TYPE', BOX_TYPES.BLUR);
  }, { once: true });

  video.load();
}

function handleImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();

  img.onload = () => {
    // Clear existing work
    dispatch('SET_BOXES', []);
    dispatch('SELECT_BOX', null);
    clearHistory();

    dispatch('SET_IMAGE', {
      file,
      element: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    // Default to draw mode and blur type for new files
    dispatch('SET_TOOL', TOOLS.DRAW);
    dispatch('SET_BOX_TYPE', BOX_TYPES.BLUR);
  };

  img.onerror = () => {
    alert('Failed to load image.');
    URL.revokeObjectURL(url);
  };

  img.src = url;
}
