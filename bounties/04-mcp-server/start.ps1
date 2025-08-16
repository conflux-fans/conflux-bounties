# Simple setup for Conflux MCP Server
Write-Host "Setting up Conflux MCP Server..." -ForegroundColor Green

# Check Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Stop existing containers
docker-compose down 2>$null

# Build and start
Write-Host "Building and starting server..." -ForegroundColor Yellow
docker-compose up --build -d

# Wait and check
Start-Sleep 10
$response = try { Invoke-WebRequest -Uri "http://localhost:3333/health" -TimeoutSec 5 } catch { $null }

if ($response -and $response.StatusCode -eq 200) {
    Write-Host "SUCCESS: Server is running at http://localhost:3333" -ForegroundColor Green
} else {
    Write-Host "ERROR: Server not responding. Check logs with: docker-compose logs" -ForegroundColor Red
} 