import { FileCategory } from "../types";

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatDate(timestampSec: number): string {
  if (!timestampSec) return "Unknown";
  const date = new Date(timestampSec * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

export const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "tiff", "avif"]);
export const VIDEO_EXTS = new Set(["mp4", "mkv", "mov", "avi", "webm", "m4v", "wmv", "flv", "mpg", "mpeg"]);
export const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "m4a", "aac", "ogg", "wma", "aiff"]);
export const DOC_EXTS = new Set(["pdf", "doc", "docx", "txt", "md", "csv", "xlsx", "xls", "pptx", "rtf"]);
export const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "rar", "7z", "bz2", "xz"]);
export const SPREADSHEET_EXTS = new Set(["xlsx", "xls", "csv", "tsv", "ods", "xlsb"]);
export const WORD_EXTS = new Set(["docx", "doc"]);
export const PPT_EXTS = new Set(["pptx", "ppt"]);
export const NOTEBOOK_EXTS = new Set(["ipynb"]);
export const CODE_EXTS = new Set([
  // Core Systems & Languages
  "py", "java", "c", "cpp", "h", "hpp", "cs", "rs", "go",
  // Web & UI
  "ts", "js", "jsx", "tsx", "vue", "svelte",
  // Scripting, Mobile & Scientific
  "rb", "php", "swift", "kt", "dart", "zig", "scala", "lua", "jl", "r",
  // Shell & Windows Terminal
  "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
  // Schemas & Queries
  "sql", "graphql", "gql", "proto",
  // Stylesheets
  "css", "scss", "sass", "less",
  // DevOps & Configuration
  "toml", "ini", "env", "conf", "tf", "tfvars", "md"
]);

export const TEXT_EXTS = new Set([
  "txt", "text", "md", "rtf", "log", "json", "xml", "html", "htm",
  "yaml", "yml", "ini", "toml", "env", "sql", "sh", "py", "js", "ts", "css",
  ...CODE_EXTS
]);

export function isImage(ext: string): boolean {
  return IMAGE_EXTS.has(ext.toLowerCase());
}

export function isVideo(ext: string): boolean {
  return VIDEO_EXTS.has(ext.toLowerCase());
}

export function isPdf(ext: string): boolean {
  return ext.toLowerCase() === "pdf";
}

export function isAudio(ext: string): boolean {
  return AUDIO_EXTS.has(ext.toLowerCase());
}

export function isSpreadsheet(ext: string): boolean {
  return SPREADSHEET_EXTS.has(ext.toLowerCase());
}

export function isWord(ext: string): boolean {
  return WORD_EXTS.has(ext.toLowerCase());
}

export function isPpt(ext: string): boolean {
  return PPT_EXTS.has(ext.toLowerCase());
}

export function isNotebook(ext: string): boolean {
  return NOTEBOOK_EXTS.has(ext.toLowerCase());
}

export function isCode(ext: string): boolean {
  return CODE_EXTS.has(ext.toLowerCase());
}

export function isTextDoc(ext: string): boolean {
  return TEXT_EXTS.has(ext.toLowerCase());
}

export function isArchive(ext: string): boolean {
  return ARCHIVE_EXTS.has(ext.toLowerCase());
}

export function getLanguageLabel(ext: string): string {
  const e = ext.toLowerCase();
  const map: Record<string, string> = {
    ipynb: "Jupyter Notebook",
    py: "Python",
    java: "Java",
    c: "C",
    cpp: "C++",
    h: "C/C++ Header",
    hpp: "C++ Header",
    cs: "C#",
    rs: "Rust",
    go: "Go",
    ts: "TypeScript",
    js: "JavaScript",
    jsx: "React JSX",
    tsx: "React TSX",
    vue: "Vue Component",
    svelte: "Svelte Component",
    rb: "Ruby",
    php: "PHP",
    swift: "Swift",
    kt: "Kotlin",
    dart: "Dart / Flutter",
    zig: "Zig",
    scala: "Scala",
    lua: "Lua",
    jl: "Julia",
    r: "R Script",
    sh: "Shell Script",
    bash: "Bash Script",
    zsh: "Zsh Script",
    fish: "Fish Script",
    ps1: "PowerShell",
    bat: "Batch Script",
    cmd: "Command Script",
    sql: "SQL Query",
    graphql: "GraphQL",
    gql: "GraphQL",
    proto: "Protocol Buffers",
    css: "CSS Stylesheet",
    scss: "SCSS Stylesheet",
    sass: "Sass Stylesheet",
    less: "Less Stylesheet",
    toml: "TOML Config",
    ini: "INI Config",
    env: "Environment File",
    conf: "Configuration",
    tf: "Terraform HCL",
    tfvars: "Terraform Vars",
    md: "Markdown",
    txt: "Plain Text",
    text: "Plain Text",
    rtf: "Rich Text",
    log: "Log File",
    json: "JSON Data",
    xml: "XML Document",
    html: "HTML Document",
    htm: "HTML Document",
    yaml: "YAML Data",
    yml: "YAML Data",
  };
  return map[e] || e.toUpperCase();
}

export function getFileCategory(ext: string): FileCategory {
  const e = ext.toLowerCase();
  if (NOTEBOOK_EXTS.has(e) || CODE_EXTS.has(e)) return "code";
  if (IMAGE_EXTS.has(e)) return "images";
  if (VIDEO_EXTS.has(e)) return "videos";
  if (DOC_EXTS.has(e)) return "documents";
  if (AUDIO_EXTS.has(e)) return "audio";
  if (ARCHIVE_EXTS.has(e)) return "archives";
  return "other";
}

