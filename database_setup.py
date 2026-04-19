import os

from dotenv import load_dotenv
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

load_dotenv()

api_key = os.getenv("PINECONE_API_KEY")
if not api_key:
    raise SystemExit("PINECONE_API_KEY .env dosyasında tanımlı olmalı.")

pc = Pinecone(api_key=api_key)
index_name = "cv-index"
index = pc.Index(index_name)
print("Bulut vektör veritabanına bağlanıldı.")
print(f"İndeks istatistikleri: {index.describe_index_stats()}")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding modeli hazır.")
