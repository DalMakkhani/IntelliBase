from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId, Int64
import os
import shutil
from pathlib import Path

from routes.auth import get_current_user
from database.connection import get_documents_collection
from utils.pdf_reader import extract_text_from_pdf_with_pages, chunk_text
from utils.embeddings import get_jina_embeddings, upsert_to_pinecone
from pinecone import Pinecone

router = APIRouter(prefix="/documents", tags=["Documents"])

# Upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    collection_type: str = Form("main"),  # "main" or "isolated"
    collection_name: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload multiple PDF documents
    
    Args:
        files: List of PDF files
        collection_type: "main" (corpus) or "isolated" (separate collection)
        collection_name: Name for isolated collection (required if collection_type="isolated")
        
    Returns:
        List of uploaded document IDs with processing status
    """
    print(f"\n{'='*60}")
    print(f"📤 UPLOAD REQUEST STARTED")
    print(f"{'='*60}")
    print(f"User: {current_user['user_id']}")
    print(f"Files: {[f.filename for f in files]}")
    print(f"Collection Type: {collection_type}")
    print(f"Collection Name: {collection_name}")
    
    try:
        user_id = current_user["user_id"]
        namespace = current_user["namespace"]
        
        # Validate collection settings
        if collection_type == "isolated" and not collection_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="collection_name required for isolated collections"
            )
        
        # Use namespace or create sub-namespace for isolated collections
        if collection_type == "isolated":
            # Create sub-namespace: user_xxx__collection_name
            upload_namespace = f"{namespace}__{collection_name}"
        else:
            upload_namespace = namespace
        
        print(f"✅ Namespace: {upload_namespace}")
        
        documents_collection = get_documents_collection()
        uploaded_docs = []
        
        # Process each file
        for file in files:
            print(f"\n📄 Processing file: {file.filename}")
            
            # Validate file type
            if not file.filename.endswith('.pdf'):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Only PDF files are supported. Invalid file: {file.filename}"
                )
            
            # Save file to disk
            user_upload_dir = UPLOAD_DIR / user_id
            user_upload_dir.mkdir(exist_ok=True)
            
            file_path = user_upload_dir / file.filename
            print(f"💾 Saving to: {file_path}")
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            file_size = file_path.stat().st_size
            print(f"✅ Saved {file_size} bytes")
            
            # Create document record in MongoDB (status: pending)
            doc_id = ObjectId()
            document = {
                "_id": doc_id,
                "user_id": ObjectId(user_id),
                "filename": file.filename,
                "file_path": str(file_path),
                "upload_date": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(days=30),
                "size_bytes": Int64(file_size),  # Use Int64 for BSON long type
                "chunk_count": 0,
                "processing_status": "pending",
                "pinecone_namespace": upload_namespace,
                "collection_type": collection_type,
                "collection_name": collection_name if collection_type == "isolated" else None
            }
            
            print(f"💾 Saving to MongoDB with ID: {doc_id}")
            documents_collection.insert_one(document)
            print(f"✅ MongoDB record created")
            
            uploaded_docs.append({
                "document_id": str(doc_id),
                "filename": file.filename,
                "status": "pending",
                "namespace": upload_namespace
            })
        
        print(f"\n🔄 Starting background processing for {len(uploaded_docs)} documents...")
        
        # Start background processing (for now, process synchronously)
        # In production, use Celery or background tasks
        for doc_info in uploaded_docs:
            try:
                print(f"\n📊 Processing document: {doc_info['filename']}")
                await process_document(doc_info["document_id"])
                print(f"✅ Successfully processed: {doc_info['filename']}")
            except Exception as e:
                print(f"❌ ERROR processing {doc_info['filename']}: {str(e)}")
                import traceback
                traceback.print_exc()
                
                # Update status to failed
                documents_collection.update_one(
                    {"_id": ObjectId(doc_info["document_id"])},
                    {"$set": {"processing_status": "failed", "error": str(e)}}
                )
                doc_info["status"] = "failed"
                doc_info["error"] = str(e)
        
        print(f"\n{'='*60}")
        print(f"✅ UPLOAD COMPLETED SUCCESSFULLY")
        print(f"{'='*60}\n")
        
        return {
            "message": f"Uploaded {len(files)} documents",
            "documents": uploaded_docs
        }
    
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"❌ UPLOAD FAILED WITH ERROR")
        print(f"{'='*60}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise


async def process_document(document_id: str):
    """
    Background processing: extract text, chunk, embed, upload to Pinecone
    """
    print(f"\n{'─'*60}")
    print(f"🔧 PROCESSING DOCUMENT: {document_id}")
    print(f"{'─'*60}")
    
    try:
        documents_collection = get_documents_collection()
        
        # Update status to processing
        print(f"📝 Updating status to 'processing'...")
        documents_collection.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {"processing_status": "processing"}}
        )
        
        # Get document
        print(f"📂 Fetching document from MongoDB...")
        document = documents_collection.find_one({"_id": ObjectId(document_id)})
        if not document:
            raise Exception("Document not found")
        
        file_path = document["file_path"]
        namespace = document["pinecone_namespace"]
        print(f"✅ File: {file_path}")
        print(f"✅ Namespace: {namespace}")
        
        # Extract text from PDF with page tracking
        print(f"\n📖 Extracting text from PDF with page numbers...")
        pages_with_text = extract_text_from_pdf_with_pages(file_path)
        
        # Calculate total characters and preview
        total_text = "\n\n".join([text for _, text in pages_with_text])
        text_preview = total_text[:200] if len(total_text) > 200 else total_text
        print(f"✅ Extracted {len(total_text)} characters from {len(pages_with_text)} pages")
        print(f"📄 Preview: {text_preview}...")
        
        # Chunk text with page tracking
        print(f"\n✂️  Chunking text with page number tracking...")
        chunk_data = []
        total_chunks = 0
        
        for page_num, page_text in pages_with_text:
            if not page_text.strip():
                continue
            
            # Chunk this page's text
            page_chunks = chunk_text(page_text, chunk_size=500, overlap=50)
            
            # Add metadata for each chunk
            for chunk in page_chunks:
                chunk_data.append({
                    "text": chunk,
                    "document_id": str(document["_id"]),
                    "document": document["filename"],
                    "page": page_num,  # NOW WE HAVE PAGE NUMBERS!
                    "chunk_index": total_chunks,
                    "user_id": str(document["user_id"])
                })
                total_chunks += 1
        
        print(f"✅ Created {len(chunk_data)} chunks across {len(pages_with_text)} pages")
        print(f"✅ Prepared {len(chunk_data)} chunk metadata entries with page numbers")
        
        # Get embeddings
        print(f"\n🧠 Generating embeddings with Jina AI...")
        texts = [c["text"] for c in chunk_data]
        
        try:
            # Use smaller batch size (50 instead of 100) to be more conservative with Jina API
            embeddings = get_jina_embeddings(texts, batch_size=50)
            print(f"✅ Generated {len(embeddings)} embeddings")
            if embeddings:
                print(f"📊 Embedding dimension: {len(embeddings[0])}")
        except Exception as e:
            print(f"❌ Jina AI embedding failed: {str(e)}")
            raise Exception(f"Jina AI embedding error: {str(e)}")
        
        # Prepare vectors for Pinecone
        print(f"\n🔢 Preparing vectors for Pinecone...")
        vectors = []
        for chunk, embedding in zip(chunk_data, embeddings):
            vector_id = f"{document_id}_chunk_{chunk['chunk_index']}"
            vectors.append((vector_id, embedding, chunk))
        print(f"✅ Prepared {len(vectors)} vectors")
        
        # Upsert to Pinecone
        print(f"\n📤 Upserting to Pinecone...")
        PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
        if not PINECONE_API_KEY:
            raise Exception("PINECONE_API_KEY not found in environment")
        
        pc = Pinecone(api_key=PINECONE_API_KEY)
        
        # Get or create index
        INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "intellibase-demo")
        print(f"📍 Index: {INDEX_NAME}")
        
        try:
            index = pc.Index(INDEX_NAME)
            print(f"✅ Connected to existing index")
        except Exception as e:
            print(f"⚠️  Index not found, creating new one...")
            # Create index if doesn't exist
            from pinecone import ServerlessSpec
            pc.create_index(
                name=INDEX_NAME,
                dimension=768,  # Jina embeddings dimension
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )
            index = pc.Index(INDEX_NAME)
            print(f"✅ Created new index")
        
        # Upsert vectors
        print(f"🔄 Upserting {len(vectors)} vectors to namespace '{namespace}'...")
        index.upsert(vectors=vectors, namespace=namespace)
        print(f"✅ Upsert completed")
        
        # Update document status to completed
        print(f"\n💾 Updating document status to 'completed'...")
        documents_collection.update_one(
            {"_id": ObjectId(document_id)},
            {
                "$set": {
                    "processing_status": "completed",
                    "chunk_count": len(chunk_data),  # Fixed: use chunk_data instead of chunks
                    "processed_at": datetime.utcnow()
                }
            }
        )
        
        print(f"{'─'*60}")
        print(f"✅ DOCUMENT PROCESSING COMPLETED")
        print(f"{'─'*60}\n")
        
    except Exception as e:
        print(f"\n{'─'*60}")
        print(f"❌ DOCUMENT PROCESSING FAILED")
        print(f"{'─'*60}")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'─'*60}\n")
        raise


@router.get("/list")
async def list_documents(current_user: dict = Depends(get_current_user)):
    """
    List all documents for current user
    """
    documents_collection = get_documents_collection()
    user_id = current_user["user_id"]
    
    # Find all documents for user
    documents = list(documents_collection.find({"user_id": ObjectId(user_id)}).sort("upload_date", -1))
    
    # Format response
    result = []
    for doc in documents:
        # Calculate days until expiry
        days_left = (doc["expires_at"] - datetime.utcnow()).days
        
        result.append({
            "document_id": str(doc["_id"]),
            "filename": doc["filename"],
            "upload_date": doc["upload_date"].isoformat(),
            "expires_at": doc["expires_at"].isoformat(),
            "days_left": max(0, days_left),
            "size_bytes": doc["size_bytes"],
            "chunk_count": doc.get("chunk_count", 0),
            "status": doc["processing_status"],
            "collection_type": doc.get("collection_type", "main"),
            "collection_name": doc.get("collection_name")
        })
    
    return {"documents": result}


@router.get("/collections")
async def list_collections(current_user: dict = Depends(get_current_user)):
    """
    List all unique collections (isolated namespaces) for current user
    """
    documents_collection = get_documents_collection()
    user_id = current_user["user_id"]
    namespace = current_user["namespace"]
    
    # Get all unique collection names for this user
    pipeline = [
        {"$match": {"user_id": ObjectId(user_id)}},
        {"$group": {
            "_id": {
                "collection_type": "$collection_type",
                "collection_name": "$collection_name"
            },
            "doc_count": {"$sum": 1},
            "last_upload": {"$max": "$upload_date"}
        }},
        {"$sort": {"last_upload": -1}}
    ]
    
    collections_data = list(documents_collection.aggregate(pipeline))
    
    result = []
    
    for coll in collections_data:
        collection_type = coll["_id"]["collection_type"]
        collection_name = coll["_id"]["collection_name"]
        
        # Determine the namespace
        if collection_type == "isolated" and collection_name:
            namespace_value = f"{namespace}__{collection_name}"
            display_name = collection_name
        else:
            namespace_value = namespace
            display_name = "Main Corpus"
        
        result.append({
            "namespace": namespace_value,
            "display_name": display_name,
            "collection_type": collection_type,
            "doc_count": coll["doc_count"],
            "last_upload": coll["last_upload"].isoformat()
        })
    
    return {"collections": result}


@router.get("/view/{filename}")
async def view_document(filename: str, current_user: dict = Depends(get_current_user)):
    """
    View/download a document by filename
    """
    print(f"\n{'='*60}")
    print(f"📄 VIEW DOCUMENT REQUEST")
    print(f"{'='*60}")
    print(f"Filename: {filename}")
    print(f"User ID: {current_user.get('user_id')}")
    print(f"Username: {current_user.get('username')}")
    
    documents_collection = get_documents_collection()
    user_id = current_user["user_id"]
    
    # Find document by filename and user
    document = documents_collection.find_one({
        "filename": filename,
        "user_id": ObjectId(user_id)
    })
    
    if not document:
        print(f"❌ Document not found in database")
        print(f"   Searched for: filename={filename}, user_id={user_id}")
        
        # List all documents for this user for debugging
        user_docs = list(documents_collection.find({"user_id": ObjectId(user_id)}, {"filename": 1}))
        print(f"   User has {len(user_docs)} documents:")
        for doc in user_docs[:5]:  # Show first 5
            print(f"     - {doc.get('filename')}")
        
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    file_path = document["file_path"]
    print(f"✅ Document found in database")
    print(f"   File path: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found on disk: {file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )
    
    print(f"✅ File exists on disk, serving PDF")
    print(f"{'='*60}\n")
    
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename
    )


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    """
    Delete a document (removes from MongoDB and Pinecone)
    """
    documents_collection = get_documents_collection()
    user_id = current_user["user_id"]
    
    # Find document
    document = documents_collection.find_one({
        "_id": ObjectId(document_id),
        "user_id": ObjectId(user_id)
    })
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Delete from Pinecone
    PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
    INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "intellibase-prod")
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    
    # Delete vectors for this document
    namespace = document["pinecone_namespace"]
    chunk_count = document.get("chunk_count", 0)
    vector_ids = [f"{document_id}_chunk_{i}" for i in range(chunk_count)]
    
    if vector_ids:
        index.delete(ids=vector_ids, namespace=namespace)
    
    # Delete file from disk
    if os.path.exists(document["file_path"]):
        os.remove(document["file_path"])
    
    # Delete from MongoDB
    documents_collection.delete_one({"_id": ObjectId(document_id)})
    
    return {"message": "Document deleted successfully"}
