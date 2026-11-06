# MediaFlow Pro 🎬

[![Adobe CEP 9.0+](https://img.shields.io/badge/Adobe%20CEP-9.0%2B-blue.svg)](https://github.com/Adobe-CEP)
[![After Effects](https://img.shields.io/badge/After%20Effects-CC%202019%2B-9999FF.svg)](https://www.adobe.com/products/aftereffects.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![i18n Supported](https://img.shields.io/badge/i18n-English%20%7C%20العربية-orange.svg)](#-internationalization--bilingual-engine)

> **MediaFlow Pro** is an enterprise-grade studio media management and automation panel for **Adobe After Effects**. It transforms project asset organization, composition hierarchy management, batch renaming, missing asset auditing, proxy generation, and archival into a seamless, unified workflow.

---

## 🌟 Key Features

### 📥 1. Smart Ingest & Drag-and-Drop
- **Two Flexible Ingest Modes:**
  - **Copy to Project:** Automatically copies imported media into organized project directories (`_media/` or custom structure).
  - **Link Original:** Ingests media directly from source location without duplicating physical files.
- **Auto Image Sequence Detection:** Intelligently recognizes numbered file sequences (e.g., `render_0001.png...render_1000.png`) and bundles them into native AE image sequences.
- **Duplicate Protection:** Detects duplicate items and lets you choose between Skip, Overwrite & Reload, Replace Link, Rename, or Shared Physical Link.

### 🌳 2. Comp Tree 2.0 & Render Queue
- **Visual Composition Hierarchy:** Interactive tree showing roots, sub-comps, and nesting depth.
- **Dynamic Status Badges:** Instant visual badges for:
  - 🟢 **Root:** Master composition unreferenced by others.
  - 🟣 **Sub:** Pre-composition nested within parent comps.
  - 🟡 **Missing:** Comp contains missing/offline footage.
  - ⚪ **Empty:** Composition contains 0 layers.
- **Integrated Render Queue Modal:** Send selected compositions directly to AE's Render Queue with customizable Output Module templates (Lossless, High Quality, ProRes 422, ProRes 4444, H.264, PNG Sequence) and instant render trigger.
- **1-Click Navigation:** Directly reveal comps in Project Panel or open them in Timeline.

### ✏️ 3. Smart Batch Renamer
- **Token Pattern Engine:** Build consistent studio naming conventions using dynamic tokens:
  - `{name}` — Original item name
  - `{counter}` — Customizable sequential numbering with start offset
  - `{date}` — Today's date (`YYYY-MM-DD`)
  - `{res}` — Composition resolution (`1920x1080`)
  - `{fps}` — Frame rate (`24fps`, `30fps`, `60fps`)
  - `{dur}` — Duration in seconds (`10s`)
- **Find & Replace:** Search and replace strings with full **Regular Expression (Regex)** and case-sensitivity support.
- **Prefix & Suffix Controls:** Quickly append versions (`_v1`, `_draft`) or shot codes (`SC01_`).
- **Live Preview Table:** Real-time side-by-side comparison before committing changes to After Effects with full Undo (`Ctrl+Z`) support.

### 🔬 4. Project Asset & Font Auditor
- **Missing Font Scanner:** Deeply scans text layers to identify uninstalled or missing fonts before final delivery.
- **Missing 3rd-Party Effect Auditor:** Detects missing plugins and effects across all compositions.
- **Instant Layer Reveal:** 1-click button to jump directly to any problematic layer inside After Effects viewer and timeline.

### 🧹 5. Deep Dependency & Orphan Cleaner
- **Dependency Hierarchy Analysis:** Traverses expression references, render queue links, and nesting chains.
- **Orphan Isolation:** Safely isolates abandoned or unused pre-comps into dedicated bins (`[ Orphan Comps ]`) without deleting them.
- **Safe Cleanup:** Remove truly unused footage and comps with full Undo group protection.

### 🔗 6. Smart Relink & Consolidate (Collect)
- **Recursive Auto-Relink:** Recursively scans drives or target folders to automatically reconnect offline media by filename.
- **Smart Collect & Archive:** Copies only truly used project media classified into organized folders (`Video`, `Audio`, `Images`, `Sequences`), generates a detailed `Collection_Report.txt`, and saves a clean consolidated `.aep` copy.

### ⚡ 7. FFmpeg Proxy & Transcode Studio
- **Background Transcoding:** Powered by local FFmpeg with zero UI freezing.
- **6 Professional Presets:**
  - Apple ProRes 422 Proxy
  - Apple ProRes 422 LT
  - H.264 Fast 720p (Ultra-lightweight)
  - H.264 Fast 1080p
  - Apple ProRes 4444 (With Alpha channel preservation)
  - Audio Extract: 24-bit 48kHz WAV
- **Auto-Attach:** Automatically links generated proxy files to footage items in After Effects upon completion.

### 🎨 8. Theme Auto-Sync
- **Native Look & Feel:** Synchronizes brightness with Adobe After Effects host theme in real-time (`Dark`, `Extra Dark`, `Medium`, `Light`).

### 🌐 9. Internationalization & Bilingual Engine
- **English & Arabic (العربية):** Full bilingual support with natural studio terminology.
- **Host AE Auto-Detection:** Automatically detects After Effects host locale (`appUILocale`) on initial launch.
- **Header Language Dropdown:** Sleek flyout dropdown menu with live checkmarks for 1-click language switching.
- **Bi-Directional Styling:** Automatically toggles `dir="ltr"` and `dir="rtl"` while keeping code, filenames, and numbers in monospace LTR.
- **Extensible Architecture:** Easily add any new language (e.g., French, Spanish, German) simply by registering a new locale dictionary.

---

## ⌨️ Productivity Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Ctrl + 1..5` | Quick Tab Switching (Ingest, Sort, Stats, Smart, Comp Tree) |
| `Ctrl + Shift + R` | Open Render Queue Options Modal |
| `Ctrl + Alt + R` | Open Smart Batch Renamer |
| `Ctrl + Shift + A` | Run Project Asset & Font Auditor |
| `Ctrl + Shift + P` | Purge All Memory & Disk Caches |
| `Escape` | Close any active modal / dropdown |

---

## 💻 System Requirements

- **Adobe After Effects:** CC 2019 (16.0) through 2024+
- **Operating System:** Windows 10/11 or macOS 10.15+
- **Architecture:** CEP 9.0+ (with abstraction layer ready for UXP migration)

---

## 🚀 Installation

### Option 1: Manual Installation (Developer / Unsigned Mode)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/wittybrandcode/MediaFlow.git
   ```

2. Copy the `MediaFlow` directory into your Adobe CEP extensions folder:
   - **Windows:**
     ```
     C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\MediaFlow
     ```
   - **macOS:**
     ```
     /Library/Application Support/Adobe/CEP/extensions/MediaFlow
     ```

3. Enable Adobe Extension Debug Mode:
   - **Windows:** In PowerShell / Registry:
     ```powershell
     reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.9" /v PlayerDebugMode /t REG_SZ /d 1 /f
     ```
   - **macOS:** In Terminal:
     ```bash
     defaults write com.adobe.CSXS.9 PlayerDebugMode 1
     ```

4. Launch **Adobe After Effects** and find the extension under:
   ```
   Window > Extensions > MediaFlow
   ```

---

## 📂 Project Architecture

```
MediaFlow/
├── CSXS/
│   └── manifest.xml          # CEP Extension manifest configuration
├── css/
│   └── style.css             # Unified After Effects dark theme stylesheet with RTL support
├── icons/                    # Panel icons and logos
├── js/
│   ├── config/               # File types and custom folder preset schemas
│   ├── core/                 # UXP / CEP compatibility adapter
│   ├── fs/                   # File scanner, sequence detector, transcoder, validator
│   ├── i18n/                 # Internationalization engine & locale dictionaries (en, ar)
│   ├── ui/                   # Controllers: comp tree, batch renamer, smart studio, proxies
│   ├── ae-bridge.js          # Promise-based ExtendScript bridge
│   ├── app.js                # Extension bootstrapper
│   └── cep-bridge.js         # Host environment and filesystem bridge
├── jsx/
│   ├── hostscript.jsx        # ExtendScript ES3 main dispatcher (31 atomic actions)
│   ├── comp-tree.jsx         # Hierarchy builder and batch renamer
│   ├── smart-actions.jsx     # Auditor, orphan cleaner, relinker, collect engine
│   └── ...                   # Importers, sequence handlers, folder managers
├── libs/
│   ├── CSInterface.js        # Adobe CSInterface library
│   └── fontawesome/          # Embedded FontAwesome icon set
├── CHANGELOG.md              # Version release history
├── LICENSE                   # MIT License
└── README.md                 # Project documentation
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by **Tawfik Mostefaoui** ([WittyBrand](https://github.com/wittybrandcode)).
