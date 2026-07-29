# Pagger Reader

Pagger is a focused reading workspace for any document. It combines a reader, notes, highlights, colored bookmarks, and a side study panel in one screen.

## Features implemented

- Document library with quick create/import (text-based files)
- Reading workspace with zoom controls
- Text selection highlights (multi-color)
- Color-coded bookmarks
- Quick notes per active document
- Local persistence with optional Supabase sync

## Local development

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Run the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase setup (optional now, ready for later Neon migration)

Add the values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Create this table in Supabase SQL editor:

```sql
create table if not exists public.reader_states (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
```

This app automatically falls back to `localStorage` when Supabase env values are not set.
