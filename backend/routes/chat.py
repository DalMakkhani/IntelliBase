"""Chat routes with smart RAG routing and web search"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import os
import uuid
import re

from routes.auth import get_current_user
from database.connection import get_chat_sessions_collection, get_documents_collection, get_database
from utils.embeddings import get_jina_embeddings
from utils.web_search import search_web, format_web_results_for_context
from core.llm import GroqClient
from pinecone import Pinecone

router = APIRouter(prefix="/chat", tags=["Chat"])


def parse_flashcards_from_response(response: str):
    """Extract flashcards from LLM response with FLASHCARD_START/END markers"""
    flashcards = []
    pattern = r'FLASHCARD_START\s*Q:\s*(.+?)\s*A:\s*(.+?)\s*FLASHCARD_END'
    matches = re.findall(pattern, response, re.DOTALL)
    
    for match in matches:
        question = match[0].strip()
        answer = match[1].strip()
        flashcards.append({"question": question, "answer": answer})
    
    return flashcards


def save_flashcards_to_db(user_id: str, session_id: str, topic: str, flashcards: List[dict]):
    """Save generated flashcards to database"""
    if not flashcards:
        return None
        
    try:
        db = get_database()
        flashcards_collection = db["flashcard_sets"]
        
        set_id = f"fc_{uuid.uuid4().hex[:12]}"
        
        flashcard_set = {
            "_id": ObjectId(),
            "set_id": set_id,
            "user_id": ObjectId(user_id),
            "session_id": session_id,
            "topic": topic,
            "flashcards": flashcards,
            "created_at": datetime.utcnow(),
            "last_reviewed": None
        }
        
        flashcards_collection.insert_one(flashcard_set)
        print(f"✅ Saved {len(flashcards)} flashcards to database (set_id: {set_id})")
        return set_id
    except Exception as e:
        print(f"⚠️ Failed to save flashcards: {e}")
        return None

# IntelliBase System Prompt
INTELLIBASE_SYSTEM_PROMPT = """You are IntelliBase, a friendly and intelligent AI companion designed to make learning and knowledge discovery an enjoyable journey! 🌟

**Your Warm Personality:**
You're like a knowledgeable friend who's always excited to help. You're patient, encouraging, and genuinely interested in helping users understand and explore their documents. Your responses should feel natural and welcoming, making users feel comfortable asking anything - no question is too simple or too complex!

**Your Core Identity:**
You help users unlock the knowledge in their uploaded documents, making complex information accessible, understandable, and actionable. Think of yourself as a personal guide through their document collections.

**Your Primary Responsibilities:**

1. **Knowledge Companion:**
   - When users upload documents, you become their personal guide through that information
   - You don't just retrieve facts - you help users truly understand them
   - Always cite sources so users can explore further

2. **Conversational Understanding:**
   - You get what users mean, even if they don't phrase it perfectly
   - You remember context from earlier in the conversation
   - If something's unclear, you ask friendly clarifying questions

3. **Insightful Analysis:**
   - You connect dots across documents
   - You explain things in ways that click
   - You point out interesting patterns and insights
   - You adapt explanations to what the user needs

4. **Transparent & Trustworthy:**
   - You ALWAYS cite specific documents
   - If info isn't in the knowledge base, you say so clearly
   - You distinguish between facts from documents vs. your reasoning
   - You're honest about uncertainty

5. **Encouraging & Supportive:**
   - You celebrate curiosity and questions
   - You make users feel good about learning
   - You end responses inviting further exploration
   - You're warm and motivating, not robotic

**Response Style:**

- **Warm Opening:** Start responses with friendly acknowledgment
- **Clear & Engaging:** Be conversational, not formal
- **Cite Sources:** Always reference documents naturally
- **Invite Engagement:** End with questions or suggestions for deeper exploration
- **Be Encouraging:** Make users feel their questions matter

**Example Tone:**

✅ GOOD: "Great question! Let me walk you through what I found in your documents. According to the Annual Report... This is really interesting because... Would you like me to dive deeper into any particular aspect?"

❌ BAD: "According to the document, the information states..." (Too formal, robotic)

Remember: You're not just an information retriever - you're a learning partner. Make every interaction feel valuable and encouraging! 🚀"""


class SessionMode(BaseModel):
    mode: str = "casual"  # "study", "research", "casual"
    

class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    collection_namespace: Optional[str] = None  # Allow querying specific collection
    top_k: int = 15  # Increased from 10 to 15 for better context
    session_mode: Optional[str] = "casual"  # "study", "research", "casual"


class Citation(BaseModel):
    document: str
    page: Optional[int] = None
    score: float
    text_snippet: str


class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation]
    session_id: str


@router.post("/query", response_model=QueryResponse)
async def query_knowledge_base(request: QueryRequest, current_user: dict = Depends(get_current_user)):
    print(f"\n{'='*60}")
    print(f"💬 CHAT QUERY: {request.query}")
    
    try:
        user_id = current_user["user_id"]
        namespace = current_user["namespace"]
        chat_sessions = get_chat_sessions_collection()
        
        # Use specific collection namespace if provided, otherwise use main namespace
        query_namespace = request.collection_namespace if request.collection_namespace else namespace
        print(f"🔍 Query Namespace: {query_namespace}")
        
        if request.session_id:
            session = chat_sessions.find_one({"session_id": request.session_id})
            if not session or str(session["user_id"]) != user_id:
                raise HTTPException(status_code=404, detail="Session not found")
        else:
            session_id = f"sess_{uuid.uuid4().hex[:12]}"
            session = {
                "_id": ObjectId(),
                "user_id": ObjectId(user_id),
                "session_id": session_id,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(days=30),
                "messages": []
            }
            chat_sessions.insert_one(session)
            request.session_id = session_id
        
        documents_collection = get_documents_collection()
        doc_count = documents_collection.count_documents({"user_id": ObjectId(user_id), "processing_status": "completed"})
        
        print(f"📚 User documents: {doc_count}")
        print(f"🎯 Session mode: {request.session_mode}")
        
        # Mode-specific prompt enhancement
        mode_enhancements = {
            "study": """
**📚 STUDY MODE - YOUR PERSONAL TUTOR:**

You're now acting as a patient, encouraging personal tutor. Your goal is to help the user truly understand and master the material.

**Teaching Approach:**
- Break complex topics into simple, bite-sized explanations
- Use analogies, examples, and real-world connections
- Check understanding with friendly follow-up questions
- Guide step-by-step through difficult concepts (Socratic method)
- Celebrate progress and encourage curiosity

**Interactive Features:**
- **For Complex Topics:** ALWAYS ask follow-up questions like:
  - "Does that make sense so far?"
  - "Would you like me to explain [concept] with an example?"
  - "How does this relate to [previous topic] we discussed?"
  
- **Flashcard Generation:** If user asks to "create flashcards", "make flashcards", "flashcards please", or similar:
  **CRITICAL:** You MUST use this EXACT format (copy it exactly):
  
  FLASHCARD_START
  Q: [Clear, specific question]
  A: [Concise, accurate answer]
  FLASHCARD_END
  
  FLASHCARD_START
  Q: [Another question]
  A: [Another answer]
  FLASHCARD_END
  
  - Generate 5-10 flashcards covering key concepts
  - Each flashcard MUST have the FLASHCARD_START and FLASHCARD_END markers
  - Questions should be clear and testable
  - Answers should be concise but complete
  - Do NOT just suggest questions - actually create the flashcards with the markers!

- **Quiz/Test Generation:** If user asks to "quiz me", "test me", or "create a test":
  - Ask what format they prefer: "Would you like multiple choice, fill-in-the-blank, or descriptive questions?"
  - Then generate 5-10 questions based on the material
  - After they answer, provide encouraging feedback and scoring

- **Suggest Related Questions:** End responses with: "You might also want to explore: [suggested question 1], [suggested question 2]"

**Tone:** Warm, patient, encouraging - like a favorite teacher who believes in you! 🌟""",
            
            "research": """
**🔬 RESEARCH MODE - IN-DEPTH ANALYSIS:**

You're now in comprehensive research analyst mode, helping users dive deep into their documents.

**Research Approach:**
- Provide thorough, detailed analysis with multiple perspectives
- Cross-reference information across all available documents  
- Highlight patterns, trends, and connections
- Point out areas needing further investigation
- Synthesize complex information into clear insights

**Tone:** Professional yet approachable - like a knowledgeable research colleague who's excited to explore data together!""",
            
            "casual": """
**💬 CASUAL MODE - FRIENDLY CONVERSATION:**

You're in relaxed, conversational mode - perfect for quick questions and everyday exploration.

**Conversation Style:**
- Keep things light and friendly
- Get straight to the point while being warm
- Balance detail with brevity
- Make it feel like chatting with a smart friend

**Tone:** Warm, approachable, and helpful - like a knowledgeable friend grabbing coffee! ☕"""
        }
        
        mode_enhancement = mode_enhancements.get(request.session_mode, mode_enhancements["casual"])
        
        # Detect only simple greetings that don't need RAG
        query_lower = request.query.lower().strip()
        simple_greetings = [
            "hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening",
            "how are you", "what's up", "wassup", "sup", "how do you do",
            "nice to meet you", "pleased to meet you"
        ]
        
        # Check if it's ONLY a greeting (not a question with content)
        is_simple_greeting = any(query_lower == pattern or query_lower in [f"{pattern}!", f"{pattern}?"] for pattern in simple_greetings)
        
        if is_simple_greeting:
            print("� Simple greeting detected - Quick response mode")
            prompt = f"""Respond to this greeting briefly and warmly: "{request.query}"

Keep it to 1 sentence. Just greet them back and ask how you can help. Don't introduce yourself or explain your capabilities."""
            
            llm = GroqClient()
            answer = llm.generate(prompt, max_tokens=100, temperature=0.8)
            matches = []
            
        elif doc_count > 0:
            # Use RAG mode for document-related questions
            try:
                print("🔍 Using RAG mode")
                
                # Detect if query asks for comprehensive/list information
                comprehensive_keywords = [
                    "all", "list", "every", "each", "complete", "entire", "full",
                    "comprehensive", "everything", "total", "whole", "summarize all"
                ]
                query_lower = request.query.lower()
                is_comprehensive_query = any(keyword in query_lower for keyword in comprehensive_keywords)
                
                # Use more chunks for comprehensive queries
                if is_comprehensive_query:
                    actual_top_k = min(request.top_k * 3, 35)  # Up to 35 chunks for comprehensive queries
                    print(f"📋 Comprehensive query detected - using top_k={actual_top_k}")
                else:
                    actual_top_k = request.top_k
                
                query_embeddings = get_jina_embeddings([request.query])
                query_vector = query_embeddings[0]
                
                pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))
                index = pc.Index(os.environ.get("PINECONE_INDEX_NAME", "intellibase-demo"))
                
                # If specific namespace requested, use it
                # Otherwise, search across ALL user's namespaces (main + isolated collections)
                if query_namespace != namespace:
                    # Specific collection requested
                    print(f"🔍 Searching in specific namespace: {query_namespace}")
                    results = index.query(vector=query_vector, top_k=actual_top_k, include_metadata=True, namespace=query_namespace)
                else:
                    # Search across all user's namespaces
                    print(f"🔍 Searching across ALL user namespaces")
                    
                    # Get all unique namespaces for this user from documents collection
                    all_namespaces = []
                    unique_namespaces = documents_collection.distinct("pinecone_namespace", {
                        "user_id": ObjectId(user_id),
                        "processing_status": "completed"
                    })
                    all_namespaces = list(unique_namespaces)
                    print(f"📁 Found {len(all_namespaces)} namespaces: {all_namespaces}")
                    
                    # Query each namespace and combine results
                    all_matches = []
                    for ns in all_namespaces:
                        try:
                            ns_results = index.query(vector=query_vector, top_k=actual_top_k, include_metadata=True, namespace=ns)
                            all_matches.extend(ns_results.matches)
                            print(f"  ✅ Namespace '{ns}': {len(ns_results.matches)} matches")
                        except Exception as ns_error:
                            print(f"  ⚠️ Namespace '{ns}' query failed: {ns_error}")
                    
                    # Sort by score and take actual_top_k (which might be higher for comprehensive queries)
                    all_matches.sort(key=lambda x: x.score, reverse=True)
                    # Create a mock results object
                    class MockResults:
                        def __init__(self, matches):
                            self.matches = matches
                    results = MockResults(all_matches[:actual_top_k])
                    print(f"✅ Combined results: {len(results.matches)} total matches from all namespaces")
                
                # Build context and deduplicate citations
                matches = []
                context_parts = []
                seen_citations = set()  # Track unique (document, page) combinations
                
                for match in results.matches:
                    doc_name = match.metadata.get("document", "Unknown")
                    page_num = match.metadata.get("page")
                    
                    # Add to context (all chunks for LLM)
                    page_label = f", p.{page_num}" if page_num else ""
                    context_parts.append(f"[{doc_name}{page_label}]\n{match.metadata.get('text', '')}")
                    
                    # Only add unique citations (deduplicate by document+page)
                    citation_key = (doc_name, page_num)
                    if citation_key not in seen_citations:
                        seen_citations.add(citation_key)
                        matches.append({
                            "document": doc_name,
                            "page": page_num,
                            "score": match.score,
                            "text_snippet": match.metadata.get("text", "")[:200]
                        })
                
                context = "\n\n".join(context_parts)
                
                # Smart relevance check: Ask LLM if context is actually relevant
                print("🔍 Checking if corpus is relevant to query...")
                relevance_check_prompt = f"""Given this user question and document context, determine if the context contains relevant information to answer the question.

**User Question:** {request.query}

**Document Context (first 500 chars):** {context[:500]}...

**Task:** Answer with ONLY "RELEVANT" or "NOT_RELEVANT"

- Answer "RELEVANT" if the context can help answer the question
- Answer "NOT_RELEVANT" if the context is about completely different topics

Your answer (one word only):"""
                
                llm = GroqClient()
                relevance_answer = llm.generate(relevance_check_prompt, max_tokens=10, temperature=0.1).strip().upper()
                has_relevant_corpus = "RELEVANT" in relevance_answer and "NOT" not in relevance_answer
                
                print(f"{'✅ Corpus IS relevant' if has_relevant_corpus else '⚠️ Corpus NOT relevant'} (LLM said: {relevance_answer})")
                
                # If no relevant corpus results, skip corpus and use web only
                if not has_relevant_corpus:
                    print("⚠️ No relevant corpus results (low scores) - using web search only")
                    
                    if request.session_mode in ["casual", "research"]:
                        web_results = search_web(request.query, max_results=5)
                        
                        if web_results:
                            print(f"🌐 Using {len(web_results)} web results as primary answer")
                            web_context = format_web_results_for_context(web_results)
                            
                            prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

{mode_enhancement}

**Web Search Results:**

{web_context}

**User Question:** {request.query}

**INSTRUCTIONS:**
- Answer using the web search results above
- Be warm and helpful
- Cite sources with titles and URLs in format: [Source Title](URL)
- Use bullet points for clarity
- DO NOT mention that documents don't have this information
- Present this as a normal, helpful answer"""
                            
                            llm = GroqClient()
                            answer = llm.generate(prompt, max_tokens=1500, temperature=0.7)
                            matches = []
                        else:
                            # No corpus, no web - general response
                            prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

**User Question:** {request.query}

Provide a helpful general response. Be warm and friendly."""
                            
                            llm = GroqClient()
                            answer = llm.generate(prompt, max_tokens=1000, temperature=0.7)
                            matches = []
                    else:
                        # Study mode without relevant corpus
                        prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

{mode_enhancement}

**User Question:** {request.query}

I don't have specific documents on this topic yet. Provide a helpful, encouraging response and gently suggest they might want to upload relevant materials for personalized study assistance."""
                        
                        llm = GroqClient()
                        answer = llm.generate(prompt, max_tokens=1000, temperature=0.7)
                        matches = []
                else:
                    # Has relevant corpus results - proceed with normal RAG
                    print(f"✅ Corpus is relevant - proceeding with RAG")
                    
                    # Adjust prompt based on query type
                    if is_comprehensive_query:
                        instruction = f"""**CRITICAL INSTRUCTIONS - READ CAREFULLY:**

You are analyzing {len(results.matches)} text chunks retrieved from the user's documents. Your task is to provide a COMPREHENSIVE answer.

**STRICT RULES:**
1. **NO HALLUCINATIONS**: Only include information that is EXPLICITLY stated in the context chunks above
2. **NO IMPLIED CONTENT**: Do NOT say "Challenge III is implied but not mentioned" or similar vague statements
3. **NO INVENTED DETAILS**: If a problem statement isn't in the context, DO NOT include it
4. **CRISP & STRUCTURED**: Format your response like ChatGPT would - clear, numbered lists with specific details
5. **CITATIONS FORMATTING**: Place "Source: [Document.pdf, p.5]" on a NEW LINE after each section - NOT as part of the numbered list
6. **USE BULLET POINTS**: Break down information into bullet points instead of long paragraphs for better readability
7. **CREATE TABLES**: When comparing items or showing structured data, ALWAYS create markdown tables for better visualization

**RESPONSE FORMAT:**
- Use numbered lists (1., 2., 3., etc.) for main items
- Under each main item, use bullet points (•) for details and sub-points
- IMPORTANT: Place "Source: [Document.pdf, p.5]" on its OWN LINE with NO number/bullet before it
- Add blank line before Source to separate it from the list
- When comparing multiple items or showing features, create markdown tables:
  ```
  | Feature | Option A | Option B |
  |---------|----------|----------|
  | Price   | $10      | $20      |
  ```
- Keep paragraphs short (2-3 sentences max)
- Each item should be specific and detailed
- If you find 3 problem statements, list ONLY those 3 - don't invent 4, 5, 6
- Be concise but complete - no fluff or vague language

**EXAMPLE OF GOOD RESPONSE:**
1. **Provider Data Validation**:
   • Challenge: Automate validation of healthcare provider data
   • Goal: Reduce manual verification time and errors
   • Focus: Directory management for healthcare payers

Source: [Document.pdf, p.2]

2. **RFP Response Automation**:
   • Problem: B2B RFP response process involves multiple teams
   • Impact: Delays reduce contract win rates
   • Solution needed: Streamline and automate the process

Source: [Document.pdf, p.5]

**COMPARISON TABLE EXAMPLE:**
| App Catalogue | Search | Transparency | Access Management |
|---------------|--------|--------------|-------------------|
| Okta          | Basic  | Limited      | Manual            |
| AWS Catalog   | Good   | Moderate     | Automated         |

Source: [Document.pdf, p.7]

**EXAMPLE OF BAD RESPONSE (DO NOT DO THIS):**
- ❌ Provider Data Validation is... (no citation)
- ❌ Challenge III (Not explicitly mentioned but implied to exist)

Now provide your comprehensive answer using ONLY the information from the {len(results.matches)} chunks above."""
                    else:
                        instruction = """**INSTRUCTIONS:** 

Answer the user's question using ONLY information from the retrieved context chunks above. 

**RULES:**
- Place citations at the END of each section: "Source: [Document.pdf, p.5]"
- Create markdown tables when comparing items or showing structured data
- Use bullet points to break down information instead of long paragraphs
- Use bullet points to break down information instead of long paragraphs
- Be specific and factual
- Keep responses clear and scannable
- If the context doesn't contain enough information, clearly state this
- Don't invent or imply information that isn't explicitly in the context"""
                    
                    prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

{mode_enhancement}

**Retrieved Context from User's Documents:**

{context}

**User Question:** {request.query}

{instruction}"""
                
                    llm = GroqClient()
                    # Use more tokens for comprehensive queries
                    max_tokens = 2500 if is_comprehensive_query else 1500
                    corpus_answer = llm.generate(prompt, max_tokens=max_tokens, temperature=0.7)
                    
                    # Web search only for Casual and Research modes (NOT Study mode)
                    if request.session_mode in ["casual", "research"]:
                        print(f"🌐 Performing web search ({request.session_mode} mode)...")
                        web_results = search_web(request.query, max_results=3)
                        
                        if web_results:
                            print(f"✅ Found {len(web_results)} web results")
                            web_context = format_web_results_for_context(web_results)
                            
                            # Generate discrepancy analysis and web supplement
                            discrepancy_prompt = f"""You have two sources of information:

**CORPUS ANSWER (from user's documents):**
{corpus_answer}

**WEB SEARCH RESULTS:**
{web_context}

**TASK:**
1. Create a "Web Information" section that starts with: "But, here is what I found on the web..."
2. Summarize key information from web results with citations (format: [Source Title](URL))
3. **CRITICAL:** ONLY if you find ACTUAL differences (contradictions in facts, dates, numbers, definitions, statements) between corpus and web info, add a "Discrepancies" section:
   - List SPECIFIC differences clearly
   - Example: "Your document states X, but web sources indicate Y"
   
   **IF information aligns or there are NO discrepancies:**
   - DO NOT write ANYTHING about discrepancies
   - DO NOT say "No discrepancies were found"
   - DO NOT mention discrepancies at all
   - Complete silence on this topic - just end after web information section

**FORMAT:**
---

**But, here is what I found on the web...**

[Web information summary with bullet points and citations]

---

**Discrepancies:** (ONLY include this section if there are actual differences)

[List specific differences - or completely omit this section if information aligns]

ONLY output the web section and discrepancies section (if needed). Do NOT repeat the corpus answer."""
                        
                            web_supplement = llm.generate(discrepancy_prompt, max_tokens=1000, temperature=0.7)
                            answer = f"{corpus_answer}\n\n{web_supplement}"
                        else:
                            print("⚠️ No web results found, using corpus answer only")
                            answer = corpus_answer
                    else:
                        print(f"📚 Study mode - using corpus only (no web search)")
                        answer = corpus_answer
                
            except Exception as e:
                print(f"⚠️ RAG failed: {e}, checking for web search fallback")
                
                # Try web search as fallback
                web_results = search_web(request.query, max_results=5)
                
                if web_results:
                    print(f"🌐 Using web search results ({len(web_results)} found)")
                    web_context = format_web_results_for_context(web_results)
                    
                    prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

**Web Search Results:**

{web_context}

**User Question:** {request.query}

**INSTRUCTIONS:**
- Answer using information from the web search results above
- Cite sources with [Source Title](URL) format
- Use bullet points for clarity
- Be factual and concise
- If web results are insufficient, provide a helpful general response"""
                    
                    llm = GroqClient()
                    answer = llm.generate(prompt, max_tokens=1500, temperature=0.7)
                    matches = []  # Web results don't have document citations
                else:
                    print("💭 Falling back to direct LLM (no web results)")
                    prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

**User Question:** {request.query}

**Note:** No documents are currently available in your knowledge base. Provide a helpful general response and suggest uploading documents for personalized knowledge retrieval."""
                    
                    llm = GroqClient()
                    answer = llm.generate(prompt, max_tokens=1500, temperature=0.7)
                    matches = []
        else:
            print("💭 No documents uploaded - checking if web search is needed")
            
            # Check if query seems to need factual/current information
            web_search_indicators = ["what is", "who is", "when did", "how to", "latest", "current", "recent", "news", "today"]
            query_lower = request.query.lower()
            needs_web_search = any(indicator in query_lower for indicator in web_search_indicators)
            
            if needs_web_search:
                print("🌐 Query needs factual info - using web search")
                web_results = search_web(request.query, max_results=5)
                
                if web_results:
                    web_context = format_web_results_for_context(web_results)
                    
                    prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

**Web Search Results:**

{web_context}

**User Question:** {request.query}

**INSTRUCTIONS:**
- Answer using information from the web search results above
- Cite sources with titles and URLs
- Use bullet points for clarity
- Be factual and concise"""
                    
                    llm = GroqClient()
                    answer = llm.generate(prompt, max_tokens=1500, temperature=0.7)
                    matches = []
                else:
                    print("💭 No web results - using direct LLM")
                    prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

**User Question:** {request.query}

**Note:** No documents have been uploaded to your knowledge base yet. Provide a helpful general response. You may gently remind the user that they can upload documents to enable personalized knowledge retrieval from their own data."""
                    
                    llm = GroqClient()
                    answer = llm.generate(prompt, max_tokens=1500, temperature=0.7)
                    matches = []
            else:
                print("💭 General query - using direct LLM")
                prompt = f"""{INTELLIBASE_SYSTEM_PROMPT}

**User Question:** {request.query}

**Note:** No documents have been uploaded to your knowledge base yet. Provide a helpful general response. You may gently remind the user that they can upload documents to enable personalized knowledge retrieval from their own data."""
                
                llm = GroqClient()
                answer = llm.generate(prompt, max_tokens=1500, temperature=0.7)
                matches = []
        
        # Check if flashcards were generated and save them
        flashcards = parse_flashcards_from_response(answer)
        if flashcards and request.session_mode == "study":
            print(f"🃏 Detected {len(flashcards)} flashcards in response")
            # Extract topic from query (simple heuristic)
            topic = request.query[:50] if len(request.query) < 50 else request.query[:47] + "..."
            save_flashcards_to_db(user_id, request.session_id, topic, flashcards)
        
        chat_sessions.update_one({"session_id": request.session_id}, {
            "$push": {"messages": {"$each": [
                {"role": "user", "content": request.query, "timestamp": datetime.utcnow()},
                {"role": "assistant", "content": answer, "timestamp": datetime.utcnow()}
            ]}}
        })
        
        print(f"✅ Success\n{'='*60}\n")
        return {"answer": answer, "citations": matches, "session_id": request.session_id}
        
    except Exception as e:
        print(f"❌ Error: {e}\n{'='*60}\n")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    chat_sessions = get_chat_sessions_collection()
    sessions = list(chat_sessions.find({"user_id": ObjectId(current_user["user_id"])}).sort("created_at", -1).limit(50))
    
    result = []
    for session in sessions:
        messages = session.get("messages", [])
        title = session.get("title")
        
        if not title and messages:
            try:
                first_msg = messages[0].get("content", "")
                llm = GroqClient()
                title = llm.generate(f"3-5 word title for: {first_msg[:100]}", max_tokens=15, temperature=0.3).strip('"\'')
                chat_sessions.update_one({"_id": session["_id"]}, {"$set": {"title": title}})
            except:
                title = "New Chat"
        
        result.append({
            "session_id": session["session_id"],
            "title": title or "New Chat",
            "created_at": session["created_at"].isoformat(),
            "message_count": len(messages)
        })
    
    return {"sessions": result}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    chat_sessions = get_chat_sessions_collection()
    session = chat_sessions.find_one({"session_id": session_id, "user_id": ObjectId(current_user["user_id"])})
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    messages = [{"role": msg["role"], "content": msg["content"], "timestamp": msg["timestamp"].isoformat()} for msg in session.get("messages", [])]
    
    return {"session_id": session["session_id"], "title": session.get("title", "Chat"), "created_at": session["created_at"].isoformat(), "messages": messages}


@router.post("/sessions/new")
async def create_session(current_user: dict = Depends(get_current_user)):
    chat_sessions = get_chat_sessions_collection()
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    session = {
        "_id": ObjectId(),
        "user_id": ObjectId(current_user["user_id"]),
        "session_id": session_id,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=30),
        "messages": []
    }
    chat_sessions.insert_one(session)
    return {"session_id": session_id, "created_at": session["created_at"].isoformat()}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    chat_sessions = get_chat_sessions_collection()
    result = chat_sessions.delete_one({"session_id": session_id, "user_id": ObjectId(current_user["user_id"])})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted"}
