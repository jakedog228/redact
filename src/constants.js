export const HANDLE_SIZE = 8;
export const MIN_BOX_SIZE = 10; // minimum box size in canvas pixels
export const DEFAULT_DURATION = 5; // seconds for new boxes
export const FRAME_STEP = 1 / 30; // ~1 frame at 30fps
export const MAX_UNDO_HISTORY = 50;

export const TOOLS = {
  SELECT: 'select',
  DRAW: 'draw',
};

export const BOX_TYPES = {
  SOLID: 'solid',
  BLUR: 'blur',
  PIXEL: 'pixel',
  ANTI: 'anti',
};

export const TIMELINE_MIN_ZOOM = 1;
export const TIMELINE_MAX_ZOOM = 20;
export const TIMELINE_TICK_MIN_SPACING = 60; // pixels between major ticks

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

export const MEDIA_TYPES = {
  VIDEO: 'video',
  IMAGE: 'image',
};
