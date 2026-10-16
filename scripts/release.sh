#!/usr/bin/env bash
set -e

# DupliSoft Automated Release & Version Archiving Script
# Naming standard: DupliSoft (MB.XX) where MB. is constant and XX is a 2-digit zero-padded number

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RELEASES_DIR="${ROOT_DIR}/releases"

mkdir -p "${RELEASES_DIR}"

# Find highest MB.XX version in releases/
LATEST_NUM=-1
for file in "${RELEASES_DIR}"/DupliSoft\ \(MB.[0-9][0-9]\).dmg; do
  if [ -f "$file" ]; then
    FILENAME=$(basename "$file")
    NUM_STR=$(echo "$FILENAME" | sed -E 's/DupliSoft \(MB\.([0-9]{2})\)\.dmg/\1/')
    NUM=$((10#$NUM_STR))
    if [ $NUM -gt $LATEST_NUM ]; then
      LATEST_NUM=$NUM
    fi
  fi
done

if [ -n "$1" ]; then
  NEXT_VERSION="$1"
else
  NEXT_NUM=$((LATEST_NUM + 1))
  NEXT_VERSION=$(printf "MB.%02d" $NEXT_NUM)
fi
RELEASE_NAME="DupliSoft (${NEXT_VERSION})"
DMG_FILENAME="${RELEASE_NAME}.dmg"

echo "=================================================="
echo " Packaging Release: ${RELEASE_NAME}"
echo "=================================================="

# 1. Update src/version.ts
cat <<EOL > "${ROOT_DIR}/src/version.ts"
export const APP_NAME = "DupliSoft";
export const APP_VERSION = "${NEXT_VERSION}";
export const FULL_APP_NAME = "${RELEASE_NAME}";
EOL

# 2. Update window title in tauri.conf.json if present
sed -i '' "s/\"title\": \"DupliSoft.*—/\"title\": \"${RELEASE_NAME} —/" "${ROOT_DIR}/src-tauri/tauri.conf.json" || true

# Run Tauri Production Build
cd "${ROOT_DIR}"
npm run tauri build

# Re-sign app bundle with deep ad-hoc signature for macOS Sequoia/Silicon compatibility
APP_BUNDLE=$(find "${ROOT_DIR}/src-tauri/target/release/bundle/macos" -name "*.app" -type d -print -quit)
if [ -d "$APP_BUNDLE" ]; then
  codesign --force --deep --sign - "$APP_BUNDLE" || true
fi

# Locate compiled DMG
SOURCE_DMG=$(find "${ROOT_DIR}/src-tauri/target/release/bundle/dmg" -name "*.dmg" -type f -print -quit)

if [ -z "$SOURCE_DMG" ] || [ ! -f "$SOURCE_DMG" ]; then
  echo "Error: Could not find compiled DMG bundle!"
  exit 1
fi

# Copy into releases archive and root directory
TARGET_DMG="${RELEASES_DIR}/${DMG_FILENAME}"
cp "$SOURCE_DMG" "$TARGET_DMG"
cp "$TARGET_DMG" "${ROOT_DIR}/${DMG_FILENAME}"

# Apply custom logo icon directly onto the DMG file for Finder & Desktop
osascript -l JavaScript -e "
  ObjC.import('AppKit');
  var img = $.NSImage.alloc.initWithContentsOfFile('${ROOT_DIR}/src-tauri/icons/icon.icns');
  if (img) {
    $.NSWorkspace.sharedWorkspace.setIconForFileOptions(img, '${TARGET_DMG}', 0);
    $.NSWorkspace.sharedWorkspace.setIconForFileOptions(img, '${ROOT_DIR}/${DMG_FILENAME}', 0);
  }
" || true

FILE_SIZE=$(ls -lh "$TARGET_DMG" | awk '{print $5}')
SHA256=$(shasum -a 256 "$TARGET_DMG" | awk '{print $1}')
DATE_STR=$(date "+%Y-%m-%d %H:%M:%S")

# Update RELEASES.md
RELEASES_MD="${ROOT_DIR}/RELEASES.md"
if [ ! -f "$RELEASES_MD" ]; then
  cat <<EOL > "$RELEASES_MD"
# DupliSoft Release Registry 📦

All versions follow the standard format: \`DupliSoft (MB.XX)\` with \`MB.\` constant and 2-digit numerical increments.

| Version | Release Name | Date | File Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- | :--- |
EOL
fi

NEW_ENTRY="| \`${NEXT_VERSION}\` | **${RELEASE_NAME}** | ${DATE_STR} | ${FILE_SIZE} | \`${SHA256}\` |"
if grep -q "| \`${NEXT_VERSION}\` |" "$RELEASES_MD"; then
  sed -i '' "s/| \`${NEXT_VERSION}\` |.*/$NEW_ENTRY/" "$RELEASES_MD" || true
else
  echo "$NEW_ENTRY" >> "$RELEASES_MD"
fi

echo ""
echo "✅ Release completed successfully!"
echo "Archived: ${TARGET_DMG}"
echo "Root Copy: ${ROOT_DIR}/${DMG_FILENAME}"
echo "Registry updated: ${RELEASES_MD}"
echo "=================================================="
