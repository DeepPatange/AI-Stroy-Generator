#!/usr/bin/env python3
"""
Quick Start Script for Q&A Interactive Storytelling

Run this script to start the application:
    python run.py

This will:
1. Check if Ollama is running
2. Start the FastAPI server
3. Open the browser
"""

import subprocess
import sys
import time
import webbrowser
import httpx

def check_ollama():
    """Check if Ollama server is running"""
    try:
        response = httpx.get("http://localhost:11434/api/tags", timeout=5.0)
        if response.status_code == 200:
            models = response.json().get("models", [])
            if models:
                print(f"✓ Ollama is running with {len(models)} model(s) available")
                for model in models[:3]:
                    print(f"  - {model['name']}")
                return True
            else:
                print("⚠ Ollama is running but no models installed")
                print("  Run: ollama pull llama3.2")
                return False
        return False
    except Exception:
        return False

def main():
    print("=" * 50)
    print("Q&A Based Interactive Storytelling")
    print("=" * 50)
    print()

    # Check Ollama
    print("Checking Ollama status...")
    if not check_ollama():
        print()
        print("⚠ Ollama is not running!")
        print()
        print("Please start Ollama first:")
        print("  1. Open a new terminal")
        print("  2. Run: ollama serve")
        print("  3. Then run this script again")
        print()
        print("If you don't have Ollama installed:")
        print("  Visit: https://ollama.ai/download")
        print()

        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)

    print()
    print("Starting web server...")
    print()
    print("=" * 50)
    print("Open your browser to: http://localhost:8000")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    print()

    # Open browser after a short delay
    def open_browser():
        time.sleep(2)
        webbrowser.open("http://localhost:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # Start uvicorn
    try:
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    main()
