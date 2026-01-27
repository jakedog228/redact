/**
 * Central pub/sub state store.
 */

const state = {
  mediaType: null,      // 'video' | 'image' | null
  mediaFile: null,      // The uploaded File object
  mediaWidth: 0,
  mediaHeight: 0,
  imageElement: null,   // For images: the loaded Image object
  // Video-specific
  videoFile: null,      // Kept for backward compat, same as mediaFile for videos
  videoDuration: 0,
  videoWidth: 0,        // Kept for backward compat, same as mediaWidth
  videoHeight: 0,       // Kept for backward compat, same as mediaHeight
  currentTime: 0,
  playing: false,
  // Tools
  tool: 'select',       // 'select' | 'draw'
  boxType: 'solid',     // 'solid' | 'blur'
  boxColor: '#000000',
  blurIntensity: 10,
  boxes: [],            // Array of box objects
  selectedBoxId: null,
  timelineZoom: 1,
  timelineScroll: 0,
  editingMode: false,
};

const listeners = {};

/**
 * Get current state value.
 */
export function getState(key) {
  return state[key];
}

/**
 * Dispatch a state change.
 */
export function dispatch(action, payload) {
  switch (action) {
    case 'SET_VIDEO':
      state.mediaType = 'video';
      state.mediaFile = payload.file;
      state.mediaWidth = payload.width;
      state.mediaHeight = payload.height;
      state.imageElement = null;
      // Backward compat
      state.videoFile = payload.file;
      state.videoDuration = payload.duration;
      state.videoWidth = payload.width;
      state.videoHeight = payload.height;
      break;
    case 'SET_IMAGE':
      state.mediaType = 'image';
      state.mediaFile = payload.file;
      state.mediaWidth = payload.width;
      state.mediaHeight = payload.height;
      state.imageElement = payload.element;
      // Clear video state
      state.videoFile = null;
      state.videoDuration = 0;
      state.videoWidth = payload.width;
      state.videoHeight = payload.height;
      state.currentTime = 0;
      state.playing = false;
      break;
    case 'SET_TIME':
      state.currentTime = payload;
      break;
    case 'SET_PLAYING':
      state.playing = payload;
      break;
    case 'SET_TOOL':
      state.tool = payload;
      break;
    case 'SET_BOX_TYPE':
      state.boxType = payload;
      break;
    case 'SET_BOX_COLOR':
      state.boxColor = payload;
      break;
    case 'SET_BLUR_INTENSITY':
      state.blurIntensity = payload;
      break;
    case 'SET_BOXES':
      state.boxes = payload;
      break;
    case 'ADD_BOX':
      state.boxes = [...state.boxes, payload];
      break;
    case 'UPDATE_BOX':
      state.boxes = state.boxes.map(b => b.id === payload.id ? { ...b, ...payload } : b);
      break;
    case 'DELETE_BOX':
      state.boxes = state.boxes.filter(b => b.id !== payload);
      if (state.selectedBoxId === payload) state.selectedBoxId = null;
      break;
    case 'REORDER_BOX':
      // payload = { fromIndex, toIndex }
      const boxes = [...state.boxes];
      const [moved] = boxes.splice(payload.fromIndex, 1);
      boxes.splice(payload.toIndex, 0, moved);
      state.boxes = boxes;
      break;
    case 'SELECT_BOX':
      state.selectedBoxId = payload;
      break;
    case 'SET_ZOOM':
      state.timelineZoom = payload;
      break;
    case 'SET_TIMELINE_SCROLL':
      state.timelineScroll = payload;
      break;
    case 'SET_EDITING_MODE':
      state.editingMode = payload;
      break;
    default:
      console.warn('Unknown action:', action);
      return;
  }
  notify(action);
}

function notify(action) {
  const cbs = listeners[action] || [];
  cbs.forEach(cb => cb(state));
  // Also notify wildcard listeners
  (listeners['*'] || []).forEach(cb => cb(action, state));
}

/**
 * Subscribe to state changes. Use '*' for all actions.
 */
export function subscribe(action, callback) {
  if (!listeners[action]) listeners[action] = [];
  listeners[action].push(callback);
  return () => {
    listeners[action] = listeners[action].filter(cb => cb !== callback);
  };
}
