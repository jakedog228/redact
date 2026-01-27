# Video Redact

A browser-based tool for redacting videos and images. Draw redaction boxes, set their duration on a timeline, and export with the redactions baked in. All processing happens locally in your browser using FFmpeg.wasm.

## Features

- **Multiple redaction types**: Solid color fill, blur, pixelation, or anti-redaction (reveal original through other redactions)
- **Video and image support**: Works with MP4, WebM, MOV, MKV, AVI, and common image formats
- **Timeline editor**: Set precise start/end times for each redaction box with draggable spans
- **Real-time preview**: See blur and pixelation effects as you edit
- **Local processing**: All encoding happens in-browser via FFmpeg.wasm - your files never leave your device
- **Undo/redo**: Full history support for all edits
- **Copy/paste boxes**: Duplicate redaction boxes with Ctrl+C/V
- **Configurable keybinds**: Customize all keyboard shortcuts via the settings panel

## Getting Started

### Prerequisites

- Node.js 18+

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Production Build

```bash
npm run build
npm run preview
```

## Usage

1. **Import media**: Drop a video or image onto the upload screen, or click to browse
2. **Draw redactions**: Select a redaction type (Solid, Blur, Pixel, or Anti) and draw boxes on the canvas
3. **Adjust timing** (video only): Drag the span bars on the timeline to set when each redaction appears
4. **Fine-tune**: Use the property panel to adjust position, size, color, or blur intensity
5. **Export**: Click Export to render the final video/image with redactions baked in

### Redaction Types

| Type | Description |
|------|-------------|
| **Solid** | Fills the region with a solid color |
| **Blur** | Applies a gaussian-style box blur |
| **Pixel** | Pixelates the region (blocky mosaic effect) |
| **Anti** | Reveals the original content, punching through other redactions |

### Keyboard Shortcuts

All shortcuts can be customized via Settings (gear icon).

| Action | Default |
|--------|---------|
| Select tool | V |
| Draw tool | D |
| Solid type | 1 |
| Blur type | 2 |
| Pixel type | 3 |
| Anti-redaction type | 4 |
| Toggle outlines | E |
| Play/Pause | Space |
| Step back | Left Arrow |
| Step forward | Right Arrow |
| Delete box | Delete |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y |
| Copy box | Ctrl+C |
| Paste box | Ctrl+V |
| Set start time | [ |
| Set end time | ] |

**Tip**: Hold Shift with arrow keys for 1-second steps instead of single frames.

## Technical Details

### Stack

- **Vite** - Build tool and dev server
- **Vanilla JS** - ES6 modules, no framework
- **FFmpeg.wasm** - Video encoding in the browser
- **Canvas API** - Real-time rendering with getImageData for blur effects

### Architecture

- Central pub/sub state store (`state.js`)
- Box coordinates stored as normalized 0-1 values (resolution-independent)
- Single canvas renders video frames + redaction overlays
- Frame buffer prevents flicker during video seeks
- FFmpeg filter graphs handle video export (drawbox, boxblur, scale for effects)

### Browser Requirements

- Modern browser with WebAssembly support
- SharedArrayBuffer support recommended (requires COOP/COEP headers, configured in Vite)

## License

MIT
