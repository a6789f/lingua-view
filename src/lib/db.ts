import { supabase } from "@/integrations/supabase/client";

export interface VideoRow {
  id: string;
  title: string;
  source_url: string | null;
  original_lang: string;
  translation_lang: string;
  duration_sec: number | null;
  is_demo: boolean;
  created_at: string;
}

export interface SegmentRow {
  id: string;
  video_id: string;
  idx: number;
  speaker: string;
  text: string;
  translation: string | null;
  start_sec: number;
  end_sec: number;
}

export interface VocabRow {
  id: string;
  video_id: string | null;
  video_title: string | null;
  word: string;
  translation: string | null;
  sentence: string | null;
  timestamp_sec: number | null;
  kind: string;
  created_at: string;
}

export const LANGUAGES = [
  { code: "ru", label: "Russian" },
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
] as const;

export function langLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** Local object URLs for uploaded files (not persisted across reloads). */
const localVideoUrls = new Map<string, string>();
export const rememberLocalVideo = (id: string, url: string) => localVideoUrls.set(id, url);
export const getLocalVideo = (id: string) => localVideoUrls.get(id);

export async function listVideos(): Promise<VideoRow[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VideoRow[];
}

export async function getVideo(id: string): Promise<VideoRow | null> {
  const { data, error } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as VideoRow) ?? null;
}

export async function getSegments(videoId: string): Promise<SegmentRow[]> {
  const { data, error } = await supabase
    .from("segments")
    .select("*")
    .eq("video_id", videoId)
    .order("idx");
  if (error) throw error;
  return (data ?? []) as SegmentRow[];
}

export async function createVideo(input: {
  title: string;
  original_lang: string;
  translation_lang: string;
  duration_sec: number | null;
}): Promise<VideoRow> {
  const { data, error } = await supabase.from("videos").insert(input).select().single();
  if (error) throw error;
  return data as VideoRow;
}

export async function insertSegments(
  videoId: string,
  rows: Array<{ idx: number; speaker: string; text: string; translation: string; start_sec: number; end_sec: number }>,
) {
  const { error } = await supabase
    .from("segments")
    .insert(rows.map((r) => ({ ...r, video_id: videoId })));
  if (error) throw error;
}

export async function listVocabulary(): Promise<VocabRow[]> {
  const { data, error } = await supabase
    .from("vocabulary")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VocabRow[];
}

export async function saveVocabulary(row: {
  video_id: string | null;
  video_title: string | null;
  word: string;
  translation: string | null;
  sentence: string | null;
  timestamp_sec: number | null;
  kind: "word" | "sentence";
}) {
  const { error } = await supabase.from("vocabulary").insert(row);
  if (error) throw error;
}

export async function deleteVocabulary(id: string) {
  const { error } = await supabase.from("vocabulary").delete().eq("id", id);
  if (error) throw error;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
