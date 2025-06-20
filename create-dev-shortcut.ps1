# PowerShell script to create a desktop shortcut for Tink 2.0 (Development Version)

# Get the current directory (where the script is located)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetPath = Join-Path $scriptPath "Launch Tink 2.0 (Development).bat"

# Get the user's desktop path
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Tink 2.0 (Development).lnk"

# Create the shortcut
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $scriptPath
$Shortcut.Description = "Tink 2.0 - Development Version with Full Node.js Support"
$Shortcut.IconLocation = Join-Path $scriptPath "assets\icon.ico"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Shortcut location: $shortcutPath" -ForegroundColor Yellow
Write-Host "This development version should resolve the 'Cannot find module' error." -ForegroundColor Cyan 