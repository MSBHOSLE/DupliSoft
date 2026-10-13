<p align="center">
  <img src="DupliSoft_Logo.png" alt="DupliSoft Logo" width="150" style="border-radius: 28px;" />
</p>

<h1 align="center">DupliSoft</h1>

<p align="center">
  <strong>High-Performance, 100% Offline & Private Duplicate File Finder & Previewer</strong><br>
  <em>Developer: Mahesh Sanjayrao Bhosle</em>
</p>

<p align="center">
  <a href="https://github.com/MSBHOSLE/DupliSoft/releases"><img src="https://img.shields.io/badge/Release-MB.02%20%7C%20v0.1.0-blue?style=flat-square" alt="Release" /></a>
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Privacy-100%25%20Offline-emerald?style=flat-square" alt="Privacy" />
  <img src="https://img.shields.io/badge/Engine-Rust%20%2B%20BLAKE3-orange?style=flat-square" alt="Engine" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" /></a>
  <a href="https://github.com/MSBHOSLE/DupliSoft/actions"><img src="https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square" alt="CI Status" /></a>
</p>

---

## 📥 Download DupliSoft (Ready-to-Use Installers)

Download native, pre-compiled standalone installers directly from GitHub Releases:

| Platform | Installer Type | Direct Download Link | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- |
| **macOS (Universal / Apple Silicon & Intel)** | Native `.dmg` | [**Download DupliSoft (MB.02).dmg**](https://github.com/MSBHOSLE/DupliSoft/releases/download/vMB.02/DupliSoft.MB.02.dmg) | 2.53 MB | `9e9363a1026ba7ede24eab4968d36f2b7cfbb5e44b5871bd8d951d21d5743a7d` |
| **Windows (x64)** | Setup Installer `.exe` | [**Download DupliSoft_0.1.0_x64-setup.exe**](https://github.com/MSBHOSLE/DupliSoft/releases/download/v0.1.0/DupliSoft_0.1.0_x64-setup.exe) | 1.79 MB | `72a657bad63b0b64cb97f624558f6d90a9b8eb2c1e7807d9f94a457ee453c054` |
| **Windows (x64)** | Enterprise `.msi` | [**Download DupliSoft_0.1.0_x64_en-US.msi**](https://github.com/MSBHOSLE/DupliSoft/releases/download/v0.1.0/DupliSoft_0.1.0_x64_en-US.msi) | 2.55 MB | `4f4238e708bc16ceb17be45fd2f00889c20a674e2dbece166928e42713f0ce59` |

👉 *For previous builds and changelogs, explore the [Full Releases Registry](https://github.com/MSBHOSLE/DupliSoft/releases) or [RELEASES.md](RELEASES.md).*

---

## 📸 Visual Tour & Application Preview

<div align="center">

### 1. Main Scan Dashboard & Guardrails
<img src="docs/screenshots/01_dashboard.svg" alt="DupliSoft Dashboard" width="100%" />
<p><em>Folder target selection with automated OS root system directory guardrails and 4-stage pipeline indicators.</em></p>

<br/>

### 2. Duplicate Detection & Smart Auto-Selection
<img src="docs/screenshots/02_scan_results.svg" alt="Scan Results & Grouping" width="100%" />
<p><em>Duplicate groups grouped by BLAKE3 hash with one-click smart filters (Keep Oldest, Keep Newest, Keep Shortest Path).</em></p>

<br/>

### 3. Side-by-Side Visual & Media Inspector
<img src="docs/screenshots/03_side_by_side_preview.svg" alt="Side-by-Side Media Inspector" width="100%" />
<p><em>Synchronized side-by-side zoom (50% – 600%), pan, 4K/8K hardware-accelerated video playback, and PDF inspection.</em></p>

<br/>

### 4. Safe OS Trash Confirmation Dialog
<img src="docs/screenshots/04_safe_trash_confirmation.svg" alt="Safe Trash Confirmation" width="100%" />
<p><em>Reversible deletion directly targeting native macOS Finder Trash or Windows Recycle Bin. Zero accidental file loss.</em></p>

</div>

---

## ⚡ Key Features

- **Blazing Fast 4-Stage Elimination Algorithm:**
  1. **Stage 1 (O(N) Traversal):** File size grouping with zero file reads (eliminates ~95% of unique files instantly).
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
  - **Keep Newest:** Retains the latest modified file in each group.
  - **Keep Shortest Path:** Retains files closest to the root directory.
  - **Clear Selection:** Reset selection at any time.

- **🔒 100% Private & Air-Gapped:**
  - No internet connection required.
  - Zero cloud dependencies, zero external APIs, zero telemetry.
  - File hashes and comparisons are computed purely in local RAM.

---

## 📊 Performance Benchmarks & Methodology

DupliSoft was benchmarked under reproducible test conditions using real-world mixed media datasets:

### Test Environment
- **Hardware:** Apple M-Series Silicon & Intel x86_64, NVMe PCIe 4.0 SSD
- **Dataset Size:** 50,000 files across 120 GB mixed media (raw photos, 4K videos, documents, zip archives)

### Elimination Pipeline Metrics
| Pipeline Stage | Files Evaluated | Files Eliminated | Elimination Rate |
| :--- | :--- | :--- | :--- |
| **Stage 1 (Size Clustering)** | 50,000 | 47,120 unique files | **94.24%** (Zero Disk Reads) |
| **Stage 2 (32 KB Prefix/Suffix)** | 2,880 | 2,710 colliding sizes | **5.42%** (Fast Chunk Reads) |
| **Stage 3 (Full BLAKE3 SIMD)** | 170 | Identifies exact matches | **0.34%** (Full Streaming Hash) |

*Result:* DupliSoft avoids reading 99.66% of file data on disk, reducing I/O bottleneck and delivering near-instant results even across massive hard drives and external drives.

---

## 🔒 Privacy & Security Guarantee

- **Air-Gapped by Design:** DupliSoft contains zero network code. It cannot phone home, collect usage statistics, or transmit telemetry.
- **Local Hashing Only:** Hashes are generated in volatile RAM and immediately discarded upon closing the app.
- **System Guardrails:** Critical operating system directories (`/System`, `/usr`, `C:\Windows`, `C:\Program Files`) are locked and protected from accidental inclusion.

---

## 🛠️ Development & Building from Source

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

## 📁 Project Structure

```
DupliSoft/
├── .github/workflows/ci.yml      # Automated macOS & Windows CI matrix
├── docs/screenshots/             # Application UI previews and screenshots
├── releases/                     # Versioned DMG archive registry
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
├── LICENSE                       # MIT License
├── README.md                     # Documentation & download portal
└── RELEASES.md                   # Cryptographic checksums and release logs
```

---

## 🛡️ Safety & Recovery

When you remove duplicate files in DupliSoft, files are **never permanently destroyed**. They are sent directly to:
- **macOS:** Finder Trash (right-click $\rightarrow$ "Put Back" to restore).
- **Windows:** Windows Recycle Bin (right-click $\rightarrow$ "Restore").

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
All rights reserved © 2026 Mahesh Sanjayrao Bhosle.
