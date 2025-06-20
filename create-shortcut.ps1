# PowerShell script to create a desktop shortcut for Tink 2.0
# This script should be run from the Tink 2.0 application directory

# Get the current directory (where the script is located)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TinkDir = $ScriptDir

# Define paths - pointing to the built executable
$ShortcutPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Tink 2.0.lnk')
$TargetPath = [System.IO.Path]::Combine($TinkDir, 'dist', 'win-unpacked', 'Tink 2.0.exe')
$IconLocation = [System.IO.Path]::Combine($TinkDir, 'assets', 'icon.ico')
$WorkingDirectory = [System.IO.Path]::Combine($TinkDir, 'dist', 'win-unpacked')

# Check if the built executable exists
if (-not (Test-Path $TargetPath)) {
    Write-Host "ERROR: Built executable not found at: $TargetPath"
    Write-Host "Please run 'npm run build' to create the built version first."
    exit 1
}

# Create the shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $WorkingDirectory
$Shortcut.IconLocation = $IconLocation
$Shortcut.Description = "Tink 2.0 - Inventory Processing Application (Production)"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully at: $ShortcutPath"
Write-Host "The shortcut will launch the BUILT version of Tink 2.0 from: $TargetPath"

# Also create a shortcut in the current directory for easy transfer
$LocalShortcutPath = [System.IO.Path]::Combine($TinkDir, 'Tink 2.0.lnk')
$LocalShortcut = $WshShell.CreateShortcut($LocalShortcutPath)
$LocalShortcut.TargetPath = $TargetPath
$LocalShortcut.WorkingDirectory = $WorkingDirectory
$LocalShortcut.IconLocation = $IconLocation
$LocalShortcut.Description = "Tink 2.0 - Inventory Processing Application (Production)"
$LocalShortcut.Save()

Write-Host "Local shortcut also created in application directory: $LocalShortcutPath"
Write-Host ""
Write-Host "This shortcut launches the BUILT version which:"
Write-Host "✅ Will properly check for updates"
Write-Host "✅ Is fully packaged and optimized"
Write-Host "✅ Doesn't require Node.js/npm on target computers"
Write-Host ""
Write-Host "You can now copy 'Tink 2.0.lnk' to the desktop of other computers."
Write-Host "Make sure to copy the entire Tink 2.0 folder including the dist/win-unpacked directory." 