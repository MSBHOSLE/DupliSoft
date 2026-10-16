import React, { useState } from "react";
import { TextPreview } from "../types";
import { FileText, AlertCircle, WrapText, Search, Code2 } from "lucide-react";
import { getLanguageLabel, isCode } from "../utils/formatters";

interface TextViewerProps {
  data: TextPreview | null;
  loading: boolean;
  error: string | null;
  filename: string;
}

export const TextViewer: React.FC<TextViewerProps> = ({
  data,
  loading,
  error,
  filename,
}) => {
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>("");

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const isCodeFile = isCode(ext);
  const langLabel = getLanguageLabel(ext);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        {isCodeFile ? (
          <Code2 className="w-10 h-10 text-indigo-400/70 mb-3 animate-bounce" />
        ) : (
          <FileText className="w-10 h-10 text-cyan-400/60 mb-3 animate-bounce" />
        )}
        <p className="text-sm font-medium text-slate-300">Reading source stream...</p>
        <p className="text-xs text-slate-500 mt-1">Extracting lines and word metrics via pure Rust</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertCircle className="w-9 h-9 text-amber-400/80 mb-2" />
        <p className="text-sm font-medium text-slate-200">Unable to preview document</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || "No readable content found."}</p>
      </div>
    );
  }

  const filteredLines = filterQuery
    ? data.lines
        .map((line, idx) => ({ line, originalIdx: idx + 1 }))
        .filter((item) => item.line.toLowerCase().includes(filterQuery.toLowerCase()))
    : data.lines.map((line, idx) => ({ line, originalIdx: idx + 1 }));

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 text-xs overflow-hidden rounded border border-slate-800/80">
      {/* Top Controls Bar */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          {isCodeFile ? (
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
          ) : (
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
          )}
          <span className="font-semibold text-slate-200 text-xs truncate max-w-[180px]" title={filename}>
            {filename}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            isCodeFile ? "bg-indigo-500/20 text-indigo-300" : "bg-cyan-500/20 text-cyan-300"
          }`}>
            {langLabel}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            {data.total_lines.toLocaleString()} lines • {data.total_words.toLocaleString()} words
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick search filter */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Find text..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded pl-6 pr-2 py-0.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-28 transition"
            />
          </div>

          {/* Line wrap toggle */}
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={`p-1 rounded transition text-xs flex items-center space-x-1 ${
              wrapLines
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Line Wrap"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Text Lines Stream Container */}
      <div className="flex-1 overflow-auto bg-slate-950 font-mono text-[11px] scrollbar-thin">
        {filteredLines.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic">
            {filterQuery ? "No matching lines found for query" : "Empty text document"}
          </div>
        ) : (
          <div className="min-w-full">
            {filteredLines.map(({ line, originalIdx }) => (
              <div
                key={originalIdx}
                className="flex items-start hover:bg-slate-900/60 transition-colors py-0.5 leading-relaxed"
              >
                {/* Line number gutter */}
                <span className="w-12 min-w-12 text-right pr-3 select-none text-[10px] text-slate-600 font-mono border-r border-slate-850">
                  {originalIdx}
                </span>

                {/* Line text */}
                <span
                  className={`pl-3 pr-4 flex-1 text-slate-300 ${
                    wrapLines ? "break-all whitespace-pre-wrap" : "whitespace-pre overflow-x-auto"
                  }`}
                >
                  {line === "" ? "\u00A0" : line}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>
          {data.is_truncated
            ? `Showing first ${data.lines.length} lines of ${data.total_lines.toLocaleString()} total lines`
            : `${data.total_lines.toLocaleString()} total lines • ${data.total_chars.toLocaleString()} characters`}
        </span>
        <span className="font-mono text-cyan-400/80">UTF-8 Clean Stream</span>
      </div>
    </div>
  );
};
