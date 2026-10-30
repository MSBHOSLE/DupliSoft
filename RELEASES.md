# DupliSoft Release Registry 📦

All versions follow the standard format: **`DupliSoft (MB.XX)`** where **`MB.`** is constant and **`XX`** is a 2-digit zero-padded number (`00`, `01`, `02`, `03`...).

All release artifacts are archived and permanently preserved in the [`releases/`](releases/) directory.

---

## 📋 Release Artifact Registry

| Version | Release Name | Date | Platform | File Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MB.06` | **DupliSoft (MB.06)** | 2026-10-17 07:12:26 | 3.7M | `a346984e010fa0c4a8b34f7cb800e478e1dad3754462669f7e31b4711662d785` |
| `MB.05` | **DupliSoft (MB.05)** | 2026-10-16 13:57:53 | macOS (`.dmg`) | 3.6 MB | `cfff3036f5c34ca5a397eae5fbd2b401d1e77b08cd4b3200681007d5f7196f90` |
| `MB.05` | **DupliSoft (MB.05)** | 2026-10-16 14:38:00 | Windows (`.exe`) | 2.25 MB | `6a25390b6684ad88d89ad898acf89c9ae4ee32972f7ba1fad60d8d37650e2793` |
| `MB.05` | **DupliSoft (MB.05)** | 2026-10-16 14:38:00 | Windows (`.msi`) | 3.2 MB | `1f1bcdeb14e796309617896cd37d77fcbc11fd5667113444b4f1a2fa7c4b7194` |
| `MB.04` | **DupliSoft (MB.04)** | 2026-10-16 12:45:43 | macOS (`.dmg`) | 2.9 MB | `dee8b288404b459af03c6d75592533c19a18a596fa18e24aaaba82375c206839` |
| `MB.03` | **DupliSoft (MB.03)** | 2026-10-14 19:21:07 | macOS (`.dmg`) | 2.9 MB | `e466a4631f6ff4dc2b50fff38e8582954887cb639b55533af8af7d78651c6c88` |
| `MB.02` | **DupliSoft (MB.02)** | 2026-10-13 22:49:58 | macOS (`.dmg`) | 2.5 MB | `9e9363a1026ba7ede24eab4968d36f2b7cfbb5e44b5871bd8d951d21d5743a7d` |
| `MB.02` | **DupliSoft (MB.02)** | 2026-10-14 19:04:12 | Windows (`.exe`) | 1.8 MB | `72a657bad63b0b64cb97f624558f6d90a9b8eb2c1e7807d9f94a457ee453c054` |
| `MB.02` | **DupliSoft (MB.02)** | 2026-10-14 19:04:12 | Windows (`.msi`) | 2.6 MB | `4f4238e708bc16ceb17be45fd2f00889c20a674e2dbece166928e42713f0ce59` |
| `MB.01` | **DupliSoft (MB.01)** | 2026-10-13 20:48:46 | macOS (`.dmg`) | 2.3 MB | `566412413583318d513955b82e6044a69da95a52ae0dd5cefb07a2d7a7b2e8ac` |
| `MB.00` | **DupliSoft (MB.00)** | 2026-10-13 19:23:00 | macOS (`.dmg`) | 2.04 MB | `77d12f27db57bbcd4fc9be4ca32810a95ff9e6024479904975f92ffcb6c5e52c` |

---

## 🚀 Version-by-Version Changelog

### 🚀 DupliSoft (MB.06) — Current Release
- **📁 Drag-and-Drop Folders & Drives**: Drag any folder, drive, or volume directly from macOS Finder or Windows Explorer anywhere into the DupliSoft window to immediately queue it for scanning.
- **⚡ Smart Path Normalization Engine**: Built-in Rust command `normalize_dropped_paths` validates and resolves dropped paths, maps dropped files to their containing directories, and eliminates duplicates.
- **🎯 Full-Window Visual Drop Target**: Glowing drop-zone overlay with animated feedback appears as soon as items hover over the window.
- **🧹 1-Click "Clear All" Target Directories**: Instantly reset all queued scan folders back to an empty slate with zero risk of deleting actual local files.
- **🏷️ Category-Scoped Smart Selection & Category Deselect**: Run "Keep Oldest", "Keep Newest", or "Keep Shortest" scoped strictly to the active tab (Images, Videos, PDFs & Docs, Code & Notebooks, etc.), preserving other tabs, and clear/deselect active categories individually with real-time selection badge counters.
- **🛡️ Zero Deletion Risk Guarantee**: Adding folders by drag-and-drop only prepares search targets; the 4-tier cryptographic safety verification and native OS Trash safeguards remain fully active.

### 🌟 DupliSoft (MB.05)
- **📈 Native Spreadsheet Inspector (`.xlsx`, `.xls`, `.csv`)**: Multi-sheet tabular inspection powered by Rust `calamine` & `csv`. View cell contents, navigate between multiple worksheets, and compare datasets side-by-side.
- **📓 Jupyter Notebook Inspector (`.ipynb`)**: Direct parsing and syntax rendering of markdown narrative cells and Python code blocks.
- **🎨 Visual Identity & Icon Overhaul**: Brand-new glossy metallic app icon integrated across macOS `.icns`, Windows `.ico`, and multi-resolution app icons.
- **⚡ Enhanced Side-by-Side Comparison**: Full support for comparing documents, spreadsheets, and archives side-by-side before deletion.

### 📄 DupliSoft (MB.04)
- **📝 Microsoft Word (`.docx`) Previewer**: In-memory XML extraction of document structure and paragraphs without requiring Microsoft Office.
- **📊 Microsoft PowerPoint (`.pptx`) Previewer**: Text and slide content extraction for quick presentation duplication checks.
- **🗜️ Archive Content Inspector (`.zip`)**: Safe examination of archive file hierarchies and manifests without disk decompression.
- **💻 Source Code & Plain Text Viewer**: Formatted line-by-line inspection for text documents, markdown, configuration files, and scripts.

### 🧠 DupliSoft (MB.03)
- **🖼️ Perceptual Image Hashing (dHash)**: Detection of visually similar images, crops, and resaved photos.
- **📸 Laplacian Blur & Sharpness Rating**: Automatic quality variance assessment to help users keep the sharpest, highest-quality photo.
- **📄 Jaccard Text Similarity**: MinHash / n-gram token overlap calculation for comparing document revisions.

### 🎨 DupliSoft (MB.02)
- **Logo Integration**: Embedded DupliSoft branding and logo across application header, window titlebars, and release artifacts.
- **Side-by-Side Zoom & Pan**: Dual-viewport synchronization with 50% – 600% zoom controls.
- **OS Trash Guardrails**: Automated detection and locking of root operating system directories.

### ⚡ DupliSoft (MB.01)
- **4-Stage Elimination Algorithm**:
  1. *Stage 1 (O(N) Traversal):* File size clustering with zero disk reads.
  2. *Stage 2 (32 KB Chunk Hash):* Prefix & suffix fast BLAKE3 elimination.
  3. *Stage 3 (Full Hashing):* Multi-threaded SIMD BLAKE3 parallelized with Rayon.
  4. *Stage 4 (Safe Deduplication):* Cross-platform reversible deletion to Finder Trash or Recycle Bin.
- **Core Media Viewer**: Hardware-accelerated 4K/8K video player, interactive photo viewer, audio player, and PDF canvas.

### 🐣 DupliSoft (MB.00)
- **Initial Prototype**: Core proof-of-concept Tauri v2 desktop application and basic duplicate grouping.

