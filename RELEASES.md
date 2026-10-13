# DupliSoft Release Registry 📦

All versions follow the standard format: **`DupliSoft (MB.XX)`** where **`MB.`** is constant and **`XX`** is a 2-digit zero-padded number (`00`, `01`, `02`, ...).

| Version | Release Name | Date | File Size | Path |
| :--- | :--- | :--- | :--- | :--- |
| `MB.00` | **DupliSoft (MB.00)** | 2026-10-13 | 2.04 MB | [`releases/DupliSoft (MB.00).dmg`](releases/DupliSoft%20%28MB.00%29.dmg) |

---

### How New Versions Are Packaged

To build and archive the next version (e.g. `DupliSoft (MB.01)`, `DupliSoft (MB.02)`), simply run:
```bash
npm run release
```
The script will:
1. Increment the 2-digit version number automatically (`MB.01`, `MB.02`, etc.).
2. Build the optimized production application.
3. Archive the DMG file into `releases/DupliSoft (MB.XX).dmg`.
4. Keep all past versions permanently intact.
| `MB.01` | **DupliSoft (MB.01)** | 2026-10-13 20:48:46 | 2.3M | `566412413583318d513955b82e6044a69da95a52ae0dd5cefb07a2d7a7b2e8ac` |
| `MB.02` | **DupliSoft (MB.02)** | 2026-10-13 22:49:58 | 2.5M | `9e9363a1026ba7ede24eab4968d36f2b7cfbb5e44b5871bd8d951d21d5743a7d` |
