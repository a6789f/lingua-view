import { useEffect, useRef } from "react";
import type { SegmentRow } from "@/lib/db";
import { formatTime } from "@/lib/db";

interface Props {
  segments: SegmentRow[];
  activeId: string | null;
  display: "original" | "translation" | "both";
  onSeek: (sec: number) => void;
}

export function DialoguePanel({ segments, activeId, display, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-active='true']");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId]);

  return (
    <div ref={ref} className="space-y-1 p-4">
      {segments.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            data-active={active}
            onClick={() => onSeek(s.start_sec)}
            className={[
              "block w-full rounded-lg px-3 py-2 text-left transition-colors",
              active ? "bg-surface-elevated xray-underline" : "hover:bg-accent/60",
            ].join(" ")}
          >
            <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">[{formatTime(s.start_sec)}]</span>
              <span className={active ? "text-primary" : ""}>{s.speaker}</span>
            </div>
            {display !== "translation" && <p className="mt-1 text-sm leading-relaxed">{s.text}</p>}
            {display !== "original" && (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.translation ?? "—"}</p>
            )}
          </button>
        );
      })}
      {segments.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">No dialogue was detected in this video.</p>
      )}
    </div>
  );
}
