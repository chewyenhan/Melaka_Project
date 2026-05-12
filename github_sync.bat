@echo off
echo ========================================
echo   Melaka Project GitHub Sync Tool
echo ========================================
echo.

:: Check if git is installed
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in your PATH.
    echo Please install Git from https://git-scm.com/ and try again.
    pause
    exit /b
)

echo [1/4] Initializing Git...
git init

echo [2/4] Adding files...
git add .

echo [3/4] Committing...
git commit -m "Sync Melaka Project with latest updates and images"

echo [4/4] Connecting to GitHub and Pushing...
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin https://github.com/chewyenhan/Melaka_Project.git
git push -u origin main --force

echo.
echo ========================================
echo   Sync Complete!
echo ========================================
pause
