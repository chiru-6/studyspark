"""Offline NLP for StudySpark.

Everything here runs locally with scikit-learn and NetworkX, so the app needs
no paid AI API and no network access:

* summarize()      extractive TextRank summary over TF-IDF sentence vectors
* key_terms()      TF-IDF n-gram ranking with overlap removal
* flashcards()     definition-pattern mining, with key-term fallbacks
* quiz()           fill-in-the-blank multiple choice with key-term distractors
"""

from __future__ import annotations

import math
import random
import re
from dataclasses import asdict, dataclass

import networkx as nx
import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

MIN_WORDS = 40  # below this there isn't enough material to study from
MAX_CHARS = 200_000
WORDS_PER_MINUTE = 230

_ABBREVIATIONS = {
    "e.g", "i.e", "etc", "vs", "mr", "mrs", "ms", "dr", "prof", "sr", "jr",
    "st", "fig", "no", "vol", "al", "approx", "inc", "ltd", "co", "u.s",
}
_STOP = set(ENGLISH_STOP_WORDS) | {
    "also", "however", "thus", "therefore", "may", "can", "will", "one", "two",
    "use", "used", "using", "called", "known", "example", "include", "includes",
    "including", "many", "much", "often", "usually", "like", "way", "ways",
    "new", "different", "important", "various", "certain", "make", "makes",
    # generic verbs/nouns that rank high in TF-IDF but make poor study terms
    "produce", "produces", "produced", "producing", "process", "processes",
    "uses", "form", "forms", "provide", "provides", "contain", "contains",
    "require", "requires", "create", "creates", "take", "takes", "place",
    "occur", "occurs", "allow", "allows", "help", "helps", "based", "large",
    "small", "main", "number", "amount", "amounts", "type", "types", "part",
    "parts", "result", "results", "called", "described", "means", "rely",
}
_DEFINITION = re.compile(
    r"^(?P<article>an?\s+|the\s+)?(?P<term>[A-Za-z][\w\-\s()/]{1,60}?)\s*,?\s+"
    r"(?P<verb>is defined as|refers to|is known as|is called|are called|means|"
    r"is|are|was|were)\s+(?P<body>.{12,})$",
    re.IGNORECASE,
)


class NotEnoughTextError(ValueError):
    """Raised when the input is too short to analyse."""


@dataclass
class Sentence:
    index: int
    text: str


# --------------------------------------------------------------------------- #
# Text preparation
# --------------------------------------------------------------------------- #
def clean_text(raw: str) -> str:
    """Normalise whitespace and repair words hyphenated across line breaks."""
    text = raw.replace("\r", "\n").replace("­", "")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)          # hyphen-\nated
    text = re.sub(r"[ \t\f\v]+", " ", text)
    # Markdown headings become stand-alone lines; other Markdown syntax is dropped.
    text = re.sub(r"(?m)^\s*#{1,6}\s+(.*)$", r"\n\1\n", text)
    text = re.sub(r"(?m)^\s*([-*+•]|\d+[.)])\s+", "\n", text)
    text = re.sub(r"(\*\*|__|`)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    # A newline after sentence-ending punctuation, or after a short title-like
    # line that starts a paragraph, is a real break; otherwise it's a line wrap.
    lines = [ln.strip() for ln in text.split("\n")]
    out: list[str] = []
    for i, line in enumerate(lines):
        if not line:
            out.append("\n")
            continue
        prev = out[-1] if out else "\n"
        if prev != "\n" and not re.search(r"[.!?:;]$", prev) and not _is_title(lines, i - 1):
            out[-1] = prev + " " + line
        else:
            out.append(line)
    joined = "\n".join(part for part in out if part != "\n")
    return joined.strip()[:MAX_CHARS]


def _is_title(lines: list[str], i: int) -> bool:
    """A short unpunctuated line that opens a block and is followed by a line
    starting with a capital letter (e.g. 'Photosynthesis Basics')."""
    if i < 0 or not lines[i]:
        return False
    line = lines[i]
    opens_block = i == 0 or not lines[i - 1]
    nxt = lines[i + 1] if i + 1 < len(lines) else ""
    return (opens_block and len(line.split()) <= 8
            and not re.search(r"[.!?:;,]$", line) and nxt[:1].isupper())


def split_sentences(text: str) -> list[Sentence]:
    """Split text into sentences, keeping abbreviations and decimals intact."""
    sentences: list[str] = []
    for block in text.split("\n"):
        start = 0
        for match in re.finditer(r"[.!?]+[\"')\]]*\s+(?=[A-Z0-9\"'(\[])", block):
            candidate = block[start:match.end()].strip()
            last_word = re.findall(r"([A-Za-z.]+)[.!?]+[\"')\]]*\s*$", candidate)
            if last_word and last_word[0].lower().rstrip(".") in _ABBREVIATIONS:
                continue
            if last_word and re.fullmatch(r"[A-Z]", last_word[0].rstrip(".")):
                continue  # initials such as "J. Smith"
            sentences.append(candidate)
            start = match.end()
        tail = block[start:].strip()
        if tail:
            sentences.append(tail)

    result = []
    for s in sentences:
        words = s.split()
        if 5 <= len(words) <= 80 and re.search(r"[a-zA-Z]{3}", s):
            result.append(Sentence(len(result), s))
    return result


def stats(text: str) -> dict:
    words = re.findall(r"\b\w+\b", text)
    return {
        "words": len(words),
        "sentences": len(split_sentences(text)),
        "reading_minutes": max(1, math.ceil(len(words) / WORDS_PER_MINUTE)),
    }


def _prepare(raw: str) -> tuple[str, list[Sentence]]:
    text = clean_text(raw or "")
    if len(re.findall(r"\b\w+\b", text)) < MIN_WORDS:
        raise NotEnoughTextError(
            f"Please provide at least {MIN_WORDS} words of notes to study from."
        )
    sentences = split_sentences(text)
    if len(sentences) < 3:
        raise NotEnoughTextError(
            "Couldn't find enough complete sentences. Try notes written in full sentences."
        )
    return text, sentences


# --------------------------------------------------------------------------- #
# Summary
# --------------------------------------------------------------------------- #
def _sentence_vectors(sentences: list[Sentence]):
    vectorizer = TfidfVectorizer(stop_words=list(_STOP), sublinear_tf=True)
    return vectorizer.fit_transform([s.text for s in sentences])


def summarize(sentences: list[Sentence], length: str = "medium") -> list[str]:
    """Rank sentences with TextRank and return the best ones in reading order."""
    ratio = {"short": 0.12, "medium": 0.22, "long": 0.35}.get(length, 0.22)
    count = min(len(sentences), max(2, round(len(sentences) * ratio)))
    count = min(count, 15)
    if len(sentences) <= count:
        return [s.text for s in sentences]

    try:
        matrix = _sentence_vectors(sentences)
    except ValueError:  # vocabulary made only of stop words
        return [s.text for s in sentences[:count]]

    similarity = cosine_similarity(matrix)
    np.fill_diagonal(similarity, 0.0)
    graph = nx.from_numpy_array(similarity)
    try:
        scores = nx.pagerank(graph, max_iter=200)
    except nx.PowerIterationFailedConvergence:
        scores = {i: float(similarity[i].sum()) for i in range(len(sentences))}

    # Small bonus for early sentences: intros usually state the main idea.
    for i in scores:
        scores[i] *= 1.0 + 0.15 / (1 + i)

    best = sorted(scores, key=scores.get, reverse=True)[:count]
    return [sentences[i].text for i in sorted(best)]


# --------------------------------------------------------------------------- #
# Key terms
# --------------------------------------------------------------------------- #
def _valid_term(term: str) -> bool:
    words = term.split()
    if words[0] in _STOP or words[-1] in _STOP:
        return False
    if any(w.isdigit() or len(w) < 3 and len(words) == 1 for w in words):
        return False
    return len(term) >= 4


def key_terms(sentences: list[Sentence], limit: int = 12) -> list[dict]:
    """Return the most characteristic 1–3 word terms with an example sentence."""
    docs = [s.text for s in sentences]
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]+\b",
        sublinear_tf=True,
        lowercase=True,
    )
    try:
        matrix = vectorizer.fit_transform(docs)
    except ValueError:
        return []
    vocab = vectorizer.get_feature_names_out()
    scores = np.asarray(matrix.sum(axis=0)).ravel()
    doc_freq = np.asarray((matrix > 0).sum(axis=0)).ravel()

    ranked = []
    for idx in np.argsort(-scores):
        term = vocab[idx]
        if not _valid_term(term):
            continue
        n_words = len(term.split())
        # Multi-word phrases must repeat to count as real terms, not accidents.
        if n_words > 1 and doc_freq[idx] < 2:
            continue
        ranked.append((term, float(scores[idx]) * (1 + 0.35 * (n_words - 1))))
    ranked.sort(key=lambda t: t[1], reverse=True)

    chosen: list[tuple[str, float]] = []
    for term, score in ranked:
        if any(term in other or other in term for other, _ in chosen):
            continue
        chosen.append((term, score))
        if len(chosen) == limit:
            break

    top = chosen[0][1] if chosen else 1.0
    results = []
    for term, score in chosen:
        example = _best_sentence_for(term, sentences)
        results.append({
            "term": _display_case(term, example),
            "score": round(score / top, 3),
            "example": example,
        })
    return results


def _best_sentence_for(term: str, sentences: list[Sentence]) -> str:
    pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
    hits = [s.text for s in sentences if pattern.search(s.text)]
    if not hits:
        return ""
    # Prefer sentences that define the term, then medium-length ones.
    def rank(s: str) -> tuple:
        defines = bool(re.search(
            rf"\b{re.escape(term)}\b\s*,?\s+(is|are|refers to|means)\b", s, re.IGNORECASE))
        return (not defines, abs(len(s.split()) - 22))
    return sorted(hits, key=rank)[0]


def _display_case(term: str, sentence: str) -> str:
    """Use the casing from the text (e.g. 'DNA', 'Krebs cycle'), ignoring the
    capital letter that only appears because a sentence starts with the term."""
    for match in re.finditer(rf"\b{re.escape(term)}\b", sentence, re.IGNORECASE):
        found = match.group(0)
        if match.start() == 0 and found[1:] == found[1:].lower():
            continue
        return found
    return term


# --------------------------------------------------------------------------- #
# Flashcards
# --------------------------------------------------------------------------- #
def flashcards(sentences: list[Sentence], terms: list[dict], limit: int = 12) -> list[dict]:
    cards: list[dict] = []
    seen: set[str] = set()
    used_backs: set[str] = set()

    for s in sentences:
        match = _DEFINITION.match(s.text)
        if not match:
            continue
        term = match.group("term").strip(" ,")
        words = term.split()
        if not (1 <= len(words) <= 5) or words[0].lower() in _STOP - {"the"}:
            continue
        if term.lower() in {"it", "this", "that", "they", "these", "there", "he", "she"}:
            continue
        if any(w.lower() in {"it", "this", "they", "which", "there"} for w in words):
            continue
        key = term.lower()
        if key in seen:
            continue
        seen.add(key)
        verb = match.group("verb").lower()
        plural = verb in {"are", "were", "are called"}
        if not match.group("article") and term[1:] == term[1:].lower() and not term.isupper():
            term = term[0].lower() + term[1:]  # capital only came from sentence start
        article = "the " if (match.group("article") or "").lower().strip() == "the" else ""
        used_backs.add(s.text)
        cards.append({
            "front": f"What {'are' if plural else 'is'} {article}{term}?",
            "back": _sentence_case(match.group("body").rstrip(".")) + ".",
            "source": s.text,
            "kind": "definition",
        })
        if len(cards) >= limit:
            return cards

    for t in terms:
        if len(cards) >= limit:
            break
        if t["term"].lower() in seen or not t["example"] or t["example"] in used_backs:
            continue
        seen.add(t["term"].lower())
        used_backs.add(t["example"])
        cards.append({
            "front": f"Explain “{t['term']}” in context.",
            "back": t["example"],
            "source": t["example"],
            "kind": "concept",
        })
    return cards


def _sentence_case(text: str) -> str:
    return text[:1].upper() + text[1:] if text else text


# --------------------------------------------------------------------------- #
# Quiz
# --------------------------------------------------------------------------- #
def quiz(sentences: list[Sentence], terms: list[dict], limit: int = 8,
         seed: int | None = None) -> list[dict]:
    """Build fill-in-the-blank questions, using other key terms as distractors."""
    rng = random.Random(seed)
    pool = [t["term"] for t in terms]
    questions: list[dict] = []
    used_sentences: set[str] = set()

    for t in terms:
        if len(questions) >= limit:
            break
        term = t["term"]
        pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
        candidates = [s.text for s in sentences
                      if pattern.search(s.text) and s.text not in used_sentences
                      and len(s.text.split()) >= 7]
        if not candidates:
            continue
        sentence = sorted(candidates, key=lambda s: abs(len(s.split()) - 20))[0]
        answer = term  # consistent casing across options; never hint via a capital
        prompt = pattern.sub("_____", sentence, count=1)

        distractors = _pick_distractors(term, pool, rng)
        if len(distractors) < 3:
            continue
        options = [answer] + distractors
        rng.shuffle(options)
        used_sentences.add(sentence)
        questions.append({
            "prompt": prompt,
            "options": options,
            "answer": options.index(answer),
            "explanation": sentence,
        })
    return questions


def _pick_distractors(term: str, pool: list[str], rng: random.Random) -> list[str]:
    n_words = len(term.split())
    others = [p for p in pool if p.lower() != term.lower()
              and p.lower() not in term.lower() and term.lower() not in p.lower()]
    same_shape = [p for p in others if len(p.split()) == n_words]
    rest = [p for p in others if p not in same_shape]
    rng.shuffle(same_shape)
    rng.shuffle(rest)
    return (same_shape + rest)[:3]


# --------------------------------------------------------------------------- #
# One-call entry point used by the API
# --------------------------------------------------------------------------- #
def analyse(raw: str, length: str = "medium", seed: int | None = None) -> dict:
    text, sentences = _prepare(raw)
    terms = key_terms(sentences)
    return {
        "stats": stats(text),
        "summary": summarize(sentences, length),
        "key_terms": terms,
        "flashcards": flashcards(sentences, terms),
        "quiz": quiz(sentences, terms, seed=seed),
    }


__all__ = [
    "NotEnoughTextError", "analyse", "clean_text", "split_sentences", "summarize",
    "key_terms", "flashcards", "quiz", "stats", "Sentence", "asdict",
]
