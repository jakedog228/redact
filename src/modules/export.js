import { getState } from '../state.js';
import { getFFmpeg, terminateFFmpeg } from './ffmpeg-loader.js';
import { fetchFile } from '@ffmpeg/util';
import { BOX_TYPES } from '../constants.js';
import { renderBoxes, renderAntiRedactions } from './box-renderer.js';

let exporting = false;
let cancelled = false;

export function initExport() {
  document.getElementById('export-btn').addEventListener('click', startExport);
  document.getElementById('export-cancel').addEventListener('click', cancelExport);
}

function cancelExport() {
  if (!exporting) return;
  cancelled = true;
  // Terminate kills the WASM worker, stopping the encode immediately.
  // The next export will reload FFmpeg from cache.
  terminateFFmpeg();
}

async function startExport() {
  if (exporting) return;

  const mediaType = getState('mediaType');
  if (mediaType === 'image') {
    await exportImage();
  } else {
    await exportVideo();
  }
}

async function exportImage() {
  exporting = true;

  const modal = document.getElementById('export-modal');
  const progressBar = document.getElementById('export-progress');
  const statusText = document.getElementById('export-status');

  modal.hidden = false;
  progressBar.style.width = '50%';
  statusText.textContent = 'Rendering image...';

  try {
    const img = getState('imageElement');
    const boxes = getState('boxes');
    const width = getState('mediaWidth');
    const height = getState('mediaHeight');

    // Create canvas at full resolution
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Create frame buffer to preserve original for anti-redaction
    const frameBuffer = document.createElement('canvas');
    frameBuffer.width = width;
    frameBuffer.height = height;
    const frameCtx = frameBuffer.getContext('2d');
    frameCtx.drawImage(img, 0, 0, width, height);

    // Draw original image to main canvas
    ctx.drawImage(img, 0, 0, width, height);

    // Draw redaction boxes (solid and blur) at native resolution (scale = 1)
    renderBoxes(ctx, boxes, width, height, width, height);

    // Apply anti-redaction boxes (restore original in those regions)
    renderAntiRedactions(ctx, boxes, width, height, frameBuffer);

    progressBar.style.width = '80%';
    statusText.textContent = 'Encoding...';

    // Export as PNG
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

    progressBar.style.width = '100%';

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const originalName = getState('mediaFile')?.name || 'image';
    const baseName = originalName.replace(/\.[^.]+$/, '');
    a.download = `${baseName}_redacted.png`;
    a.click();
    URL.revokeObjectURL(url);

    statusText.textContent = 'Done!';
    setTimeout(cleanup, 1500);
  } catch (err) {
    console.error('Export error:', err);
    statusText.textContent = `Error: ${err.message}`;
    setTimeout(cleanup, 3000);
  }
}

async function exportVideo() {
  exporting = true;
  cancelled = false;

  const modal = document.getElementById('export-modal');
  const progressBar = document.getElementById('export-progress');
  const statusText = document.getElementById('export-status');

  modal.hidden = false;
  progressBar.style.width = '0%';
  statusText.textContent = 'Loading FFmpeg...';

  try {
    const ffmpeg = await getFFmpeg((progress) => {
      if (cancelled) return;
      const pct = Math.round(progress * 100);
      progressBar.style.width = pct + '%';
      statusText.textContent = `Encoding: ${pct}%`;
    });

    if (cancelled) { cleanup(); return; }

    statusText.textContent = 'Reading video file...';
    const videoFile = getState('mediaFile');
    const fileData = await fetchFile(videoFile);
    await ffmpeg.writeFile('input.mp4', fileData);

    if (cancelled) { cleanup(); return; }

    statusText.textContent = 'Building filter graph...';
    const boxes = getState('boxes');
    const videoWidth = getState('mediaWidth');
    const videoHeight = getState('mediaHeight');

    const filterGraph = buildFilterGraph(boxes, videoWidth, videoHeight);
    console.log('[Export] Filter graph:', filterGraph || '(none - copy mode)');

    const duration = getState('videoDuration');
    const args = ['-y', '-i', 'input.mp4'];
    if (filterGraph) {
      args.push('-filter_complex', filterGraph, '-map', '[out]', '-map', '0:a?',
        '-c:v', 'libx264', '-crf', '23', '-preset', 'ultrafast',
        '-c:a', 'copy', '-t', duration.toFixed(3), 'output.mp4');
    } else {
      args.push('-c', 'copy', '-t', duration.toFixed(3), 'output.mp4');
    }

    console.log('[Export] FFmpeg args:', args.join(' '));
    statusText.textContent = 'Encoding...';

    const startTime = performance.now();
    await ffmpeg.exec(args);
    console.log(`[Export] Encoding completed in ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

    if (cancelled) { cleanup(); return; }

    statusText.textContent = 'Reading output...';
    const outputData = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    // Download
    const a = document.createElement('a');
    a.href = url;
    const originalName = getState('mediaFile')?.name || 'video';
    const baseName = originalName.replace(/\.[^.]+$/, '');
    a.download = `${baseName}_redacted.mp4`;
    a.click();
    URL.revokeObjectURL(url);

    statusText.textContent = 'Done!';
    setTimeout(cleanup, 1500);
  } catch (err) {
    if (cancelled) {
      console.log('[Export] Cancelled by user');
      cleanup();
    } else {
      console.error('Export error:', err);
      statusText.textContent = `Error: ${err.message}`;
      setTimeout(cleanup, 3000);
    }
  }
}

function buildFilterGraph(boxes, videoWidth, videoHeight) {
  if (boxes.length === 0) return '';

  const solidBoxes = boxes.filter(b => b.type === BOX_TYPES.SOLID);
  const blurBoxes = boxes.filter(b => b.type === BOX_TYPES.BLUR);
  const pixelBoxes = boxes.filter(b => b.type === BOX_TYPES.PIXEL);
  const antiBoxes = boxes.filter(b => b.type === BOX_TYPES.ANTI);

  // If only anti boxes and nothing to redact, no filter needed
  if (solidBoxes.length === 0 && blurBoxes.length === 0 && pixelBoxes.length === 0) return '';

  let filter = '';
  let lastLabel = '0:v';
  let labelCounter = 0;

  // If we have anti-redaction boxes, we need to preserve the original stream
  const origLabels = [];
  if (antiBoxes.length > 0) {
    // Split input: one copy for each anti box + one working stream
    const splitCount = antiBoxes.length + 1;
    const splitLabels = [];
    for (let i = 0; i < splitCount; i++) {
      splitLabels.push(`orig${i}`);
    }
    filter += `[0:v]split=${splitCount}${splitLabels.map(l => `[${l}]`).join('')};`;

    // Last split output is the working stream
    lastLabel = splitLabels[splitCount - 1];
    // Other outputs are for anti-redaction
    for (let i = 0; i < antiBoxes.length; i++) {
      origLabels.push(splitLabels[i]);
    }
  }

  // Apply solid boxes as drawbox filters
  for (const box of solidBoxes) {
    const x = Math.round(box.x * videoWidth);
    const y = Math.round(box.y * videoHeight);
    const w = Math.round(box.width * videoWidth);
    const h = Math.round(box.height * videoHeight);
    const color = box.color.replace('#', '0x');
    const enable = `between(t,${box.startTime.toFixed(3)},${box.endTime.toFixed(3)})`;

    const outLabel = `s${labelCounter++}`;
    filter += `[${lastLabel}]drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill:enable='${enable}'[${outLabel}];`;
    lastLabel = outLabel;
  }

  // Apply blur boxes using split/crop/boxblur/overlay
  for (const box of blurBoxes) {
    const x = Math.round(box.x * videoWidth);
    const y = Math.round(box.y * videoHeight);
    const w = Math.round(box.width * videoWidth);
    const h = Math.round(box.height * videoHeight);
    const radius = Math.max(1, box.blurIntensity);
    // Match canvas passes: Math.min(3, Math.max(1, Math.ceil(intensity / 7)))
    const power = Math.min(3, Math.max(1, Math.ceil(box.blurIntensity / 7)));
    const enable = `between(t,${box.startTime.toFixed(3)},${box.endTime.toFixed(3)})`;

    const splitA = `ba${labelCounter}`;
    const splitB = `bb${labelCounter}`;
    const blurred = `bd${labelCounter}`;
    const outLabel = `b${labelCounter++}`;

    // boxblur positional: luma_radius:luma_power:chroma_radius:chroma_power
    filter += `[${lastLabel}]split[${splitA}][${splitB}];`;
    filter += `[${splitB}]crop=${w}:${h}:${x}:${y},boxblur=${radius}:${power}:${radius}:${power}[${blurred}];`;
    filter += `[${splitA}][${blurred}]overlay=${x}:${y}:enable='${enable}'[${outLabel}];`;
    lastLabel = outLabel;
  }

  // Apply pixel boxes using pixelation (scale down + scale up with nearest neighbor)
  for (const box of pixelBoxes) {
    const x = Math.round(box.x * videoWidth);
    const y = Math.round(box.y * videoHeight);
    const w = Math.round(box.width * videoWidth);
    const h = Math.round(box.height * videoHeight);
    const pixelFactor = Math.max(2, Math.round(box.blurIntensity * 1.5));
    const scaledW = Math.max(4, Math.round(w / pixelFactor));
    const scaledH = Math.max(4, Math.round(h / pixelFactor));
    const enable = `between(t,${box.startTime.toFixed(3)},${box.endTime.toFixed(3)})`;

    const splitA = `pa${labelCounter}`;
    const splitB = `pb${labelCounter}`;
    const pixelated = `pp${labelCounter}`;
    const outLabel = `p${labelCounter++}`;

    filter += `[${lastLabel}]split[${splitA}][${splitB}];`;
    filter += `[${splitB}]crop=${w}:${h}:${x}:${y},scale=${scaledW}:${scaledH},scale=${w}:${h}:flags=neighbor[${pixelated}];`;
    filter += `[${splitA}][${pixelated}]overlay=${x}:${y}:enable='${enable}'[${outLabel}];`;
    lastLabel = outLabel;
  }

  // Apply anti-redaction boxes - overlay original content back
  for (let i = 0; i < antiBoxes.length; i++) {
    const box = antiBoxes[i];
    const x = Math.round(box.x * videoWidth);
    const y = Math.round(box.y * videoHeight);
    const w = Math.round(box.width * videoWidth);
    const h = Math.round(box.height * videoHeight);
    const enable = `between(t,${box.startTime.toFixed(3)},${box.endTime.toFixed(3)})`;

    const croppedLabel = `ac${labelCounter}`;
    const outLabel = `a${labelCounter++}`;

    // Crop the original region from the preserved original stream
    filter += `[${origLabels[i]}]crop=${w}:${h}:${x}:${y}[${croppedLabel}];`;
    // Overlay it onto the redacted stream
    filter += `[${lastLabel}][${croppedLabel}]overlay=${x}:${y}:enable='${enable}'[${outLabel}];`;
    lastLabel = outLabel;
  }

  // Remove trailing semicolon
  if (filter.endsWith(';')) {
    filter = filter.slice(0, -1);
  }

  // Replace the last output label with [out]
  const lastBracket = filter.lastIndexOf(`[${lastLabel}]`);
  if (lastBracket !== -1) {
    filter = filter.substring(0, lastBracket) + '[out]' + filter.substring(lastBracket + lastLabel.length + 2);
  }

  return filter;
}

function cleanup() {
  const modal = document.getElementById('export-modal');
  modal.hidden = true;
  exporting = false;
  cancelled = false;
}
