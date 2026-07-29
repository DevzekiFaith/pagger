"use client";

import { type ChangeEvent, useEffect, useMemo, useState, useRef } from "react";
import {
  BookOpenText,
  FileUp,
  Library,
  SearchCheck,
  SpellCheck,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Download,
  Printer,
  Moon,
  Sun,
  X,
  Plus
} from "lucide-react";
import { useReaderStore } from "@/hooks/use-reader-store";
import type { StudyColor } from "@/lib/types";
import { AnnotationToolbar } from "@/components/annotation-toolbar";
import { AnnotationCanvas } from "@/components/annotation-canvas";
import { SignatureModal } from "@/components/signature-modal";


const COLOR_MAP: Record<StudyColor, string> = {
  yellow: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  green: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  blue: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
  pink: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
};

const SAMPLE_TEXT = `Welcome to Pagger.

Paste or upload your study document here so you can read, annotate, and bookmark without leaving your flow.

This immersive workspace is built to support focused reading on phone, tablet, and desktop. Tools float over the canvas so you never lose your place.`;

export function ReaderApp() {
  const {
    documents,
    bookmarks,
    highlights,
    notes,
    theme,
    activeDocumentId,
    zoom,
    hydrated,
    hydrate,
    setTheme,
    setActiveDocument,
    setZoom,
    addDocument,
    addBookmark,
    addHighlight,
    addNote,
  } = useReaderStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(SAMPLE_TEXT);
  const [noteInput, setNoteInput] = useState("");
  const [selection, setSelection] = useState("");
  const [highlightDraft, setHighlightDraft] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [lookupTerm, setLookupTerm] = useState("");
  const [dictionaryLoading, setDictionaryLoading] = useState(false);
  const [dictionaryResult, setDictionaryResult] = useState<{
    word: string;
    phonetic: string;
    meanings: Array<{ partOfSpeech: string; definitions: string[] }>;
    relatedWords: string[];
  } | null>(null);
  const [dictionaryError, setDictionaryError] = useState("");
  const [correctingNote, setCorrectingNote] = useState(false);
  
  // UI State
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isStudyOpen, setIsStudyOpen] = useState(false);
  const [activeStudyTab, setActiveStudyTab] = useState<"dictionary" | "concordance" | "notes">("dictionary");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isResizingSidebar, setIsResizingSidebar] = useState<"library" | "study" | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docContainerRef = useRef<HTMLDivElement>(null);
  const [docBounds, setDocBounds] = useState({ width: 1000, height: 1200 });

  const handleSidebarResizeMove = (e: React.PointerEvent) => {
    if (!isResizingSidebar) return;
    if (isResizingSidebar === "library") {
      const newW = Math.max(280, Math.min(650, e.clientX));
      setSidebarWidth(newW);
    } else if (isResizingSidebar === "study") {
      const newW = Math.max(280, Math.min(650, window.innerWidth - e.clientX));
      setSidebarWidth(newW);
    }
  };

  const handleSidebarResizeEnd = () => {
    setIsResizingSidebar(null);
  };

  useEffect(() => {
    const el = docContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setDocBounds({
            width: Math.max(300, Math.round(entry.contentRect.width)),
            height: Math.max(400, Math.round(entry.contentRect.height)),
          });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeDocumentId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // Open library by default if no documents exist after hydration
  useEffect(() => {
    if (hydrated && documents.length === 0) {
      setIsLibraryOpen(true);
    }
  }, [hydrated, documents.length]);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) ?? null,
    [documents, activeDocumentId],
  );

  const activeBookmarks = bookmarks.filter((item) => item.documentId === activeDocumentId);
  const activeHighlights = highlights.filter((item) => item.documentId === activeDocumentId);
  const activeNotes = notes.filter((item) => item.documentId === activeDocumentId);

  function onCreateDocument() {
    const finalTitle = title.trim() || `Document ${documents.length + 1}`;
    addDocument(finalTitle, content);
    setTitle("");
    setContent(SAMPLE_TEXT);
    if (window.innerWidth < 1024) setIsLibraryOpen(false);
  }

  function onFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);

    const reader = new FileReader();
    const baseTitle = file.name.replace(/\.[^/.]+$/, "");

    if (file.type === "application/pdf") {
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        addDocument(baseTitle, "", file.type, dataUrl);
        if (window.innerWidth < 1024) setIsLibraryOpen(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      addDocument(baseTitle, text || SAMPLE_TEXT, file.type);
      if (window.innerWidth < 1024) setIsLibraryOpen(false);
    };
    reader.readAsText(file);
    
    // Reset file input so same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function captureSelection() {
    const selected = window.getSelection()?.toString().trim() ?? "";
    if (!selected) return;

    setSelection(selected);
    setHighlightDraft(selected);
    if (selected.split(" ").length <= 3) {
      setLookupTerm(selected);
    }
  }

  function addHighlightFromDraft(color: StudyColor) {
    const text = highlightDraft.trim();
    if (!text) return;
    addHighlight(text, color);
  }

  async function runDictionaryLookup(rawTerm: string) {
    const term = rawTerm.trim();
    if (!term) return;

    setDictionaryLoading(true);
    setDictionaryError("");
    try {
      const response = await fetch(`/api/dictionary?term=${encodeURIComponent(term)}`);
      const data = (await response.json()) as {
        word?: string;
        phonetic?: string;
        meanings?: Array<{ partOfSpeech?: string; definitions?: string[] }>;
        relatedWords?: string[];
        error?: string;
      };

      if (!response.ok || data.error) {
        setDictionaryResult(null);
        setDictionaryError(data.error ?? "No dictionary result found.");
        return;
      }

      setDictionaryResult({
        word: data.word ?? term,
        phonetic: data.phonetic ?? "",
        meanings:
          data.meanings?.map((item) => ({
            partOfSpeech: item.partOfSpeech ?? "unknown",
            definitions: item.definitions ?? [],
          })) ?? [],
        relatedWords: data.relatedWords ?? [],
      });
    } catch {
      setDictionaryResult(null);
      setDictionaryError("Unable to reach dictionary service.");
    } finally {
      setDictionaryLoading(false);
    }
  }

  async function autoCorrectNote() {
    if (!noteInput.trim()) return;

    setCorrectingNote(true);
    try {
      const response = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteInput }),
      });
      const data = (await response.json()) as { correctedText?: string };
      if (response.ok && data.correctedText) {
        setNoteInput(data.correctedText);
      }
    } finally {
      setCorrectingNote(false);
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleDownload = () => {
    if (activeDocument?.fileDataUrl) {
      const a = document.createElement("a");
      a.href = activeDocument.fileDataUrl;
      a.download = activeDocument.title || "document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handlePrint = () => {
    if (activeDocument?.fileDataUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = activeDocument.fileDataUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      };
    }
  };

  const renderedContent = useMemo(() => {
    if (!activeDocument?.content) return null;
    if (!activeHighlights.length) return activeDocument.content;

    const terms = Array.from(new Set(activeHighlights.map((h) => h.selectedText).filter(Boolean)));
    if (!terms.length) return activeDocument.content;

    const termColorMap = new Map<string, StudyColor>();
    activeHighlights.forEach((h) => {
      if (h.selectedText) termColorMap.set(h.selectedText.toLowerCase(), h.color);
    });

    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = activeDocument.content.split(regex);

    return parts.map((part, i) => {
      const color = termColorMap.get(part.toLowerCase());
      if (color) {
        const colorClass =
          color === "yellow"
            ? "bg-amber-300 text-amber-950 font-semibold px-1 rounded-sm shadow-xs dark:bg-amber-400 dark:text-slate-950"
            : color === "green"
            ? "bg-emerald-300 text-emerald-950 font-semibold px-1 rounded-sm shadow-xs dark:bg-emerald-400 dark:text-slate-950"
            : color === "blue"
            ? "bg-sky-300 text-sky-950 font-semibold px-1 rounded-sm shadow-xs dark:bg-sky-400 dark:text-slate-950"
            : "bg-rose-300 text-rose-950 font-semibold px-1 rounded-sm shadow-xs dark:bg-rose-400 dark:text-slate-950";

        return (
          <mark key={i} className={`${colorClass} inline transition-all`}>
            {part}
          </mark>
        );
      }
      return part;
    });
  }, [activeDocument?.content, activeHighlights]);

  const concordanceRows = (() => {
    if (!activeDocument?.content || !lookupTerm.trim() || activeDocument.mimeType === "application/pdf") {
      return [];
    }

    const target = lookupTerm.trim().toLowerCase();
    const normalizedLines = activeDocument.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const rows = normalizedLines
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => line.toLowerCase().includes(target))
      .slice(0, 8);

    return rows;
  })();

  if (!hydrated) {
    return <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 animate-pulse">Loading workspace...</div>;
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handleSidebarResizeMove}
      onPointerUp={handleSidebarResizeEnd}
      className={`relative h-[100dvh] w-full overflow-hidden bg-[#f8fafc] dark:bg-[#0f172a] transition-colors duration-500 font-sans ${
        isResizingSidebar ? "select-none cursor-col-resize" : ""
      }`}
    >
      
      {/* 1. IMMERSIVE CANVAS */}
      <main className="absolute inset-0 z-0 flex items-start justify-center overflow-auto pb-32">
        {!activeDocument ? (
          <div className="mt-32 flex max-w-md flex-col items-center text-center px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/20">
              <BookOpenText size={36} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Pagger Workspace</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              Your distraction-free reading environment. Open the library to upload a document or paste text to begin.
            </p>
            <button
              onClick={() => setIsLibraryOpen(true)}
              className="mt-8 flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white shadow-lg transition hover:scale-105 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Library size={18} />
              Open Library
            </button>
          </div>
        ) : activeDocument.mimeType === "application/pdf" && activeDocument.fileDataUrl ? (
          <div className="w-full min-h-[85vh] p-2 sm:p-4 lg:p-8 flex justify-center">
            <div
              ref={docContainerRef}
              className="relative w-full max-w-7xl shadow-2xl rounded-2xl overflow-hidden border border-zinc-200/50 dark:border-white/10 transition-transform duration-300 origin-top flex flex-col min-h-[85vh]"
              style={{
                transform: `scale(${zoom / 100})`,
                width: `${10000 / zoom}%`,
              }}
            >
              <iframe
                src={activeDocument.fileDataUrl}
                title={activeDocument.title}
                className="w-full flex-1 min-h-[85vh] bg-white dark:bg-zinc-950"
              />
              <AnnotationCanvas />
            </div>
          </div>
        ) : (
          <div ref={docContainerRef} className="relative w-full max-w-3xl px-6 py-12 sm:px-12 sm:py-20 min-h-[80vh]">
            <article
              className="w-full text-[1.05rem] leading-loose tracking-[0.01em] text-zinc-800 dark:text-zinc-200"
              style={{ fontSize: `${zoom}%` }}
              onMouseUp={captureSelection}
              onTouchEnd={captureSelection}
            >
              <h1 className="mb-8 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{activeDocument.title}</h1>
              <div className="whitespace-pre-wrap">{renderedContent}</div>
            </article>
            <AnnotationCanvas />
          </div>
        )}
      </main>

      {/* ADOBE ANNOTATION TOOLBAR */}
      {activeDocument && (
        <div className="fixed top-4 left-1/2 z-40 -translate-x-1/2 max-w-[95vw]">
          <AnnotationToolbar onOpenSignatureModal={() => setIsSignatureModalOpen(true)} />
        </div>
      )}

      {/* SIGNATURE MODAL */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
      />

      {/* 2. FLOATING OVERLAYS (LIBRARY) */}
      <aside
        style={{ width: typeof window !== "undefined" && window.innerWidth >= 1024 ? `${sidebarWidth}px` : undefined }}
        className={`absolute inset-x-2 top-2 bottom-24 z-40 flex flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/70 shadow-2xl backdrop-blur-2xl transition-transform duration-500 ease-in-out dark:border-zinc-800/50 dark:bg-zinc-950/70 sm:bottom-4 lg:bottom-4 ${
          isLibraryOpen ? "translate-x-0" : "-translate-x-[110%]"
        }`}
      >
        {/* Right Resizable Drag Handle */}
        <div
          onPointerDown={() => setIsResizingSidebar("library")}
          className="hidden lg:block absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500/50 transition z-50 group"
          title="Drag to resize panel"
        >
          <div className="h-full w-0.5 bg-indigo-500/30 group-hover:bg-indigo-500 mx-auto" />
        </div>
        <div className="flex items-center justify-between border-b border-zinc-200/50 p-5 dark:border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Pagger Library</h2>
          </div>
          <button onClick={() => setIsLibraryOpen(false)} className="rounded-full p-2 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
          <div className="space-y-3">
            <label
              htmlFor="document-upload"
              className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200/50 bg-indigo-50/30 p-6 transition hover:border-indigo-500 hover:bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/40"
            >
              <div className="rounded-full bg-white p-3 shadow-sm transition-transform group-hover:scale-110 group-hover:text-indigo-600 dark:bg-zinc-900 dark:text-zinc-300 dark:group-hover:text-indigo-400">
                <FileUp size={22} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Upload Document</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Drop a PDF, TXT, MD, or CSV</p>
                {selectedFileName && <p className="mt-2 truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">{selectedFileName}</p>}
              </div>
            </label>
            <input ref={fileInputRef} id="document-upload" type="file" accept=".txt,.md,.csv,.pdf" onChange={onFileImport} className="hidden" />
          </div>

          <div className="rounded-2xl border border-zinc-200/50 bg-white/50 p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Quick Text Paste</h3>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title (Optional)"
              className="mb-2 w-full rounded-xl border border-zinc-200/50 bg-white/80 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800/50 dark:bg-zinc-950/80 dark:text-white"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              placeholder="Paste text snippet..."
              className="w-full resize-none rounded-xl border border-zinc-200/50 bg-white/80 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800/50 dark:bg-zinc-950/80 dark:text-white"
            />
            <button
              onClick={onCreateDocument}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus size={16} /> Create Document
            </button>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Your Documents</h3>
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200/50 border-dashed p-6 text-center text-zinc-500 dark:border-zinc-800/50 dark:text-zinc-500">
                <p className="text-sm">No documents found.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((document) => (
                  <button
                    key={document.id}
                    onClick={() => {
                      setActiveDocument(document.id);
                      if (window.innerWidth < 1024) setIsLibraryOpen(false);
                    }}
                    className={`w-full group flex flex-col items-start rounded-xl border p-3 transition-all ${
                      document.id === activeDocumentId
                        ? "border-indigo-500 bg-indigo-50/50 shadow-sm dark:border-indigo-500/50 dark:bg-indigo-500/10"
                        : "border-transparent bg-white/50 hover:border-zinc-200 hover:bg-white dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <p className={`truncate text-sm font-semibold ${document.id === activeDocumentId ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-800 dark:text-zinc-200"}`}>
                      {document.title}
                    </p>
                    <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 opacity-70">
                      {document.mimeType === "application/pdf" ? "PDF" : "Text"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 3. FLOATING OVERLAYS (STUDY TOOLS) */}
      <aside
        style={{ width: typeof window !== "undefined" && window.innerWidth >= 1024 ? `${sidebarWidth}px` : undefined }}
        className={`absolute inset-x-2 top-2 bottom-24 z-40 flex flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/70 shadow-2xl backdrop-blur-2xl transition-transform duration-500 ease-in-out dark:border-zinc-800/50 dark:bg-zinc-950/70 sm:bottom-4 lg:bottom-4 lg:left-auto lg:right-4 ${
          isStudyOpen ? "translate-x-0" : "translate-x-[110%]"
        }`}
      >
        {/* Left Resizable Drag Handle */}
        <div
          onPointerDown={() => setIsResizingSidebar("study")}
          className="hidden lg:block absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500/50 transition z-50 group"
          title="Drag to resize panel"
        >
          <div className="h-full w-0.5 bg-indigo-500/30 group-hover:bg-indigo-500 mx-auto" />
        </div>
        <div className="flex items-center justify-between border-b border-zinc-200/50 p-5 dark:border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500" />
            <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">Pagger Study</h2>
          </div>
          <button onClick={() => setIsStudyOpen(false)} className="rounded-full p-2 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-500 transition">
            <X size={18} />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto no-scrollbar flex flex-col">
          {/* Tabs Navigation */}
          <div className="px-5 py-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex p-1 gap-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl">
              {(["dictionary", "concordance", "notes"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveStudyTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition ${
                    activeStudyTab === tab 
                      ? "bg-white text-indigo-600 shadow-sm dark:bg-zinc-800 dark:text-indigo-400" 
                      : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
            {activeStudyTab === "dictionary" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="rounded-2xl border border-zinc-200/50 bg-white/50 p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                  <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <BookOpenText size={15} /> Dictionary
                  </h3>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={lookupTerm}
                      onChange={(event) => setLookupTerm(event.target.value)}
                      placeholder="Word lookup..."
                      className="w-full rounded-xl border border-zinc-200/50 bg-white/80 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 dark:border-zinc-800/50 dark:bg-zinc-950/80 dark:text-white"
                    />
                    <button
                      onClick={() => void runDictionaryLookup(lookupTerm)}
                      className="flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-white shadow-md transition hover:bg-indigo-700 dark:bg-indigo-50 dark:hover:bg-indigo-600"
                    >
                      <SearchCheck size={16} />
                    </button>
                  </div>
                  {dictionaryLoading && <p className="mt-3 text-xs text-zinc-500 animate-pulse">Searching...</p>}
                  {dictionaryResult && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-lg font-bold text-zinc-900 dark:text-white">{dictionaryResult.word}</p>
                        {dictionaryResult.phonetic && <p className="text-xs text-zinc-500">{dictionaryResult.phonetic}</p>}
                      </div>
                      {dictionaryResult.meanings.slice(0, 2).map((meaning, index) => (
                        <div key={`${meaning.partOfSpeech}-${index}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {meaning.partOfSpeech}
                          </p>
                          <ul className="mt-1 space-y-1 pl-3 text-sm text-zinc-700 dark:text-zinc-300 list-disc marker:text-zinc-300 dark:marker:text-zinc-600">
                            {meaning.definitions.slice(0, 2).map((def, i) => <li key={i}>{def}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {dictionaryError && <p className="mt-3 text-xs text-rose-500">{dictionaryError}</p>}
                </div>
              </div>
            )}

            {activeStudyTab === "concordance" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="rounded-2xl border border-zinc-200/50 bg-white/50 p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Document Search</h3>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={lookupTerm}
                      onChange={(event) => setLookupTerm(event.target.value)}
                      placeholder="Find in document..."
                      className="w-full rounded-xl border border-zinc-200/50 bg-white/80 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 dark:border-zinc-800/50 dark:bg-zinc-950/80 dark:text-white"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-500">Search results will appear below in real-time.</p>
                </div>

                {concordanceRows.length > 0 ? (
                  <div className="rounded-2xl border border-indigo-200/50 bg-indigo-50/30 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Appearances
                    </h3>
                    <div className="space-y-2">
                      {concordanceRows.map((row, i) => (
                        <div key={i} className="rounded-xl bg-white/60 p-2.5 text-xs text-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-300 border border-indigo-100 dark:border-indigo-900/20">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">Line {row.lineNumber}: </span>
                          <span className="italic">"{row.line}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-zinc-500 dark:border-zinc-800">
                    <p className="text-xs">No matches found in the current text document.</p>
                  </div>
                )}
                {activeDocument?.mimeType === "application/pdf" && (
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      <strong>Note:</strong> Concordance search currently works on text-based documents and pasted snippets.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeStudyTab === "notes" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="rounded-2xl border border-zinc-200/50 bg-white/50 p-4 dark:border-zinc-800/50 dark:bg-zinc-900/50">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick Note</h3>
                  <textarea
                    value={noteInput}
                    onChange={(event) => setNoteInput(event.target.value)}
                    rows={3}
                    placeholder="Thoughts on this..."
                    spellCheck
                    className="mt-2 w-full resize-none rounded-xl border border-zinc-200/50 bg-white/80 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800/50 dark:bg-zinc-950/80 dark:text-white"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={autoCorrectNote}
                      disabled={correctingNote}
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      <SpellCheck size={14} /> {correctingNote ? "Fixing..." : "Fix"}
                    </button>
                    <button
                      onClick={() => {
                        addNote(noteInput);
                        setNoteInput("");
                      }}
                      className="flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white shadow-md transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      Save Note
                    </button>
                  </div>
                </div>

                {activeHighlights.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Highlights</h3>
                    <div className="space-y-2">
                      {activeHighlights.map((highlight) => (
                        <div key={highlight.id} className="rounded-xl border border-zinc-200/50 bg-white/50 p-3 text-sm dark:border-zinc-800/50 dark:bg-zinc-900/50">
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <div className={`h-2.5 w-2.5 rounded-full ${
                              highlight.color === "yellow" ? "bg-amber-400" : highlight.color === "green" ? "bg-emerald-400" : highlight.color === "blue" ? "bg-sky-400" : "bg-rose-400"
                            }`} />
                          </div>
                          <p className="text-zinc-700 dark:text-zinc-300 italic line-clamp-3">"{highlight.selectedText}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeNotes.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Saved Notes</h3>
                    <div className="space-y-2">
                      {activeNotes.map((note) => (
                        <div key={note.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-sm text-zinc-800 dark:border-indigo-900/30 dark:bg-indigo-900/10 dark:text-zinc-200">
                          {note.content}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* 4. THE COMMAND PILL (DOCK) */}
      <nav className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 sm:gap-2 rounded-full border border-white/20 bg-white/70 p-1.5 shadow-2xl backdrop-blur-2xl dark:border-zinc-800/60 dark:bg-zinc-900/80">
        
        {/* Brand Logo */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg sm:ml-1">
          <BookOpenText size={18} />
        </div>

        <div className="mx-1 h-6 w-px bg-zinc-300/50 dark:bg-zinc-700/50" />

        {/* Library Toggle */}
        <button
          onClick={() => {
            setIsLibraryOpen(!isLibraryOpen);
            setIsStudyOpen(false);
          }}
          className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
            isLibraryOpen 
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" 
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          <Library size={16} />
          <span className="hidden sm:inline">Library</span>
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-300/50 dark:bg-zinc-700/50" />

        {/* Zoom Controls */}
        <div className="hidden sm:flex items-center gap-1 px-1">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="hidden sm:block mx-1 h-6 w-px bg-zinc-300/50 dark:bg-zinc-700/50" />

        {/* PDF Actions */}
        {activeDocument?.mimeType === "application/pdf" && (
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrint}
              className="rounded-full p-2.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
              title="Print"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={handleDownload}
              className="rounded-full p-2.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
              title="Download PDF"
            >
              <Download size={16} />
            </button>
            <div className="mx-1 h-6 w-px bg-zinc-300/50 dark:bg-zinc-700/50" />
          </div>
        )}

        {/* Fullscreen & Theme */}
        <button
          onClick={toggleFullscreen}
          className="rounded-full p-2.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
        
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full p-2.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
          title="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div className="mx-1 h-6 w-px bg-zinc-300/50 dark:bg-zinc-700/50" />

        {/* Study Toggle */}
        <button
          onClick={() => {
            setIsStudyOpen(!isStudyOpen);
            setIsLibraryOpen(false);
          }}
          className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
            isStudyOpen 
              ? "bg-indigo-600 text-white dark:bg-indigo-500" 
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          <SpellCheck size={16} />
          <span className="hidden sm:inline">Study</span>
        </button>
      </nav>

      {/* 5. FLOATING HIGHLIGHT BAR (Only visible when text selected) */}
      {highlightDraft.trim() && (
        <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-white/90 p-2 shadow-2xl backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/90 animate-in slide-in-from-bottom-4">
          <input
            value={highlightDraft}
            onChange={(event) => setHighlightDraft(event.target.value)}
            placeholder="Selected text..."
            className="w-32 sm:w-48 bg-transparent px-3 py-1 text-sm text-zinc-900 outline-none dark:text-white"
          />
          <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex gap-1.5 px-1">
            {(["yellow", "green", "blue", "pink"] as StudyColor[]).map((color) => (
              <button
                key={color}
                onClick={() => {
                  addHighlightFromDraft(color);
                  setHighlightDraft("");
                  setSelection("");
                }}
                className={`h-7 w-7 rounded-full border-2 border-white/50 shadow-sm transition hover:scale-110 dark:border-zinc-950 ${
                  color === "yellow" ? "bg-amber-400" :
                  color === "green" ? "bg-emerald-400" :
                  color === "blue" ? "bg-sky-400" : "bg-rose-400"
                }`}
                title={`Highlight ${color}`}
              />
            ))}
          </div>
          <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            onClick={() => {
              setHighlightDraft("");
              setSelection("");
            }}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {/* 6. WATERMARK */}
      <div className="fixed bottom-4 right-6 z-10 pointer-events-none select-none opacity-20 dark:opacity-10 transition-opacity hover:opacity-40">
        <div className="flex flex-col items-end">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-900 dark:text-white">Pagger</p>
          <p className="text-[8px] font-medium text-zinc-500 dark:text-zinc-400">Workspace</p>
        </div>
      </div>
    </div>
  );
}
