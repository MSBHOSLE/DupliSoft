import React from "react";
import { PptxPreview } from "../types";
import { Presentation, AlertCircle, Layers, Image as ImageIcon } from "lucide-react";

interface PptxViewerProps {
  data: PptxPreview | null;
  loading: boolean;
  error: string | null;
  filename: string;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({
  data,
  loading,
  error,
  filename,
}) => {
  if (loading) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-8 text-slate-400 animate-pulse">
        <Presentation className="w-10 h-10 text-orange-400/60 mb-3 animate-bounce" />
        <p className="text-sm font-medium text-slate-300">Reading presentation deck...</p>
        <p className="text-xs text-slate-500 mt-1">Extracting slide covers and outlines from PPTX container</p>
      </div>
    );
  }

  if (error || !data || data.slide_count === 0) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <AlertCircle className="w-9 h-9 text-amber-400/80 mb-2" />
        <p className="text-sm font-medium text-slate-200">Unable to preview presentation</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">{error || "No slides found in presentation."}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-200 text-xs overflow-hidden rounded border border-slate-800/80">
      {/* Top Metadata Header */}
      <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2 truncate max-w-[65%]">
          <Presentation className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <span className="font-semibold text-slate-200 text-xs truncate" title={data.title || filename}>
            {data.title || filename}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
          <span className="px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300 font-medium border border-orange-500/25">
            PPTX
          </span>
          <span className="font-mono">{data.slide_count} Slides</span>
        </div>
      </div>

      {/* Body: Slide Cover + Outline */}
      <div className="flex-1 overflow-auto p-4 space-y-4 scrollbar-thin">
        {/* Slide 1 Cover Thumbnail */}
        {data.thumbnail_base64 && (
          <div className="flex flex-col items-center bg-slate-900/70 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 mb-2 self-start">
              <ImageIcon className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-medium">Slide 1 Cover Preview</span>
            </div>
            <img
              src={data.thumbnail_base64}
              alt="Slide Cover"
              className="max-h-56 max-w-full rounded border border-slate-700/80 shadow-md object-contain select-none"
            />
          </div>
        )}

        {/* Slide-by-slide Outline */}
        <div className="space-y-2">
          <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-medium px-1">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <span>Slide Deck Outline</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {data.slides.map((slide) => (
              <div
                key={slide.slide_number}
                className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-2.5 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-orange-400 font-semibold">
                    Slide {slide.slide_number}
                  </span>
                  <span className="text-slate-200 font-semibold text-xs truncate max-w-[70%]">
                    {slide.title || "Untitled Slide"}
                  </span>
                </div>

                {slide.text_snippets.length > 0 && (
                  <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5 mt-1.5 pl-1">
                    {slide.text_snippets.map((snip, sIdx) => (
                      <li key={sIdx} className="truncate">
                        {snip}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
        <span>Total deck size: {data.slide_count} slides</span>
        <span className="truncate max-w-[200px]" title={filename}>
          {filename}
        </span>
      </div>
    </div>
  );
};
