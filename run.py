import uvicorn
import os
import sys

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload_mode = os.getenv("RELOAD", "false").lower() == "true"

    print("=" * 60)
    print("  ResuForge AI — ATS Checker & Executive Resume Builder")
    print("  FastAPI + Google Gemini API")
    print("=" * 60)
    print(f"  Application running at: http://{host}:{port}")
    print(f"  Interactive Swagger Docs: http://{host}:{port}/docs")
    print("=" * 60)

    # Ensure working directory is project root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, current_dir)

    uvicorn.run("app.main:app", host=host, port=port, reload=reload_mode)
