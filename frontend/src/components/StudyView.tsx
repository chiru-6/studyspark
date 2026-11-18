import { useMemo, useState } from "react";
import type { StudySet } from "../types";
import { download, flashcardsToCsv } from "../storage";
import { Flashcards } from "./Flashcards";
import { Quiz } from "./Quiz";
import { Copy, Download, Trash } from "./Icons";

type Tab = "summary" | "terms" | "cards" | "quiz";

interface Props {
  set: StudySet;
  onUpdate: (patch: Partial<StudySet>) => void;
  onDelete: () => void;
}

export function StudyView({ set, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState(false);

  const termRegex = useMemo(() => {
    const terms = set.key_terms.map((t) => t.term).sort((a, b) => b.length - a.length);
    if (!terms.length) return null;
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  }, [set.key_terms]);

  function highlight(sentence: string) {
    if (!termRegex) return sentence;
    const parts = sentence.split(termRegex);
    return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p));
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(set.summary.map((s) => `• ${s}`).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "summary", label: "Summary", count: set.summary.length },
    { id: "terms", label: "Key terms", count: set.key_terms.length },
    { id: "cards", label: "Flashcards", count: set.flashcards.length },
    { id: "quiz", label: "Quiz", count: set.quiz.length },
  ];

  return (
    <section className="study">
      <header className="study-head">
        <div>
          <input
            className="study-title"
            value={set.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            aria-label="Study set title"
          />
          <div className="chips">
            <span className="chip">{set.stats.words.toLocaleString()} words</span>
            <span className="chip">{set.stats.reading_minutes} min read</span>
            <span className="chip">{set.flashcards.length} cards</span>
            <span className="chip">{set.quiz.length} questions</span>
            {set.bestScore !== null && <span className="chip accent">Best quiz: {set.bestScore}%</span>}
          </div>
        </div>
        <div className="head-actions">
          <button className="ghost" onClick={() => download(`${slug(set.title)}-flashcards.csv`, flashcardsToCsv(set))}
            title="CSV works with Anki and Quizlet import">
            <Download size={15} /> Export cards
          </button>
          <button className="icon-btn" onClick={() => { if (confirm("Delete this study set?")) onDelete(); }}
            aria-label="Delete study set" title="Delete study set">
            <Trash size={16} />
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}<span className="count">{t.count}</span>
          </button>
        ))}
      </nav>

      <div className="panel glass" role="tabpanel">
        {tab === "summary" && (
          <div className="summary">
            <div className="panel-head">
              <h2>The big picture</h2>
              <button className="ghost" onClick={copySummary}><Copy size={15} /> {copied ? "Copied!" : "Copy"}</button>
            </div>
            <ol>
              {set.summary.map((s, i) => <li key={i}>{highlight(s)}</li>)}
            </ol>
            <p className="hint">Highlighted words are the key terms StudySpark found.</p>
          </div>
        )}

        {tab === "terms" && (
          <div className="terms">
            {set.key_terms.length === 0 && <p className="empty">No key terms found.</p>}
            {set.key_terms.map((t, i) => (
              <article key={t.term} className="term" style={{ animationDelay: `${i * 35}ms` }}>
                <div className="term-top">
                  <h3>{t.term}</h3>
                  <div className="relevance" title={`Relevance ${Math.round(t.score * 100)}%`}>
                    <i style={{ width: `${Math.max(8, t.score * 100)}%` }} />
                  </div>
                </div>
                {t.example && <p>{highlight(t.example)}</p>}
              </article>
            ))}
          </div>
        )}

        {tab === "cards" && (
          <Flashcards key={set.id} cards={set.flashcards} known={set.known} onKnownChange={(known) => onUpdate({ known })} />
        )}

        {tab === "quiz" && (
          <Quiz key={set.id} questions={set.quiz} bestScore={set.bestScore}
            onFinish={(p) => onUpdate({ bestScore: Math.max(p, set.bestScore ?? 0) })} />
        )}
      </div>
    </section>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study-set";
}
