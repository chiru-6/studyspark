import io
from pathlib import Path

import pytest

from studyspark.app import create_app
from studyspark.extract import ExtractionError, extract_text
from studyspark.nlp import (
    NotEnoughTextError,
    analyse,
    clean_text,
    split_sentences,
)

SAMPLE = (Path(__file__).parent.parent / "samples" / "cellular-respiration.md").read_text()


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


# --------------------------------------------------------------------- text prep
def test_clean_text_joins_wrapped_lines_and_hyphenation():
    raw = "Photosynthesis Basics\nPlants convert light\ninto chemi-\ncal energy. Next one."
    assert clean_text(raw) == (
        "Photosynthesis Basics\nPlants convert light into chemical energy. Next one."
    )


def test_markdown_is_stripped():
    out = clean_text("# Title\n\n- **Bold** item with a [link](http://x.y) here.")
    assert "#" not in out and "**" not in out and "http" not in out
    assert "Bold item with a link here." in out


def test_sentence_splitter_keeps_abbreviations_and_decimals():
    text = "Dr. Smith measured 3.5 mL of solution, e.g. in a flask. The result was clear to everyone."
    sentences = [s.text for s in split_sentences(text)]
    assert sentences == [
        "Dr. Smith measured 3.5 mL of solution, e.g. in a flask.",
        "The result was clear to everyone.",
    ]


# --------------------------------------------------------------------- analysis
def test_analyse_sample_produces_every_section():
    result = analyse(SAMPLE, seed=7)
    assert result["stats"]["words"] > 300
    assert 3 <= len(result["summary"]) <= 15
    terms = [t["term"].lower() for t in result["key_terms"]]
    assert "krebs cycle" in terms and "electron transport chain" in terms
    assert len(result["flashcards"]) >= 5
    assert len(result["quiz"]) >= 5


def test_summary_sentences_come_from_the_source_in_order():
    result = analyse(SAMPLE)
    positions = [SAMPLE.find(s) for s in result["summary"]]
    assert all(p >= 0 for p in positions)
    assert positions == sorted(positions)


def test_summary_length_option_changes_size():
    short = analyse(SAMPLE, length="short")["summary"]
    long = analyse(SAMPLE, length="long")["summary"]
    assert len(short) < len(long)


def test_definition_flashcards_are_detected():
    fronts = [c["front"] for c in analyse(SAMPLE)["flashcards"]]
    assert "What is cellular respiration?" in fronts
    assert "What is the Krebs cycle?" in fronts


def test_quiz_questions_are_well_formed():
    for q in analyse(SAMPLE, seed=3)["quiz"]:
        assert "_____" in q["prompt"]
        assert len(q["options"]) == 4
        assert len({o.lower() for o in q["options"]}) == 4, "options must be distinct"
        assert 0 <= q["answer"] < 4
        filled = q["prompt"].replace("_____", q["options"][q["answer"]], 1)
        assert filled.lower() == q["explanation"].lower()


def test_quiz_is_deterministic_with_seed():
    assert analyse(SAMPLE, seed=42)["quiz"] == analyse(SAMPLE, seed=42)["quiz"]


def test_short_text_is_rejected():
    with pytest.raises(NotEnoughTextError):
        analyse("Too short to study.")


# --------------------------------------------------------------------- extraction
def test_extract_docx():
    import docx

    document = docx.Document()
    for para in SAMPLE.split("\n\n"):
        document.add_paragraph(para)
    buf = io.BytesIO()
    document.save(buf)
    text = extract_text("notes.docx", buf.getvalue())
    assert "Krebs cycle" in text


def test_extract_pdf():
    reportlab = pytest.importorskip("reportlab")  # noqa: F841
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=letter)
    y = 740
    for line in ["Glycolysis splits glucose into two molecules of pyruvate.",
                 "The Krebs cycle releases carbon dioxide as a waste product."]:
        pdf.drawString(72, y, line)
        y -= 20
    pdf.save()
    text = extract_text("notes.pdf", buf.getvalue())
    assert "pyruvate" in text and "Krebs" in text


@pytest.mark.parametrize("name,data,message", [
    ("virus.exe", b"MZ", "Unsupported"),
    ("empty.txt", b"   ", "No text"),
    ("broken.pdf", b"%PDF-not really", "Couldn't read"),
])
def test_extract_rejects_bad_files(name, data, message):
    with pytest.raises(ExtractionError, match=message):
        extract_text(name, data)


# --------------------------------------------------------------------- API
def test_health(client):
    assert client.get("/api/health").get_json()["status"] == "ok"


def test_analyze_json(client):
    res = client.post("/api/analyze", json={"text": SAMPLE, "length": "short"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["title"] == "Cellular Respiration"
    assert res.headers["Cache-Control"] == "no-store"
    assert res.headers["X-Content-Type-Options"] == "nosniff"


def test_analyze_upload(client):
    res = client.post(
        "/api/analyze",
        data={"file": (io.BytesIO(SAMPLE.encode()), "bio-lecture.md"), "length": "long"},
        content_type="multipart/form-data",
    )
    assert res.status_code == 200
    assert res.get_json()["title"] == "bio-lecture"


@pytest.mark.parametrize("payload,status", [
    ({"text": "short"}, 422),
    ({"text": SAMPLE, "length": "huge"}, 400),
    ({"text": 123}, 400),
])
def test_analyze_errors(client, payload, status):
    res = client.post("/api/analyze", json=payload)
    assert res.status_code == status
    assert "error" in res.get_json()


def test_unknown_api_route_is_json_404(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    assert res.get_json()["error"]
