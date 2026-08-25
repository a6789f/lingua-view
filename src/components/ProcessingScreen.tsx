export const PROCESSING_STAGES = [
  "Preparing video",
  "Extracting audio",
  "Uploading audio",
  "Transcribing dialogue",
  "Processing timestamps",
  "Translating dialogue",
  "Preparing Language X-Ray",
] as const;

interface Props {
  current: number;
  detail?: string | null;
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function ProcessingScreen({ current, detail, error, onRetry, onCancel }: Props) {
  return (
    <div className="mx-auto w-full max-w-lg panel p-8 shadow-panel animate-fade-up">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Processing your upload</p>
      <h2 className="mt-2 text-2xl font-semibold">Building your X-Ray layer</h2>

      <ul className="mt-8 space-y-4">
        {PROCESSING_STAGES.map((stage, i) => {
          const done = i < current;
          const active = i === current && !error;
          const failed = i === current && !!error;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={[
                  "size-2.5 rounded-full transition-all",
                  done ? "bg-xray" : failed ? "bg-destructive" : active ? "bg-primary animate-pulse" : "bg-border",
                ].join(" ")}
              />
              <span
                className={[
                  "text-sm transition-colors",
                  done ? "text-foreground" : failed ? "text-destructive" : active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {stage}
              </span>
              {active && (
                <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{detail ?? "working…"}</span>
              )}
              {failed && <span className="ml-auto text-xs text-destructive">failed</span>}
              {done && <span className="ml-auto text-xs text-xray">done</span>}
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">Transcription failed</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            No demo dialogue is used as a substitute — this upload was not processed.
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        {error && onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs hover:bg-accent"
          >
            Retry
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {error ? "Back to upload" : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
