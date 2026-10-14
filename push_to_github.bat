@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Sri Devi One Saloon - Automated GitHub Sync
echo   Target: https://github.com/catipamula/sridevionesaloon.git
echo ===================================================
echo.

:: Ensure we are in the repository folder
if exist "%~dp0.git" (
    cd /d "%~dp0"
) else if exist "%~dp0sridevionesaloon-main\.git" (
    cd /d "%~dp0sridevionesaloon-main"
) else (
    echo [ERROR] Could not locate .git repository directory!
    pause
    exit /b 1
)

:: Check git
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed or not in PATH.
    pause
    exit /b 1
)

:: Pull remote changes first to prevent merge conflicts
echo [1/4] Pulling latest changes from GitHub (with rebase)...
git pull --rebase origin main
if errorlevel 1 (
    echo.
    echo [WARNING] Git pull with rebase encountered a conflict or error.
    echo Please resolve any conflicts before pushing.
    pause
    exit /b 1
)

:: Stage all files
echo [2/4] Staging all files and folders...
git add -A

:: Check if there are changes to commit
git diff --cached --quiet
if errorlevel 1 (
    :: Prompt for commit message or use timestamp
    set "COMMIT_MSG=%~1"
    if "!COMMIT_MSG!"=="" (
        set /p "COMMIT_MSG=Enter commit message (Press Enter for auto-generated): "
    )
    if "!COMMIT_MSG!"=="" (
        for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "DT=%%I"
        set "TIMESTAMP=!DT:~0,4!-!DT:~4,2!-!DT:~6,2! !DT:~8,2!:!DT:~10,2!"
        set "COMMIT_MSG=Auto update !TIMESTAMP!"
    )

    echo [3/4] Committing changes with message: "!COMMIT_MSG!"...
    git commit -m "!COMMIT_MSG!"
) else (
    echo [3/4] Working tree clean - no new changes to commit.
)

:: Push to remote
echo [4/4] Pushing to GitHub main branch...
git push origin main
if errorlevel 1 (
    echo.
    echo [ERROR] Push to GitHub failed.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   SUCCESS! All files and folders are synced to GitHub:
echo   https://github.com/catipamula/sridevionesaloon
echo ===================================================
echo.
if "%~1"=="" pause
