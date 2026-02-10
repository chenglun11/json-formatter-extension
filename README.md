# JSON Formatter

A lightweight Chrome extension for formatting and viewing JSON with syntax highlighting — right from your context menu.

![Chrome Extension](https://img.shields.io/badge/Manifest-V3-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Right-Click to Format** — Select any JSON text on a page, right-click, and instantly view it formatted in a new tab
- **Syntax Highlighting** — Color-coded keys, strings, numbers, booleans, and null values
- **Collapsible Tree View** — Click the arrow to fold/unfold objects and arrays
- **Copy to Clipboard** — One-click copy of the formatted JSON
- **Raw Text Mode** — Paste and format JSON manually with `Ctrl+Enter` / `Cmd+Enter`
- **Light / Dark Theme** — Automatically follows your system appearance
- **i18n** — English and Simplified Chinese, auto-detected from browser language

## Screenshots

### Dark Mode

```
┌─────────────────────────────────────────────┐
│ { }  JSON Formatter  v1.0.0    [Expand All] │
│─────────────────────────────────────────────│
│ ▼ {                                         │
│     "name": "JSON Formatter",               │
│     "version": "1.0.0",                     │
│   ▼ "features": [                           │
│         "syntax highlighting",              │
│         "collapsible tree"                  │
│     ]                                       │
│   }                                         │
│─────────────────────────────────────────────│
│          GitHub · Made with care            │
└─────────────────────────────────────────────┘
```

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/chenglun11/json-formatter-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **Developer mode** (top-right toggle)

4. Click **Load unpacked** and select the `json-formatter-extension` folder

5. Done! You should see the extension icon in your toolbar.

## Usage

### Via Context Menu (Recommended)

1. Select any JSON text on a web page
2. Right-click → **Format JSON**
3. A new tab opens with the formatted, syntax-highlighted result

### Manual Input

1. Click the extension icon or open the viewer page
2. Click **Raw Text** to switch to the input mode
3. Paste your JSON
4. Press `Ctrl+Enter` (or `Cmd+Enter` on macOS) to format

## Project Structure

```
json-formatter-extension/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Service worker, registers context menu
├── viewer.html            # JSON viewer page
├── viewer.css             # Styles with light/dark theme support
├── viewer.js              # JSON parsing, rendering, and interaction
├── _locales/
│   ├── en/messages.json   # English
│   └── zh_CN/messages.json # Simplified Chinese
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
