# IntelliBase Frontend Startup Script

Write-Host "🎨 Starting IntelliBase Frontend..." -ForegroundColor Cyan

# Navigate to frontend directory
$frontendPath = "c:\Users\Arjun\Downloads\Unthinkable Project\frontend"
Set-Location $frontendPath

# Start Vite dev server
Write-Host "✓ Starting Vite development server..." -ForegroundColor Green
Write-Host "  Frontend will open automatically" -ForegroundColor Yellow
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

npm run dev
