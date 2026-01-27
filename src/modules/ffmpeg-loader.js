import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let loaded = false;

/**
 * Terminate the FFmpeg instance, killing any running encode.
 * A new instance will be created and reloaded on the next getFFmpeg() call.
 */
export function terminateFFmpeg() {
  if (ffmpeg) {
    ffmpeg.terminate();
    ffmpeg = null;
    loaded = false;
    console.log('[FFmpeg] Terminated');
  }
}

/**
 * Get the FFmpeg instance, loading it from CDN if needed.
 * Always uses single-thread core to avoid deadlocks with split/overlay filter graphs.
 * Progress callback is updated on every call.
 */
export async function getFFmpeg(onProgress) {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }

  // Always update the progress handler (remove old, add new)
  ffmpeg.off('progress');
  if (onProgress) {
    ffmpeg.on('progress', ({ progress, time }) => {
      console.log(`[FFmpeg] Progress: ${(progress * 100).toFixed(1)}%, time: ${(time / 1000000).toFixed(2)}s`);
      onProgress(progress);
    });
  }

  // Add log handler for debugging (only once)
  if (!loaded) {
    ffmpeg.on('log', ({ type, message }) => {
      console.log(`[FFmpeg ${type}] ${message}`);
    });
  }

  if (loaded) return ffmpeg;

  // Always use single-thread core. The multi-thread (-mt) core deadlocks
  // on filter graphs that use split/overlay (needed for blur redaction).
  const coreVersion = '0.12.6';
  const baseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;

  console.log('[FFmpeg] Loading single-thread core...');

  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    loaded = true;
    console.log('[FFmpeg] Loaded successfully');
  } catch (e) {
    console.error('[FFmpeg] Load error:', e);
    throw e;
  }

  return ffmpeg;
}
