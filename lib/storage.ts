import { getSupabaseClient } from "@/lib/supabase";
import type {
  Bookmark,
  DocumentItem,
  DrawingStroke,
  Highlight,
  Note,
  SavedSignature,
  StampAnnotation,
  StickyNotePin,
} from "@/lib/types";

type PersistedState = {
  documents: DocumentItem[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  notes: Note[];
  drawingStrokes?: DrawingStroke[];
  stickyNotes?: StickyNotePin[];
  stampAnnotations?: StampAnnotation[];
  savedSignatures?: SavedSignature[];
};

const KEY = "pagger_state_v1";

const defaultState: PersistedState = {
  documents: [],
  bookmarks: [],
  highlights: [],
  notes: [],
  drawingStrokes: [],
  stickyNotes: [],
  stampAnnotations: [],
  savedSignatures: [],
};

function canUseWindow() {
  return typeof window !== "undefined";
}

export function readLocalState(): PersistedState {
  if (!canUseWindow()) {
    return defaultState;
  }

  const raw = localStorage.getItem(KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      documents: parsed.documents ?? [],
      bookmarks: parsed.bookmarks ?? [],
      highlights: parsed.highlights ?? [],
      notes: parsed.notes ?? [],
      drawingStrokes: parsed.drawingStrokes ?? [],
      stickyNotes: parsed.stickyNotes ?? [],
      stampAnnotations: parsed.stampAnnotations ?? [],
      savedSignatures: parsed.savedSignatures ?? [],
    };
  } catch {
    return defaultState;
  }
}

export function writeLocalState(state: PersistedState) {
  if (!canUseWindow()) {
    return;
  }

  localStorage.setItem(KEY, JSON.stringify(state));
}

export async function saveToSupabase(state: PersistedState) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  const payload = {
    id: "default",
    state,
    updated_at: new Date().toISOString(),
  };

  await supabase.from("reader_states").upsert(payload);
}

export async function loadFromSupabase(): Promise<PersistedState | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("reader_states")
    .select("state")
    .eq("id", "default")
    .single();

  if (error || !data) {
    return null;
  }

  return data.state as PersistedState;
}
