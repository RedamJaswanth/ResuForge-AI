// ResuForge AI Client Logic

let currentAnalysis = null;
let structuredResumeData = null;

// Initialize Lucide icons
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  initApiKey();
  initDragAndDrop();
  initResumeTextListener();
});

// API Key Management
function initApiKey() {
  const savedKey = localStorage.getItem("RESUFORGE_GEMINI_KEY");
  if (savedKey) {
    document.getElementById("keyStatusDot").className = "w-2 h-2 rounded-full bg-emerald-400";
    document.getElementById("keyStatusText").innerText = "Gemini Key Saved (Local)";
    document.getElementById("apiKeyInput").value = savedKey;
  }
}

function openKeyModal() {
  document.getElementById("keyModal").classList.remove("hidden");
}

function closeKeyModal() {
  document.getElementById("keyModal").classList.add("hidden");
}

function saveApiKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (key) {
    localStorage.setItem("RESUFORGE_GEMINI_KEY", key);
    document.getElementById("keyStatusDot").className = "w-2 h-2 rounded-full bg-emerald-400";
    document.getElementById("keyStatusText").innerText = "Gemini Key Saved (Local)";
    showToast("Gemini API Key saved successfully!", "check-circle");
  } else {
    localStorage.removeItem("RESUFORGE_GEMINI_KEY");
    document.getElementById("keyStatusDot").className = "w-2 h-2 rounded-full bg-amber-400";
    document.getElementById("keyStatusText").innerText = "Set Gemini Key";
    showToast("API Key cleared.", "info");
  }
  closeKeyModal();
  if (window.lucide) window.lucide.createIcons();
}

function getActiveApiKey() {
  return localStorage.getItem("RESUFORGE_GEMINI_KEY") || "";
}

// Drag & Drop File Upload
function initDragAndDrop() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("border-brand-500", "bg-brand-500/10");
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-brand-500", "bg-brand-500/10");
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) handleFileUpload(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileUpload(e.target.files[0]);
  });
}

function initResumeTextListener() {
  const textarea = document.getElementById("resumeText");
  textarea.addEventListener("input", () => {
    updateWordCount(textarea.value);
  });
}

function updateWordCount(text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById("charCount").innerText = `${words} words`;
}

async function handleFileUpload(file) {
  const feedback = document.getElementById("uploadFeedback");
  feedback.classList.remove("hidden");
  feedback.innerText = `Extracting text from ${file.name}...`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload-resume", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to upload resume");
    }

    const data = await res.json();
    document.getElementById("resumeText").value = data.extracted_text;
    updateWordCount(data.extracted_text);

    feedback.innerText = `✓ Extracted ${data.word_count} words from ${data.filename}`;
    feedback.className = "mt-2 text-xs text-emerald-400 font-mono";

    const badge = document.getElementById("fileBadge");
    badge.innerText = `${data.file_type.toUpperCase()} Loaded`;
    badge.classList.remove("hidden");

    showToast(`Loaded ${file.name}`, "file-check");
  } catch (error) {
    feedback.innerText = `✗ ${error.message}`;
    feedback.className = "mt-2 text-xs text-rose-400 font-mono";
    showToast(error.message, "alert-circle");
  }
}

// Full Analysis Call
async function runAnalysis() {
  const resumeText = document.getElementById("resumeText").value.trim();
  const jobDescription = document.getElementById("jobDescription").value.trim();
  const apiKey = getActiveApiKey();

  if (!resumeText) {
    showToast("Please upload or paste your resume text first.", "alert-triangle");
    return;
  }
  if (!jobDescription) {
    showToast("Please paste the target job description.", "alert-triangle");
    return;
  }

  // Show loading
  document.getElementById("loadingState").classList.remove("hidden");
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("analyzeBtn").disabled = true;

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        job_description: jobDescription,
        api_key: apiKey
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Analysis failed");
    }

    currentAnalysis = await res.json();
    renderAnalysisResults(currentAnalysis);

    // Auto-populate structured resume builder
    populateResumeBuilder(resumeText, currentAnalysis);

    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("resultsSection").classList.remove("hidden");

    // Scroll to results
    document.getElementById("resultsSection").scrollIntoView({ behavior: "smooth" });
    showToast("ATS Diagnostic & X-Y-Z rewrites ready!", "check-circle");

  } catch (error) {
    document.getElementById("loadingState").classList.add("hidden");
    showToast(error.message, "alert-triangle");
    if (error.message.includes("API Key")) {
      openKeyModal();
    }
  } finally {
    document.getElementById("analyzeBtn").disabled = false;
  }
}

function renderAnalysisResults(data) {
  // 1. Radial Score Animation
  const score = data.overall_score || 0;
  animateScore(score);

  // Verdict badge
  const verdictEl = document.getElementById("verdictBadge");
  verdictEl.innerText = data.score_verdict || `${score}% Match`;
  if (score >= 80) {
    verdictEl.className = "px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  } else if (score >= 60) {
    verdictEl.className = "px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30";
  } else {
    verdictEl.className = "px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30";
  }

  document.getElementById("summaryText").innerText = data.summary || "";

  // 2. Matched Keywords
  const matchedContainer = document.getElementById("matchedKeywordsContainer");
  matchedContainer.innerHTML = "";
  const matched = data.matched_keywords || [];
  document.getElementById("matchedCount").innerText = matched.length;
  matched.forEach(kw => {
    const span = document.createElement("span");
    span.className = "px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    span.innerText = `✓ ${kw}`;
    matchedContainer.appendChild(span);
  });

  // 3. Missing Keywords
  const missingContainer = document.getElementById("missingKeywordsContainer");
  missingContainer.innerHTML = "";
  const missing = data.missing_keywords || [];
  document.getElementById("missingCount").innerText = missing.length;
  missing.forEach(kw => {
    const span = document.createElement("span");
    span.className = "px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 cursor-pointer hover:bg-rose-500/20 transition";
    span.title = "Click to copy keyword";
    span.innerText = `+ ${kw}`;
    span.onclick = () => {
      navigator.clipboard.writeText(kw);
      showToast(`Copied "${kw}" to clipboard`, "copy");
    };
    missingContainer.appendChild(span);
  });

  // 4. Strengths
  const strengthsList = document.getElementById("strengthsList");
  strengthsList.innerHTML = "";
  (data.strengths || []).forEach(s => {
    const li = document.createElement("li");
    li.className = "flex items-start gap-1.5";
    li.innerHTML = `<span class="text-cyan-400 font-bold">•</span> <span>${s}</span>`;
    strengthsList.appendChild(li);
  });

  // 5. Recommendations
  const recsList = document.getElementById("recommendationsList");
  recsList.innerHTML = "";
  (data.formatting_recommendations || []).forEach(r => {
    const li = document.createElement("li");
    li.className = "flex items-start gap-1.5";
    li.innerHTML = `<span class="text-amber-400 font-bold">•</span> <span>${r}</span>`;
    recsList.appendChild(li);
  });

  // 6. X-Y-Z Bullets
  renderXYZBullets(data.xyz_bullets || []);

  if (window.lucide) window.lucide.createIcons();
}

function animateScore(targetScore) {
  const ring = document.getElementById("scoreRing");
  const numberEl = document.getElementById("scoreNumber");
  
  // Circumference is 2 * PI * 42 ≈ 264
  const circumference = 264;
  const offset = circumference - (targetScore / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  // Color change on ring
  if (targetScore >= 80) {
    ring.classList.remove("text-amber-500", "text-rose-500");
    ring.classList.add("text-emerald-400");
  } else if (targetScore >= 60) {
    ring.classList.remove("text-emerald-400", "text-rose-500");
    ring.classList.add("text-amber-400");
  } else {
    ring.classList.remove("text-emerald-400", "text-amber-400");
    ring.classList.add("text-rose-400");
  }

  // Count up animation
  let current = 0;
  const step = Math.max(1, Math.floor(targetScore / 30));
  const timer = setInterval(() => {
    current += step;
    if (current >= targetScore) {
      current = targetScore;
      clearInterval(timer);
    }
    numberEl.innerText = current;
  }, 25);
}

function renderXYZBullets(bullets) {
  const container = document.getElementById("xyzBulletsList");
  container.innerHTML = "";

  if (!bullets.length) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">No specific experience bullets detected to rewrite.</p>`;
    return;
  }

  bullets.forEach((b, index) => {
    const card = document.createElement("div");
    card.className = "glass-card rounded-xl p-4 border border-slate-800 space-y-3 glass-card-hover";
    
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="w-5 h-5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold flex items-center justify-center">#${index + 1}</span>
          <span class="text-xs font-semibold text-slate-400">Google X-Y-Z Transformation</span>
        </div>
        <div class="flex items-center space-x-2">
          ${b.impact_metric ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Metric: ${b.impact_metric}</span>` : ''}
          ${b.action_verb ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Verb: ${b.action_verb}</span>` : ''}
        </div>
      </div>

      <!-- Before & After Comparison -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <span class="text-[10px] font-bold uppercase text-slate-500 block mb-1">Before (Weak / Passive)</span>
          <p class="text-slate-400 line-through opacity-80 leading-relaxed">${escapeHtml(b.original)}</p>
        </div>

        <div class="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 relative">
          <span class="text-[10px] font-bold uppercase text-emerald-400 block mb-1">After (Quantified X-Y-Z)</span>
          <p class="text-emerald-200 font-medium leading-relaxed">${escapeHtml(b.rewritten_xyz)}</p>
        </div>
      </div>

      <div class="flex items-center justify-between pt-1">
        <p class="text-[11px] text-slate-400 italic">${escapeHtml(b.rationale || '')}</p>
        <div class="flex items-center space-x-2">
          <button onclick="copyBullet('${escapeJs(b.rewritten_xyz)}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1">
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span>Copy</span>
          </button>
          <button onclick="applyBulletToResume('${escapeJs(b.rewritten_xyz)}')" class="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-brand-600 hover:bg-brand-500 text-white transition flex items-center gap-1 shadow-sm">
            <i data-lucide="plus" class="w-3 h-3"></i>
            <span>Apply to Resume</span>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

async function rewriteCustomBullet() {
  const input = document.getElementById("singleBulletInput");
  const bulletText = input.value.trim();
  const jobDescription = document.getElementById("jobDescription").value.trim();
  const apiKey = getActiveApiKey();

  if (!bulletText) {
    showToast("Please type a bullet point to rewrite.", "alert-triangle");
    return;
  }

  const container = document.getElementById("customVariantsContainer");
  container.classList.remove("hidden");
  container.innerHTML = `<p class="text-xs text-brand-300 italic animate-pulse">Forging 3 X-Y-Z variants with Gemini...</p>`;

  try {
    const res = await fetch("/api/rewrite-bullet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bullet: bulletText,
        job_description: jobDescription,
        api_key: apiKey
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Rewrite failed");
    }

    const data = await res.json();
    container.innerHTML = "";
    
    (data.variations || []).forEach((v, i) => {
      const box = document.createElement("div");
      box.className = "p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3";
      box.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold uppercase text-brand-400">Variant ${i + 1}</span>
            <span class="text-[10px] text-slate-500 font-mono">${escapeHtml(v.rationale || '')}</span>
          </div>
          <p class="text-xs text-emerald-300 font-medium">${escapeHtml(v.rewritten_xyz)}</p>
        </div>
        <button onclick="applyBulletToResume('${escapeJs(v.rewritten_xyz)}')" class="px-2.5 py-1 rounded bg-brand-600 hover:bg-brand-500 text-[10px] font-bold text-white whitespace-nowrap transition">
          Apply
        </button>
      `;
      container.appendChild(box);
    });

  } catch (err) {
    container.innerHTML = `<p class="text-xs text-rose-400">${escapeHtml(err.message)}</p>`;
  }
}

function applyBulletToResume(bulletText) {
  const expArea = document.getElementById("formExperience");
  const current = expArea.value.trim();
  const newBulletLine = `• ${bulletText}`;
  if (current) {
    expArea.value = current + "\n" + newBulletLine;
  } else {
    expArea.value = newBulletLine;
  }
  showToast("Applied X-Y-Z bullet into Resume Builder!", "check-circle");
}

function copyBullet(text) {
  navigator.clipboard.writeText(text);
  showToast("Bullet copied to clipboard!", "copy");
}

function scrollToEditor() {
  document.getElementById("resumeBuilderSection").scrollIntoView({ behavior: "smooth" });
}

// Populate Resume Builder form fields
function populateResumeBuilder(rawText, analysis) {
  // Try simple regex extraction for header details
  const nameMatch = rawText.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
  const emailMatch = rawText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = rawText.match(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  
  if (nameMatch && !document.getElementById("formFullName").value) {
    document.getElementById("formFullName").value = nameMatch[1];
  }
  if (emailMatch && !document.getElementById("formEmail").value) {
    document.getElementById("formEmail").value = emailMatch[1];
  }
  if (phoneMatch && !document.getElementById("formPhone").value) {
    document.getElementById("formPhone").value = phoneMatch[0];
  }

  // Auto-generate professional summary using matched skills if empty
  if (!document.getElementById("formSummary").value && analysis.summary) {
    document.getElementById("formSummary").value = analysis.summary;
  }

  // Prepopulate skills with matched + missing keywords suggestions
  if (!document.getElementById("formSkills").value && analysis.matched_keywords) {
    document.getElementById("formSkills").value = "Core Proficiencies: " + analysis.matched_keywords.join(", ");
  }

  // Prepopulate experience with rewritten X-Y-Z bullets
  if (!document.getElementById("formExperience").value && analysis.xyz_bullets) {
    const lines = analysis.xyz_bullets.map(b => `• ${b.rewritten_xyz}`);
    document.getElementById("formExperience").value = lines.join("\n");
  }
}

// Compile Form into Structured JSON and Trigger PDF Download
async function downloadPdfNow() {
  const fullName = document.getElementById("formFullName").value.trim() || "Candidate";
  const email = document.getElementById("formEmail").value.trim();
  const phone = document.getElementById("formPhone").value.trim();
  const location = document.getElementById("formLocation").value.trim();
  const linkedin = document.getElementById("formLinkedin").value.trim();
  const github = document.getElementById("formGithub").value.trim();
  const summary = document.getElementById("formSummary").value.trim();
  const rawSkills = document.getElementById("formSkills").value.trim();
  const rawExp = document.getElementById("formExperience").value.trim();
  const rawEdu = document.getElementById("formEducation").value.trim();
  const rawCerts = document.getElementById("formCertifications").value.trim();
  const templateStyle = document.getElementById("templateStyle").value;

  // Build StructuredResume object
  const skillsDict = {};
  if (rawSkills) {
    const lines = rawSkills.split("\n");
    lines.forEach(l => {
      if (l.includes(":")) {
        const [cat, items] = l.split(":");
        skillsDict[cat.trim()] = items.split(",").map(i => i.trim()).filter(Boolean);
      } else {
        skillsDict["Technical & Professional"] = l.split(",").map(i => i.trim()).filter(Boolean);
      }
    });
  }

  // Parse experience lines into bullet points
  const expBullets = rawExp.split("\n").map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
  const experienceList = [
    {
      company: "Professional Experience",
      role: "Key Career Achievements",
      location: "",
      start_date: "",
      end_date: "",
      bullets: expBullets
    }
  ];

  // Parse education
  const eduList = [];
  if (rawEdu) {
    const lines = rawEdu.split("\n").filter(Boolean);
    lines.forEach(l => {
      eduList.push({
        institution: l,
        degree: "",
        location: "",
        graduation_year: "",
        details: ""
      });
    });
  }

  // Parse certs
  const certList = rawCerts.split("\n").map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);

  const payload = {
    resume: {
      contact: {
        full_name: fullName,
        email: email,
        phone: phone,
        location: location,
        linkedin: linkedin,
        github: github
      },
      summary: summary,
      skills: skillsDict,
      experience: experienceList,
      education: eduList,
      projects: [],
      certifications: certList
    },
    template_style: templateStyle
  };

  showToast("Generating ATS-compliant PDF...", "file-text");

  try {
    const res = await fetch("/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error("PDF generation failed");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resume_${fullName.replace(/\s+/g, '_')}_ATS.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    showToast("PDF downloaded successfully!", "check-circle");
  } catch (err) {
    showToast(err.message, "alert-circle");
  }
}

// Sample Data for Instant Testing
function loadSampleData() {
  const sampleResume = `ALEXANDER RIVERS
alex.rivers@email.com | (555) 234-5678 | San Francisco, CA | linkedin.com/in/alexrivers | github.com/alexrivers

PROFESSIONAL SUMMARY
Senior Software & AI Engineer with 6+ years of experience designing scalable backend architectures, RESTful microservices, and integrating Large Language Models into enterprise workflows.

EXPERIENCE
TechNova Solutions — Senior Backend Engineer
San Francisco, CA | 2022 – Present
- Responsible for backend API development using FastAPI and Python.
- Worked on optimizing SQL database queries to make endpoints faster.
- Built automated data ingestion pipelines for machine learning models.
- Collaborated with front-end team to deliver client features.

DataVanguard Inc — Software Engineer
Austin, TX | 2019 – 2022
- Maintained legacy microservices and fixed bugs.
- Implemented Docker containerization for deployment on AWS ECS.
- Created unit tests and integration tests for CI/CD pipelines.

EDUCATION
B.S. in Computer Science — University of California, Berkeley (2015 – 2019)

SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks: FastAPI, Django, Flask, PyTorch
Tools: Docker, Kubernetes, AWS, PostgreSQL, Redis, Git`;

  const sampleJD = `Lead AI / Backend Engineer — High Growth AI SaaS
Location: Remote / San Francisco

About the Role:
We are seeking an experienced Backend & AI Systems Engineer to spearhead our core AI platform. You will build high-throughput FastAPI microservices, orchestrate LLM workflows (prompt engineering, function calling, evaluation), and scale asynchronous distributed data systems.

Required Qualifications:
- 5+ years of software engineering experience with strong proficiency in Python and FastAPI.
- Deep hands-on experience integrating LLM APIs (OpenAI, Gemini, Anthropic) into production applications.
- Proven track record of performance optimization (p99 latency reduction, caching with Redis, asynchronous concurrency).
- Experience with Docker, Kubernetes, and AWS cloud architecture.
- Demonstrated ability to deliver quantifiable business impact and lead technical initiatives.
- Strong knowledge of vector databases, prompt evaluation, and CI/CD best practices.`;

  document.getElementById("resumeText").value = sampleResume;
  document.getElementById("jobDescription").value = sampleJD;
  updateWordCount(sampleResume);

  const badge = document.getElementById("fileBadge");
  badge.innerText = "Sample Loaded";
  badge.classList.remove("hidden");

  // Also pre-fill candidate fields
  document.getElementById("formFullName").value = "Alexander Rivers";
  document.getElementById("formEmail").value = "alex.rivers@email.com";
  document.getElementById("formPhone").value = "(555) 234-5678";
  document.getElementById("formLocation").value = "San Francisco, CA";
  document.getElementById("formLinkedin").value = "linkedin.com/in/alexrivers";
  document.getElementById("formGithub").value = "github.com/alexrivers";
  document.getElementById("formEducation").value = "B.S. in Computer Science — University of California, Berkeley (2015 – 2019)";
  document.getElementById("formCertifications").value = "AWS Certified Solutions Architect — Associate";

  showToast("Sample Resume & Job Post Loaded! Click 'Run ATS Diagnostic'", "wand-2");
}

// Toast helper
function showToast(message, icon = "info") {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toastMessage");
  const iconEl = document.getElementById("toastIcon");

  msgEl.innerText = message;
  iconEl.setAttribute("data-lucide", icon);

  toast.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}

// Utility escape helpers
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (!str) return "";
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
