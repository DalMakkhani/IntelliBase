"""
IntelliBase - FastAPI Backend
Main application with authentication and RAG endpoints
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from parent directory
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
print(f"✅ Loaded .env from: {env_path}")
print(f"✅ PINECONE_API_KEY: {'Set' if os.getenv('PINECONE_API_KEY') else 'NOT SET'}")
print(f"✅ JINA_API_KEY: {'Set' if os.getenv('JINA_API_KEY') else 'NOT SET'}")
print(f"✅ MONGODB_URI: {'Set' if os.getenv('MONGODB_URI') else 'NOT SET'}")

# Import routers
from routes.auth import router as auth_router
from routes.documents import router as documents_router
from routes.chat import router as chat_router
from routes.flashcards import router as flashcards_router

# Create FastAPI app
app = FastAPI(
    title="IntelliBase API",
    description="RAG Knowledge Base with Citations and Chat Memory",
    version="1.0.0"
)

# Configure CORS - Allow all origins for development
print("🌐 Configuring CORS for all origins")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Include routers
app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(chat_router)
app.include_router(flashcards_router)


@app.get("/")
async def root():
    """API health check"""
    return {
        "message": "IntelliBase API is running",
        "version": "1.0.0",
        "endpoints": {
            "auth": "/auth",
            "documents": "/documents",
            "chat": "/chat",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
