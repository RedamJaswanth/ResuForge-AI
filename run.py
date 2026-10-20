import uvicorn
import os
import sys

if __name__ == "__main__":
    print("=" * 60)
    print("  ResuForge AI — ATS Checker & Executive Resume Builder")
    print("  FastAPI + Google Gemini API")
    print("=" * 60)
    print("  Application running at: http://127.0.0.1:8000")
    print("  Interactive Swagger Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)

    # Ensure working directory is project root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, current_dir)

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
