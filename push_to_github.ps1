# Sri Devi One Saloon - Automated GitHub Push Script (PowerShell)
param (
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Sri Devi One Saloon - Automated GitHub Sync" -ForegroundColor Cyan
Write-Host "  Target: https://github.com/catipamula/sridevionesaloon.git" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Determine target directory
$RepoDir = $PSScriptRoot
if (-not (Test-Path "$RepoDir\.git")) {
    if (Test-Path "$RepoDir\sridevionesaloon-main\.git") {
        $RepoDir = "$RepoDir\sridevionesaloon-main"
    } else {
        Write-Error "Could not find .git repository directory."
    }
}
Set-Location $RepoDir

# Pull latest changes using rebase and autostash to avoid unnecessary merge conflicts
Write-Host "[1/4] Pulling latest remote changes..." -ForegroundColor Yellow
git pull --rebase --autostash origin main

# Stage changes
Write-Host "[2/4] Staging all files..." -ForegroundColor Yellow
git add -A

# Check for staged changes
$staged = git diff --cached --name-only
if ($staged) {
    if (-not $CommitMessage) {
        $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $CommitMessage = Read-Host "Enter commit message (Leave blank for 'Auto update $timestamp')"
        if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
            $CommitMessage = "Auto update $timestamp"
        }
    }
    Write-Host "[3/4] Committing: '$CommitMessage'..." -ForegroundColor Yellow
    git commit -m "$CommitMessage"
} else {
    Write-Host "[3/4] No modified or new files to commit." -ForegroundColor Green
}

# Push
Write-Host "[4/4] Pushing to GitHub (origin/main)..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  SUCCESS! Project is synced to GitHub:" -ForegroundColor Green
Write-Host "  https://github.com/catipamula/sridevionesaloon" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
