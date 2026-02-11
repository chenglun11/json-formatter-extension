<div align="center">

# { } JSON Formatter

A lightweight Chrome extension for formatting and viewing JSON — right from your context menu or toolbar icon.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![GitHub](https://img.shields.io/github/stars/chenglun11/json-formatter-extension?style=social)](https://github.com/chenglun11/json-formatter-extension)

**English** | [中文](#中文说明)

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **In-Page Floating Window** | Format result appears as a draggable floating panel on the current page |
| **Pin Mode** | Pin the floating window to keep it visible while interacting with the page |
| **One-Click Access** | Click the extension icon to open the viewer instantly |
| **Right-Click Format** | Select JSON text on any page → right-click → Format JSON |
| **Syntax Highlighting** | Color-coded keys, strings, numbers, booleans, and null |
| **Collapsible Tree** | Fold / unfold objects and arrays by clicking the `▼` arrow |
| **Copy** | One-click copy of formatted JSON |
| **JSONPath Query** | Built-in JSONPath support (`$.key`, `..key`, `[*]`, `[0:3]`) to quickly locate data in large JSON |
| **Edit Mode** | Paste JSON manually, press `Ctrl+Enter` / `Cmd+Enter` to format |
| **Light / Dark Theme** | Automatically follows system appearance |
| **i18n** | English & Simplified Chinese, auto-detected |

## Screenshots

> TODO: Add screenshots here
>
> Dark mode: `screenshots/dark.png`
> Light mode: `screenshots/light.png`

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/chenglun11/json-formatter-extension.git
   ```

2. Open Chrome → navigate to `chrome://extensions/`

3. Enable **Developer mode** (top-right toggle)

4. Click **Load unpacked** → select the `json-formatter-extension` folder

5. Pin the extension in the toolbar for quick access

## Usage

### Click Extension Icon

Click the **{ }** icon in the Chrome toolbar → paste your JSON → press `Ctrl+Enter` (`Cmd+Enter` on macOS) to format.

### Right-Click Context Menu

1. Select any JSON text on a web page
2. Right-click → **Format JSON**
3. A floating window appears with the formatted result
4. Click the **pin** button to keep it visible while browsing

## Project Structure

```
json-formatter-extension/
├── manifest.json            # Extension config (Manifest V3)
├── background.js            # Service worker — context menu & icon click
├── content.js               # In-page floating window
├── viewer.html              # Full-page viewer
├── viewer.css               # Styles — light/dark theme via CSS variables
├── viewer.js                # JSON parsing, rendering & interaction
├── onboarding.html          # First-run onboarding page
├── onboarding.css
├── onboarding.js
├── _locales/
│   ├── en/messages.json     # English
│   └── zh_CN/messages.json  # 简体中文
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Contributing

Contributions are welcome! Feel free to open an [issue](https://github.com/chenglun11/json-formatter-extension/issues) or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

## License

[MIT](./LICENSE)

---

<a id="中文说明"></a>

## 中文说明

一个轻量级 Chrome 扩展，用于格式化和查看 JSON。

### 安装方法

1. 克隆仓库：

   ```bash
   git clone https://github.com/chenglun11/json-formatter-extension.git
   ```

2. 打开 Chrome，地址栏输入 `chrome://extensions/`

3. 打开右上角的 **开发者模式** 开关

4. 点击 **加载已解压的扩展程序** → 选择 `json-formatter-extension` 文件夹

5. 将扩展固定到工具栏，方便随时使用

### 使用方式

- **点击图标**：点击工具栏中的扩展图标 → 粘贴 JSON → `Ctrl+Enter` 格式化
- **右键菜单**：选中页面上的 JSON 文本 → 右键 → 「格式化 JSON」→ 页内悬浮窗查看
- **固定模式**：点击悬浮窗的图钉按钮，可将窗口固定在页面上继续浏览

### 功能特性

- 页内可拖拽悬浮窗，支持固定（pin）模式
- 语法高亮（key / string / number / boolean / null 各有颜色）
- 可折叠的树形视图
- 一键复制格式化结果
- 内置 JSONPath 查询，快速定位大型 JSON 中的数据
- 跟随系统自动切换亮色 / 暗色主题
- 支持中英文自动切换
- 首次安装自动展示引导页
