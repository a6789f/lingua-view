import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XrayPanel } from "@/components/XrayPanel";
import { DialoguePanel } from "@/components/DialoguePanel";
import { VocabularyPanel } from "@/components/VocabularyPanel";
import {
  formatTime,
  getLocalVideo,
  getSegments,
  getVideo,
  langLabel,
  saveVocabulary,
  type SegmentRow,
  type VideoRow,
} from "@/lib/db";

export const Route = createFileRoute("/watch/$videoId")({
  head: () => ({
    meta: [
      { title: "Watching — Language X-Ray" },
      {
        name: "description",
        content: "Interactive player with live subtitles, translations, dialogue transcript and word analysis.",
      },
      { property: "og:title", content: "Language X-Ray player" },
      { property: "og:description", content: "Pause any line and inspect the language behind it." },
    ],
  }),
  component: Watch,
});

type Tab = "xray" | "dialogue" | "vocab";
type Display = "original" | "translation" | "both";

function Watch() {
  const { videoId } = Route.useParams();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [video, setVideo] = useState<VideoRow | null>(null);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(true);
  const [tab, setTab] = useState<Tab>("xray");
  const [display, setDisplay] = useState<Display>("both");
  const [showWordAnalysis, setShowWordAnalysis] = useState(true);
  const [learningMode, setLearningMode] = useState(false);
  const [slow, setSlow] = useState(false);
  const [vocabKey, setVocabKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const lastPausedIdx = useRef<number>(-1);

  useEffect(() => {
    setLoading(true);
    Promise.all([getVideo(videoId), getSegments(videoId)])
      .then(([v, s]) => {
        setVideo(v);
        setSegments(s);
      })
      .finally(() => setLoading(false));
  }, [videoId]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = slow ? 0.65 : 1;
  }, [slow]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeIndex = useMemo(() => {
    let found = -1;
    segments.forEach((s, i) => {
      if (time >= s.start_sec - 0.15 && time <= s.end_sec + 0.35) found = i;
    });
    if (found === -1 && paused) {
      // When paused between lines, show the most recent line.
      segments.forEach((s, i) => {
        if (s.start_sec <= time) found = i;
      });
    }
    return found;
  }, [segments, time, paused]);

  const active = activeIndex >= 0 ? (segments[activeIndex] ?? null) : null;

  const seek = useCallback((sec: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, sec);
    setTime(Math.max(0, sec));
  }, []);

  const replaySentence = () => {
    if (!active) return;
    seek(active.start_sec);
    void videoRef.current?.play();
  };

  // Learning mode: pause automatically at the end of each dialogue sentence.
  const onTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setTime(el.currentTime);
    if (!learningMode || el.paused) return;
    const idx = segments.findIndex((s) => el.currentTime >= s.end_sec && el.currentTime < s.end_sec + 0.35);
    if (idx >= 0 && lastPausedIdx.current !== idx) {
      lastPausedIdx.current = idx;
      el.pause();
    }
  };

  const src = video?.source_url ?? getLocalVideo(videoId) ?? null;

  const save = async (kind: "word" | "sentence", word: string, translation: string) => {
    if (!video) return;
    await saveVocabulary({
      video_id: video.id,
      video_title: video.title,
      word,
      translation,
      sentence: active?.text ?? null,
      timestamp_sec: active?.start_sec ?? null,
      kind,
    });
    setVocabKey((k) => k + 1);
    setToast(kind === "word" ? "Word saved" : "Sentence saved");
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!video) return <div className="p-10 text-sm text-muted-foreground">This video could not be found.</div>;

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span className="size-2 rounded-full bg-xray" />
          Language X-Ray
        </Link>
        <p className="truncate px-4 text-sm font-medium">{video.title}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">
          {langLabel(video.original_lang)} → {langLabel(video.translation_lang)}
        </p>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <section className="flex flex-1 flex-col">
          <div className="relative bg-background">
            {src ? (
              <video
                ref={videoRef}
                src={src}
                controls
                playsInline
                onTimeUpdate={onTimeUpdate}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
                onSeeked={() => {
                  lastPausedIdx.current = -1;
                }}
                className="max-h-[62vh] w-full bg-black"
              />
            ) : (
              <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                The video file lives only in your browser for this prototype. Re-upload it from the home screen to watch
                it again — the transcript below is still saved.
              </div>
            )}

            {active && display !== "translation" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-6">
                <div className="max-w-3xl rounded-xl bg-background/80 px-4 py-3 text-center backdrop-blur">
                  <p className="text-lg leading-snug">{active.text}</p>
                  {display === "both" && (
                    <p className="mt-1 text-sm text-muted-foreground">{active.translation ?? "—"}</p>
                  )}
                </div>
              </div>
            )}
            {active && display === "translation" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-6">
                <div className="max-w-3xl rounded-xl bg-background/80 px-4 py-3 text-center backdrop-blur">
                  <p className="text-lg leading-snug">{active.translation ?? "—"}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 text-xs">
            <Control onClick={replaySentence}>Replay sentence</Control>
            <Control onClick={() => active && seek(Math.max(active.start_sec, time - 1.2))}>Replay word</Control>
            <Control active={slow} onClick={() => setSlow((s) => !s)}>
              Slow 0.65×
            </Control>
            <Control active={learningMode} onClick={() => setLearningMode((l) => !l)}>
              Learning mode
            </Control>
            <Control
              onClick={() => setDisplay(display === "both" ? "original" : display === "original" ? "translation" : "both")}
            >
              {display === "both" ? "Original + translation" : display === "original" ? "Original only" : "Translation only"}
            </Control>
            <Control active={showWordAnalysis} onClick={() => setShowWordAnalysis((v) => !v)}>
              Word analysis
            </Control>
            <Control onClick={() => active && save("sentence", active.text, active.translation ?? "")}>
              Save sentence
            </Control>
            <span className="ml-auto tabular-nums text-muted-foreground">{formatTime(time)}</span>
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col border-t border-border lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="flex border-b border-border">
            {(
              [
                ["xray", "Language X-Ray"],
                ["dialogue", "Dialogue"],
                ["vocab", "Vocabulary"],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={[
                  "flex-1 px-3 py-3 text-xs font-medium transition-colors",
                  tab === key ? "bg-surface text-primary" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
            {tab === "xray" && (
              <XrayPanel
                segment={paused ? active : null}
                sourceLang={video.original_lang}
                targetLang={video.translation_lang}
                showWordAnalysis={showWordAnalysis}
                showTranslation={display !== "original"}
                onSaveWord={(w, t) => void save("word", w, t)}
                onReplayWord={() => active && seek(Math.max(active.start_sec, time - 1.2))}
              />
            )}
            {tab === "dialogue" && (
              <DialoguePanel
                segments={segments}
                activeId={active?.id ?? null}
                display={display}
                onSeek={(sec) => {
                  seek(sec);
                  void videoRef.current?.play();
                }}
              />
            )}
            {tab === "vocab" && <VocabularyPanel refreshKey={vocabKey} onSeek={seek} />}
          </div>
        </aside>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-surface-elevated px-4 py-2 text-sm shadow-panel animate-fade-up">
          {toast}
        </div>
      )}
    </main>
  );
}

function Control({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-1.5 transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
