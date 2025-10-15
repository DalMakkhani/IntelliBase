"""
Web search utilities using Tavily AI
"""
import os
from typing import List, Dict
from tavily import TavilyClient

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

def search_web(query: str, max_results: int = 5) -> List[Dict]:
    """
    Search the web using Tavily AI
    
    Args:
        query: Search query
        max_results: Maximum number of results to return
        
    Returns:
        List of search results with title, url, content, and score
    """
    if not TAVILY_API_KEY:
        print("⚠️  TAVILY_API_KEY not set, skipping web search")
        return []
    
    try:
        client = TavilyClient(api_key=TAVILY_API_KEY)
        
        print(f"🌐 Searching web for: {query}")
        response = client.search(
            query=query,
            max_results=max_results,
            search_depth="basic",  # "basic" or "advanced"
            include_answer=True,   # Get AI-generated answer
            include_raw_content=False
        )
        
        results = []
        for result in response.get("results", []):
            results.append({
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "content": result.get("content", ""),
                "score": result.get("score", 0)
            })
        
        # Add AI answer if available
        ai_answer = response.get("answer")
        if ai_answer:
            print(f"📝 Tavily AI Answer: {ai_answer[:200]}...")
        
        print(f"✅ Found {len(results)} web results")
        return results
        
    except Exception as e:
        print(f"❌ Web search failed: {e}")
        return []


def format_web_results_for_context(results: List[Dict], max_length: int = 3000) -> str:
    """
    Format web search results into a context string for the LLM
    
    Args:
        results: List of search results from search_web()
        max_length: Maximum character length for context
        
    Returns:
        Formatted context string
    """
    if not results:
        return ""
    
    context_parts = []
    current_length = 0
    
    for i, result in enumerate(results, 1):
        title = result.get("title", "Unknown")
        url = result.get("url", "")
        content = result.get("content", "")
        
        # Truncate content if needed
        if len(content) > 500:
            content = content[:500] + "..."
        
        part = f"**Web Result {i}: {title}**\nSource: {url}\n{content}\n"
        
        if current_length + len(part) > max_length:
            break
            
        context_parts.append(part)
        current_length += len(part)
    
    return "\n".join(context_parts)
