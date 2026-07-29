"use client";

import { create } from "zustand";
import { loadFromSupabase, readLocalState, saveToSupabase, writeLocalState } from "@/lib/storage";
import type {
  Bookmark,
  DocumentItem,
  DrawingStroke,
  Highlight,
  Note,
  SavedSignature,
  StampAnnotation,
  StampPreset,
  StickyNotePin,
  StudyColor,
  ToolMode,
} from "@/lib/types";

type ReaderState = {
  documents: DocumentItem[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  notes: Note[];
  drawingStrokes: DrawingStroke[];
  stickyNotes: StickyNotePin[];
  stampAnnotations: StampAnnotation[];
  savedSignatures: SavedSignature[];

  // Active Tool & Styling state
  activeToolMode: ToolMode;
  activePenColor: string;
  activePenWidth: number;
  activeStampPreset: StampPreset;
  activeSignatureId: string | null;

  theme: "dark" | "light";
  activeDocumentId: string | null;
  zoom: number;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setTheme: (theme: "dark" | "light") => void;
  setActiveDocument: (id: string) => void;
  setZoom: (zoom: number) => void;
  setToolMode: (mode: ToolMode) => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;
  setStampPreset: (preset: StampPreset) => void;
  setActiveSignatureId: (id: string | null) => void;

  addDocument: (title: string, content: string, mimeType?: string, fileDataUrl?: string) => void;
  addBookmark: (label: string, color: StudyColor) => void;
  addHighlight: (selectedText: string, color: StudyColor, note?: string) => void;
  addNote: (content: string) => void;

  // Annotations actions
  addDrawingStroke: (stroke: Omit<DrawingStroke, "id" | "documentId" | "createdAt">) => void;
  undoDrawingStroke: () => void;
  clearDrawingStrokes: () => void;

  addStickyNote: (x: number, y: number, content: string, color?: StudyColor) => void;
  deleteStickyNote: (id: string) => void;

  addStampAnnotation: (x: number, y: number, width: number, height: number, type: "preset" | "signature", presetLabel?: StampPreset, signatureDataUrl?: string) => void;
  deleteStampAnnotation: (id: string) => void;

  addSavedSignature: (title: string, dataUrl: string) => void;
  deleteSavedSignature: (id: string) => void;
};

const isoNow = () => new Date().toISOString();

export const useReaderStore = create<ReaderState>((set, get) => ({
  documents: [],
  bookmarks: [],
  highlights: [],
  notes: [],
  drawingStrokes: [],
  stickyNotes: [],
  stampAnnotations: [],
  savedSignatures: [],

  activeToolMode: "select",
  activePenColor: "#ef4444", // vibrant red default
  activePenWidth: 3,
  activeStampPreset: "APPROVED",
  activeSignatureId: null,

  theme: "dark",
  activeDocumentId: null,
  zoom: 100,
  hydrated: false,

  hydrate: async () => {
    const local = readLocalState();
    const cloud = await loadFromSupabase();
    const merged = cloud ?? local;

    let savedTheme: "dark" | "light" = "dark";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("pagger-theme");
      if (stored === "light") savedTheme = "light";
    }

    set({
      documents: merged.documents,
      bookmarks: merged.bookmarks,
      highlights: merged.highlights,
      notes: merged.notes,
      drawingStrokes: merged.drawingStrokes ?? [],
      stickyNotes: merged.stickyNotes ?? [],
      stampAnnotations: merged.stampAnnotations ?? [],
      savedSignatures: merged.savedSignatures ?? [],
      theme: savedTheme,
      activeDocumentId: merged.documents[0]?.id ?? null,
      hydrated: true,
    });
  },

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pagger-theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    set({ theme });
  },

  setActiveDocument: (id) => set({ activeDocumentId: id }),
  setZoom: (zoom) => set({ zoom }),
  setToolMode: (activeToolMode) => set({ activeToolMode }),
  setPenColor: (activePenColor) => set({ activePenColor }),
  setPenWidth: (activePenWidth) => set({ activePenWidth }),
  setStampPreset: (activeStampPreset) => set({ activeStampPreset, activeToolMode: "stamp" }),
  setActiveSignatureId: (activeSignatureId) => set({ activeSignatureId, activeToolMode: "stamp" }),

  addDocument: (title, content, mimeType, fileDataUrl) => {
    const document: DocumentItem = {
      id: crypto.randomUUID(),
      title,
      content,
      mimeType,
      fileDataUrl,
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };

    const state = get();
    const nextDocuments = [document, ...state.documents];

    const payload = {
      documents: nextDocuments,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);

    set({
      documents: nextDocuments,
      activeDocumentId: document.id,
    });
  },

  addBookmark: (label, color) => {
    const state = get();
    if (!state.activeDocumentId) return;

    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      documentId: state.activeDocumentId,
      label,
      color,
      createdAt: isoNow(),
    };

    const payload = {
      documents: state.documents,
      bookmarks: [bookmark, ...state.bookmarks],
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ bookmarks: payload.bookmarks });
  },

  addHighlight: (selectedText, color, note) => {
    const state = get();
    if (!state.activeDocumentId) return;

    const highlight: Highlight = {
      id: crypto.randomUUID(),
      documentId: state.activeDocumentId,
      selectedText,
      note,
      color,
      createdAt: isoNow(),
    };

    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: [highlight, ...state.highlights],
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ highlights: payload.highlights });
  },

  addNote: (content) => {
    const state = get();
    if (!state.activeDocumentId || !content.trim()) return;

    const note: Note = {
      id: crypto.randomUUID(),
      documentId: state.activeDocumentId,
      content: content.trim(),
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };

    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: [note, ...state.notes],
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ notes: payload.notes });
  },

  addDrawingStroke: (strokeData) => {
    const state = get();
    if (!state.activeDocumentId) return;

    const stroke: DrawingStroke = {
      ...strokeData,
      id: crypto.randomUUID(),
      documentId: state.activeDocumentId,
      createdAt: isoNow(),
    };

    const nextStrokes = [...state.drawingStrokes, stroke];
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: nextStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ drawingStrokes: nextStrokes });
  },

  undoDrawingStroke: () => {
    const state = get();
    if (!state.activeDocumentId || state.drawingStrokes.length === 0) return;

    const activeStrokes = state.drawingStrokes.filter((s) => s.documentId === state.activeDocumentId);
    if (activeStrokes.length === 0) return;

    const lastId = activeStrokes[activeStrokes.length - 1].id;
    const nextStrokes = state.drawingStrokes.filter((s) => s.id !== lastId);

    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: nextStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ drawingStrokes: nextStrokes });
  },

  clearDrawingStrokes: () => {
    const state = get();
    if (!state.activeDocumentId) return;

    const nextStrokes = state.drawingStrokes.filter((s) => s.documentId !== state.activeDocumentId);
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: nextStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ drawingStrokes: nextStrokes });
  },

  addStickyNote: (x, y, content, color = "yellow") => {
    const state = get();
    if (!state.activeDocumentId || !content.trim()) return;

    const pin: StickyNotePin = {
      id: crypto.randomUUID(),
      documentId: state.activeDocumentId,
      x,
      y,
      content: content.trim(),
      color,
      createdAt: isoNow(),
    };

    const nextSticky = [pin, ...state.stickyNotes];
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: nextSticky,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ stickyNotes: nextSticky });
  },

  deleteStickyNote: (id) => {
    const state = get();
    const nextSticky = state.stickyNotes.filter((s) => s.id !== id);
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: nextSticky,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ stickyNotes: nextSticky });
  },

  addStampAnnotation: (x, y, width, height, type, presetLabel, signatureDataUrl) => {
    const state = get();
    if (!state.activeDocumentId) return;

    const stamp: StampAnnotation = {
      id: crypto.randomUUID(),
      documentId: state.activeDocumentId,
      x,
      y,
      width,
      height,
      type,
      presetLabel,
      signatureDataUrl,
      createdAt: isoNow(),
    };

    const nextStamps = [stamp, ...state.stampAnnotations];
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: nextStamps,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ stampAnnotations: nextStamps });
  },

  deleteStampAnnotation: (id) => {
    const state = get();
    const nextStamps = state.stampAnnotations.filter((s) => s.id !== id);
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: nextStamps,
      savedSignatures: state.savedSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ stampAnnotations: nextStamps });
  },

  addSavedSignature: (title, dataUrl) => {
    const state = get();
    const sig: SavedSignature = {
      id: crypto.randomUUID(),
      title,
      dataUrl,
      createdAt: isoNow(),
    };

    const nextSignatures = [sig, ...state.savedSignatures];
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: nextSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ savedSignatures: nextSignatures });
  },

  deleteSavedSignature: (id) => {
    const state = get();
    const nextSignatures = state.savedSignatures.filter((s) => s.id !== id);
    const payload = {
      documents: state.documents,
      bookmarks: state.bookmarks,
      highlights: state.highlights,
      notes: state.notes,
      drawingStrokes: state.drawingStrokes,
      stickyNotes: state.stickyNotes,
      stampAnnotations: state.stampAnnotations,
      savedSignatures: nextSignatures,
    };

    writeLocalState(payload);
    void saveToSupabase(payload);
    set({ savedSignatures: nextSignatures });
  },
}));

