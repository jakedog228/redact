import { subscribe, getState, dispatch } from '../state.js';
import { updateBox } from './box-manager.js';
import { getTimelineWidth } from './timeline.js';
import { seekTo } from './player.js';
import { clamp } from '../utils.js';
import { pushHistory } from './history.js';

let spansContainer;
let timelineBody;
let expandBtn;
let expanded = false;

// Drag reorder state
let dragFromIndex = null;
let dragOverIndex = null;

export function initTimelineSpans() {
  spansContainer = document.getElementById('timeline-spans');
  timelineBody = document.getElementById('timeline-body');
  expandBtn = document.getElementById('timeline-expand');

  expandBtn.addEventListener('click', toggleExpand);

  subscribe('SET_BOXES', renderSpans);
  subscribe('ADD_BOX', renderSpans);
  subscribe('UPDATE_BOX', renderSpans);
  subscribe('DELETE_BOX', renderSpans);
  subscribe('SELECT_BOX', renderSpans);
  subscribe('SET_ZOOM', renderSpans);
  subscribe('SET_VIDEO', renderSpans);
  subscribe('REORDER_BOX', renderSpans);
}

function toggleExpand() {
  expanded = !expanded;
  timelineBody.classList.toggle('expanded', expanded);
  expandBtn.classList.toggle('expanded', expanded);
}

function renderSpans() {
  const boxes = getState('boxes');
  const duration = getState('videoDuration');
  const selectedId = getState('selectedBoxId');
  const totalWidth = getTimelineWidth();

  if (!duration || !spansContainer) return;

  spansContainer.style.width = totalWidth + 'px';
  spansContainer.innerHTML = '';

  boxes.forEach((box, index) => {
    const lane = document.createElement('div');
    lane.className = 'span-lane';
    lane.dataset.index = index;
    lane.style.top = (index * 28) + 'px';

    // Drag handle for reordering
    const dragHandle = document.createElement('div');
    dragHandle.className = 'span-drag-handle';
    dragHandle.innerHTML = '&#8942;'; // vertical ellipsis
    dragHandle.title = 'Drag to reorder';
    dragHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startReorderDrag(e, index);
    });

    const span = document.createElement('div');
    span.className = 'span-bar' + (box.id === selectedId ? ' selected' : '');
    span.style.backgroundColor = getSpanColor(box);

    const left = (box.startTime / duration) * totalWidth;
    const right = (box.endTime / duration) * totalWidth;
    span.style.left = left + 'px';
    span.style.width = (right - left) + 'px';

    span.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      dispatch('SELECT_BOX', box.id);
      startSpanDrag(e, box, 'move', duration, totalWidth);
    });

    // Left handle (start time)
    const leftHandle = document.createElement('div');
    leftHandle.className = 'span-handle span-handle-left';
    leftHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startSpanDrag(e, box, 'start', duration, totalWidth);
    });

    // Right handle (end time)
    const rightHandle = document.createElement('div');
    rightHandle.className = 'span-handle span-handle-right';
    rightHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startSpanDrag(e, box, 'end', duration, totalWidth);
    });

    span.appendChild(leftHandle);
    span.appendChild(rightHandle);
    lane.appendChild(dragHandle);
    lane.appendChild(span);
    spansContainer.appendChild(lane);
  });

  // Update container height
  spansContainer.style.height = Math.max(30, boxes.length * 28) + 'px';
}

function getSpanColor(box) {
  if (box.type === 'blur') return '#6a5acd';
  if (box.type === 'pixel') return '#cd5a6a';
  if (box.type === 'anti') return '#22cc66';
  return box.color;
}

function startReorderDrag(e, fromIndex) {
  dragFromIndex = fromIndex;
  dragOverIndex = fromIndex;

  const lanes = spansContainer.querySelectorAll('.span-lane');
  lanes[fromIndex].classList.add('dragging');

  const onMove = (me) => {
    // Calculate which lane we're over based on Y position
    const containerRect = spansContainer.getBoundingClientRect();
    const y = me.clientY - containerRect.top + spansContainer.parentElement.scrollTop;
    const newIndex = Math.floor(y / 28);
    const clampedIndex = clamp(newIndex, 0, lanes.length - 1);

    if (clampedIndex !== dragOverIndex) {
      // Remove old drag-over class
      lanes.forEach(l => l.classList.remove('drag-over'));
      // Add new drag-over class
      if (clampedIndex !== dragFromIndex) {
        lanes[clampedIndex].classList.add('drag-over');
      }
      dragOverIndex = clampedIndex;
    }
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    // Clean up classes
    const lanes = spansContainer.querySelectorAll('.span-lane');
    lanes.forEach(l => {
      l.classList.remove('dragging');
      l.classList.remove('drag-over');
    });

    // Perform reorder if indices differ
    if (dragFromIndex !== dragOverIndex && dragFromIndex !== null && dragOverIndex !== null) {
      pushHistory();
      dispatch('REORDER_BOX', { fromIndex: dragFromIndex, toIndex: dragOverIndex });
    }

    dragFromIndex = null;
    dragOverIndex = null;
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startSpanDrag(e, box, edge, duration, totalWidth) {
  pushHistory();
  const startX = e.clientX;
  const origStart = box.startTime;
  const origEnd = box.endTime;
  const spanDuration = origEnd - origStart;

  const onMove = (me) => {
    const dx = me.clientX - startX;
    const dt = (dx / totalWidth) * duration;

    if (edge === 'move') {
      const newStart = clamp(origStart + dt, 0, duration - spanDuration);
      updateBox(box.id, { startTime: newStart, endTime: newStart + spanDuration });
    } else if (edge === 'start') {
      const newTime = clamp(origStart + dt, 0, duration);
      if (newTime < origEnd) {
        updateBox(box.id, { startTime: newTime });
        seekTo(newTime);
      }
    } else {
      const newTime = clamp(origEnd + dt, 0, duration);
      if (newTime > origStart) {
        updateBox(box.id, { endTime: newTime });
        seekTo(newTime);
      }
    }
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
