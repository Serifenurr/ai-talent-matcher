import os
import tempfile
from typing import List, Optional, Any
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from dotenv import load_dotenv

from lio_hr_search import parse_ceo_query, build_filter, _match_to_dict, MODEL_NAME, INDEX_NAME
from lio_hr_cv import read_docx_full_text, compress_professional_text
from metadata_extractor import extract_metadata
from save_to_cloud import save_to_cloud

load_dotenv()

app = FastAPI(title="AI Talent Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CEO_PASSWORD = os.getenv("CEO_PASSWORD", "admin123")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

model = None
pinecone_index = None

@app.on_event("startup")
def startup_event():
    global model, pinecone_index
    if not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY is missing in environment.")
    
    model = SentenceTransformer(MODEL_NAME)
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    pinecone_index = pc.Index(INDEX_NAME)

def authenticate_ceo(token: str = Depends(oauth2_scheme)):
    if token.strip() not in [CEO_PASSWORD.strip(), "guest"]:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token.strip()

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class Candidate(BaseModel):
    id: str
    filename: str
    score: float
    experience_years: float | str
    top_skills: List[str]
    summary: str

class SearchResponse(BaseModel):
    search_query: str
    min_years: float
    max_years: Optional[float]
    results: List[Candidate]

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/token")
def login(req: LoginRequest):
    if req.password.strip() != CEO_PASSWORD.strip():
        raise HTTPException(status_code=400, detail="Incorrect password")
    return {"access_token": req.password.strip(), "token_type": "bearer"}

@app.post("/api/search", response_model=SearchResponse)
def search_talents(req: SearchRequest, user: str = Depends(authenticate_ceo)):
    global model, pinecone_index
    
    parsed = parse_ceo_query(req.query)
    target_query = parsed.get("search_query", req.query)
    min_years = parsed.get("min_years", 0.0)
    max_years = parsed.get("max_years")
    
    vector = model.encode(target_query).tolist()
    
    flt = build_filter(min_years if min_years > 0 else None, max_years)
    
    print(f"DEBUG: Parsed Query: {target_query} | Min Years: {min_years} | Filter: {flt}")
    
    try:
        results = pinecone_index.query(
            vector=vector,
            top_k=req.top_k,
            include_metadata=True,
            filter=flt
        )
        matches = getattr(results, "matches", []) or results.get("matches", [])
    except Exception as e:
        print(f"DEBUG: Pinecone Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
    candidates = []
    for match in matches:
        score, meta, vid = _match_to_dict(match)
        vid = vid or "?"
        
        skills = meta.get("top_skills") or []
        if not isinstance(skills, list):
            skills = [str(skills)]
            
        yrs = meta.get("experience_years", meta.get("years_experience", 0))
        try:
            yrs = float(yrs)
        except:
            pass
            
        candidates.append(Candidate(
            id=vid,
            filename=meta.get("filename", vid),
            score=round(float(score) * 100, 2) if isinstance(score, (int, float)) else 0.0,
            experience_years=yrs,
            top_skills=skills,
            summary=meta.get("summary") or meta.get("text_preview") or ""
        ))
        
    return SearchResponse(
        search_query=target_query,
        min_years=min_years,
        max_years=max_years,
        results=candidates
    )

import uuid

@app.post("/api/upload-cv")
async def upload_cv(files: List[UploadFile] = File(...), user: str = Depends(authenticate_ceo)):
    if user == "guest":
        raise HTTPException(status_code=403, detail="Misafir girişi ile dosya yüklenemez.")
        
    global model, pinecone_index
    
    uploaded_data = []
    
    for file in files:
        if not file.filename.lower().endswith(".docx"):
            continue
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp:
            content = await file.read()
            temp.write(content)
            temp_path = temp.name
            
        try:
            metin = read_docx_full_text(temp_path)
            meta = extract_metadata(metin)
            vector = model.encode(metin).tolist()
            
            safe_name = file.filename.replace(" ", "_").lower().replace(".docx", "")
            vector_id = f"{safe_name}_{uuid.uuid4().hex[:6]}"
            
            onizleme = (meta.get("summary") or "").strip() or compress_professional_text(metin, max_chars=500)
            skills = meta.get("top_skills") or []
            exp_years = float(int(meta.get("experience_years") or 0))

            md = {
                "filename": file.filename,
                "experience_years": exp_years,
                "job_title": (meta.get("job_title") or "")[:200],
                "summary": (meta.get("summary") or "")[:500],
                "text_preview": onizleme[:500] if isinstance(onizleme, str) else str(onizleme)[:500],
            }
            if skills:
                md["top_skills"] = skills

            save_to_cloud(
                vector_id,
                metin,
                md,
                vector=vector,
                model=model,
                index=pinecone_index,
            )
            uploaded_data.append({
                "id": vector_id,
                "filename": file.filename,
                "score": 100.0,
                "experience_years": exp_years,
                "top_skills": skills if skills else [],
                "summary": md["summary"] if md["summary"] else md["text_preview"]
            })
        except Exception as e:
            print(f"Error processing {file.filename}: {e}")
        finally:
            os.remove(temp_path)
            
    if not uploaded_data:
        raise HTTPException(status_code=400, detail="Hiçbir geçerli .docx dosyası yüklenemedi.")
        
    return {"message": f"{len(uploaded_data)} adet CV başarıyla eklendi.", "uploaded": uploaded_data}

@app.delete("/api/delete-cv/{cv_id}")
async def delete_cv(cv_id: str, user: str = Depends(authenticate_ceo)):
    if user == "guest":
        raise HTTPException(status_code=403, detail="Misafir girişi ile aday silinemez.")
        
    global pinecone_index
    try:
        pinecone_index.delete(ids=[cv_id])
        return {"message": "Aday başarıyla silindi.", "id": cv_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "AI Talent Matcher API is running"}
