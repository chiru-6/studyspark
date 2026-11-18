import type { StudySet } from "./types";

const KEY = "studyspark.sets.v1";
const MAX_SETS = 30;

/** Study sets live in localStorage: private to this browser, no account needed. */
export function loadSets(): StudySet[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSets(sets: StudySet[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(sets.slice(0, MAX_SETS)));
    return true;
  } catch {
    return false; // storage full or disabled (e.g. private browsing)
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function flashcardsToCsv(set: StudySet): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = set.flashcards.map((c) => `${esc(c.front)},${esc(c.back)}`);
  return ["Front,Back", ...rows].join("\n");
}

export function download(filename: string, content: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
