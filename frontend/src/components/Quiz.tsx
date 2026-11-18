import React, { useState } from "react";
import type { QuizQuestion } from "../types";
import { Check, X } from "./Icons";

interface Props {
  questions: QuizQuestion[];
  bestScore: number | null;
  onFinish: (percent: number) => void;
}

export function Quiz({ questions, bestScore, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (!questions.length) {
    return <p className="empty">Not enough distinct key terms to build a quiz. Try longer notes.</p>;
  }

  const q = questions[index];
  const answered = picked !== null;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    if (i === q.answer) setCorrect((c) => c + 1);
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setPicked(null);
    } else {
      setDone(true);
      onFinish(Math.round((correct / questions.length) * 100));
    }
  }

  function restart() {
    setIndex(0); setPicked(null); setCorrect(0); setDone(false);
  }

  if (done) {
    const percent = Math.round((correct / questions.length) * 100);
    const verdict = percent >= 85 ? "Excellent work!" : percent >= 60 ? "Solid. A bit more review and you've got it." : "Keep going. Flip through the flashcards, then try again.";
    return (
      <div className="quiz-result glass">
        <div className="score-ring" style={{ ["--p" as string]: percent } as React.CSSProperties}>
          <span>{percent}%</span>
        </div>
        <h3>{correct} of {questions.length} correct</h3>
        <p>{verdict}</p>
        {bestScore !== null && <small>Best score: {Math.max(bestScore, percent)}%</small>}
        <button className="primary" onClick={restart}>Retake quiz</button>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz-progress">
        <span>Question {index + 1} of {questions.length}</span>
        <div className="steps">
          {questions.map((_, i) => <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />)}
        </div>
      </div>
      <h3 className="quiz-prompt">
        {q.prompt.split("_____").map((part, i, arr) => (
          <React.Fragment key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className={`blank ${answered ? (picked === q.answer ? "ok" : "bad") : ""}`}>
                {answered ? q.options[q.answer] : " ".repeat(10)}
              </span>
            )}
          </React.Fragment>
        ))}
      </h3>
      <div className="options">
        {q.options.map((opt, i) => {
          const state = !answered ? "" : i === q.answer ? "correct" : i === picked ? "wrong" : "dim";
          return (
            <button key={i} className={`option ${state}`} onClick={() => choose(i)} disabled={answered}>
              <kbd>{String.fromCharCode(65 + i)}</kbd>
              <span>{opt}</span>
              {state === "correct" && <Check size={16} />}
              {state === "wrong" && <X size={16} />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`feedback ${picked === q.answer ? "ok" : "bad"}`}>
          <strong>{picked === q.answer ? "Correct!" : "Not quite."}</strong>
          <p>{q.explanation}</p>
          <button className="primary" onClick={next} autoFocus>
            {index + 1 < questions.length ? "Next question" : "See results"}
          </button>
        </div>
      )}
    </div>
  );
}
