import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Flashcard } from "../types";
import { Check, ChevronLeft, ChevronRight, Shuffle } from "./Icons";

interface Props {
  cards: Flashcard[];
  known: number[];
  onKnownChange: (known: number[]) => void;
}

export function Flashcards({ cards, known, onKnownChange }: Props) {
  const [order, setOrder] = useState<number[]>(() => cards.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [onlyUnknown, setOnlyUnknown] = useState(false);

  const deck = useMemo(
    () => (onlyUnknown ? order.filter((i) => !known.includes(i)) : order),
    [order, known, onlyUnknown],
  );
  const current = deck[Math.min(pos, Math.max(deck.length - 1, 0))];
  const card = current !== undefined ? cards[current] : undefined;

  const go = useCallback((delta: number) => {
    setFlipped(false);
    setPos((p) => (deck.length ? (p + delta + deck.length) % deck.length : 0));
  }, [deck.length]);

  const mark = useCallback((isKnown: boolean) => {
    if (current === undefined) return;
    const next = isKnown
      ? Array.from(new Set([...known, current]))
      : known.filter((k) => k !== current);
    onKnownChange(next);
    if (!onlyUnknown || !isKnown) go(1);
    else setFlipped(false);
  }, [current, known, onKnownChange, go, onlyUnknown]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key.toLowerCase() === "k") mark(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, mark]);

  if (!cards.length) return <p className="empty">No flashcards could be made from this text.</p>;

  const progress = Math.round((known.length / cards.length) * 100);

  return (
    <div className="flash">
      <div className="flash-toolbar">
        <div className="mastery">
          <div className="bar"><i style={{ width: `${progress}%` }} /></div>
          <span>{known.length}/{cards.length} mastered</span>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyUnknown}
            onChange={(e) => { setOnlyUnknown(e.target.checked); setPos(0); setFlipped(false); }} />
          Review unmastered only
        </label>
        <button className="ghost" onClick={() => {
          const shuffled = [...order].sort(() => Math.random() - 0.5);
          setOrder(shuffled); setPos(0); setFlipped(false);
        }}><Shuffle size={15} /> Shuffle</button>
      </div>

      {card ? (
        <>
          <button
            className={`card3d ${flipped ? "flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Show question" : "Show answer"}
          >
            <div className="face front">
              <span className="face-label">{card.kind === "definition" ? "Definition" : "Concept"}</span>
              <p>{card.front}</p>
              <small>Click or press Space to flip</small>
            </div>
            <div className="face back">
              <span className="face-label">Answer</span>
              <p>{card.back}</p>
              {current !== undefined && known.includes(current) && <span className="known-badge"><Check size={13} /> Mastered</span>}
            </div>
          </button>

          <div className="flash-nav">
            <button className="icon-btn big" onClick={() => go(-1)} aria-label="Previous card"><ChevronLeft /></button>
            <span className="counter">{Math.min(pos, deck.length - 1) + 1} / {deck.length}</span>
            <button className="icon-btn big" onClick={() => go(1)} aria-label="Next card"><ChevronRight /></button>
          </div>
          <div className="flash-actions">
            <button className="ghost danger" onClick={() => mark(false)}>Still learning</button>
            <button className="primary" onClick={() => mark(true)}><Check size={15} /> I know this</button>
          </div>
        </>
      ) : (
        <div className="celebrate glass">
          <h3>🎉 Every card mastered</h3>
          <p>Turn off “Review unmastered only” to go through the full deck again.</p>
        </div>
      )}
    </div>
  );
}
