export const PROCESSING_STAGES = [
  "Analyzing video",
  "Extracting audio",
  "Transcribing dialogue",
  "Detecting speakers",
  "Segmenting dialogue",
  "Translating",
  "Preparing Language X-Ray",
] as const;

interface Props {
  current: number;
  error?: string | null;
  onCancel?: () => void;
}

export function ProcessingScreen({ current, error, onCancel }: Props) {
  return (
    <div className="mx-auto w-full max-w-lg panel p-8 shadow-panel animate-fade-up">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Processing</p>
      <h2 className="mt-2 text-2xl font-semibold">Building your X-Ray layer</h2>

      <ul className="mt-8 space-y-4">
        {PROCESSING_STAGES.map((stage, i) => {
          const done = i < current;
          const active = i === current && !error;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={[
                  "size-2.5 rounded-full transition-all",
                  done ? "bg-xray" : active ? "bg-primary animate-pulse" : "bg-border",
                ].join(" ")}
              />
              <span
                className={[
                  "text-sm transition-colors",
                  done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {stage}
              </span>
              {active && <span className="ml-auto text-xs text-muted-foreground">working…</span>}
              {done && <span className="ml-auto text-xs text-xray">done</span>}
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-8 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
