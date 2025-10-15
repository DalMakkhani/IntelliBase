"""
Modified Groq client that bypasses DNS issues by using direct IP resolution
"""
import os
import socket
from typing import List, Dict, Any
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())


# Monkey-patch DNS resolution to use Google DNS for Groq
_original_getaddrinfo = socket.getaddrinfo

def custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """Custom DNS resolver that uses known IPs for Groq"""
    if 'groq.com' in host:
        # Use the IPs we got from Google DNS
        groq_ips = ['172.64.147.158', '104.18.40.98']
        # Return the first IP in the correct format
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (groq_ips[0], port))]
    return _original_getaddrinfo(host, port, family, type, proto, flags)

# Apply the patch
socket.getaddrinfo = custom_getaddrinfo


class GroqClient:
    """Groq API client with DNS workaround for network issues"""

    def __init__(self):
        import requests
        self.requests = requests
        self.api_key = os.environ.get("GROQ_API_KEY")
        if not self.api_key:
            raise RuntimeError("GROQ_API_KEY not set. Please set it in your environment or .env file.")
        self.api_url = os.environ.get("GROQ_API_URL", "https://api.groq.com/openai/v1")
        self.model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    def generate(self, prompt: str, context: List[Dict[str, Any]] = None, **kwargs) -> str:
        """Generate text from the Groq-hosted model using chat completions API.

        Returns the generated text as a string.
        """
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        
        # Use OpenAI-compatible chat completions format
        messages = [{"role": "user", "content": prompt}]
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 512),
            "temperature": kwargs.get("temperature", 0.7),
        }
        
        url = f"{self.api_url}/chat/completions"
        resp = self.requests.post(url, json=payload, headers=headers, timeout=30)
        
        try:
            resp.raise_for_status()
        except Exception as e:
            # Provide clearer error message including status and body
            raise RuntimeError(f"Groq API error: {e}; status={resp.status_code}; body={resp.text}")
        
        data = resp.json()
        
        # Extract text from OpenAI-compatible response
        if "choices" in data and len(data["choices"]) > 0:
            choice = data["choices"][0]
            if "message" in choice:
                return choice["message"].get("content", "")
            elif "text" in choice:
                return choice["text"]
        
        # Fallback
        return str(data)


def get_llm_client() -> GroqClient:
    """Return a GroqClient instance (Groq is the provider for Llama in this project)."""
    return GroqClient()


def check_model_exists(model_name: str) -> Dict[str, Any]:
    """Helper that queries the Groq models endpoint to list or check a specific model.

    Requires `GROQ_API_KEY` and `GROQ_API_URL` set. Returns the parsed JSON response.
    """
    import requests
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set; cannot check models")
    api_url = os.environ.get("GROQ_API_URL", "https://api.groq.com/openai/v1")
    headers = {"Authorization": f"Bearer {api_key}"}
    url = f"{api_url}/models"
    r = requests.get(url, headers=headers, timeout=10)
    r.raise_for_status()
    data = r.json()
    # If model_name provided, try finding it
    matches = []
    models = data.get("data", []) if isinstance(data, dict) else data
    for m in models:
        # m could be string or dict with 'id'/'name'
        if isinstance(m, str) and model_name in m:
            matches.append(m)
        elif isinstance(m, dict):
            if model_name in m.get("id", "") or model_name in m.get("name", ""):
                matches.append(m)
    return {"available": data, "matches": matches}
