import { useEffect, useState } from "react";
import { deleteVocabulary, formatTime, listVocabulary, type VocabRow } from "@/lib/db";

export function VocabularyPanel({ refreshKey, onSeek }: { refreshKey: number; onSeek?: (sec: number) => void }) {
  const [rows, setRows] = useState<VocabRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listVocabulary()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [refreshKey]);

  if (loading) return <p className="p-5 text-sm text-muted-foreground">Loading vocabulary…</p>;
  if (rows.length === 0)
    return <p className="p-5 text-sm text-muted-foreground">Nothing saved yet. Save words or sentences from the X-Ray panel.</p>;

  return (
    <div className="space-y-2 p-4">
      {rows.map((r) => (
        <div key={r.id} className="panel p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.word}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{r.translation}</p>
            </div>
            <button
              onClick={() => deleteVocabulary(r.id).then(load)}
              className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </div>
          {r.sentence && <p className="mt-2 text-xs italic text-muted-foreground">“{r.sentence}”</p>}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded bg-secondary px-1.5 py-0.5">{r.kind}</span>
            {r.timestamp_sec != null && (
              <button
                onClick={() => onSeek?.(r.timestamp_sec ?? 0)}
                className="tabular-nums hover:text-primary"
                disabled={!onSeek}
              >
                {formatTime(r.timestamp_sec)}
              </button>
            )}
            {r.video_title && <span className="truncate">· {r.video_title}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
