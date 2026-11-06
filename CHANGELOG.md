# MediaFlow - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-11-06

### OpenGeo Geometric Precision & Lucide Iconography
- **Zero Border-Radius Architectural Aesthetics:**
  - Transitioned all buttons, cards, dialogs, inputs, badges, and tabs to strict zero-radius (`0px`) geometric sharpness.
  - Matches the architectural, technical precision of Adobe After Effects and OpenGeo.
- **Lucide Icons Vector Engine:**
  - Replaced FontAwesome solid icons with modern stroke-based Lucide Icons (`libs/lucide.min.js`, 2,000+ vector symbols).
  - Consistent `1.75px` vector stroke weight and optical alignment across 145+ interface elements.
- **OpenGeo Technical Emerald & Deep Charcoal Palette:**
  - Integrated deep matte studio dark tokens (`#181818` panel, `#1f1f1f` toolbars, `#121212` canvas and wells, `#363636` 1px borders).
  - Signature technical emerald accent (`#10b981` default, `#34d399` hover, `#059669` active).
  - High-contrast Sovereign Primary buttons (`#10b981` solid fill with `#121212` bold text).
- **OpenGeo Dialog & Modal System:**
  - Modernized all modals with a 2px top emerald gradient accent stripe (`linear-gradient(90deg, #10b981, #059669 55%, transparent)`).
  - Ambient glass blur overlay (`backdrop-filter: blur(4px); background: rgba(0, 0, 0, 0.65)`).
- **Segmented Controls & Technical Dropzone:**
  - Seamless joined borders for sort controls with 6px square micro-indicators.
  - Blueprint-style dashed rectangular ingest zone.
- **Metallic Emerald Header Title:**
  - Brand header title with clean metallic emerald gradient (`linear-gradient(135deg, #ffffff 40%, #6ee7b7 100%)`).

## [2.1.0] - 2026-11-06

### Modern Studio Dashboard & UI Revolution
- **Studio Command Center (Home Screen):**
  - Completely transformed the landing page from a blank dropzone into a modern, executive Studio Command Center.
  - **Live Project Health Bar:** Real-time pulse indicator, overall health status badge (`Optimal`, `Review`, `Issues Found`), and interactive metric pills (`Comps`, `Assets`, `Offline`, `Unused`).
  - **Quick Action Tools Hub:** 6 high-visibility glowing action cards providing 1-click access to *Asset & Font Auditor*, *Comp Tree & Batch Renamer*, *FFmpeg Proxy Studio*, *Deep Dependency & Orphan Cleaner*, *Auto-Relink Media*, and *Collect & Archive*.
  - **Sleek Ingest & Dropzone:** Integrated modern dropzone that balances aesthetics and utility.
  - **Direct Project Sort Strip:** Instant 1-click sort buttons (`Sort AE Bins`, `Sort OS & AE`, `Sort Comps`) directly on the home hub without requiring tab switching.
- **Architectural Bin Structure Preview in Sort Tab:**
  - Added live preview card displaying active folder preset mappings (`Video`, `Images`, `Audio`, `Comps`, `Sequences`, `Solids`) with a direct shortcut to edit in Settings.
- **Smart Collapsible Activity Log Drawer:**
  - Redesigned the Activity Log from a permanent space-wasting box into a compact, responsive 26px status footer that displays real-time activity previews and auto-expands on error, saving 80+ vertical pixels.
- **Enhanced Internationalization (i18n):**
  - Added full Arabic and English localizations for all new dashboard elements, health states, cards, and tooltips (100% coverage across 261 tagged elements).

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
