from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class XYZBullet(BaseModel):
    original: str = Field(..., description="Original resume bullet point")
    rewritten_xyz: str = Field(..., description="Rewritten in Google's X-Y-Z formula: Accomplished [X], as measured by [Y], by doing [Z]")
    impact_metric: Optional[str] = Field(None, description="Quantified metric or estimated measurement used [Y]")
    action_verb: Optional[str] = Field(None, description="Strong power verb used")
    rationale: Optional[str] = Field(None, description="Why this improves ATS ranking and recruiter appeal")

class ATSAnalysisResponse(BaseModel):
    overall_score: int = Field(..., ge=0, le=100, description="Overall ATS compatibility score from 0 to 100")
    score_verdict: str = Field(..., description="Verdict e.g. Exceptional Match, Strong Match, Moderate, Low Match")
    match_percentage: int = Field(..., ge=0, le=100)
    summary: str = Field(..., description="Executive critique summarizing strengths & gaps")
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    matched_keywords: List[str] = Field(default_factory=list)
    missing_keywords: List[str] = Field(default_factory=list)
    hard_skills_match: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    xyz_bullets: List[XYZBullet] = Field(default_factory=list, description="Top rewritten bullets")
    formatting_recommendations: List[str] = Field(default_factory=list)

class ExperienceItem(BaseModel):
    company: str = ""
    role: str = ""
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    bullets: List[str] = Field(default_factory=list)

class EducationItem(BaseModel):
    institution: str = ""
    degree: str = ""
    location: Optional[str] = ""
    graduation_year: Optional[str] = ""
    details: Optional[str] = ""

class ProjectItem(BaseModel):
    title: str = ""
    technologies: Optional[str] = ""
    bullets: List[str] = Field(default_factory=list)
    link: Optional[str] = ""

class ContactInfo(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    website: Optional[str] = ""

class StructuredResume(BaseModel):
    contact: ContactInfo = Field(default_factory=ContactInfo)
    summary: str = ""
    skills: Dict[str, List[str]] = Field(default_factory=dict)
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)

class AnalysisRequest(BaseModel):
    resume_text: str
    job_description: str
    api_key: Optional[str] = None
    target_role: Optional[str] = None

class BulletRewriteRequest(BaseModel):
    bullet: str
    role_context: Optional[str] = ""
    job_description: Optional[str] = ""
    api_key: Optional[str] = None

class PDFExportRequest(BaseModel):
    resume: StructuredResume
    template_style: Optional[str] = "executive"
