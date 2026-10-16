import React, { useState } from "react";
import { NotebookPreview } from "../types";
import { BookOpen, AlertCircle, Search, Terminal, FileCode, CheckCircle2 } from "lucide-react";

interface NotebookViewerProps {
  data: NotebookPreview | null;
  loading: boolean;
  error: string | null;
  filename: string;
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({
  data,
  loading,
  error,
  filename,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>("");

  if (loading) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        <BookOpen className="w-10 h-10 text-amber-400/70 mb-3 animate-bounce" />
        <p className="text-sm font-medium text-slate-300">Parsing Jupyter Notebook...</p>
        <p className="text-xs text-slate-500 mt-1">Extracting code & markdown cells via Rust engine</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertCircle className="w-9 h-9 text-amber-400/80 mb-2" />
        <p className="text-sm font-medium text-slate-200">Unable to preview Jupyter Notebook</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || "No valid notebook cells found."}</p>
      </div>
    );
  }

  const filteredCells = filterQuery
    ? data.cells
        .map((cell, idx) => ({ cell, originalIndex: idx + 1 }))
        .filter((item) =>
          item.cell.source.some((line) => line.toLowerCase().includes(filterQuery.toLowerCase()))
        )
    : data.cells.map((cell, idx) => ({ cell, originalIndex: idx + 1 }));

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 text-xs overflow-hidden rounded border border-slate-800/80">
      {/* Notebook Toolbar */}
      <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold text-slate-200 text-xs truncate max-w-[200px]" title={filename}>
            {filename}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
            Jupyter Notebook
          </span>
          {data.kernel_name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {data.kernel_name}
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
            {data.code_cells_count} code • {data.markdown_cells_count} md
          </span>
        </div>

        {/* Quick search filter */}
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search notebook..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded pl-6 pr-2 py-0.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-32 transition"
          />
        </div>
      </div>

      {/* Cells Stream */}
      <div className="flex-1 overflow-auto p-3 space-y-3 bg-slate-950 font-mono text-[11px] scrollbar-thin">
        {filteredCells.length === 0 ? (
          <div className="p-8 text-center text-slate-500 italic">
            {filterQuery ? "No matching cells found for query" : "Empty notebook with no cells"}
          </div>
        ) : (
          filteredCells.map(({ cell, originalIndex }) => (
            <div
              key={originalIndex}
              className={`rounded border transition-colors ${
                cell.cell_type === "code"
                  ? "bg-slate-900/60 border-slate-800/90 hover:border-slate-700"
                  : "bg-slate-900/30 border-slate-850 hover:border-slate-800"
              }`}
            >
              {/* Cell Header Badge */}
              <div className="flex items-center justify-between px-2.5 py-1 bg-slate-900/90 border-b border-slate-800/60 text-[10px]">
                <div className="flex items-center space-x-1.5">
                  {cell.cell_type === "code" ? (
                    <>
                      <Terminal className="w-3 h-3 text-cyan-400" />
                      <span className="text-cyan-400 font-semibold">
                        In [{cell.execution_count != null ? cell.execution_count : " "}]:
                      </span>
                      <span className="text-slate-500 font-mono text-[9px]">Cell #{originalIndex}</span>
                    </>
                  ) : (
                    <>
                      <FileCode className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400 font-medium">Markdown Cell #{originalIndex}</span>
                    </>
                  )}
                </div>
                <span className="text-slate-600 font-mono text-[9px] uppercase">
                  {cell.cell_type}
                </span>
              </div>

              {/* Cell Source Code Lines */}
              <div className="p-2 overflow-x-auto">
                {cell.source.length === 0 ? (
                  <div className="text-slate-600 italic text-[10px]">Empty cell</div>
                ) : (
                  <div className="space-y-0.5">
                    {cell.source.map((line, lineIdx) => (
                      <div key={lineIdx} className="flex items-start leading-relaxed">
                        <span className="w-7 min-w-7 text-right pr-2 select-none text-[9px] text-slate-600 font-mono border-r border-slate-850">
                          {lineIdx + 1}
                        </span>
                        <span
                          className={`pl-2 flex-1 whitespace-pre-wrap break-all ${
                            cell.cell_type === "code" ? "text-emerald-300/90 font-mono" : "text-slate-300 font-sans"
                          }`}
                        >
                          {line === "" ? "\u00A0" : line}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="px-3 py-1 bg-slate-900/80 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center space-x-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Cell-by-cell structured view (heavy outputs bypassed)</span>
        </div>
        <div>
          {data.is_truncated && (
            <span className="text-amber-400 font-medium">Showing top {data.cells.length} cells • </span>
          )}
          <span>Total {data.total_cells} cells</span>
        </div>
      </div>
    </div>
  );
};
