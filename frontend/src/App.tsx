import React, { useEffect, useState } from "react";
import { analyzeFile, analyzeText } from "./api";
import { loadSets, newId, saveSets } from "./storage";
import type { AnalysisResult, StudySet, SummaryLength } from "./types";
import { Composer } from "./components/Composer";
import { StudyView } from "./components/StudyView";
import { Github, Menu, Plus, Spark, X } from "./components/Icons";

const REPO_URL = "https://github.com/chiru-6/studyspark";

export function App() {
  const [sets, setSets] = useState<StudySet[]>(() => loadSets());
  const [activeId, setActiveId] = useState<string | null>(() => loadSets()[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setStorageWarning(!saveSets(sets));
  }, [sets]);

  const active = sets.find((s) => s.id === activeId) ?? null;

  async function run(task: () => Promise<AnalysisResult>, length: SummaryLength) {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      const set: StudySet = {
        ...result,
        id: newId(),
        createdAt: new Date().toISOString(),
        length,
        known: [],
        bestScore: null,
      };
      setSets((prev) => [set, ...prev]);
      setActiveId(set.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function update(id: string, patch: Partial<StudySet>) {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function remove(id: string) {
    setSets((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function select(id: string | null) {
    setActiveId(id);
    setDrawer(false);
    setError(null);
  }

  return (
    <div className="shell">
      <div className="aurora" aria-hidden><i /><i /><i /></div>

      <aside className={`sidebar glass ${drawer ? "open" : ""}`}>
        <div className="brand">
          <span className="logo"><Spark size={18} /></span>
          <span>StudySpark</span>
          <button className="icon-btn mobile-only" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={16} /></button>
        </div>
        <button className="primary wide" onClick={() => select(null)}><Plus size={16} /> New study set</button>
        <h4>Your study sets</h4>
        {sets.length === 0 && <p className="muted small">Sets you create are saved in this browser.</p>}
        <ul className="set-list">
          {sets.map((s) => {
            const mastered = s.flashcards.length ? Math.round((s.known.length / s.flashcards.length) * 100) : 0;
            return (
              <li key={s.id}>
                <button className={s.id === activeId ? "active" : ""} onClick={() => select(s.id)}>
                  <span className="set-title">{s.title || "Untitled"}</span>
                  <span className="set-meta">
                    {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    {" · "}{mastered}% mastered
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <a className="repo-link" href={REPO_URL} target="_blank" rel="noreferrer"><Github size={15} /> Source on GitHub</a>
      </aside>

      <main className="main">
        <div className="topbar mobile-only">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu /></button>
          <span className="brand-inline"><Spark size={16} /> StudySpark</span>
        </div>

        {storageWarning && (
          <p className="banner">Your browser isn't letting StudySpark save. Sets will disappear when you close this tab.</p>
        )}

        {active ? (
          <StudyView
            key={active.id}
            set={active}
            onUpdate={(patch) => update(active.id, patch)}
            onDelete={() => remove(active.id)}
          />
        ) : (
          <section className="hero">
            <span className="eyebrow"><Spark size={14} /> Free · No sign-up · Runs on local NLP</span>
            <h1>Turn your notes into<br /><span className="gradient-text">flashcards, quizzes & summaries.</span></h1>
            <p className="lede">
              Paste a lecture, drop in a PDF, and StudySpark pulls out the key ideas, builds
              flip cards and quizzes you on them, in seconds.
            </p>
            <Composer
              busy={busy}
              error={error}
              onText={(text, length, title) => run(() => analyzeText(text, length, title), length)}
              onFile={(file, length) => run(() => analyzeFile(file, length), length)}
            />
            <div className="features">
              <div><b>TextRank summaries</b><span>Graph-ranked key sentences, not random cuts</span></div>
              <div><b>Smart flashcards</b><span>Definitions are detected and turned into Q&amp;A</span></div>
              <div><b>Instant quizzes</b><span>Fill-in-the-blank with realistic distractors</span></div>
            </div>
          </section>
        )}
      </main>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
    </div>
  );
}
