import io
import os
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.models import (
    AnalysisRequest,
    ATSAnalysisResponse,
    BulletRewriteRequest,
    PDFExportRequest,
    StructuredResume
)
from app.parser_service import parse_uploaded_file
from app.gemini_service import (
    analyze_resume_ats,
    rewrite_single_bullet,
    parse_resume_to_structured
)
from app.pdf_generator import generate_ats_pdf

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resuforge")

app = FastAPI(
    title="ResuForge AI - ATS Checker & Resume Builder",
    description="Executive-grade AI ATS resume scoring, Google X-Y-Z bullet rewrites, and PDF generation powered by Gemini.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static and Templates
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)

@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    has_env_key = bool(os.getenv("GEMINI_API_KEY", "").strip())
    context = {
        "request": request,
        "has_env_key": has_env_key
    }
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context=context
    )

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "has_env_key": bool(os.getenv("GEMINI_API_KEY", "").strip()),
        "app_name": "ResuForge AI"
    }

@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """Upload resume (PDF/DOCX/TXT) and extract its plain text."""
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds the 10MB limit.")
            
        extracted_text, file_type = parse_uploaded_file(file.filename or "resume.pdf", content)
        word_count = len(extracted_text.split())
        return {
            "filename": file.filename,
            "file_type": file_type,
            "char_count": len(extracted_text),
            "word_count": word_count,
            "extracted_text": extracted_text
        }
    except Exception as e:
        logger.error(f"Error parsing resume: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/analyze", response_model=ATSAnalysisResponse)
async def analyze_resume_endpoint(payload: AnalysisRequest):
    """Run full ATS scoring, keyword match, and Google X-Y-Z bullet rewriting."""
    if not payload.resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text is required.")
    if not payload.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description is required for ATS matching.")

    try:
        analysis = analyze_resume_ats(
            resume_text=payload.resume_text,
            job_description=payload.job_description,
            api_key=payload.api_key
        )
        return analysis
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rewrite-bullet")
async def rewrite_bullet_endpoint(payload: BulletRewriteRequest):
    """Rewrite a specific bullet into Google X-Y-Z formula variants."""
    if not payload.bullet.strip():
        raise HTTPException(status_code=400, detail="Bullet point text is required.")
    try:
        variations = rewrite_single_bullet(
            bullet=payload.bullet,
            role_context=payload.role_context or "",
            job_description=payload.job_description or "",
            api_key=payload.api_key
        )
        return {"variations": variations}
    except Exception as e:
        logger.error(f"Bullet rewrite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/parse-structured", response_model=StructuredResume)
async def parse_structured_endpoint(payload: AnalysisRequest):
    """Parse unstructured resume text into a rich editable schema."""
    if not payload.resume_text.strip():
        raise HTTPException(status_code=400, detail="Resume text is required.")
    try:
        structured = parse_resume_to_structured(
            resume_text=payload.resume_text,
            api_key=payload.api_key
        )
        return structured
    except Exception as e:
        logger.error(f"Structured parsing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-pdf")
async def generate_pdf_endpoint(payload: PDFExportRequest):
    """Compile structured resume data into an ATS-compliant PDF stream."""
    try:
        pdf_stream = generate_ats_pdf(payload.resume, style_theme=payload.template_style or "executive")
        filename = f"Resume_{(payload.resume.contact.full_name or 'ATS').replace(' ', '_')}.pdf"
        
        return StreamingResponse(
            pdf_stream,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"PDF generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
