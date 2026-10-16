import React from "react";
import { DocxPreview } from "../types";
import { FileText, AlertCircle, User, BookOpen } from "lucide-react";

interface DocxViewerProps {
  data: DocxPreview | null;
  loading: boolean;
  error: string | null;
  filename: string;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({
  data,
  loading,
  error,
  filename,
}) => {
  if (loading) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        <FileText className="w-10 h-10 text-blue-400/60 mb-3 animate-bounce" />
        <p className="text-sm font-medium text-slate-300">Decompressing Word document...</p>
        <p className="text-xs text-slate-500 mt-1">Extracting document paragraphs and styles via XML engine</p>
      </div>
    );
  }

  if (error || !data || data.paragraphs.length === 0) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertCircle className="w-9 h-9 text-amber-400/80 mb-2" />
        <p className="text-sm font-medium text-slate-200">Unable to preview Word document</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || "No readable document text found."}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 text-xs overflow-hidden rounded border border-slate-800/80">
      {/* Top Metadata Header */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 truncate max-w-[65%]">
          <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-200 text-xs truncate" title={data.title || filename}>
            {data.title || filename}
          </span>
          {data.author && (
            <span className="flex items-center space-x-1 text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded truncate">
              <User className="w-3 h-3 text-slate-500" />
              <span>{data.author}</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
          <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-medium border border-blue-500/25">
            DOCX
          </span>
          <span className="font-mono">
            {data.total_paragraphs.toLocaleString()} paras • {data.total_words.toLocaleString()} words
          </span>
        </div>
      </div>

      {/* Document Body Reader */}
      <div className="flex-1 overflow-auto bg-slate-900/40 p-6 scrollbar-thin">
        <div className="max-w-2xl mx-auto bg-slate-950 p-6 rounded-lg border border-slate-800/60 shadow-lg space-y-3.5">
          {data.title && (
            <h1 className="text-lg font-bold text-white border-b border-slate-800 pb-2 mb-3">
              {data.title}
            </h1>
          )}

          {data.paragraphs.map((p, idx) => {
            if (p.is_heading) {
              if (p.heading_level === 1) {
                return (
                  <h2 key={idx} className="text-base font-bold text-blue-300 mt-4 mb-1">
                    {p.text}
                  </h2>
                );
              } else if (p.heading_level === 2) {
                return (
                  <h3 key={idx} className="text-sm font-semibold text-blue-200 mt-3 mb-1">
                    {p.text}
                  </h3>
                );
              } else {
                return (
                  <h4 key={idx} className="text-xs font-semibold text-slate-300 mt-2 mb-0.5">
                    {p.text}
                  </h4>
                );
              }
            }

            return (
              <p key={idx} className="text-slate-300 text-xs leading-relaxed text-justify">
                {p.text}
              </p>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>
          {data.is_truncated
            ? `Showing first ${data.paragraphs.length} paragraphs of ${data.total_paragraphs.toLocaleString()} total`
            : `${data.total_paragraphs.toLocaleString()} paragraphs rendered`}
        </span>
        <span className="truncate max-w-[200px]" title={filename}>
          {filename}
        </span>
      </div>
    </div>
  );
};
