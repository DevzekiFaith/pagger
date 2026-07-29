"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MessageSquare, X, Trash2, Send, Move, RotateCcw } from "lucide-react";
import { useReaderStore } from "@/hooks/use-reader-store";
import type { DrawingStroke, Point, StampPreset, StudyColor } from "@/lib/types";

export function AnnotationCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [dimensions, setDimensions] = useState({ width: 1000, height: 1000 });
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [activeStickyInput, setActiveStickyInput] = useState<{ x: number; y: number } | null>(null);
  const [stickyNoteText, setStickyNoteText] = useState("");
  const [selectedStickyColor, setSelectedStickyColor] = useState<StudyColor>("yellow");
  const [openedStickyId, setOpenedStickyId] = useState<string | null>(null);

  // Selection & Resize state for Stamps and Signatures
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    stampId: string;
    action: "move" | "resize";
    handle?: "tl" | "tr" | "bl" | "br" | "n" | "s" | "e" | "w";
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
  } | null>(null);

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
    updateStickyNote,
    deleteStickyNote,
    addStampAnnotation,
    updateStampAnnotation,
    deleteStampAnnotation,
  } = useReaderStore();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(300, Math.round(rect.width));
      const h = Math.max(300, Math.round(rect.height));
      setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const activeStrokes = useMemo(
    () => drawingStrokes.filter((s) => s.documentId === activeDocumentId),
    [drawingStrokes, activeDocumentId]
  );
  const activeSticky = useMemo(
    () => stickyNotes.filter((s) => s.documentId === activeDocumentId),
    [stickyNotes, activeDocumentId]
  );
  const activeStamps = useMemo(
    () => stampAnnotations.filter((s) => s.documentId === activeDocumentId),
    [stampAnnotations, activeDocumentId]
  );

  const hexToRgba = (hex: string, alpha: number) => {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((char) => char + char).join("");
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  };

  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const drawPresetStamp = (ctx: CanvasRenderingContext2D, stamp: (typeof activeStamps)[0]) => {
    const { x, y, width: w, height: h, presetLabel: preset } = stamp;
    if (!preset) return;

    ctx.save();
    ctx.translate(x, y);

    const color = preset === "APPROVED" ? "#10b981" : preset === "CONFIDENTIAL" ? "#ef4444" : "#f59e0b";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, w / 35);
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8);

    const fontSize = Math.max(10, Math.round(h * 0.35));
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(preset, 0, 0);

    ctx.restore();
  };

  const drawSignatureStamp = (ctx: CanvasRenderingContext2D, stamp: (typeof activeStamps)[0]) => {
    const { x, y, width: w, height: h, signatureDataUrl: dataUrl } = stamp;
    if (!dataUrl) return;

    let img = imageCacheRef.current.get(dataUrl);
    if (!img) {
      img = new Image();
      img.src = dataUrl;
      imageCacheRef.current.set(dataUrl, img);
      img.onload = () => redrawCanvas();
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
      ctx.restore();
    }
  };

  const drawSingleStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = stroke.tool === "highlighter" ? "square" : "round";
    ctx.lineJoin = "round";

    if (stroke.tool === "highlighter") {
      ctx.strokeStyle = hexToRgba(stroke.color, 0.5);
      ctx.lineWidth = Math.max(12, stroke.width * 3.5);
      ctx.globalCompositeOperation = "source-over";
    } else if (stroke.tool === "eraser") {
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = stroke.width * 5;
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.globalCompositeOperation = "source-over";
    }

    const points = stroke.points;

    if (stroke.tool === "pen" || stroke.tool === "highlighter" || stroke.tool === "eraser") {
      if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, 2 * Math.PI);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          
          if (stroke.tool === "pen" && p2.pressure && p2.pressure > 0) {
            ctx.lineWidth = Math.max(1, stroke.width * (p2.pressure * 2.2));
          }

          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        ctx.stroke();
      }
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
      ctx.ellipse(centerX, centerY, Math.max(2, radiusX), Math.max(2, radiusY), 0, 0, 2 * Math.PI);
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
      
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

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

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

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
      if (stamp.type === "preset") {
        drawPresetStamp(ctx, stamp);
      } else if (stamp.type === "signature") {
        drawSignatureStamp(ctx, stamp);
      }
    });

    ctx.restore();
  }, [activeStrokes, isPointerDown, currentPoints, activeToolMode, activePenColor, activePenWidth, activeStamps, activeDocumentId, dimensions]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCoordinates = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: (e as React.PointerEvent<HTMLCanvasElement>).pointerType === "pen" && (e as React.PointerEvent<HTMLCanvasElement>).pressure ? (e as React.PointerEvent<HTMLCanvasElement>).pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCoordinates(e);

    if (activeToolMode === "select") {
      // Check if user clicked on an existing stamp to select/move/resize it
      const clickedStamp = [...activeStamps].reverse().find((s) => {
        const left = s.x - s.width / 2;
        const right = s.x + s.width / 2;
        const top = s.y - s.height / 2;
        const bottom = s.y + s.height / 2;
        return pt.x >= left && pt.x <= right && pt.y >= top && pt.y <= bottom;
      });

      if (clickedStamp) {
        setSelectedStampId(clickedStamp.id);
        setDragState({
          stampId: clickedStamp.id,
          action: "move",
          startX: pt.x,
          startY: pt.y,
          initialX: clickedStamp.x,
          initialY: clickedStamp.y,
          initialW: clickedStamp.width,
          initialH: clickedStamp.height,
        });
        return;
      }

      setSelectedStampId(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    if (activeToolMode === "sticky") {
      setActiveStickyInput({ x: pt.x, y: pt.y });
      return;
    }

    if (activeToolMode === "stamp") {
      if (activeSignatureId) {
        const sig = savedSignatures.find((s) => s.id === activeSignatureId);
        if (sig) {
          addStampAnnotation(pt.x, pt.y, 160, 70, "signature", undefined, sig.dataUrl);
        }
      } else {
        addStampAnnotation(pt.x, pt.y, 160, 52, "preset", activeStampPreset);
      }
      return;
    }

    setIsPointerDown(true);
    setCurrentPoints([pt]);
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (dragState) {
      const pt = getCoordinates(e);
      const dx = pt.x - dragState.startX;
      const dy = pt.y - dragState.startY;

      if (dragState.action === "move") {
        updateStampAnnotation(dragState.stampId, {
          x: Math.round(dragState.initialX + dx),
          y: Math.round(dragState.initialY + dy),
        });
      } else if (dragState.action === "resize" && dragState.handle) {
        let newW = dragState.initialW;
        let newH = dragState.initialH;
        let newX = dragState.initialX;
        let newY = dragState.initialY;

        if (dragState.handle.includes("e")) newW = Math.max(40, dragState.initialW + dx);
        if (dragState.handle.includes("w")) {
          const w = Math.max(40, dragState.initialW - dx);
          newX = dragState.initialX + (dragState.initialW - w) / 2;
          newW = w;
        }
        if (dragState.handle.includes("s")) newH = Math.max(25, dragState.initialH + dy);
        if (dragState.handle.includes("n")) {
          const h = Math.max(25, dragState.initialH - dy);
          newY = dragState.initialY + (dragState.initialH - h) / 2;
          newH = h;
        }

        updateStampAnnotation(dragState.stampId, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(newW),
          height: Math.round(newH),
        });
      }
      return;
    }

    if (!isPointerDown) return;
    const pt = getCoordinates(e);
    setCurrentPoints((prev) => [...prev, pt]);
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      setDragState(null);
      return;
    }

    if (!isPointerDown) return;
    const canvas = canvasRef.current;
    if (canvas && (e as React.PointerEvent<HTMLCanvasElement>).pointerId) {
      try {
        canvas.releasePointerCapture((e as React.PointerEvent<HTMLCanvasElement>).pointerId);
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

  const selectedStamp = useMemo(
    () => activeStamps.find((s) => s.id === selectedStampId),
    [activeStamps, selectedStampId]
  );

  return (
    <div
      ref={containerRef}
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
      className="absolute inset-0 z-20 pointer-events-none w-full h-full"
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%" }}
        onPointerDown={handlePointerDown}
        className={`absolute inset-0 w-full h-full touch-none ${
          activeToolMode === "select" ? "pointer-events-auto cursor-default" : "cursor-crosshair pointer-events-auto z-20"
        }`}
      />

      {/* Interactive Selection Bounding Box & 8 Stretch Handles */}
      {selectedStamp && (
        <div
          style={{
            left: `${selectedStamp.x}px`,
            top: `${selectedStamp.y}px`,
            width: `${selectedStamp.width}px`,
            height: `${selectedStamp.height}px`,
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 z-40 border-2 border-indigo-500 border-dashed rounded-lg pointer-events-auto group bg-indigo-500/10 cursor-move"
          onPointerDown={(e) => {
            e.stopPropagation();
            const pt = getCoordinates(e);
            setDragState({
              stampId: selectedStamp.id,
              action: "move",
              startX: pt.x,
              startY: pt.y,
              initialX: selectedStamp.x,
              initialY: selectedStamp.y,
              initialW: selectedStamp.width,
              initialH: selectedStamp.height,
            });
          }}
        >
          {/* Delete Button Header */}
          <div className="absolute -top-9 right-0 flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg text-xs text-white shadow-lg">
            <span className="text-[10px] font-bold text-indigo-400 uppercase">Selected</span>
            <button
              type="button"
              onClick={() => {
                deleteStampAnnotation(selectedStamp.id);
                setSelectedStampId(null);
              }}
              className="text-rose-400 hover:text-rose-300 ml-1"
              title="Delete Object"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 8 Stretch & Scale Handles (Corners + Sides) */}
          {[
            { handle: "tl", pos: "-left-2 -top-2 cursor-nwse-resize" },
            { handle: "tr", pos: "-right-2 -top-2 cursor-nesw-resize" },
            { handle: "bl", pos: "-left-2 -bottom-2 cursor-nesw-resize" },
            { handle: "br", pos: "-right-2 -bottom-2 cursor-nwse-resize" },
            { handle: "n", pos: "left-1/2 -top-2 -translate-x-1/2 cursor-ns-resize" },
            { handle: "s", pos: "left-1/2 -bottom-2 -translate-x-1/2 cursor-ns-resize" },
            { handle: "w", pos: "-left-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
            { handle: "e", pos: "-right-2 top-1/2 -translate-y-1/2 cursor-ew-resize" },
          ].map(({ handle, pos }) => (
            <div
              key={handle}
              onPointerDown={(e) => {
                e.stopPropagation();
                const pt = getCoordinates(e);
                setDragState({
                  stampId: selectedStamp.id,
                  action: "resize",
                  handle: handle as any,
                  startX: pt.x,
                  startY: pt.y,
                  initialX: selectedStamp.x,
                  initialY: selectedStamp.y,
                  initialW: selectedStamp.width,
                  initialH: selectedStamp.height,
                });
              }}
              className={`absolute h-3.5 w-3.5 rounded-full border-2 border-indigo-600 bg-white shadow-md transition hover:scale-125 ${pos}`}
            />
          ))}
        </div>
      )}

      {/* Render Sticky Note Pins Overlay */}
      <div className="absolute inset-0 z-30 pointer-events-none w-full h-full overflow-hidden">
        {activeSticky.map((pin) => (
          <div
            key={pin.id}
            style={{ left: `${pin.x}px`, top: `${pin.y}px` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          >
            <button
              type="button"
              onClick={() => setOpenedStickyId(openedStickyId === pin.id ? null : pin.id)}
              className="group flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg ring-2 ring-amber-300 transition hover:scale-110"
            >
              <MessageSquare className="h-4 w-4 fill-slate-950" />
            </button>

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

        {activeStickyInput && (
          <div
            style={{
              left: `${activeStickyInput.x}px`,
              top: `${activeStickyInput.y}px`,
            }}
            className="absolute z-50 -translate-x-1/2 -translate-y-1/2 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl backdrop-blur-md pointer-events-auto"
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
