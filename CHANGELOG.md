# MediaFlow - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-06

### Major Overhaul & Architecture Polish
- **Enterprise Internationalization (i18n) Engine:**
  - Full native English & Arabic (العربية) localization.
  - Automatic detection of After Effects host locale (`csInterface.getHostEnvironment().appUILocale`).
  - Header flyout language dropdown switcher with live checkmarks and instant zero-reload reactive translation.
  - Full bi-directional layout support (`dir="ltr"` & `dir="rtl"`) with monospace preservation for paths, filenames, and code.
  - Open/Closed extensible architecture allowing new languages to be registered via simple locale dictionary files.
- **Comp Tree 2.0 & Render Queue Integration:**
  - Visual hierarchy tree with dynamic status badges (`Root`, `Sub`, `Missing`, `Empty`).
  - Integrated Render Queue modal with customizable output templates and 1-click execution.
  - Instant navigation: reveal composition in Project Panel or open in Timeline.
- **Smart Batch Renamer:**
  - Token-based renaming (`{name}`, `{counter}`, `{date}`, `{res}`, `{fps}`, `{dur}`).
  - Live side-by-side preview table.
  - Regular Expression (Regex) and case-sensitive find & replace.
  - Prefix, suffix, and counter start controls.
- **Project Asset & Font Auditor:**
  - Detects uninstalled and missing fonts across text layers.
  - Scans for missing 3rd-party effects and plugins.
  - Direct 1-click layer reveal in After Effects timeline and viewer.
- **Deep Dependency & Orphan Cleaner:**
  - Dependency traversal isolating unreferenced pre-comps and unused footage into safe `[ Orphan Comps ]` bins.
- **Smart Relink & Consolidate:**
  - Recursive search reconnecting offline media by filename.
  - Smart collect copying active assets by type, generating manifests, and saving consolidated `.aep` files.
- **FFmpeg Proxy & Transcode Studio:**
  - Background video transcoding with progress bars and speed calculation.
  - 6 presets including Apple ProRes 422 Proxy, LT, 4444 with Alpha, and H.264 720p/1080p.
  - Auto-attach generated proxies to After Effects footage items.
- **Theme Auto-Sync:**
  - Dynamic synchronization with After Effects skin brightness (Dark, Extra Dark, Medium, Light).
- **Productivity Keyboard Shortcuts:**
  - `Ctrl+1..5` tab switching, `Ctrl+Shift+R` render queue, `Ctrl+Alt+R` renamer, `Ctrl+Shift+A` auditor, `Ctrl+Shift+P` cache purge.
- **UXP Readiness:**
  - Unified file system and host abstraction adapter layer.

---

## [1.0.0] - 2026-02-25

### Initial Release
- Smart media import with drag & drop interface.
- Copy to Project and Link Original modes.
- Automatic bin organization by file type.
- Automatic image sequence detection.
- Batch processing and duplicate file handling.
- Undo support for import actions.
- Dark theme matching After Effects.
