import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingScreen, PROCESSING_STAGES } from "@/components/ProcessingScreen";
import { VocabularyPanel } from "@/components/VocabularyPanel";
import { extractWavFromVideo } from "@/lib/audio";
import { translateSentences } from "@/lib/xray.functions";
import {
  createVideo,
  insertSegments,
  LANGUAGES,
  langLabel,
  listVideos,
  rememberLocalVideo,
  type VideoRow,
} from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Language X-Ray — turn any video into a language lesson" },
      {
        name: "description",
        content:
          "Drop in a video and get AI transcription, timestamps, translations and word-by-word analysis in a cinematic player.",
      },
      { property: "og:title", content: "Language X-Ray" },
      {
        property: "og:description",
        content: "AI subtitles, translations and contextual word analysis layered over your videos.",
      },
    ],
  }),
  component: Home,
});

interface RawSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

function Home() {
  const navigate = useNavigate();
  const translate = useServerFn(translateSentences);

  const [sourceLang, setSourceLang] = useState("ru");
  const [targetLang, setTargetLang] = useState("en");
  const [stage, setStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [showVocab, setShowVocab] = useState(false);

  useEffect(() => {
    listVideos()
      .then(setVideos)
      .catch(() => setVideos([]));
  }, []);

  async function process(file: File) {
    setError(null);
    setStage(0);
    try {
      // 1. Analyzing video — read metadata.
      const objectUrl = URL.createObjectURL(file);
      const duration = await readDuration(objectUrl);

      // 2. Extracting audio locally (only audio leaves the browser).
      setStage(1);
      const wav = await extractWavFromVideo(file);

      // 3-5. Transcription, speaker detection and segmentation.
      setStage(2);
      const form = new FormData();
      form.append("audio", wav, "audio.wav");
      form.append("sourceLang", langLabel(sourceLang));
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const payload = (await res.json()) as { segments?: RawSegment[]; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Transcription failed");
      const segments = payload.segments ?? [];
      if (segments.length === 0) throw new Error("No dialogue was detected in this video's audio.");
      setStage(4);

      // 6. Translating.
      setStage(5);
      const { translations } = await translate({
        data: {
          sentences: segments.map((s) => s.text),
          sourceLang: langLabel(sourceLang),
          targetLang: langLabel(targetLang),
        },
      });

      // 7. Persist and prepare the X-Ray layer.
      setStage(6);
      const video = await createVideo({
        title: file.name.replace(/\.[^.]+$/, ""),
        original_lang: sourceLang,
        translation_lang: targetLang,
        duration_sec: duration,
      });
      await insertSegments(
        video.id,
        segments.map((s, i) => ({
          idx: i,
          speaker: s.speaker,
          text: s.text,
          translation: translations[i] ?? "",
          start_sec: s.start,
          end_sec: s.end,
        })),
      );
      rememberLocalVideo(video.id, objectUrl);
      navigate({ to: "/watch/$videoId", params: { videoId: video.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
    }
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-xray shadow-glow" />
          <span className="font-display text-sm font-semibold tracking-tight">Language X-Ray</span>
        </div>
        <button
          onClick={() => setShowVocab((v) => !v)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent"
        >
          My Vocabulary
        </button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <h1 className="text-balance text-center text-4xl font-semibold leading-tight sm:text-5xl">
          Watch a film. <span className="text-primary">Read the language.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Upload a video and Language X-Ray transcribes the dialogue, times it, translates it and lets you inspect any
          word in its real context — an intelligent layer over normal viewing.
        </p>

        {stage !== null ? (
          <div className="mt-12">
            <ProcessingScreen
              current={stage}
              error={error}
              onCancel={() => {
                setStage(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <LangSelect label="Original / learning language" value={sourceLang} onChange={setSourceLang} />
              <LangSelect label="Translation language" value={targetLang} onChange={setTargetLang} />
            </div>

            <div className="mt-6">
              <UploadZone onFile={process} />
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </>
        )}

        {showVocab && (
          <div className="mt-10 panel">
            <p className="border-b border-border px-5 py-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              My Vocabulary
            </p>
            <VocabularyPanel refreshKey={0} />
          </div>
        )}

        {videos.length > 0 && (
          <div className="mt-14">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Library</p>
            <ul className="mt-4 space-y-2">
              {videos.map((v) => (
                <li key={v.id}>
                  <Link
                    to="/watch/$videoId"
                    params={{ videoId: v.id }}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-elevated"
                  >
                    <span className="truncate text-sm">{v.title}</span>
                    <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                      {v.is_demo ? "Demo · " : ""}
                      {langLabel(v.original_lang)} → {langLabel(v.translation_lang)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function LangSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function readDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => resolve(null);
    el.src = url;
  });
}
