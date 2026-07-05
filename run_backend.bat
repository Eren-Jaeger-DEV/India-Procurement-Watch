@echo off
cd backend\api
echo Starting Backend Server...
call ..\venv\Scripts\activate.bat
python app.py
