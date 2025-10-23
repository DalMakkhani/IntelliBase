# IntelliBase Backend Startup Script

Write-Host "🚀 Starting IntelliBase Backend..." -ForegroundColor Cyan

# Navigate to project root
$projectRoot = "c:\Users\Arjun\Downloads\Unthinkable Project"
Set-Location $projectRoot

# Activate virtual environment
Write-Host "✓ Activating virtual environment..." -ForegroundColor Green
& ".\unthinkable\Scripts\Activate.ps1"

# Navigate to backend
Set-Location "backend"

# Start server
Write-Host "✓ Starting FastAPI server on http://localhost:8000..." -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

uvicorn app:app --reload --host 0.0.0.0 --port 8000
