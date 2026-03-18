import base64
import io
import re
import logging
from typing import List

import pdfplumber
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="CV Extractor + Embedder + Reranker", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load models once at startup ───────────────────────────────────────────────

logger.info("Loading MiniLM embedding model...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
logger.info("✅ MiniLM ready")

logger.info("Loading cross-encoder reranking model...")
rerank_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
logger.info("✅ Cross-encoder ready")

# ──────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ──────────────────────────────────────────────────────────────────────────────

class ExtractRequest(BaseModel):
    pdf_base64: str


class ExtractResponse(BaseModel):
    text: str
    page_count: int
    char_count: int


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: List[float]
    dimensions: int


class RerankCandidate(BaseModel):
    candidateId: str
    name: str
    profileText: str


class RerankRequest(BaseModel):
    query: str
    candidates: List[RerankCandidate]


class RerankResult(BaseModel):
    candidateId: str
    name: str
    score: float


class RerankResponse(BaseModel):
    results: List[RerankResult]

# ──────────────────────────────────────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "minilm": "ready",
        "cross_encoder": "ready",
    }

# ──────────────────────────────────────────────────────────────────────────────
# ASSESSFIRST EXTRACTION
# ──────────────────────────────────────────────────────────────────────────────

LOW_MOTIVATOR_PHRASES = [
    "Working in a disciplined environment",
    "Having an attractive salary",
    "Focusing on aesthetics",
    "Working in a stable environment",
    "Performing repetitive tasks",
    "Having a high salary",
    "Working alone",
    "Managing others",
    "Following strict rules",
]

AF_TALENT_CLOUD = {
    "Influence": ["Build relationships", "Take the lead", "Unite and mobilise"],
    "Cooperate": ["Communicate with diplomacy", "Provide support", "Work collaboratively"],
    "Think": ["Anticipate challenges", "Develop a vision", "Innovate"],
    "Act": ["Take initiative", "Plan and organise", "Inspect and improve"],
    "Feel": ["Spread enthusiasm", "React swiftly", "Handle stress"],
}


def _af_extract(pdf_bytes: bytes) -> dict:

    pages_text = {}
    pages_obj  = {}

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            pages_text[i + 1] = (page.extract_text() or "").strip()
            pages_obj[i + 1]  = page

    r = {}

    # ── Page 1: Name + Date ───────────────────────────────────────────────
    p1 = pages_text.get(1, "")
    m = re.search(r"(.+?) - (\d{2}/\d{2}/\d{4})", p1)
    r["candidate_name"]  = m.group(1).strip() if m else None
    r["assessment_date"] = m.group(2).strip() if m else None

    # ── Page 2: Personal style, traits, improvements ──────────────────────
    p2 = pages_text.get(2, "")

    m = re.search(r"Personal style:\s*(\w+)", p2)
    r["personal_style"] = m.group(1).strip() if m else None

    # Description: stop at "Main strengths" — that section belongs elsewhere
    m = re.search(
        r"Personal style:\s*\w+\n(.+?)(?=Main strengths|#[A-Z]|Areas of improvement|\Z)",
        p2, re.DOTALL
    )
    if m:
        desc = m.group(1).strip()
        desc = re.sub(r"\nTunahan.*$", "", desc, flags=re.DOTALL).strip()
        r["personal_style_desc"] = desc
    else:
        r["personal_style_desc"] = None

    # Traits — only from page 2 to avoid talent cloud legend contamination
    r["traits"] = re.findall(r"#([A-Za-z][A-Za-z-]*)", p2)

    # Areas of improvement — page 2 only
    m = re.search(
        r"Areas of improvement\n(.+?)(?=Tunahan Koc \d|\Z)",
        p2, re.DOTALL
    )
    if m:
        raw = m.group(1)
        lines = [l.strip().lstrip("*").strip() for l in raw.split("\n") if l.strip()]
        merged, buf = [], ""
        for line in lines:
            if line.startswith("Tunahan"):
                continue
            if buf:
                if re.match(r"^He (could|would|should|might)", line):
                    merged.append(buf.strip())
                    buf = line
                else:
                    buf += " " + line
            else:
                buf = line
        if buf:
            merged.append(buf.strip())
        r["improvements"] = [x for x in merged if len(x) > 10]
    else:
        r["improvements"] = []

    # ── Talent cloud ──────────────────────────────────────────────────────
    r["talent_cloud"] = AF_TALENT_CLOUD

    # ── Dimension details — pages 4-8 individually ───────────────────────
    # Extract each dimension from its own page to avoid cross-page bleed
    dim_page_map = {
        "Influence": pages_text.get(4, ""),
        "Cooperate": pages_text.get(5, ""),
        "Think":     pages_text.get(6, ""),
        "Act":       pages_text.get(7, ""),
        "Feel":      pages_text.get(8, ""),
    }

    dim_details = {}
    for dim, text in dim_page_map.items():
        subs    = AF_TALENT_CLOUD[dim]
        details = {}
        for j, sub in enumerate(subs):
            next_sub = subs[j + 1] if j + 1 < len(subs) else None
            end_pat  = re.escape(next_sub) if next_sub else r"(?:Tunahan|\Z)"
            m2 = re.search(
                rf"{re.escape(sub)}\nHe is particularly good at:\n(.+?)(?={end_pat})",
                text, re.DOTALL
            )
            if m2:
                raw = m2.group(1).strip()
                bullets = [
                    l.strip() for l in raw.split("\n")
                    if l.strip() and not l.strip().startswith("Tunahan")
                    and len(l.strip()) > 5
                ]
                details[sub] = bullets
            else:
                # Fallback: inline bullets separated by periods
                m2 = re.search(
                    rf"{re.escape(sub)}\n(.+?)(?={end_pat})",
                    text, re.DOTALL
                )
                if m2:
                    raw = m2.group(1).strip()
                    bullets = []
                    for part in re.split(r"\.\s*(?=[A-Z])", raw):
                        part = part.strip().rstrip(".")
                        if part and len(part) > 5 and not part.startswith("Tunahan"):
                            bullets.append(part + ".")
                    details[sub] = bullets
        dim_details[dim] = details
    r["dimension_details"] = dim_details

    # ── Page 9: Motivations — split columns by bounding box ───────────────
    p9_obj = pages_obj.get(9)
    if p9_obj:
        page_w = float(p9_obj.width)
        page_h = float(p9_obj.height)
        mid    = page_w / 2

        left_text  = (p9_obj.crop((0,   0, mid,    page_h)).extract_text() or "")
        right_text = (p9_obj.crop((mid, 0, page_w, page_h)).extract_text() or "")

        # Top motivators from left column
        m = re.search(
            r"(?:What motivates him the most|motivates)\n(.+?)(?:How he manages|The activities|Preferred Activities|#[a-z]|\Z)",
            left_text, re.DOTALL | re.IGNORECASE
        )
        if m:
            lines = [
                l.strip().lstrip("*").strip()
                for l in m.group(1).split("\n")
                if l.strip()
                and not l.strip().startswith("Tunahan")
                and not re.match(
                    r"^(What motivates|Top$|Low$|What demotivates|How he|The activities)",
                    l.strip(), re.IGNORECASE
                )
            ]
            # Merge continuation lines (e.g. "Having a positive impact on the" / "world")
            merged, buf = [], ""
            for line in lines:
                if buf:
                    # Continue if line starts lowercase or is a single short word
                    if line[0].islower() or (len(line.split()) <= 2 and line[0].isupper()):
                        buf += " " + line
                    else:
                        merged.append(buf)
                        buf = line
                else:
                    buf = line
            if buf:
                merged.append(buf)
            final_top = []
            for item in merged:
                parts = re.split(r'(?<=[a-z])\s+(?=[A-Z])', item)
                final_top.extend(parts)
                r["top_motivators"] = [x.strip() for x in final_top if len(x.strip()) > 4][:6]
        else:
            r["top_motivators"] = []

        # Low motivators from right column — only take lines from the motivators section
        # Stop before the energy description paragraph
        m = re.search(
            r"(?:What motivates him the least|demotivates)\n(.+?)(?:How he manages|The activities|Propel|Design|Evaluate|#[a-z]|\Z)",
            right_text, re.DOTALL | re.IGNORECASE
        )
        if m:
            lines = [
                l.strip().lstrip("*").strip()
                for l in m.group(1).split("\n")
                if l.strip()
                and not l.strip().startswith("Tunahan")
                and not re.match(
                    r"^(What motivates|Top$|Low$|What demotivates|How he)",
                    l.strip(), re.IGNORECASE
                )
            ]
            # Only keep lines that look like motivator phrases
            # (short, start with capital, not mid-sentence fragments)
            clean = []
            for line in lines:
                # Skip fragments — mid-sentence continuations from energy paragraph
                if line[0].islower():
                    continue
                # Skip lines that look like energy description sentences
                if re.match(r"^(Tunahan|He needs|He is|For him|It is better)", line):
                    continue
                # Skip lines ending mid-word (column bleed)
                if len(line) < 5:
                    continue
                clean.append(line)
            r["low_motivators"] = clean[:6]
        else:
            r["low_motivators"] = [
                p for p in LOW_MOTIVATOR_PHRASES
                if p.lower() in pages_text.get(9, "").lower()
            ][:6]

        r["energy_tags"] = re.findall(r"#([a-z][a-z-]*)", left_text)

        # Preferred activities — from full page 9 text, after motivators section
        p9_full = pages_text.get(9, "")
        activity_names = [
            "Propel", "Design", "Evaluate", "Connect", "Convince",
            "Organise", "Monitor", "Analyse", "Create", "Lead",
            "Support", "Communicate", "Develop", "Manage",
        ]
        all_names_pat = "|".join(activity_names)
        preferred_activities = []

        for name in activity_names:
            m = re.search(
                rf"\b{name}\b\n(.+?)(?=\n\b(?:{all_names_pat})\b\n|His Management|DRIVE|BRAIN|\Z)",
                p9_full, re.DOTALL
            )
            if m:
                raw = m.group(1).strip()
                desc_lines = [
                    l.strip() for l in raw.split("\n")
                    if l.strip()
                    and not l.strip().startswith("Tunahan")
                    and len(l.strip()) > 8
                ]
                if desc_lines:
                    preferred_activities.append({
                        "name":        name,
                        "description": " ".join(desc_lines),
                    })
        r["preferred_activities"] = preferred_activities

    else:
        r["top_motivators"]       = []
        r["low_motivators"]       = []
        r["energy_tags"]          = []
        r["preferred_activities"] = []

    # ── Page 10: Management styles + culture ─────────────────────────────
    p10 = pages_text.get(10, "")

    mgmt_scores = re.findall(r"(\d+)%", p10)
    mgmt_labels = re.findall(
        r"\b(Winner|Visionary|Coach|Director|Collaborator|Expert|Empowering|Pioneer)\b",
        p10
    )
    r["management_style"] = [
        {"label": mgmt_labels[i] if i < len(mgmt_labels) else "?", "pct": int(mgmt_scores[i])}
        for i in range(min(2, len(mgmt_scores)))
    ]
    r["sought_management"] = [
        {"label": mgmt_labels[i + 2] if i + 2 < len(mgmt_labels) else "?", "pct": int(mgmt_scores[i + 2])}
        for i in range(min(2, max(0, len(mgmt_scores) - 2)))
    ]

    culture_match = re.search(
        r"\b(INNOVATION|COLLABORATION|ORGANISATION|COMPETITION)\b", p10
    )
    r["culture_fit"] = culture_match.group(1).title() if culture_match else None

    p11 = pages_text.get(11, "")
    m = re.search(
        r"The ideal culture for him\n(.+?)(?=Tunahan|CONTROL|FLEXIBILITY|\Z)",
        p10 + "\n" + p11, re.DOTALL
    )
    if m:
        desc_lines = [
            l.strip() for l in m.group(1).strip().split("\n")
            if l.strip()
            and not l.strip().startswith("Tunahan")
            and not re.match(
                r"^(FLEXIBILITY|CONTROL|COLLABORATION|COMPETITION|ORGANISATION|RESULTS|RELATIONSHIPS|[A-Z]\s*$)",
                l.strip()
            )
        ]
        r["culture_desc"] = " ".join(desc_lines)
    else:
        r["culture_desc"] = None

    # ── Page 12: Aptitude ─────────────────────────────────────────────────
    p12 = pages_text.get(12, "")

    m = re.search(r"Decision-making\s*:?\s*([A-Za-z]+)", p12)
    r["decision_making"] = m.group(1).strip() if m else None

    m = re.search(r"Preferred tasks\s*:?\s*([A-Za-z]+)", p12)
    r["preferred_tasks"] = m.group(1).strip() if m else None

    m = re.search(r"Learning style\s*:?\s*([A-Za-z]+)", p12)
    r["learning_style"] = m.group(1).strip() if m else None

    # Aptitude description — everything from "How he learns" to end
    # Skip the one-liner capability sentence, get the paragraph
    m = re.search(
        r"How he learns new skills and concepts\n(.+?)(?=Tunahan|\Z)",
        p12, re.DOTALL
    )
    if not m:
        # Fallback: after "Learning style: X\n"
        m = re.search(
            r"Learning style\s*:?\s*\w+\n(.+?)(?=Tunahan|\Z)",
            p12, re.DOTALL
        )
    if m:
        desc_lines = [
            l.strip() for l in m.group(1).strip().split("\n")
            if l.strip() and not l.strip().startswith("Tunahan")
        ]
        r["aptitude_desc"] = " ".join(desc_lines)
    else:
        r["aptitude_desc"] = None

    return r


@app.post("/extract-assessfirst")
async def extract_assessfirst_endpoint(file: UploadFile = File(...)):

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()

    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    try:
        return _af_extract(pdf_bytes)

    except Exception as e:
        logger.error(f"AssessFirst extraction failed: {e}")
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {str(e)}")

# ──────────────────────────────────────────────────────────────────────────────
# Standard CV extraction
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/extract", response_model=ExtractResponse)
def extract(body: ExtractRequest):

    try:
        pdf_bytes = base64.b64decode(body.pdf_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 PDF data")

    try:
        text = extract_text_from_pdf(pdf_bytes)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {str(e)}")

    return ExtractResponse(
        text=text,
        page_count=count_pages(pdf_bytes),
        char_count=len(text),
    )

# ──────────────────────────────────────────────────────────────────────────────
# Embedding
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/embed", response_model=EmbedResponse)
def embed(body: EmbedRequest):

    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    text = body.text.strip()[:2000]
    vector = embedding_model.encode(text).tolist()

    return EmbedResponse(embedding=vector, dimensions=len(vector))

# ──────────────────────────────────────────────────────────────────────────────
# Reranking
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/rerank", response_model=RerankResponse)
def rerank(body: RerankRequest):

    if not body.query or not body.candidates:
        raise HTTPException(status_code=400, detail="query and candidates are required")

    pairs = [(body.query, c.profileText) for c in body.candidates]

    raw_scores = rerank_model.predict(pairs)

    import math

    def sigmoid(x):
        return 1 / (1 + math.exp(-x))

    scored = [
        {
            "candidateId": c.candidateId,
            "name": c.name,
            "score": round(sigmoid(float(score)), 4),
        }
        for c, score in zip(body.candidates, raw_scores)
    ]

    scored.sort(key=lambda x: x["score"], reverse=True)

    return RerankResponse(results=[RerankResult(**r) for r in scored])

# ──────────────────────────────────────────────────────────────────────────────
# PDF text extraction helpers
# ──────────────────────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes: bytes) -> str:

    full_text_parts = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            if text.strip():
                full_text_parts.append(text.strip())

    return clean_text("\n\n".join(full_text_parts))


def clean_text(text: str) -> str:

    text = re.sub(r"[•·▪▸►●◆→✓✔–—]", "-", text)
    text = re.sub(r"[ \t]+", " ", text)

    lines = [line.strip() for line in text.split("\n")]
    lines = [l for l in lines if l]

    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def count_pages(pdf_bytes: bytes) -> int:

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return len(pdf.pages)
    except Exception:
        return 0