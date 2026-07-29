export type StudyColor = "yellow" | "green" | "blue" | "pink";

export type DocumentItem = {
  id: string;
  title: string;
  content: string;
  mimeType?: string;
  fileDataUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Bookmark = {
  id: string;
  documentId: string;
  label: string;
  color: StudyColor;
  createdAt: string;
};

export type Highlight = {
  id: string;
  documentId: string;
  selectedText: string;
  note?: string;
  color: StudyColor;
  createdAt: string;
};

export type Note = {
  id: string;
  documentId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type ToolMode =
  | "select"
  | "pen"
  | "highlighter"
  | "eraser"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "sticky"
  | "stamp";

export type Point = {
  x: number;
  y: number;
  pressure?: number;
};

export type DrawingStroke = {
  id: string;
  documentId: string;
  tool: "pen" | "highlighter" | "eraser" | "rectangle" | "circle" | "line" | "arrow";
  points: Point[];
  color: string;
  width: number;
  opacity?: number;
  createdAt: string;
};

export type StickyNotePin = {
  id: string;
  documentId: string;
  x: number;
  y: number;
  content: string;
  color: StudyColor;
  author?: string;
  createdAt: string;
};

export type StampPreset = "APPROVED" | "CONFIDENTIAL" | "DRAFT" | "REVIEWED" | "URGENT";

export type StampAnnotation = {
  id: string;
  documentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "preset" | "signature";
  presetLabel?: StampPreset;
  signatureDataUrl?: string;
  color?: string;
  createdAt: string;
};

export type SavedSignature = {
  id: string;
  title: string;
  dataUrl: string;
  createdAt: string;
};

