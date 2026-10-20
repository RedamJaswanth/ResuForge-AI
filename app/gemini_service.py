import os
import json
import logging
import requests
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

from app.models import (
    ATSAnalysisResponse,
    XYZBullet,
    StructuredResume,
    ContactInfo,
    ExperienceItem,
    EducationItem,
    ProjectItem
)

load_dotenv()
logger = logging.getLogger(__name__)

# Preferred models with gemini-3.8-flash leading as recommended by Google Gemini API
FALLBACK_GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
]

AVAILABLE_MODEL_CACHE: Dict[str, List[str]] = {}

def get_effective_api_key(provided_key: Optional[str] = None) -> str:
    """Return provided API key or fallback to environment variable."""
    key = (provided_key or "").strip() or os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise ValueError("Gemini API Key is missing. Please provide it in the UI or set GEMINI_API_KEY in .env")
    return key

def get_candidate_models_for_key(api_key: str) -> List[str]:
    """Dynamically discover available generateContent models for this specific API key."""
    if api_key in AVAILABLE_MODEL_CACHE and AVAILABLE_MODEL_CACHE[api_key]:
        return AVAILABLE_MODEL_CACHE[api_key]

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            models = data.get("models", [])
            valid_models = []
            for m in models:
                name = m.get("name", "").replace("models/", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    valid_models.append(name)
            
            if valid_models:
                # Sort: put 3.8-flash / 3-flash / flash models first
                def score_model(name: str) -> int:
                    n = name.lower()
                    if "3.8-flash" in n: return 0
                    if "3-flash" in n: return 1
                    if "2.5-flash" in n: return 2
                    if "2.0-flash" in n: return 3
                    if "1.5-flash" in n: return 4
                    if "flash" in n: return 5
                    if "pro" in n: return 6
                    return 10

                sorted_models = sorted(valid_models, key=score_model)
                logger.info(f"Dynamically discovered models for key: {sorted_models[:5]}")
                AVAILABLE_MODEL_CACHE[api_key] = sorted_models
                return sorted_models
    except Exception as e:
        logger.warning(f"Could not list models via ModelService: {e}")

    return FALLBACK_GEMINI_MODELS

def call_gemini_rest(prompt: str, system_instruction: str, api_key: str, json_mode: bool = True) -> str:
    """
    Call Gemini API directly via REST.
    Tries dynamically discovered models first, then falls back through candidates.
    """
    candidate_models = get_candidate_models_for_key(api_key)
    error_log = []

    for model_name in candidate_models[:6]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        
        payload: Dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95
            }
        }
        
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }
            
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        logger.info(f"Successfully generated response with model {model_name}")
                        return parts[0].get("text", "")
            else:
                error_body = resp.text
                error_log.append(f"{model_name} (HTTP {resp.status_code}): {error_body}")
                logger.warning(f"Gemini API attempt with {model_name} failed: {error_body}")
        except Exception as e:
            error_log.append(f"{model_name} (Exception): {str(e)}")
            logger.warning(f"Request exception for {model_name}: {e}")

    summary_errors = "\n".join(error_log[-3:])
    raise RuntimeError(f"All Gemini models failed.\n{summary_errors}")

def clean_json_response(raw_text: str) -> str:
    """Strip markdown code fences if present."""
    text = raw_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def analyze_resume_ats(resume_text: str, job_description: str, api_key: Optional[str] = None) -> ATSAnalysisResponse:
    """Analyze resume against job description and return detailed ATS score and X-Y-Z bullets."""
    key = get_effective_api_key(api_key)

    system_instruction = (
        "You are an expert Head of Recruiting and Principal ATS (Applicant Tracking System) Algorithm Architect. "
        "Your task is to analyze candidate resumes against job descriptions with rigorous honesty and actionable precision. "
        "You always apply Google's proven X-Y-Z formula for bullet points: 'Accomplished [X], as measured by [Y], by doing [Z]'."
    )

    prompt = f"""
Analyze this candidate's resume against the target job post.

JOB DESCRIPTION:
\"\"\"
{job_description}
\"\"\"

RESUME TEXT:
\"\"\"
{resume_text}
\"\"\"

Return a valid JSON object matching EXACTLY this structure:
{{
  "overall_score": <integer from 0 to 100 representing realistic ATS match score>,
  "score_verdict": "<e.g., Exceptional Match (90-100), Strong Candidate (75-89), Moderate Fit (60-74), High Gap (<60)>",
  "match_percentage": <integer 0 to 100>,
  "summary": "<2-3 sentence executive recruiter summary of how well this candidate fits the role>",
  "strengths": ["<top strength 1>", "<top strength 2>", "<top strength 3>"],
  "weaknesses": ["<critical gap 1>", "<critical gap 2>", "<critical gap 3>"],
  "matched_keywords": ["<keyword found in both resume and JD>", "..."],
  "missing_keywords": ["<critical keyword in JD but missing in resume>", "..."],
  "hard_skills_match": ["<technical/domain skill matched>", "..."],
  "missing_skills": ["<technical/domain skill absent>", "..."],
  "xyz_bullets": [
    {{
      "original": "<exact weak bullet from candidate's resume>",
      "rewritten_xyz": "<rewritten bullet strictly using 'Accomplished [X] as measured by [Y], by doing [Z]'>",
      "impact_metric": "<the quantifiable metric [Y] e.g., 'by 35%', '$120K annual savings', 'reduced latency from 450ms to 90ms'>",
      "action_verb": "<strong action verb e.g. Spearheaded, Engineered, Architected>",
      "rationale": "<brief reason why this rewrite beats ATS and impresses hiring managers>"
    }}
  ],
  "formatting_recommendations": [
    "<actionable formatting or structural advice to maximize ATS parse rate>"
  ]
}}

Provide 4 to 6 high-impact xyz_bullets rewritten from the candidate's actual work history.
Be strict and realistic with the score; do not flatter.
"""

    raw_response = call_gemini_rest(prompt, system_instruction, key, json_mode=True)
    cleaned = clean_json_response(raw_response)
    data = json.loads(cleaned)
    return ATSAnalysisResponse(**data)

def rewrite_single_bullet(bullet: str, role_context: str = "", job_description: str = "", api_key: Optional[str] = None) -> List[XYZBullet]:
    """Rewrite a single bullet into Google's X-Y-Z formula variations."""
    key = get_effective_api_key(api_key)

    system_instruction = (
        "You are an executive resume coach specializing in Google's X-Y-Z resume bullet formula: "
        "'Accomplished [X], as measured by [Y], by doing [Z]'."
    )

    prompt = f"""
Rewrite the following resume bullet point into 3 distinct high-impact variations using Google's X-Y-Z formula.

ORIGINAL BULLET:
"{bullet}"

ROLE CONTEXT:
"{role_context}"

TARGET JOB DESCRIPTION (IF ANY):
"{job_description}"

Return a valid JSON array of 3 objects with this structure:
[
  {{
    "original": "{bullet}",
    "rewritten_xyz": "Accomplished [X] as measured by [Y], by doing [Z]",
    "impact_metric": "Quantified metric (estimate if needed)",
    "action_verb": "Power verb",
    "rationale": "Focus: High-Impact Metrics"
  }}
]
"""
    raw_response = call_gemini_rest(prompt, system_instruction, key, json_mode=True)
    cleaned = clean_json_response(raw_response)
    data = json.loads(cleaned)
    return [XYZBullet(**item) for item in data]

def parse_resume_to_structured(resume_text: str, api_key: Optional[str] = None) -> StructuredResume:
    """Parse unstructured resume text into a structured JSON for interactive editing and PDF generation."""
    key = get_effective_api_key(api_key)

    system_instruction = "You are a resume parsing specialist. Extract raw text into structured resume fields."
    prompt = f"""
Convert the following resume text into a structured JSON format:

RESUME TEXT:
\"\"\"
{resume_text}
\"\"\"

Return a valid JSON object matching EXACTLY this format:
{{
  "contact": {{
    "full_name": "<name>",
    "email": "<email>",
    "phone": "<phone>",
    "location": "<city, state/country>",
    "linkedin": "<linkedin url or handle>",
    "github": "<github url or handle>",
    "website": "<portfolio/website>"
  }},
  "summary": "<concise professional summary or objective>",
  "skills": {{
    "Languages": ["Python", "..."],
    "Frameworks & Tools": ["FastAPI", "..."],
    "Methodologies": ["Agile", "..."]
  }},
  "experience": [
    {{
      "company": "<company name>",
      "role": "<job title>",
      "location": "<location>",
      "start_date": "<e.g. Jan 2022>",
      "end_date": "<e.g. Present>",
      "bullets": [
        "<bullet 1>",
        "<bullet 2>"
      ]
    }}
  ],
  "education": [
    {{
      "institution": "<university/college>",
      "degree": "<degree & major>",
      "location": "<city, state>",
      "graduation_year": "<year>",
      "details": "<gpa, honors, or relevant coursework>"
    }}
  ],
  "projects": [
    {{
      "title": "<project name>",
      "technologies": "<tech stack>",
      "bullets": ["<point 1>", "<point 2>"],
      "link": "<github or demo link>"
    }}
  ],
  "certifications": [
    "<certification name>"
  ]
}}
"""
    raw_response = call_gemini_rest(prompt, system_instruction, key, json_mode=True)
    cleaned = clean_json_response(raw_response)
    data = json.loads(cleaned)
    return StructuredResume(**data)
