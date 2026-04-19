"""
Lio-HR-Agent — CEO doğal dil cümlesi veya doğrudan sorgu + Pinecone metadata filtresi.

Örnekler:
  python lio_hr_search.py --ceo "5 yıldan fazla tecrübeli bir Java uzmanı bul"
  python lio_hr_search.py "python backend microservices" --min-years 3
  python lio_hr_search.py   # interaktif: tek CEO cümlesi
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Any

from dotenv import load_dotenv
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

INDEX_NAME = "cv-index"
MODEL_NAME = "all-MiniLM-L6-v2"


def build_filter(
    min_years: float | None,
    max_years: float | None,
) -> dict[str, Any] | None:
    """Pinecone metadata alanı: ``experience_years`` (konsol filtresi ile aynı)."""
    parts: list[dict[str, Any]] = []
    if min_years is not None and float(min_years) > 0:
        parts.append({"experience_years": {"$gte": float(min_years)}})
    if max_years is not None:
        parts.append({"experience_years": {"$lte": float(max_years)}})
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return {"$and": parts}


def parse_ceo_query(ceo_text: str) -> dict[str, Any]:
    """
    CEO / yönetici cümlesinden vektör araması metni + yıl filtreleri çıkarır.
    GROQ_API_KEY yoksa veya hata olursa tüm cümle aranır, min_years=0.
    """
    text = (ceo_text or "").strip()
    out = {"search_query": text, "min_years": 0.0, "max_years": None}
    if not text:
        return out

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return out

    try:
        from langchain_core.output_parsers import JsonOutputParser
        from langchain_core.prompts import PromptTemplate
        from langchain_groq import ChatGroq

        model_name = os.getenv("GROQ_MODEL", "llama3-70b-8192")
        tmpl = """
Sen bir İK asistanısın. Yöneticinin tek cümlesinden şu alanları çıkar; yalnızca geçerli JSON döndür.

- search_query: Pinecone semantik araması için kısa sorgu (rol, teknoloji, anahtar kelimeler; Türkçe veya İngilizce)
- min_years: minimum toplam iş tecrübesi yılı (cümlede yoksa 0)
- max_years: maksimum yıl (cümlede üst sınır yoksa null)

Örnek yapı:
{{
    "search_query": "",
    "min_years": 0,
    "max_years": null
}}

Cümle: {ceo_text}
"""
        llm = ChatGroq(model=model_name, temperature=0, api_key=api_key)
        prompt = PromptTemplate.from_template(tmpl)
        chain = prompt | llm | JsonOutputParser()
        raw = chain.invoke({"ceo_text": text[:4000]})
        if not isinstance(raw, dict):
            return out
        sq = str(raw.get("search_query") or text).strip()
        out["search_query"] = sq or text
        try:
            mn = float(raw.get("min_years") or 0)
        except (TypeError, ValueError):
            mn = 0.0
        out["min_years"] = max(0.0, mn)
        mx = raw.get("max_years")
        if mx is not None and mx != "" and str(mx).lower() != "null":
            try:
                out["max_years"] = float(mx)
            except (TypeError, ValueError):
                out["max_years"] = None
        return out
    except Exception:
        return {"search_query": text, "min_years": 0.0, "max_years": None}


def _match_to_dict(m: Any) -> tuple[Any, dict[str, Any], str | None]:
    if isinstance(m, dict):
        return m.get("score"), (m.get("metadata") or {}), m.get("id")
    md = getattr(m, "metadata", None) or {}
    return getattr(m, "score", None), md, getattr(m, "id", None)


def akilli_arama(
    kriter: str,
    min_tecrube: float = 0,
    max_tecrube: float | None = None,
    top_k: int = 3,
    *,
    model: SentenceTransformer | None = None,
    index=None,
) -> None:
    """
    Kriteri vektöre çevirir; Pinecone'da semantik arama + ``experience_years`` metadata filtresi.
    (Eski ``where=`` yerine SDK'nın ``filter=`` parametresi kullanılır.)
    """
    load_dotenv()
    m = model or SentenceTransformer(MODEL_NAME)
    if index is not None:
        idx = index
    else:
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise SystemExit("PINECONE_API_KEY .env içinde tanımlı olmalı.")
        idx = Pinecone(api_key=api_key).Index(INDEX_NAME)

    sorgu_vektoru = m.encode(kriter).tolist()
    flt = build_filter(min_tecrube if min_tecrube > 0 else None, max_tecrube)

    q_kwargs: dict[str, Any] = {
        "vector": sorgu_vektoru,
        "top_k": int(top_k),
        "include_metadata": True,
    }
    if flt is not None:
        q_kwargs["filter"] = flt

    sonuclar = idx.query(**q_kwargs)
    matches = sonuclar.matches if hasattr(sonuclar, "matches") else (sonuclar.get("matches") or [])

    min_s = int(min_tecrube) if min_tecrube == int(min_tecrube) else min_tecrube
    print(f"\n--- '{kriter}' kriterine uygun adaylar (min. {min_s} yıl tecrübe) ---\n")

    if not matches:
        print("Eşleşme yok (filtre çok dar, indeks boş veya sorgu zayıf olabilir).")
        return

    for match in matches:
        score, meta, vid = _match_to_dict(match)
        vid = vid or "?"
        ad = meta.get("filename", vid)
        yrs = meta.get("experience_years", meta.get("years_experience", "?"))
        skills = meta.get("top_skills") or []
        if not isinstance(skills, list):
            skills = [str(skills)]
        ozet = meta.get("summary") or meta.get("text_preview") or ""

        pct = round(float(score) * 100, 2) if isinstance(score, (int, float)) else score
        print(f"Aday: {ad} | Uyumluluk: %{pct}")
        print(f"Tecrübe (yıl): {yrs}")
        print(f"Yetenekler: {', '.join(str(s) for s in skills[:12]) if skills else '-'}")
        print(f"Özet: {ozet}")
        print("-" * 30)


def akilli_arama_ceo(ceo_cumlesi: str, top_k: int = 3, **kwargs: Any) -> None:
    """CEO cümlesini ayrıştırıp ``akilli_arama`` çalıştırır."""
    load_dotenv()
    p = parse_ceo_query(ceo_cumlesi)
    print(f"[Agent] Ayrıştırılan sorgu: {p['search_query']!r} | min_yıl={p['min_years']} | max_yıl={p.get('max_years')}")
    akilli_arama(
        p["search_query"],
        min_tecrube=float(p["min_years"]),
        max_tecrube=p.get("max_years"),
        top_k=top_k,
        **kwargs,
    )


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="CEO cümlesi (Groq) veya doğrudan semantik arama + Pinecone filtre"
    )
    parser.add_argument("query", nargs="?", help="Doğrudan arama metni (--ceo kullanılmadığında)")
    parser.add_argument(
        "--ceo",
        type=str,
        metavar="CÜMLE",
        help='CEO doğal dil cümlesi, örn: "5 yıldan fazla tecrübeli Java uzmanı"',
    )
    parser.add_argument("--min-years", type=float, default=None, help="Doğrudan mod: min experience_years")
    parser.add_argument("--max-years", type=float, default=None, help="Doğrudan mod: max experience_years")
    parser.add_argument("--top-k", type=int, default=8)
    args = parser.parse_args()

    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise SystemExit("PINECONE_API_KEY .env içinde tanımlı olmalı.")

    print("Model yükleniyor...")
    model = SentenceTransformer(MODEL_NAME)
    pc = Pinecone(api_key=api_key)
    index = pc.Index(INDEX_NAME)

    if args.ceo:
        akilli_arama_ceo(args.ceo, top_k=args.top_k, model=model, index=index)
        return

    if args.query:
        mn = args.min_years if args.min_years is not None else 0.0
        akilli_arama(
            args.query,
            min_tecrube=mn,
            max_tecrube=args.max_years,
            top_k=args.top_k,
            model=model,
            index=index,
        )
        return

    # İnteraktif: tek CEO cümlesi
    if sys.stdin.isatty():
        arama_metni = input("Hangi profilde aday arıyorsunuz? (CEO cümlesi): ").strip()
        if not arama_metni:
            raise SystemExit("Boş girdi.")
        top_k_s = input("Kaç sonuç gösterilsin? [8]: ").strip() or "8"
        try:
            tk = max(1, int(top_k_s))
        except ValueError:
            tk = 8
        akilli_arama_ceo(arama_metni, top_k=tk, model=model, index=index)
    else:
        raise SystemExit(
            "Argüman verin: python lio_hr_search.py --ceo \"...\" veya python lio_hr_search.py \"sorgu\" --min-years 3"
        )


if __name__ == "__main__":
    main()
