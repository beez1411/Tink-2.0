const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Setting up production environment...');

try {
  // Check if we're in a packaged app
  const isPackaged = process.env.NODE_ENV === 'production' || 
                    fs.existsSync(path.join(__dirname, '..', '.packaged'));
  
  if (isPackaged) {
    console.log('Detected packaged application');
    
    // Set up Puppeteer cache directory
    const puppeteerCacheDir = path.join(__dirname, '..', 'puppeteer-cache');
    
    if (!fs.existsSync(puppeteerCacheDir)) {
      fs.mkdirSync(puppeteerCacheDir, { recursive: true });
      console.log('Created puppeteer-cache directory');
    }
    
    // Set environment variable for Puppeteer
    process.env.PUPPETEER_CACHE_DIR = puppeteerCacheDir;
    
    // Try to install Chrome if not present
    try {
      const chromeDir = path.join(puppeteerCacheDir, 'chrome');
      if (!fs.existsSync(chromeDir) || fs.readdirSync(chromeDir).length === 0) {
        console.log('Installing Chrome browser...');
        execSync('npx puppeteer browsers install chrome', { 
          stdio: 'inherit',
          env: { ...process.env, PUPPETEER_CACHE_DIR: puppeteerCacheDir }
        });
        console.log('Chrome browser installed successfully');
      } else {
        console.log('Chrome browser already installed');
      }
    } catch (browserError) {
      console.warn('Warning: Could not install Chrome browser:', browserError.message);
      console.warn('The application may not work properly without Chrome browser');
    }
  } else {
    console.log('Development environment detected, skipping production setup');
  }
  
  console.log('Production setup completed');
} catch (error) {
  console.error('Error during production setup:', error.message);
  // Don't fail the installation, just warn
  process.exit(0);
}
