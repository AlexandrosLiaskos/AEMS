# AEMS Desktop Application Launcher
# PowerShell script for better Windows integration

# Set console properties
$Host.UI.RawUI.WindowTitle = "AEMS - Agentic Email Management System"

# Function to check if Node.js is installed
function Test-NodeJS {
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Host "✅ Node.js detected: $nodeVersion" -ForegroundColor Green
            return $true
        }
    }
    catch {
        return $false
    }
    return $false
}

# Function to check if we're in the right directory
function Test-AEMSDirectory {
    if (Test-Path "desktop-app.js") {
        return $true
    }
    return $false
}

# Main execution
try {
    # Clear screen and show header
    Clear-Host
    
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║                    AEMS Desktop Launcher                     ║" -ForegroundColor Cyan
    Write-Host "║              Agentic Email Management System                 ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # Check Node.js
    if (-not (Test-NodeJS)) {
        Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Check directory
    if (-not (Test-AEMSDirectory)) {
        Write-Host "❌ desktop-app.js not found in current directory" -ForegroundColor Red
        Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
        Write-Host "Please make sure you're running this from the AEMS directory" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    # Start AEMS
    Write-Host "🚀 Starting AEMS Desktop Application..." -ForegroundColor Green
    Write-Host ""
    
    # Execute the Node.js application
    & node desktop-app.js
    
}
catch {
    Write-Host ""
    Write-Host "❌ An error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# If we get here, the application has stopped normally
Write-Host ""
Write-Host "AEMS has stopped." -ForegroundColor Yellow
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
