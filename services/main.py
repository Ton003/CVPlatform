import base64
import io
import re
import logging
from typing import List

import math

import pdfplumber
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, CrossEncoder

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="CV Extractor + Embedder + Reranker", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("Loading MiniLM embedding model...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
logger.info(" MiniLM ready")

logger.info("Loading cross-encoder reranking model...")
rerank_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
logger.info(" Cross-encoder ready")
# Request / Response schemas

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
# Health check

@app.get("/health")
def health():
    return {
        "status": "ok",
        "minilm": "ready",
        "cross_encoder": "ready",
    }
# Standard CV extraction

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
# Embedding

@app.post("/embed", response_model=EmbedResponse)
def embed(body: EmbedRequest):

    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    import numpy as np

    max_length = 300  # Words (approximate token limit)
    overlap = 50

    words = text.split()
    if not words:
        raise HTTPException(status_code=400, detail="Text contains no valid words")

    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i : i + max_length])
        chunks.append(chunk)
        i += (max_length - overlap)

    # Encode all chunks
    vectors = embedding_model.encode(chunks)

    # Mean pooling to get a single vector representation for the whole document
    mean_vector = np.mean(vectors, axis=0).tolist()

    return EmbedResponse(embedding=mean_vector, dimensions=len(mean_vector))
# Reranking

@app.post("/rerank", response_model=RerankResponse)
def rerank(body: RerankRequest):

    if not body.query or not body.candidates:
        raise HTTPException(status_code=400, detail="query and candidates are required")
        
    if len(body.candidates) > 100:
        raise HTTPException(status_code=400, detail="Cannot rerank more than 100 candidates at once to prevent memory exhaustion")

    pairs = [(body.query, c.profileText) for c in body.candidates]

    raw_scores = rerank_model.predict(pairs)

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
# PDF text extraction helpers

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