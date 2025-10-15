import os
from typing import List, Dict, Any
from dotenv import load_dotenv
load_dotenv()

import requests
from pinecone import Pinecone, ServerlessSpec

JINA_API_KEY = os.environ.get("JINA_API_KEY")
JINA_API_URL = os.environ.get("JINA_API_URL", "https://api.jina.ai/v1/embeddings")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_ENV = os.environ.get("PINECONE_ENV")


def get_jina_embeddings(texts: List[str], batch_size: int = 100) -> List[List[float]]:
    """Generate embeddings using Jina AI API - with batch processing for large documents"""
    if not JINA_API_KEY:
        raise RuntimeError("JINA_API_KEY not set in environment")
    
    print(f"🔑 Using Jina API: {JINA_API_URL}")
    print(f"📝 Generating embeddings for {len(texts)} texts in batches of {batch_size}...")
    
    all_embeddings = []
    total_batches = (len(texts) + batch_size - 1) // batch_size
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        print(f"  📦 Processing batch {batch_num}/{total_batches} ({len(batch)} texts)...")
        
        # Retry logic with exponential backoff
        max_retries = 3
        for attempt in range(max_retries):
            try:
                headers = {"Authorization": f"Bearer {JINA_API_KEY}", "Content-Type": "application/json"}
                
                # Use the EXACT format from demo_full_rag.py that works
                payload = {
                    "input": batch,
                    "model": "jina-embeddings-v2-base-en"
                }
                
                r = requests.post(JINA_API_URL, json=payload, headers=headers, timeout=60)
                r.raise_for_status()
                data = r.json()
                
                # Parse Jina response format (same as demo)
                batch_embeddings = []
                if isinstance(data, dict) and "data" in data:
                    # Standard OpenAI-compatible format
                    for item in data["data"]:
                        batch_embeddings.append(item["embedding"])
                elif isinstance(data, dict) and "embeddings" in data:
                    batch_embeddings = data["embeddings"]
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and "embedding" in item:
                            batch_embeddings.append(item["embedding"])
                        elif isinstance(item, dict) and "vector" in item:
                            batch_embeddings.append(item["vector"])
                
                if not batch_embeddings:
                    raise RuntimeError(f"Unexpected Jina response format: {data}")
                
                all_embeddings.extend(batch_embeddings)
                print(f"  ✅ Batch {batch_num} complete ({len(batch_embeddings)} embeddings)")
                
                # Add small delay between batches to avoid rate limiting
                if batch_num < total_batches:
                    import time
                    time.sleep(1)  # 1 second delay between batches
                
                break  # Success, exit retry loop
                
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    print(f"  ⚠️  Batch {batch_num} timeout, retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                    import time
                    time.sleep(wait_time)
                else:
                    print(f"  ❌ Batch {batch_num} timeout after {max_retries} attempts")
                    raise RuntimeError(f"Jina API request timeout for batch {batch_num} after {max_retries} retries")
                    
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # 1s, 2s, 4s
                    print(f"  ⚠️  Batch {batch_num} failed: {str(e)}")
                    if hasattr(e, 'response') and e.response is not None:
                        print(f"  Response: {e.response.text[:200]}")
                    print(f"  🔄 Retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                    import time
                    time.sleep(wait_time)
                else:
                    print(f"  ❌ Batch {batch_num} failed after {max_retries} attempts: {str(e)}")
                    if hasattr(e, 'response') and e.response is not None:
                        print(f"  Response body: {e.response.text}")
                    raise RuntimeError(f"Jina API request failed on batch {batch_num} after {max_retries} retries: {str(e)}")
    
    dimension = len(all_embeddings[0]) if all_embeddings else 0
    print(f"✅ Generated {len(all_embeddings)} total embeddings (dimension: {dimension})")
    return all_embeddings


def get_pinecone_client() -> Pinecone:
    if not PINECONE_API_KEY:
        raise RuntimeError("PINECONE_API_KEY not set")
    return Pinecone(api_key=PINECONE_API_KEY)


def upsert_to_pinecone(index_name: str, namespace: str, vectors: List[Dict[str, Any]], dimension: int = 1536):
    pc = get_pinecone_client()
    # Check existing indexes
    try:
        idxs = pc.list_indexes()
        existing = idxs.names() if hasattr(idxs, "names") else list(idxs)
    except Exception:
        existing = []
    if index_name not in existing:
        # Create serverless index if supported
        try:
            pc.create_index(name=index_name, dimension=dimension)
        except Exception:
            # Fall back to older create_index signature
            pc.create_index(index_name, dimension=dimension)
    # Upsert: API expects a client-side call
    idx = pc.index(index_name)
    # vectors: list of (id, vector, metadata)
    idx.upsert(items=vectors, namespace=namespace)
