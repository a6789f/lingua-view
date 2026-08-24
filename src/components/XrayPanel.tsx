import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeWord, explainSentence } from "@/lib/xray.functions";
import type { SegmentRow } from "@/lib/db";
import { langLabel } from "@/lib/db";

interface WordInfo {
  meaning: string;
  base: string;
  pronunciation: string;
  role: string;
  forms: string;
  context: string;
  example: string;
}

interface SentenceInfo {
  structure: string;
  grammar: string;
  expressions: string;
  tone: string;
  literal: string;
  natural: string;
}

interface Props {
  segment: SegmentRow | null;
  sourceLang: string;
  targetLang: string;
  showWordAnalysis: boolean;
  showTranslation: boolean;
  onSaveWord: (word: string, translation: string) => void;
  onReplayWord: () => void;
}

const tokenize = (text: string) => text.split(/(\s+)/).filter((t) => t.length > 0);
const clean = (token: string) => token.replace(/[^\p{L}\p{N}'’-]/gu, "");

export function XrayPanel({
  segment,
  sourceLang,
  targetLang,
  showWordAnalysis,
  showTranslation,
  onSaveWord,
  onReplayWord,
}: Props) {
  const runWord = useServerFn(analyzeWord);
  const runSentence = useServerFn(explainSentence);

  const [selected, setSelected] = useState<string | null>(null);
  const [word, setWord] = useState<WordInfo | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const [sentence, setSentence] = useState<SentenceInfo | null>(null);
  const [sentenceLoading, setSentenceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setWord(null);
    setSentence(null);
    setError(null);
  }, [segment?.id]);

  if (!segment) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Pause the video on a line of dialogue to open its X-Ray.
      </div>
    );
  }

  const pickWord = async (raw: string) => {
    const w = clean(raw);
    if (!w) return;
    setSelected(w);
    setWord(null);
    setError(null);
    setWordLoading(true);
    try {
      const res = await runWord({
        data: { word: w, sentence: segment.text, sourceLang: langLabel(sourceLang), targetLang: langLabel(targetLang) },
      });
      setWord(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse this word.");
    } finally {
      setWordLoading(false);
    }
  };

  const explain = async () => {
    setSentenceLoading(true);
    setError(null);
    try {
      const res = await runSentence({
        data: { sentence: segment.text, sourceLang: langLabel(sourceLang), targetLang: langLabel(targetLang) },
      });
      setSentence(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not explain this sentence.");
    } finally {
      setSentenceLoading(false);
    }
  };

  return (
    <div className="space-y-5 p-5">
      <section>
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Original — {segment.speaker}</p>
        <p className="mt-2 text-lg leading-relaxed">{segment.text}</p>
      </section>

      {showTranslation && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Translation</p>
          <p className="mt-2 text-sm text-muted-foreground">{segment.translation ?? "—"}</p>
        </section>
      )}

      {showWordAnalysis && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Word analysis</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tokenize(segment.text).map((token, i) =>
              clean(token) ? (
                <button
                  key={i}
                  onClick={() => pickWord(token)}
                  className={[
                    "rounded-md px-2 py-1 text-sm transition-colors",
                    selected === clean(token)
                      ? "bg-xray text-xray-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent",
                  ].join(" ")}
                >
                  {token.trim()}
                </button>
              ) : null,
            )}
          </div>
        </section>
      )}

      {wordLoading && <p className="text-sm text-muted-foreground">Analysing “{selected}” in context…</p>}

      {word && selected && (
        <div className="panel animate-fade-up space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-primary">{selected}</p>
              <p className="text-xs text-muted-foreground">{word.pronunciation}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onReplayWord}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                Replay
              </button>
              <button
                onClick={() => onSaveWord(selected, word.meaning)}
                className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Save word
              </button>
            </div>
          </div>
          <Row label="In this context" value={word.meaning} highlight />
          <Row label="Base form" value={word.base} />
          <Row label="Grammar role" value={word.role} />
          <Row label="Forms" value={word.forms} />
          <Row label="Why here" value={word.context} />
          <Row label="Example" value={word.example} />
        </div>
      )}

      <section className="space-y-3">
        <button
          onClick={explain}
          disabled={sentenceLoading}
          className="w-full rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
        >
          {sentenceLoading ? "Thinking…" : "Explain this sentence"}
        </button>

        {sentence && (
          <div className="panel animate-fade-up space-y-3 p-4">
            <Row label="Structure" value={sentence.structure} />
            <Row label="Grammar" value={sentence.grammar} />
            <Row label="Expressions" value={sentence.expressions} />
            <Row label="Tone" value={sentence.tone} />
            <Row label="Literal" value={sentence.literal} />
            <Row label="Natural" value={sentence.natural} highlight />
          </div>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={["mt-1 text-sm leading-relaxed", highlight ? "text-foreground" : "text-muted-foreground"].join(" ")}>
        {value}
      </p>
    </div>
  );
}
