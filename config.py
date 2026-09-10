import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY", "")
MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.3-70b-versatile")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 8000))

# Verified active Groq LLM models
VERIFIED_MODELS = [
    "llama-3.3-70b-versatile",
    "deepseek-r1-distill-llama-70b",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768"
]

# Workspace path to analyze/modify
WORKSPACE_DIR = BASE_DIR

def get_ai_client() -> OpenAI:
    """Returns an OpenAI client configured for Groq or standard OpenAI."""
    if not GROQ_API_KEY:
        raise ValueError("Missing GROQ_API_KEY or OPENAI_API_KEY in environment!")
    
    return OpenAI(
        api_key=GROQ_API_KEY,
        base_url=GROQ_BASE_URL
    )

def get_hardware_device_info() -> dict:
    """Detects available hardware compute acceleration (GPU CUDA vs CPU)."""
    device_name = "CPU"
    cuda_available = False
    device_count = 0
    try:
        import torch
        cuda_available = torch.cuda.is_available()
        if cuda_available:
            device_count = torch.cuda.device_count()
    except ImportError:
        pass
    device_type = "cuda" if cuda_available else "cpu"
    return {
        'device_type': device_type,
        'device_name': device_name,
        'cuda_available': cuda_available,
        'device_count': device_count
    }

# Added a new route for the calculator
from http.server import BaseHTTPRequestHandler, HTTPServer

class CalculatorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/calculator':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            with open('calculator.html', 'rb') as file:
                self.wfile.write(file.read())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Not Found')

if __name__ == '__main__':
    # Create the server
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, CalculatorHandler)
    print('Starting httpd on port %d...' % PORT)
    httpd.serve_forever()