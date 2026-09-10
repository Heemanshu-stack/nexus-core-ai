import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY", "")
MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))

VERIFIED_MODELS = [
    "llama-3.3-70b-versatile",
    "deepseek-r1-distill-llama-70b",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768"
]

WORKSPACE_DIR = BASE_DIR

def get_ai_client() -> OpenAI:
    """Returns an OpenAI client configured for Groq or standard OpenAI."""
    api_key = GROQ_API_KEY
    if not api_key:
        raise ValueError("GROQ_API_KEY is not configured in environment!")
    return OpenAI(
        api_key=api_key,
        base_url=GROQ_BASE_URL
    )

def get_hardware_device_info() -> dict:
    device_name = "CPU"
    cuda_available = False
    device_count = 0
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            device_count = torch.cuda.device_count()
    except Exception:
        pass
    device_type = "cuda" if cuda_available else "cpu"
    return {
        'device_type': device_type,
        'device_name': device_name,
        'cuda_available': cuda_available,
        'device_count': device_count
    }
