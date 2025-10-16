# IntelliBase - AI-Powered Knowledge Base with RAG

IntelliBase is an intelligent document search and question-answering system that uses **Retrieval-Augmented Generation (RAG)** to help users extract insights from their PDF documents.
Click here to watch a demo: https://drive.google.com/file/d/1Jom9uLH9CyjqnIWfkDGEA8kXVUoJ4p2s/view?usp=drive_link

## Features

### Authentication & Security
- **Secure Authentication** - JWT-based user authentication with bcrypt password hashing
- **Protected Routes** - Token-based API access control

### Document Management
- **PDF Document Upload** - Upload and process multiple PDF files
- **Smart RAG Pipeline** - Automatic text extraction, chunking, and embedding generation
- **Document Collections** - Organize documents in main corpus or isolated collections
- **Real-time Processing** - Background document processing with status tracking

### Intelligent Chat
- **Multiple Session Modes** - Choose between Casual, Study, and Research modes:
  - **Casual Mode** - Balanced responses combining your documents with web search for comprehensive answers
  - **Study Mode** - Focused learning experience with warm, encouraging tone. Perfect for exam prep with flashcard generation and quiz features
  - **Research Mode** - In-depth analysis with comprehensive citations and web-enhanced research
- **Citation Tracking** - Every AI response includes source document citations with page numbers
- **Interactive Flashcards** - Generate and review flip-style flashcards from your study materials (Study mode)
- **Web-Enhanced Answers** - Combines corpus knowledge with real-time web search (Casual & Research modes)
- **Smart Relevance Detection** - Automatically determines when to use web search vs. document corpus

### Search & Retrieval
- **Semantic Search** - Advanced vector similarity search using Pinecone
- **Context-Aware Responses** - LLM-based relevance checking for accurate answers
- **Comprehensive Mode** - Deeper document search for complex queries

### User Interface
- **Modern UI** - Clean, responsive React interface with shadcn/ui components
- **PDF Viewer** - In-app document viewing with page navigation
- **Session Management** - Create, view, and organize chat sessions

## Architecture

### Backend (FastAPI + Python)
- **FastAPI** - High-performance web framework
- **MongoDB** - User data, documents, and chat sessions
- **Pinecone** - Vector database for semantic search
- **Jina AI** - 768-dimensional embeddings (jina-embeddings-v2-base-en)
- **Groq** - LLM inference (llama-3.3-70b-versatile)
- **PyPDF** - PDF text extraction

### Frontend (React + TypeScript)
- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **shadcn/ui** - Beautiful, accessible components
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tool
- **Axios** - API client with JWT interceptors

## Prerequisites

- **Python 3.9+** (backend)
- **Node.js 18+** (frontend)
- **MongoDB Atlas Account** (free tier works)
- **Pinecone Account** (free tier works)
- **Jina AI API Key** (free tier works)
- **Groq API Key** (free tier works)

## Quick Start

### 1. Clone and Setup Environment

```bash
cd "Unthinkable Project"
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your API keys:

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB_NAME=intellibase

# Pinecone
PINECONE_API_KEY=pcsk_your_api_key_here
PINECONE_INDEX_NAME=intellibase-demo

# Jina AI
JINA_API_KEY=jina_your_api_key_here
JINA_API_URL=https://api.jina.ai/v1/embeddings

# Groq (LLM)
GROQ_API_KEY=gsk_your_api_key_here
GROQ_API_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile

# JWT
JWT_SECRET=your-super-secret-key-change-this
JWT_ALGORITHM=HS256
```

### 3. Install Backend Dependencies

```bash
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# OR
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 5. Setup MongoDB (First Time Only)

```bash
cd backend
python setup_mongodb.py
```

This creates:
- `users` collection with schema validation
- `documents` collection with schema validation
- `chat_sessions` collection with TTL indexes
- Optimized indexes for performance

### 6. Start the Application

**Option A: Use PowerShell Scripts**
```powershell
# Terminal 1 - Backend
.\start-backend.ps1

# Terminal 2 - Frontend
.\start-frontend.ps1
```

**Option B: Manual Start**
```bash
# Terminal 1 - Backend
cd backend
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 7. Access the Application

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

## Usage

### 1. Create Account
1. Go to http://localhost:8080
2. Click "Sign Up"
3. Enter username, email, and password
4. You'll be logged in automatically

### 2. Upload Documents
1. Navigate to "Documents" page
2. Click "Upload Documents"
3. Select one or more PDF files
4. Choose "Main Corpus" or "Isolated Collection"
5. Wait for processing to complete

### 3. Chat with Your Documents
1. Navigate to "Chat" page
2. Select a session mode (Casual, Study, or Research)
3. Ask questions about your documents
4. Get AI-powered answers with citations
5. In Study mode, request flashcards to generate interactive review materials
6. View source documents for each answer

### 4. Manage Sessions
- Create new chat sessions
- View chat history
- Delete old sessions
- Auto-generated session titles

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout user

### Documents
- `POST /documents/upload` - Upload PDF files
- `GET /documents/list` - List user's documents
- `DELETE /documents/{id}` - Delete document

### Chat
- `POST /chat/query` - Ask question (with or without RAG)
- `GET /chat/sessions` - List chat sessions
- `GET /chat/sessions/{id}` - Get session details
- `POST /chat/sessions/new` - Create new session
- `DELETE /chat/sessions/{id}` - Delete session

## RAG Pipeline Details

### Document Processing Flow
1. **Upload** - PDF file saved to disk
2. **Text Extraction** - PyPDF extracts all text
3. **Chunking** - Text split into 500-char chunks (50-char overlap)
4. **Embedding** - Jina AI generates 768-dim vectors
5. **Storage** - Vectors uploaded to Pinecone with metadata
6. **Status Update** - MongoDB document marked as "completed"

### Query Flow
1. **User Question** - User submits query
2. **Document Check** - System checks if user has documents
3. **Routing Decision:**
   - **With Documents (RAG Mode):**
     - Generate query embedding (Jina)
     - Search Pinecone for similar chunks (top 3)
     - Build context from matches
     - Send to Groq with IntelliBase prompt + context
     - Return answer with citations
   - **Without Documents (Direct LLM):**
     - Send query directly to Groq
     - No RAG, no citations
     - Helpful general response
4. **Session Storage** - Save message to MongoDB

## Project Structure

```
IntelliBase/
├── backend/                    # FastAPI backend
│   ├── app.py                 # Main application
│   ├── auth/                  # Authentication modules
│   │   ├── jwt_handler.py    # JWT token management
│   │   └── password.py       # Password hashing
│   ├── core/                  # Core functionality
│   │   └── llm.py            # Groq LLM client
│   ├── database/              # Database connections
│   │   └── connection.py     # MongoDB client
│   ├── routes/                # API endpoints
│   │   ├── auth.py           # Auth endpoints
│   │   ├── chat.py           # Chat/RAG endpoints
│   │   └── documents.py      # Document endpoints
│   ├── utils/                 # Utility functions
│   │   ├── embeddings.py     # Jina AI + Pinecone
│   │   └── pdf_reader.py     # PDF text extraction
│   ├── uploads/               # User uploaded files
│   └── setup_mongodb.py       # MongoDB schema setup
├── frontend/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Page components
│   │   ├── lib/               # API client
│       │   └── contexts/      # React contexts
│       ├── public/            # Static assets
│       └── package.json       # Dependencies
├── .env                       # Environment variables (SECRET)
├── .env.example              # Environment template
├── requirements.txt          # Python dependencies
├── start-backend.ps1         # Backend startup script
├── start-frontend.ps1        # Frontend startup script
```
└── README.md                 # This file
```

## Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
```

## 🔐 Security Best Practices

1. **Never commit `.env`** - Already in `.gitignore`
2. **Strong JWT Secret** - Use 32+ character random string
3. **HTTPS in Production** - Use reverse proxy (nginx/Caddy)
4. **Rate Limiting** - Add rate limits to API endpoints
5. **Input Validation** - All inputs validated with Pydantic
6. **Password Security** - Bcrypt with automatic salting

## Troubleshooting

### Backend won't start
```bash
# Check if port 8000 is in use
netstat -ano | findstr :8000

# Kill conflicting process (replace PID)
taskkill /PID <PID> /F

# Restart backend
.\start-backend.ps1
```

### Frontend won't start
```bash
# Check if port 8080 is in use
netstat -ano | findstr :8080

# Kill conflicting process
taskkill /PID <PID> /F

# Clear cache and restart
cd frontend
Remove-Item -Recurse -Force node_modules, .vite
npm install
npm run dev
```

### MongoDB connection issues
- Verify `MONGODB_URI` in `.env`
- Check MongoDB Atlas network access (allow your IP)
- Ensure database user has read/write permissions

### Pinecone errors
- Verify `PINECONE_API_KEY` is correct
- Ensure index `intellibase-demo` exists (768 dimensions, cosine metric)
- Check Pinecone dashboard for quota limits

### Document upload fails
- Check PDF file is valid and not corrupted
- Ensure uploads directory has write permissions
- Verify Jina AI API key is valid
- Check backend logs for detailed error

## API Documentation

Interactive API documentation available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## IntelliBase System Prompt

The AI uses a comprehensive system prompt defining its identity as a knowledge retrieval assistant. It emphasizes:
- Accurate citations from source documents
- Transparency about limitations
- Clear distinction between facts and inferences
- Helpful responses with and without documents

## Data Retention

- **Documents:** Auto-expire after 30 days (configurable)
- **Chat Sessions:** Auto-expire after 30 days (MongoDB TTL index)
- **User Accounts:** No expiration (manual deletion required)

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Web Framework | FastAPI | High-performance async API |
| Database | MongoDB Atlas | User data & sessions |
| Vector DB | Pinecone | Semantic search |
| Embeddings | Jina AI | Text → 768-dim vectors |
| LLM | Groq (Llama 3.3 70B) | Answer generation |
| PDF Processing | PyPDF | Text extraction |
| Auth | JWT + Bcrypt | Secure authentication |
| Frontend | React + TypeScript | Modern UI |
| Styling | Tailwind + shadcn/ui | Beautiful components |

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved

## Acknowledgments

- Groq for fast LLM inference
- Jina AI for embeddings
- Pinecone for vector search
- MongoDB for data storage
- shadcn/ui for beautiful components

---

**Built with ❤️ for intelligent document search**
