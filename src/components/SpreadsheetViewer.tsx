import React, { useState } from "react";
import { SpreadsheetPreview } from "../types";
import { Table, Layers, FileSpreadsheet, AlertCircle } from "lucide-react";

interface SpreadsheetViewerProps {
  data: SpreadsheetPreview | null;
  loading: boolean;
  error: string | null;
  filename: string;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  data,
  loading,
  error,
  filename,
}) => {
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  if (loading) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        <FileSpreadsheet className="w-10 h-10 text-emerald-400/60 mb-3 animate-bounce" />
        <p className="text-sm font-medium text-slate-300">Parsing spreadsheet tables...</p>
        <p className="text-xs text-slate-500 mt-1">Reading sheets and cell matrix via high-speed Rust parser</p>
      </div>
    );
  }

  if (error || !data || data.sheets.length === 0) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertCircle className="w-9 h-9 text-amber-400/80 mb-2" />
        <p className="text-sm font-medium text-slate-200">Unable to preview spreadsheet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || "No readable sheet data found."}</p>
      </div>
    );
  }

  const currentSheet = data.sheets[activeSheetIdx] || data.sheets[0];
  const hasMultipleSheets = data.sheets.length > 1;

  // Generate column letter labels (A, B, C... Z, AA, AB...)
  const getColLabel = (index: number): string => {
    let label = "";
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode((i % 26) + 65) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 text-xs overflow-hidden rounded border border-slate-800/80">
      {/* Top Bar: Sheet Navigation & Metadata */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 overflow-x-auto py-0.5 max-w-[70%] scrollbar-thin">
          {hasMultipleSheets ? (
            data.sheets.map((sheet, idx) => (
              <button
                key={sheet.sheet_name + idx}
                onClick={() => setActiveSheetIdx(idx)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition whitespace-nowrap ${
                  idx === activeSheetIdx
                    ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{sheet.sheet_name}</span>
              </button>
            ))
          ) : (
            <div className="flex items-center space-x-1.5 text-xs text-slate-300 font-semibold">
              <Table className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentSheet.sheet_name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <span className="px-1.5 py-0.5 rounded bg-slate-800/80 uppercase font-mono font-bold text-[10px] text-emerald-400 border border-slate-700/60">
            {data.format}
          </span>
          <span>
            {currentSheet.total_rows.toLocaleString()} rows × {currentSheet.total_cols} cols
          </span>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto bg-slate-950 scrollbar-thin">
        <table className="w-full border-collapse text-left font-mono text-[11px]">
          {/* Header Row */}
          <thead className="sticky top-0 bg-slate-900/95 shadow-sm z-10 backdrop-blur">
            <tr className="border-b border-slate-700/80 text-slate-400">
              {/* Row index indicator */}
              <th className="w-10 min-w-10 px-2 py-1.5 text-center bg-slate-900 border-r border-slate-800 text-[10px] text-slate-500 font-semibold select-none">
                #
              </th>
              {currentSheet.headers.length > 0 ? (
                currentSheet.headers.map((col, cIdx) => (
                  <th
                    key={cIdx}
                    className="px-3 py-1.5 font-semibold text-slate-200 border-r border-slate-800/80 whitespace-nowrap max-w-[240px] truncate"
                    title={col}
                  >
                    <span className="text-[10px] text-slate-500 font-normal mr-1.5">{getColLabel(cIdx)}</span>
                    {col || <span className="italic text-slate-600 font-normal">Empty</span>}
                  </th>
                ))
              ) : (
                <th className="px-3 py-1.5 text-slate-500">No Columns</th>
              )}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {currentSheet.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, currentSheet.headers.length + 1)}
                  className="px-4 py-8 text-center text-slate-500 italic"
                >
                  Empty worksheet (no data rows)
                </td>
              </tr>
            ) : (
              currentSheet.rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={`border-b border-slate-850/60 hover:bg-slate-800/40 transition-colors ${
                    rIdx % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"
                  }`}
                >
                  {/* Row number */}
                  <td className="px-2 py-1 text-center bg-slate-900/70 border-r border-slate-800 text-[10px] text-slate-500 font-mono select-none">
                    {rIdx + 1}
                  </td>
                  {/* Cells */}
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3 py-1 border-r border-slate-850/60 text-slate-300 whitespace-nowrap max-w-[240px] truncate"
                      title={cell}
                    >
                      {cell === "" ? (
                        <span className="text-slate-700 select-none">-</span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  {/* If row has fewer cells than headers, fill empty cells */}
                  {Array.from({ length: Math.max(0, currentSheet.headers.length - row.length) }).map((_, padIdx) => (
                    <td
                      key={`pad-${padIdx}`}
                      className="px-3 py-1 border-r border-slate-850/60 text-slate-700"
                    >
                      -
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>
          Showing top {Math.min(currentSheet.rows.length, 50)} rows of {currentSheet.total_rows.toLocaleString()} total
        </span>
        <span className="truncate max-w-[220px]" title={filename}>
          {filename}
        </span>
      </div>
    </div>
  );
};
