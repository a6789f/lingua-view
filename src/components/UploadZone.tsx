import { useRef, useState } from "react";

const ACCEPTED = ["video/mp4", "video/webm", "video/quicktime"];

export function UploadZone({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = (file?: File | null) => {
    if (!file) return;
    const ok = ACCEPTED.includes(file.type) || /\.(mp4|webm|mov)$/i.test(file.name);
    if (!ok) {
      setError("Unsupported format. Use MP4, WebM or MOV.");
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          "cursor-pointer rounded-2xl border border-dashed p-12 text-center transition-all",
          over
            ? "border-xray bg-surface-elevated shadow-glow"
            : "border-border bg-surface hover:border-primary/60 hover:bg-surface-elevated",
        ].join(" ")}
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-surface-elevated text-primary">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4m0 0 4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="mt-4 text-base font-medium">Drop a video here</p>
        <p className="mt-1 text-sm text-muted-foreground">MP4, WebM or MOV — analysed locally, audio only is sent for AI processing</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mov"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
