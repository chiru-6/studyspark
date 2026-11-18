import React, { useRef, useState } from "react";
import type { SummaryLength } from "../types";
import { SAMPLE_NOTES, SAMPLE_TITLE } from "../sample";
import { FileText, Spark, Upload, X } from "./Icons";

interface Props {
  busy: boolean;
  error: string | null;
  onText: (text: string, length: SummaryLength, title: string) => void;
  onFile: (file: File, length: SummaryLength) => void;
}

const ACCEPT = ".pdf,.docx,.txt,.md";
const MIN_WORDS = 40;

export function Composer({ busy, error, onText, onFile }: Props) {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [length, setLength] = useState<SummaryLength>("medium");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const canSubmit = !busy && (mode === "paste" ? words >= MIN_WORDS : !!file);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (mode === "paste") onText(text, length, title);
    else if (file) onFile(file, length);
  }

  function pickFile(f: File | undefined | null) {
    if (f) {
      setFile(f);
      setMode("upload");
    }
  }

  return (
    <form className="composer glass" onSubmit={submit}>
      <div className="segmented" role="tablist" aria-label="Input method">
        <button type="button" role="tab" aria-selected={mode === "paste"}
          className={mode === "paste" ? "active" : ""} onClick={() => setMode("paste")}>
          <FileText size={16} /> Paste notes
        </button>
        <button type="button" role="tab" aria-selected={mode === "upload"}
          className={mode === "upload" ? "active" : ""} onClick={() => setMode("upload")}>
          <Upload size={16} /> Upload file
        </button>
      </div>

      {mode === "paste" ? (
        <>
          <input className="title-input" placeholder="Title (optional)" value={title}
            maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste lecture notes, a textbook section or an article…"
            aria-label="Notes"
            rows={10}
          />
          <div className="composer-meta">
            <span className={words && words < MIN_WORDS ? "warn" : ""}>
              {words.toLocaleString()} words{words > 0 && words < MIN_WORDS ? ` · need ${MIN_WORDS}+` : ""}
            </span>
            <button type="button" className="link" onClick={() => { setText(SAMPLE_NOTES); setTitle(SAMPLE_TITLE); }}>
              Try sample notes
            </button>
          </div>
        </>
      ) : (
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          role="button"
          tabIndex={0}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} hidden
            onChange={(e) => pickFile(e.target.files?.[0])} />
          {file ? (
            <div className="file-chip">
              <FileText size={18} />
              <span>{file.name}</span>
              <small>{(file.size / 1024).toFixed(0)} KB</small>
              <button type="button" className="icon-btn" aria-label="Remove file"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="drop-icon"><Upload size={26} /></div>
              <p><strong>Drop a file here</strong> or click to browse</p>
              <small>PDF, DOCX, TXT or Markdown · up to 10 MB</small>
            </>
          )}
        </div>
      )}

      <div className="composer-footer">
        <div className="length-picker" role="radiogroup" aria-label="Summary length">
          <span>Summary</span>
          {(["short", "medium", "long"] as SummaryLength[]).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={length === l}
              className={length === l ? "active" : ""} onClick={() => setLength(l)}>
              {l}
            </button>
          ))}
        </div>
        <button type="submit" className="primary" disabled={!canSubmit}>
          {busy ? <span className="spinner" aria-hidden /> : <Spark size={16} />}
          {busy ? "Generating…" : "Generate study set"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
