# Auto-Update Setup Guide for Tink 2.0

This guide explains how to set up and use the auto-update functionality for the Tink 2.0 Electron application.

## ✅ Current Implementation Status

### What's Already Implemented:
- ✅ **electron-updater** dependency installed (v5.3.0)
- ✅ **Auto-updater code** in main.js with event handlers
- ✅ **GitHub publish configuration** in package.json
- ✅ **GitHub Actions workflow** for building and releasing
- ✅ **Update notification UI** with progress tracking
- ✅ **IPC handlers** for checking updates and restarting

## 🚀 How to Create a Release

### Step 1: Update Version Number
1. Edit `package.json` and update the version number:
   ```json
   {
     "version": "2.0.1"  // Increment from 2.0.0
   }
   ```

### Step 2: Create a Git Tag
```bash
git add .
git commit -m "Release v2.0.1"
git tag v2.0.1
git push origin main
git push origin v2.0.1
```

### Step 3: GitHub Actions Will Automatically:
1. Build the application for Windows
2. Create executable installer (.exe)
3. Generate update metadata files (.yml, .blockmap)
4. Create a GitHub Release with all necessary files
5. Publish to the GitHub repository

## 🔔 How Auto-Updates Work

### For End Users:
1. **Automatic Check**: App checks for updates on startup
2. **Update Available**: Notification appears in top-right corner
3. **Background Download**: Update downloads automatically
4. **Install Prompt**: User chooses when to restart and install
5. **Seamless Update**: App restarts with new version

### Update Notifications:
- **Blue notification**: "Update Available" - download starting
- **Progress bar**: Shows download progress
- **Install buttons**: "Restart & Install" or "Later"

## 📋 Manual Testing Process

### Test Auto-Updates:
1. Build and install current version (v2.0.0)
2. Create a new release (v2.0.1) following steps above
3. Wait for GitHub Actions to complete
4. Run the installed app - it should detect and download the update
5. Install notification should appear when download completes

### Force Update Check:
```javascript
// In developer console:
window.api.checkForUpdates();
```

## ⚠️ Important Notes

### GitHub Repository Requirements:
- Repository must be **public** or you need GitHub Pro for private repos
- Repository must have **Releases** enabled
- GitHub token must have proper permissions

### Windows Code Signing (Optional):
- For production, consider adding code signing certificates
- This eliminates Windows security warnings
- Add signing configuration to package.json build section

### Version Format:
- Always use semantic versioning: `MAJOR.MINOR.PATCH`
- Git tags must match the format: `v2.0.1`
- Package.json version: `2.0.1` (without 'v')

## 🛠️ Troubleshooting

### Common Issues:

1. **"No updates available"**
   - Check if GitHub release was created successfully
   - Verify the repository URL in package.json publish config
   - Ensure the release has the .exe and .yml files

2. **Download fails**
   - Check internet connection
   - Verify GitHub repository is accessible
   - Check console for detailed error messages

3. **Update notification doesn't appear**
   - Check if auto-updater is loaded (main.js logs)
   - Verify update event listeners are working
   - Check browser developer console for errors

### Debug Information:
- Check `%USERPROFILE%\AppData\Roaming\Tink 2.0\logs\` for update logs
- Use developer console to monitor update events
- Check GitHub Actions logs for build issues

## 📈 Future Enhancements

### Possible Improvements:
- **Delta updates**: Only download changed files
- **Beta channel**: Separate pre-release updates
- **Update scheduling**: Allow users to schedule update times
- **Rollback mechanism**: Ability to revert to previous version
- **Code signing**: Eliminate Windows security warnings

---

## Current GitHub Configuration

**Repository**: `beez1411/Tink-2.0`
**Publish Provider**: GitHub Releases
**Auto-check**: On app startup
**Update Channel**: Stable releases only

The auto-update system is now ready to use! Simply create new releases following the steps above. 