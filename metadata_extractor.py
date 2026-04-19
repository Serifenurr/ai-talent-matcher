"""
Thought Compression — Groq + LangChain ile CV metadata (JSON).
GROQ_API_KEY .env içinde olmalıdır.
"""
from __future__ import annotations

import os
from datetime import date
from typing import Any

from dotenv import load_dotenv
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_groq import ChatGroq

load_dotenv()

_DEFAULT_MODEL = "llama3-70b-8192"
_MAX_RESUME_CHARS = 14_000

template = """
Sen profesyonel bir İK veri analiz uzmanısın. Aşağıdaki CV metninden bilgileri ayıkla.
Cevabı SADECE geçerli JSON olarak ver; açıklama, markdown veya kod bloğu ekleme.

ÖZELLİKLE DİKKAT ET — experience_years (tam sayı, adım adım):
1) Her iş satırındaki başlangıç ve bitiş yılını yaz (örn. 2019-2021 → 2 yıl; 2021-2024 → 3 yıl).
2) Her aralığın yıl sayısını hesapla: bitiş - başlangıç + 1 mi yoksa bitiş - başlangıç mı tutarlı kullan; CV'deki yazım neyi ima ediyorsa ona uy.
3) Örtüşen iki iş varsa toplamı şişirme: birleştirilmiş takvim uzunluğu veya daha uzun süreyi mantıklı seç.
4) Present / Halen / Günümüz / Now → bitiş = {reference_year}.
5) Sonuç: tek bir tam sayı experience_years. Tarih yoksa 0.

Diğer alanlar:
- top_skills: en fazla 8 kısa yetenek (metinde geçenler).
- job_title: en son / güncel iş unvanı (yoksa boş string).
- summary: adayı anlatan kısa özet (yaklaşık 20 kelime).

Örnek yapı (içerik uydurma):
{{
    "experience_years": 0,
    "top_skills": ["yetenek1", "yetenek2"],
    "job_title": "",
    "summary": ""
}}

CV Metni:
{resume_text}
"""


def _normalize_meta(raw: dict[str, Any] | None) -> dict[str, Any]:
    if not raw or not isinstance(raw, dict):
        return _empty_meta()
    years = raw.get("experience_years", 0)
    try:
        years_i = int(float(years))
    except (TypeError, ValueError):
        years_i = 0
    skills = raw.get("top_skills") or []
    if not isinstance(skills, list):
        skills = [str(skills)] if skills else []
    skills = [str(s).strip() for s in skills if str(s).strip()][:8]
    title = str(raw.get("job_title") or "").strip()[:200]
    summary = str(raw.get("summary") or "").strip()[:500]
    return {
        "experience_years": max(0, min(years_i, 60)),
        "top_skills": skills,
        "job_title": title,
        "summary": summary,
    }


def _empty_meta() -> dict[str, Any]:
    return {
        "experience_years": 0,
        "top_skills": [],
        "job_title": "",
        "summary": "",
    }


def extract_metadata(resume_text: str) -> dict[str, Any]:
    """
    CV metninden JSON metadata döndürür.
    Tecrübe yılı: LLM + CV metnindeki tarihler için deterministik ``estimate_years_experience``
    birleştirilir (ikisinin max'ı), böylece filtre ``experience_years >= N`` güvenilir kalır.
    GROQ_API_KEY yoksa yalnızca sezgisel yıl + boş diğer alanlar döner.
    """
    from lio_hr_cv import estimate_years_experience

    text = (resume_text or "").strip()
    heuristic = int(round(float(estimate_years_experience(text))))
    heuristic = max(0, min(heuristic, 60))

    if not text:
        return {**_empty_meta(), "experience_years": heuristic}

    norm = _empty_meta()
    api_key = os.getenv("GROQ_API_KEY")
    if api_key:
        trimmed = text[:_MAX_RESUME_CHARS]
        model_name = os.getenv("GROQ_MODEL", _DEFAULT_MODEL)
        llm = ChatGroq(
            model=model_name,
            temperature=0,
            api_key=api_key,
        )
        prompt = PromptTemplate.from_template(template)
        chain = prompt | llm | JsonOutputParser()
        try:
            raw = chain.invoke(
                {
                    "resume_text": trimmed,
                    "reference_year": date.today().year,
                }
            )
            norm = _normalize_meta(raw)
        except Exception:
            norm = _empty_meta()

    llm_years = int(norm.get("experience_years") or 0)
    merged = max(llm_years, heuristic)
    merged = min(merged, 60)
    norm["experience_years"] = merged
    return norm
