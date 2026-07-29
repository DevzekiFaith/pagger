"use client";

import { useState, useEffect } from "react";
import {
  MousePointer,
  Pen,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveRight,
  MessageSquarePlus,
  Stamp as StampIcon,
  RotateCcw,
  Trash2,
  PenTool,
  CheckCircle2,
  ChevronDown,
  Save,
  Check,
} from "lucide-react";
import { useReaderStore } from "@/hooks/use-reader-store";
import type { StampPreset } from "@/lib/types";

const COLOR_PRESETS = [
  "#ef4444", // Red
  "#f59e0b", // Amber / Yellow
  "#10b981", // Emerald / Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#0f172a", // Dark Blue
];

const STAMP_PRESETS: StampPreset[] = ["APPROVED", "CONFIDENTIAL", "DRAFT", "REVIEWED", "URGENT"];

interface AnnotationToolbarProps {
  onOpenSignatureModal: () => void;
}

export function AnnotationToolbar({ onOpenSignatureModal }: AnnotationToolbarProps) {
  const {
    activeToolMode,
    activePenColor,
    activePenWidth,
    activeStampPreset,
    savedSignatures,
    setToolMode,
    setPenColor,
    setPenWidth,
    setStampPreset,
    setActiveSignatureId,
    undoDrawingStroke,
    clearDrawingStrokes,
    saveDocumentNow,
  } = useReaderStore();

  const [isShapesOpen, setIsShapesOpen] = useState(false);
  const [isStampsOpen, setIsStampsOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const handleManualSave = () => {
    saveDocumentNow();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  // Global Keyboard Shortcuts (P = Pen, H = Highlighter, E = Eraser, Esc = Select, N = Sticky, Ctrl+S = Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleManualSave();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoDrawingStroke();
        return;
      }

      switch (e.key.toLowerCase()) {
        case "p":
          e.preventDefault();
          selectPen();
          break;
        case "h":
          e.preventDefault();
          selectHighlighter();
          break;
        case "e":
          e.preventDefault();
          setToolMode("eraser");
          break;
        case "n":
          e.preventDefault();
          setToolMode("sticky");
          break;
        case "escape":
          e.preventDefault();
          setToolMode("select");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setToolMode, undoDrawingStroke]);

  const selectPen = () => {
    setToolMode("pen");
    if (activePenWidth > 10) {
      setPenWidth(3);
    }
  };

  const selectHighlighter = () => {
    setToolMode("highlighter");
    if (activePenColor === "#0f172a" || activePenColor === "#ef4444") {
      setPenColor("#f59e0b");
    }
    if (activePenWidth < 8) {
      setPenWidth(16);
    }
  };

  const currentShapeTool = ["rectangle", "circle", "line", "arrow"].includes(activeToolMode)
    ? activeToolMode
    : "rectangle";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/90 p-2 shadow-2xl backdrop-blur-md text-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Main Tool Switches */}
      <div className="flex items-center gap-1">
        {/* Select / Read mode */}
        <button
          type="button"
          onClick={() => setToolMode("select")}
          title="Select / Resize & Move Objects (Esc)"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            activeToolMode === "select"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <MousePointer className="h-4 w-4" />
          <span className="hidden sm:inline">Select</span>
        </button>

        {/* Freehand Stylus Pen */}
        <button
          type="button"
          onClick={selectPen}
          title="Freehand Stylus Pen (P)"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            activeToolMode === "pen"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Pen className="h-4 w-4" />
          <span className="hidden sm:inline">Pen</span>
        </button>

        {/* Highlighter Pen */}
        <button
          type="button"
          onClick={selectHighlighter}
          title="Text Highlighter (H)"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            activeToolMode === "highlighter"
              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-900/40 font-bold"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Highlighter className="h-4 w-4" />
          <span className="hidden sm:inline">Highlight</span>
        </button>

        {/* Eraser */}
        <button
          type="button"
          onClick={() => setToolMode("eraser")}
          title="Eraser (E)"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            activeToolMode === "eraser"
              ? "bg-rose-600 text-white shadow-md shadow-rose-900/40"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <Eraser className="h-4 w-4" />
          <span className="hidden sm:inline">Eraser</span>
        </button>

        {/* Shapes Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsShapesOpen(!isShapesOpen)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              ["rectangle", "circle", "line", "arrow"].includes(activeToolMode)
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {currentShapeTool === "rectangle" && <Square className="h-4 w-4" />}
            {currentShapeTool === "circle" && <Circle className="h-4 w-4" />}
            {currentShapeTool === "line" && <Minus className="h-4 w-4" />}
            {currentShapeTool === "arrow" && <MoveRight className="h-4 w-4" />}
            <span className="hidden sm:inline capitalize">{currentShapeTool}</span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>

          {isShapesOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 flex w-36 flex-col rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setToolMode("rectangle");
                  setIsShapesOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Square className="h-4 w-4 text-indigo-400" /> Rectangle
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolMode("circle");
                  setIsShapesOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Circle className="h-4 w-4 text-indigo-400" /> Circle
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolMode("line");
                  setIsShapesOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <Minus className="h-4 w-4 text-indigo-400" /> Line
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolMode("arrow");
                  setIsShapesOpen(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <MoveRight className="h-4 w-4 text-indigo-400" /> Arrow
              </button>
            </div>
          )}
        </div>

        {/* Sticky Note Pin */}
        <button
          type="button"
          onClick={() => setToolMode("sticky")}
          title="Drop Sticky Note Pin (N)"
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
            activeToolMode === "sticky"
              ? "bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-900/40"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          }`}
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Sticky Pin</span>
        </button>

        {/* Stamp & E-Signature Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsStampsOpen(!isStampsOpen)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
              activeToolMode === "stamp"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <StampIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Stamp / Sign</span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>

          {isStampsOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 flex w-52 flex-col rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl space-y-1">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Preset Stamps
              </span>
              {STAMP_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setActiveSignatureId(null);
                    setStampPreset(preset);
                    setIsStampsOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    activeToolMode === "stamp" && activeStampPreset === preset
                      ? "bg-indigo-600 text-white"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <span>{preset}</span>
                  {activeToolMode === "stamp" && activeStampPreset === preset && (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                </button>
              ))}

              <div className="my-1 border-t border-slate-800" />
              
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                E-Signatures
              </span>
              {savedSignatures.map((sig) => (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() => {
                    setActiveSignatureId(sig.id);
                    setIsStampsOpen(false);
                  }}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  <span className="truncate">{sig.title}</span>
                  <PenTool className="h-3 w-3 text-indigo-400" />
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setIsStampsOpen(false);
                  onOpenSignatureModal();
                }}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500/50 bg-indigo-950/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60"
              >
                <PenTool className="h-3.5 w-3.5" /> + New E-Signature
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Color Palette & Stroke Controls */}
      {activeToolMode !== "select" && activeToolMode !== "eraser" && activeToolMode !== "sticky" && (
        <div className="flex items-center gap-3">
          {/* Color Presets */}
          <div className="flex items-center gap-1">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setPenColor(color)}
                style={{ backgroundColor: color }}
                className={`h-5 w-5 rounded-full border border-slate-700 transition hover:scale-110 ${
                  activePenColor === color ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110" : ""
                }`}
              />
            ))}
          </div>

          {/* Stroke Width Slider */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[10px] uppercase font-bold">Size</span>
            <input
              type="range"
              min="1"
              max="32"
              value={activePenWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="h-1.5 w-16 cursor-pointer rounded-lg bg-slate-700 accent-indigo-500"
            />
            <span className="w-4 text-right text-[11px] font-mono text-slate-200">{activePenWidth}</span>
          </div>
        </div>
      )}

      {/* Canvas Utilities: Save, Undo & Clear */}
      <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
        <button
          type="button"
          onClick={handleManualSave}
          title="Save Document & Annotations (Ctrl+S)"
          className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
            justSaved
              ? "bg-emerald-500 text-slate-950 font-bold"
              : "bg-indigo-600/80 text-white hover:bg-indigo-600"
          }`}
        >
          {justSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{justSaved ? "Saved!" : "Save"}</span>
        </button>

        <button
          type="button"
          onClick={undoDrawingStroke}
          title="Undo Last Stroke (Ctrl+Z)"
          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={clearDrawingStrokes}
          title="Clear All Canvas Drawings"
          className="rounded-xl p-1.5 text-rose-400 hover:bg-rose-950 hover:text-rose-200 transition"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
