"use client";

import { useRef, useState, useEffect } from "react";
import { X, Eraser, Check, PenTool, Trash2 } from "lucide-react";
import { useReaderStore } from "@/hooks/use-reader-store";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSignature?: (dataUrl: string) => void;
}

export function SignatureModal({ isOpen, onClose, onSelectSignature }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signatureTitle, setSignatureTitle] = useState("My Signature");
  const { savedSignatures, addSavedSignature, deleteSavedSignature } = useReaderStore();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => clearCanvas(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background guide line
    ctx.strokeStyle = "rgba(156, 163, 175, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, canvas.height - 40);
    ctx.lineTo(canvas.width - 30, canvas.height - 40);
    ctx.stroke();
    ctx.setLineDash([]);
    
    setHasDrawn(false);
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pointerType === "pen" && e.pressure ? e.pressure : 0.6,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setHasDrawn(true);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, pressure } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a"; // Crisp dark blue ink for signatures
    ctx.lineWidth = Math.max(2, pressure * 6);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, pressure } = getCoordinates(e);
    ctx.lineWidth = Math.max(2, pressure * 6);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && e.pointerId) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setIsDrawing(false);
  };

  const handleSaveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    const dataUrl = canvas.toDataURL("image/png");
    addSavedSignature(signatureTitle || "Signature", dataUrl);

    if (onSelectSignature) {
      onSelectSignature(dataUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-indigo-400" />
            <h3 className="text-lg font-bold tracking-tight text-white">E-Signature Pad</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Signature Label
            </label>
            <input
              type="text"
              value={signatureTitle}
              onChange={(e) => setSignatureTitle(e.target.value)}
              placeholder="e.g. Primary Signature"
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Draw Signature (Stylus, Touch, or Mouse)
              </span>
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear Pad
              </button>
            </div>
            
            <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                width={500}
                height={200}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="w-full h-44 touch-none cursor-crosshair"
              />
              {!hasDrawn && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium">
                  Sign here with stylus or finger...
                </div>
              )}
            </div>
          </div>

          {/* Saved Signatures list if any */}
          {savedSignatures.length > 0 && (
            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saved Signatures
              </span>
              <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {savedSignatures.map((sig) => (
                  <div
                    key={sig.id}
                    className="group relative flex flex-col items-center justify-between rounded-xl border border-slate-700 bg-slate-800 p-2 text-xs transition hover:border-indigo-500"
                  >
                    <img src={sig.dataUrl} alt={sig.title} className="h-10 object-contain filter invert dark:invert-0" />
                    <div className="mt-1 flex w-full items-center justify-between text-slate-300">
                      <span className="truncate font-medium">{sig.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectSignature) onSelectSignature(sig.dataUrl);
                          onClose();
                        }}
                        className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-500"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasDrawn}
            onClick={handleSaveSignature}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-900/30"
          >
            <Check className="h-4 w-4" /> Save & Use Signature
          </button>
        </div>
      </div>
    </div>
  );
}
