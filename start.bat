@echo off
title ResuForge AI Launcher
cd /d "%~dp0"
echo Starting ResuForge AI Server...
start "" http://127.0.0.1:8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
