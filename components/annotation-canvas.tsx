"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, X, Trash2, Send } from "lucide-react";
import { useReaderStore } from "@/hooks/use-reader-store";
import type { DrawingStroke, Point, StampPreset, StudyColor } from "@/lib/types";

interface AnnotationCanvasProps {
  width: number;
  height: number;
}

export function AnnotationCanvas({ width, height }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [activeStickyInput, setActiveStickyInput] = useState<{ x: number; y: number } | null>(null);
  const [stickyNoteText, setStickyNoteText] = useState("");
  const [selectedStickyColor, setSelectedStickyColor] = useState<StudyColor>("yellow");
  const [openedStickyId, setOpenedStickyId] = useState<string | null>(null);

  const {
    activeDocumentId,
    activeToolMode,
    activePenColor,
    activePenWidth,
    activeStampPreset,
    activeSignatureId,
    drawingStrokes,
    stickyNotes,
    stampAnnotations,
    savedSignatures,
    addDrawingStroke,
    addStickyNote,
    deleteStickyNote,
    addStampAnnotation,
    deleteStampAnnotation,
  } = useReaderStore();

  const activeStrokes = drawingStrokes.filter((s) => s.documentId === activeDocumentId);
  const activeSticky = stickyNotes.filter((s) => s.documentId === activeDocumentId);
  const activeStamps = stampAnnotations.filter((s) => s.documentId === activeDocumentId);

  // Helper to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((char) => char + char).join("");
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  };

  // Main Canvas Rendering Engine
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw saved strokes
    activeStrokes.forEach((stroke) => {
      drawSingleStroke(ctx, stroke);
    });

    // 2. Draw live preview stroke
    if (isPointerDown && currentPoints.length > 0 && activeToolMode !== "select" && activeToolMode !== "sticky" && activeToolMode !== "stamp") {
      const tempStroke: DrawingStroke = {
        id: "temp",
        documentId: activeDocumentId || "",
        tool: activeToolMode as DrawingStroke["tool"],
        points: currentPoints,
        color: activePenColor,
        width: activePenWidth,
        createdAt: new Date().toISOString(),
      };
      drawSingleStroke(ctx, tempStroke);
    }

    // 3. Draw Stamps & Signatures
    activeStamps.forEach((stamp) => {
      ctx.save();
      if (stamp.type === "preset" && stamp.presetLabel) {
        drawPresetStamp(ctx, stamp.x, stamp.y, stamp.presetLabel);
      } else if (stamp.type === "signature" && stamp.signatureDataUrl) {
        drawSignatureStamp(ctx, stamp.x, stamp.y, stamp.signatureDataUrl);
      }
      ctx.restore();
    });
  }, [activeStrokes, isPointerDown, currentPoints, activeToolMode, activePenColor, activePenWidth, activeStamps, activeDocumentId]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const drawSingleStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "highlighter") {
      ctx.strokeStyle = hexToRgba(stroke.color, 0.4);
      ctx.lineWidth = stroke.width * 4;
      ctx.globalCompositeOperation = "source-over"; // Works smoothly over text canvas
    } else if (stroke.tool === "eraser") {
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = stroke.width * 6;
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalCompositeOperation = "source-over";
    }

    const points = stroke.points;

    if (stroke.tool === "pen" || stroke.tool === "highlighter" || stroke.tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        
        // Stylus pressure variable width support
        if (stroke.tool === "pen" && p2.pressure && p2.pressure > 0) {
          ctx.lineWidth = Math.max(1, stroke.width * (p2.pressure * 2.2));
        }

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.stroke();
    } else if (stroke.tool === "rectangle") {
      const start = points[0];
      const end = points[points.length - 1];
      const w = end.x - start.x;
      const h = end.y - start.y;
      ctx.beginPath();
      ctx.rect(start.x, start.y, w, h);
      ctx.stroke();
    } else if (stroke.tool === "circle") {
      const start = points[0];
      const end = points[points.length - 1];
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      const centerX = Math.min(start.x, end.x) + radiusX;
      const centerY = Math.min(start.y, end.y) + radiusY;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (stroke.tool === "line") {
      const start = points[0];
      const end = points[points.length - 1];
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (stroke.tool === "arrow") {
      const start = points[0];
      const end = points[points.length - 1];
      
      // Draw main line
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw arrowhead
      const headLength = Math.max(12, stroke.width * 3);
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = stroke.color;
      ctx.fill();
    }

    ctx.restore();
  };

  const drawPresetStamp = (ctx: CanvasRenderingContext2D, x: number, y: number, preset: StampPreset) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.08); // Slight stylish tilt like real rubber stamp

    const w = 150;
    const h = 48;

    // Stamp Border
    ctx.strokeStyle = preset === "APPROVED" ? "#10b981" : preset === "CONFIDENTIAL" ? "#ef4444" : "#f59e0b";
    ctx.lineWidth = 4;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Inner dashed border
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);

    // Stamp Text
    ctx.font = "900 16px sans-serif";
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(preset, 0, 0);

    ctx.restore();
  };

  const drawSignatureStamp = (ctx: CanvasRenderingContext2D, x: number, y: number, dataUrl: string) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      ctx.drawImage(img, x - 75, y - 30, 150, 60);
    };
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pointerType === "pen" && e.pressure ? e.pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeToolMode === "select") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const pt = getCoordinates(e);

    if (activeToolMode === "sticky") {
      setActiveStickyInput({ x: pt.x, y: pt.y });
      return;
    }

    if (activeToolMode === "stamp") {
      if (activeSignatureId) {
        const sig = savedSignatures.find((s) => s.id === activeSignatureId);
        if (sig) {
          addStampAnnotation(pt.x, pt.y, 150, 60, "signature", undefined, sig.dataUrl);
        }
      } else {
        addStampAnnotation(pt.x, pt.y, 150, 48, "preset", activeStampPreset);
      }
      return;
    }

    setIsPointerDown(true);
    setCurrentPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDown) return;
    const pt = getCoordinates(e);
    setCurrentPoints((prev) => [...prev, pt]);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPointerDown) return;
    const canvas = canvasRef.current;
    if (canvas && e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }

    setIsPointerDown(false);

    if (currentPoints.length > 0 && activeToolMode !== "select" && activeToolMode !== "sticky" && activeToolMode !== "stamp") {
      addDrawingStroke({
        tool: activeToolMode as DrawingStroke["tool"],
        points: currentPoints,
        color: activePenColor,
        width: activePenWidth,
      });
    }

    setCurrentPoints([]);
  };

  const handleSaveSticky = () => {
    if (!activeStickyInput || !stickyNoteText.trim()) return;
    addStickyNote(activeStickyInput.x, activeStickyInput.y, stickyNoteText.trim(), selectedStickyColor);
    setActiveStickyInput(null);
    setStickyNoteText("");
  };

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`absolute inset-0 z-20 touch-none ${
          activeToolMode === "select" ? "pointer-events-none" : "cursor-crosshair pointer-events-auto"
        }`}
      />

      {/* Render Sticky Note Pins Overlay */}
      <div className="pointer-events-auto absolute inset-0 z-30 overflow-hidden">
        {activeSticky.map((pin) => (
          <div
            key={pin.id}
            style={{ left: `${(pin.x / width) * 100}%`, top: `${(pin.y / height) * 100}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          >
            {/* Sticky Pin Icon */}
            <button
              type="button"
              onClick={() => setOpenedStickyId(openedStickyId === pin.id ? null : pin.id)}
              className="group flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg ring-2 ring-amber-300 transition hover:scale-110"
            >
              <MessageSquare className="h-4 w-4 fill-slate-950" />
            </button>

            {/* Expanded Sticky Card */}
            {openedStickyId === pin.id && (
              <div className="absolute left-6 top-6 z-40 w-64 rounded-xl border border-amber-300 bg-amber-100 p-3 text-slate-900 shadow-2xl animate-in fade-in zoom-in-95 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                <div className="mb-2 flex items-center justify-between border-b border-amber-200/60 pb-1.5 dark:border-amber-800">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Sticky Note
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => deleteStickyNote(pin.id)}
                      className="rounded p-1 text-rose-600 hover:bg-rose-200/50 dark:text-rose-400 dark:hover:bg-rose-900/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenedStickyId(null)}
                      className="rounded p-1 text-slate-600 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{pin.content}</p>
                <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-400 text-right">
                  {new Date(pin.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* New Sticky Note Input Popup */}
        {activeStickyInput && (
          <div
            style={{
              left: `${(activeStickyInput.x / width) * 100}%`,
              top: `${(activeStickyInput.y / height) * 100}%`,
            }}
            className="absolute z-50 -translate-x-1/2 -translate-y-1/2 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl backdrop-blur-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-white">Add Sticky Comment</span>
              <button
                type="button"
                onClick={() => setActiveStickyInput(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={3}
              value={stickyNoteText}
              onChange={(e) => setStickyNoteText(e.target.value)}
              placeholder="Type comment or feedback..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden"
              autoFocus
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {(["yellow", "green", "blue", "pink"] as StudyColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedStickyColor(c)}
                    className={`h-4 w-4 rounded-full border border-slate-700 ${
                      c === "yellow"
                        ? "bg-amber-400"
                        : c === "green"
                        ? "bg-emerald-400"
                        : c === "blue"
                        ? "bg-sky-400"
                        : "bg-rose-400"
                    } ${selectedStickyColor === c ? "ring-2 ring-white" : ""}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveSticky}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Send className="h-3 w-3" /> Post Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
