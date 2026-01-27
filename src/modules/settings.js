/**
 * Keybind configuration and settings management.
 */

const STORAGE_KEY = 'redact-keybinds';

// Default keybinds
const DEFAULT_KEYBINDS = {
  select: { key: 'v', ctrl: false, label: 'Select tool' },
  draw: { key: 'd', ctrl: false, label: 'Draw tool' },
  typeSolid: { key: '1', ctrl: false, label: 'Solid fill' },
  typeBlur: { key: '2', ctrl: false, label: 'Blur' },
  typePixel: { key: '3', ctrl: false, label: 'Pixelate' },
  typeAnti: { key: '4', ctrl: false, label: 'Anti-redaction' },
  editingMode: { key: 'e', ctrl: false, label: 'Toggle outlines' },
  undo: { key: 'z', ctrl: true, label: 'Undo' },
  redo: { key: 'y', ctrl: true, label: 'Redo' },
  playPause: { key: ' ', ctrl: false, label: 'Play/Pause' },
  stepBack: { key: 'ArrowLeft', ctrl: false, label: 'Step back' },
  stepForward: { key: 'ArrowRight', ctrl: false, label: 'Step forward' },
  delete: { key: 'Delete', ctrl: false, label: 'Delete box' },
  copy: { key: 'c', ctrl: true, label: 'Copy box' },
  paste: { key: 'v', ctrl: true, label: 'Paste box' },
  setStart: { key: '[', ctrl: false, label: 'Set start time' },
  setEnd: { key: ']', ctrl: false, label: 'Set end time' },
};

let keybinds = {};
let settingsModal;
let keybindList;
let recordingAction = null;

export function initSettings() {
  settingsModal = document.getElementById('settings-modal');
  keybindList = document.getElementById('keybind-list');

  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('keybind-reset').addEventListener('click', resetKeybinds);

  // Close on background click
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // Load keybinds
  loadKeybinds();
  updateTooltips();
}

function loadKeybinds() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to handle new keybinds
      keybinds = { ...DEFAULT_KEYBINDS };
      for (const action in parsed) {
        if (keybinds[action]) {
          keybinds[action] = { ...keybinds[action], ...parsed[action] };
        }
      }
    } else {
      keybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
    }
  } catch {
    keybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
  }
}

function saveKeybinds() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keybinds));
  updateTooltips();
}

function resetKeybinds() {
  keybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
  saveKeybinds();
  renderKeybindList();
}

function openSettings() {
  settingsModal.hidden = false;
  renderKeybindList();
}

function closeSettings() {
  settingsModal.hidden = true;
  recordingAction = null;
}

function renderKeybindList() {
  keybindList.innerHTML = '';

  for (const action in keybinds) {
    const bind = keybinds[action];
    const row = document.createElement('div');
    row.className = 'keybind-row';

    const label = document.createElement('span');
    label.className = 'keybind-label';
    label.textContent = bind.label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'keybind-input';
    input.value = formatKeybind(bind);
    input.readOnly = true;
    input.dataset.action = action;

    input.addEventListener('click', () => startRecording(input, action));
    input.addEventListener('keydown', (e) => handleKeyRecord(e, action));
    input.addEventListener('blur', () => stopRecording());

    row.appendChild(label);
    row.appendChild(input);
    keybindList.appendChild(row);
  }
}

function formatKeybind(bind) {
  let text = '';
  if (bind.ctrl) text += 'Ctrl+';
  if (bind.shift) text += 'Shift+';

  // Format special keys
  const keyNames = {
    ' ': 'Space',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'Delete': 'Del',
    'Backspace': 'Backspace',
    'Escape': 'Esc',
  };

  const keyDisplay = keyNames[bind.key] || bind.key.toUpperCase();
  text += keyDisplay;
  return text;
}

function startRecording(input, action) {
  // Stop any previous recording
  const prev = keybindList.querySelector('.recording');
  if (prev) prev.classList.remove('recording');

  input.classList.add('recording');
  input.value = 'Press a key...';
  recordingAction = action;
}

function stopRecording() {
  const prev = keybindList.querySelector('.recording');
  if (prev) {
    prev.classList.remove('recording');
    prev.value = formatKeybind(keybinds[recordingAction]);
  }
  recordingAction = null;
}

function handleKeyRecord(e, action) {
  if (!recordingAction || recordingAction !== action) return;

  e.preventDefault();
  e.stopPropagation();

  // Ignore modifier-only keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

  // Escape cancels recording
  if (e.key === 'Escape') {
    stopRecording();
    return;
  }

  // Update keybind
  keybinds[action] = {
    ...keybinds[action],
    key: e.key,
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
  };

  saveKeybinds();

  // Update input display
  const input = keybindList.querySelector(`[data-action="${action}"]`);
  if (input) {
    input.classList.remove('recording');
    input.value = formatKeybind(keybinds[action]);
  }

  recordingAction = null;
}

function updateTooltips() {
  // Update all elements with data-keybind attribute
  const elements = document.querySelectorAll('[data-keybind]');
  for (const el of elements) {
    const action = el.dataset.keybind;
    const bind = keybinds[action];
    if (bind) {
      el.title = `${bind.label} (${formatKeybind(bind)})`;
    }
  }
}

/**
 * Get the current keybind configuration.
 */
export function getKeybinds() {
  return keybinds;
}

/**
 * Check if an event matches a specific keybind action.
 */
export function matchesKeybind(e, action) {
  const bind = keybinds[action];
  if (!bind) return false;

  const ctrlMatch = bind.ctrl === (e.ctrlKey || e.metaKey);
  const shiftMatch = !bind.shift || bind.shift === e.shiftKey;
  const keyMatch = e.key.toLowerCase() === bind.key.toLowerCase() || e.key === bind.key;

  return ctrlMatch && shiftMatch && keyMatch;
}
