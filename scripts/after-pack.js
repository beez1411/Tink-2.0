const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  console.log('Running after-pack script...');
  
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName === 'win32') {
    // Ensure puppeteer-cache directory exists in the packaged app
    const puppeteerCacheDir = path.join(appOutDir, 'resources', 'app.asar.unpacked', 'puppeteer-cache');
    
    if (!fs.existsSync(puppeteerCacheDir)) {
      fs.mkdirSync(puppeteerCacheDir, { recursive: true });
      console.log('Created puppeteer-cache directory');
    }
    
    // Create a marker file to indicate the app was properly packaged
    const markerFile = path.join(appOutDir, 'resources', 'app.asar.unpacked', '.packaged');
    fs.writeFileSync(markerFile, JSON.stringify({
      packaged: true,
      timestamp: new Date().toISOString(),
      platform: electronPlatformName
    }));
    
    console.log('After-pack script completed successfully');
  }
};
