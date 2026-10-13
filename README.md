<p align="center">
  <img src="DupliSoft_Logo.png" alt="DupliSoft Logo" width="150" style="border-radius: 28px;" />
</p>

<h1 align="center">DupliSoft</h1>

<p align="center">
  <strong>High-Performance, 100% Offline & Private Duplicate File Finder & Previewer</strong><br>
  <em>Developer: Mahesh Sanjayrao Bhosle</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Privacy-100%25%20Offline-emerald?style=flat-square" alt="Privacy" />
  <img src="https://img.shields.io/badge/Engine-Rust%20%2B%20BLAKE3-orange?style=flat-square" alt="Engine" />
  <img src="https://img.shields.io/badge/Version-MB.02-indigo?style=flat-square" alt="Version" />
</p>

---

## Key Features

- **⚡ Blazing Fast 4-Stage Elimination Algorithm:**
  1. **Stage 1 (O(N) Traversal):** File size grouping with zero file reads (eliminates 95% of unique files instantly).
  2. **Stage 2 (32 KB Chunk Hash):** Reads prefix (16 KB) and suffix (16 KB) with BLAKE3 to discard distinct files of identical size.
  3. **Stage 3 (Full Multithreaded Hashing):** SIMD-accelerated BLAKE3 hashing parallelized across all CPU cores with Rayon.
  4. **Stage 4 (Safe Deduplication):** Cross-platform reversible deletion directly to macOS Finder Trash or Windows Recycle Bin.

- **🔍 Side-by-Side Visual & Media Inspector:**
  - **Photos & Images:** Interactive zoom (50% – 600%), pan, actual size, and side-by-side comparison.
  - **PDF Documents:** Embedded zoomable canvas viewer with page navigation.
  - **Videos & Movies:** Hardware-accelerated 4K/8K playback with synchronized dual scrubbing and audio controls.
  - **Audio:** Audio player with duration, bitrate, and playback scrubber.

- **✨ Smart Auto-Selectors:**
  - **Keep Oldest:** Automatically marks newer duplicate copies for removal.
  - **Keep Newest:** Keeps the latest modified file in each group.
  - **Keep Shortest Path:** Retains files closest to the root directory.
  - **Clear Selection:** Reset selection at any time.

- **🔒 100% Private & Air-Gapped:**
  - No internet connection required.
  - Zero cloud dependencies, zero external APIs, zero telemetry.
  - File hashes and comparisons are computed purely in local RAM.

---

## Getting Started

### Prerequisites
- **Node.js** (v20+) and **npm**
- **Rust** (v1.80+) and **cargo**

### Development Mode
Launch the application with hot reloading:
```bash
npm run tauri dev
```

### Production Build
To create a standalone native installer:
- **macOS:** Produces a `.dmg` and `.app` bundle:
  ```bash
  npm run tauri build
  ```
- **Windows:** Compiles natively into a `.msi` or `.exe` installer.

---

## Project Structure

```
DupliSoft/
├── src/                          # Frontend (React 19, TypeScript, Tailwind CSS v4)
│   ├── components/
│   │   ├── Header.tsx            # Metrics, privacy badge & trash action
│   │   ├── Sidebar.tsx           # Directory selector & scan guardrails
│   │   ├── ProgressBanner.tsx    # Real-time scan pipeline status
│   │   ├── SmartSelectBar.tsx    # One-click smart selection presets
│   │   ├── DuplicateList.tsx     # Filterable duplicate group cards
│   │   ├── PreviewModal.tsx      # Side-by-side zoom & video inspector
│   │   └── TrashConfirmModal.tsx # Safe OS Trash confirmation
│   ├── types.ts                  # TypeScript interfaces matching Rust models
│   └── utils/formatters.ts       # Byte/date formatting & file categorizers
├── src-tauri/                    # Backend (Rust & Tauri v2)
│   ├── src/
│   │   ├── hasher.rs             # BLAKE3 prefix/suffix chunk & full streaming hasher
│   │   ├── scanner.rs            # Multi-stage elimination pipeline & event emitter
│   │   ├── trash.rs              # Safe OS Trash (macOS NSFileManager / Win Recycle Bin)
│   │   ├── models.rs             # Serializable data models
│   │   └── lib.rs                # Tauri command registration & async runtime
│   ├── Cargo.toml                # Rust dependencies (blake3, rayon, walkdir, trash)
│   └── tauri.conf.json           # Tauri v2 window and asset protocol configuration
```

---

## Safety & Recovery
When you remove duplicate files in DupliSoft, files are **never permanently destroyed**. They are sent directly to:
- **macOS:** Finder Trash (right-click $\rightarrow$ "Put Back" to restore).
- **Windows:** Windows Recycle Bin (right-click $\rightarrow$ "Restore").
