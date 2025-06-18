const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Try to load auto-updater, but don't crash if it fails
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
  console.log('Auto-updater not available:', error.message);
}

let mainWindow;
let pythonProcess;

// Modules are now imported only when needed inside functions

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile('index.html');
  
  // Maximize the window after it's ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    
    // Ensure the renderer is fully initialized
    mainWindow.webContents.executeJavaScript(`
      console.log('Window is now ready and visible');
      // Force input field initialization if not already done
      if (window.initializeInputFields) {
        window.initializeInputFields();
      }
    `).catch(err => console.log('JavaScript execution error:', err));
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  // Configure auto-updater if available
  if (autoUpdater) {
    try {
      autoUpdater.logger = require('electron-log');
      autoUpdater.logger.transports.file.level = 'info';
      
      // Auto-update: check for updates and notify
      autoUpdater.checkForUpdatesAndNotify();

      // Listen for update events
      autoUpdater.on('checking-for-update', () => {
        console.log('Checking for update...');
      });
      
      autoUpdater.on('update-available', (info) => {
        console.log('Update available.');
        if (mainWindow) {
          mainWindow.webContents.send('update-available', info);
        }
      });
      
      autoUpdater.on('update-not-available', (info) => {
        console.log('Update not available.');
      });
      
      autoUpdater.on('error', (err) => {
        console.log('Error in auto-updater. ' + err);
      });
      
      autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        console.log(log_message);
        if (mainWindow) {
          mainWindow.webContents.send('download-progress', progressObj);
        }
      });
      
      autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded');
        if (mainWindow) {
          mainWindow.webContents.send('update-downloaded', info);
        }
      });
    } catch (error) {
      console.log('Auto-updater setup failed:', error.message);
    }
  } else {
    console.log('Auto-updater not available - continuing without auto-update functionality');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size
    };
  }
  return null;
});

ipcMain.handle('check-dependencies', async () => {
  const dependencies = [
    'puppeteer',
    'exceljs',
    'papaparse',
    'simple-statistics',
    'ml-kmeans'
  ];

  const results = {};
  
  for (const dep of dependencies) {
    try {
      const result = await checkNodePackage(dep);
      results[dep] = result;
    } catch (error) {
      results[dep] = { installed: false, version: null };
    }
  }

  return results;
});

// Update handlers
ipcMain.handle('restart-app', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall();
  } else {
    app.relaunch();
    app.exit();
  }
});

ipcMain.handle('check-for-updates', () => {
  if (autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    console.log('Auto-updater not available');
  }
});

ipcMain.handle('process-file', async (event, options) => {
  const { filePath, scriptType, daysThreshold, currentMonth, username, password, store, sheetName } = options;
  
  try {
    // Clean up any existing flag files for AceNet processes
    if (scriptType === 'check_acenet') {
      cleanupAceNetFlags();
    }

    // Handle special case for AceNet using suggested order file
    let actualInputFile = filePath;
    let outputDir = filePath ? path.dirname(filePath) : path.join(os.homedir(), 'Desktop');
    
    if (scriptType === 'check_acenet' && filePath === 'USE_SUGGESTED_ORDER') {
      // Look for suggested order files on desktop and in project directory
      const desktop = path.join(os.homedir(), 'Desktop');
      const projectDir = __dirname;
      
      // Search in both desktop and project directory
      const searchDirs = [desktop, projectDir];
      let foundFile = null;
      let mostRecentFile = null;
      let mostRecentTime = 0;
      
      for (const dir of searchDirs) {
        try {
          const files = fs.readdirSync(dir);
          
          // Look for suggested_order_output_*.xlsx files
          const suggestedOrderFiles = files.filter(file => 
            file.startsWith('suggested_order_output_') && file.endsWith('.xlsx')
          );
          
          // Find the most recent file by timestamp in filename
          for (const file of suggestedOrderFiles) {
            const match = file.match(/suggested_order_output_(\d+)\.xlsx/);
            if (match) {
              const timestamp = parseInt(match[1]);
              if (timestamp > mostRecentTime) {
                mostRecentTime = timestamp;
                mostRecentFile = path.join(dir, file);
              }
            }
          }
          
          // Also check for traditional naming patterns
          const today = new Date().toISOString().split('T')[0];
          const todayFile = path.join(dir, `Suggested Order -- ${today}.xlsx`);
          if (fs.existsSync(todayFile)) {
            const stats = fs.statSync(todayFile);
            if (stats.mtime.getTime() > mostRecentTime) {
              mostRecentTime = stats.mtime.getTime();
              mostRecentFile = todayFile;
            }
          }
          
          // Check yesterday's file
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          const yesterdayFile = path.join(dir, `Suggested Order -- ${yesterdayStr}.xlsx`);
          if (fs.existsSync(yesterdayFile)) {
            const stats = fs.statSync(yesterdayFile);
            if (stats.mtime.getTime() > mostRecentTime) {
              mostRecentTime = stats.mtime.getTime();
              mostRecentFile = yesterdayFile;
            }
          }
        } catch (error) {
          console.log(`Error reading directory ${dir}:`, error.message);
        }
      }
      
      if (mostRecentFile && fs.existsSync(mostRecentFile)) {
        actualInputFile = mostRecentFile;
        outputDir = path.dirname(mostRecentFile);
        console.log(`Found suggested order file: ${mostRecentFile}`);
      } else {
        throw new Error('No recent suggested order file found. Please run Suggested Order first or upload a part numbers file.');
      }
    }

    // Create config object
    const config = {
      script_type: scriptType,
      input_file: actualInputFile,
      output_file: path.join(outputDir, `${scriptType}_output_${Date.now()}.xlsx`),
      days_threshold: daysThreshold,
      current_month: currentMonth
    };
    
    // Add script-specific parameters
    if (scriptType === 'check_acenet') {
      config.username = username;
      config.password = password;
      config.store = store;
      config.sheet_name = sheetName || 'Big Beautiful Order';
    }

    // Send initial progress update
    event.sender.send('processing-update', {
      type: 'log',
      message: 'Starting processing...'
    });

    // Run wrapper functionality directly in this process
    const result = await runWrapperDirectly(config, (updateData) => {
      event.sender.send('processing-update', updateData);
    });

    // Clean up flag files for AceNet processes
    if (scriptType === 'check_acenet') {
      cleanupAceNetFlags();
    }

    return {
      success: true,
      output: result.output,
      outputFile: result.output_file,
      partnumberFile: result.partnumber_file || null,
      orderData: result.orderData || [],
      processed_items: result.processed_items || 0,
      debug: result.debug || {}
    };

  } catch (error) {
    // Clean up flag files for AceNet processes
    if (scriptType === 'check_acenet') {
      cleanupAceNetFlags();
    }
    
    throw new Error(`Processing failed: ${error.message}`);
  }
});

// New function to run wrapper functionality directly
async function runWrapperDirectly(config, progressCallback) {
  const { runAceNetCheck, runAceNetCheckDirect } = require('./js/acenet-scraper');
  const { generateSuggestedOrder } = require('./js/inventory-analyzer');
  
  const scriptType = config.script_type;
  const filePath = config.input_file;
  
  let result = {};
  
  if (scriptType === 'suggested_order') {
    const skipFileOutput = config.output_file === 'SKIP_FILE_OUTPUT';
    const daysThreshold = config.days_threshold || 14;
    const outputFile = config.output_file;
    
    progressCallback({
      type: 'log',
      message: 'Analyzing inventory data...'
    });
    
    const orderResult = await generateSuggestedOrder({
      inputFile: filePath,
      outputFile: outputFile,
      supplierNumber: 10,
      daysThreshold: daysThreshold,
      currentMonth: config.current_month,
      onOrderData: config.onOrderData || {}
    });
   
    // Handle the new return format (no file output) and set the main result
    if (orderResult && (orderResult.orderData || orderResult.processed_items !== undefined)) {
      progressCallback({
        type: 'log',
        message: `Generated ${orderResult.processed_items || 0} order recommendations`
      });
      
      // Set the main result object for final JSON output
      result = {
        success: true,
        output: `Generated ${orderResult.processed_items || 0} order recommendations`,
        output_file: outputFile,
        orderData: orderResult.orderData || [],
        processed_items: orderResult.processed_items || 0,
        debug: orderResult.debug || {}
      };
    } else {
      throw new Error('No output generated');
    }
    
  } else if (scriptType === 'check_acenet_direct') {
    throw new Error('Direct AceNet processing not supported in this context');
  } else if (scriptType.includes('check_acenet')) {
    // File-based processing
    const username = config.username;
    const password = config.password;
    const store = config.store;
    const sheetName = config.sheet_name || 'Big Beautiful Order';
    
    if (!username || !password || !store) {
      throw new Error('Missing required AceNet credentials (username, password, store)');
    }
    
    progressCallback({
      type: 'log',
      message: 'Starting AceNet check...'
    });
    
    result = await runAceNetCheck(filePath, username, password, store, sheetName);
  } else {
    throw new Error(`Unknown script type: ${scriptType}`);
  }
  
  return result;
}

ipcMain.handle('install-dependencies', async (event) => {
  return new Promise((resolve, reject) => {
    const packages = [
      'puppeteer',
      'exceljs',
      'papaparse',
      'simple-statistics',
      'ml-kmeans'
    ];

    const npmProcess = spawn('npm', ['install', ...packages]);

    npmProcess.stdout.on('data', (data) => {
      event.sender.send('install-update', {
        type: 'log',
        message: data.toString().trim()
      });
    });

    npmProcess.stderr.on('data', (data) => {
      event.sender.send('install-update', {
        type: 'error',
        message: data.toString().trim()
      });
    });

    npmProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error('Installation failed'));
      }
    });
  });
});

// IPC handler to save temporary files
ipcMain.handle('save-temp-file', async (event, fileInfo) => {
  const tempDir = path.join(os.tmpdir(), 'tink-temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFilePath = path.join(tempDir, fileInfo.name);
  fs.writeFileSync(tempFilePath, Buffer.from(fileInfo.data));
  
  return tempFilePath;
});

// IPC handler to run Node.js scripts directly
ipcMain.handle('run-python', async (event, args) => {
  try {
    console.log('Starting script execution...');
    console.log('Script parameters:', args.params);

    // Parse the parameters to determine what to do
    const scriptType = args.params[0];
    
    if (scriptType === 'check_acenet_direct') {
      // Handle direct AceNet processing
      const usernameIndex = args.params.indexOf('--username');
      const passwordIndex = args.params.indexOf('--password');
      const storeIndex = args.params.indexOf('--store');
      const partNumbersIndex = args.params.indexOf('--part-numbers');
      
      if (usernameIndex !== -1 && passwordIndex !== -1 && storeIndex !== -1 && partNumbersIndex !== -1) {
        const username = args.params[usernameIndex + 1];
        const password = args.params[passwordIndex + 1];
        const store = args.params[storeIndex + 1];
        const partNumbersJson = args.params[partNumbersIndex + 1];
        
        try {
          const partNumbers = JSON.parse(partNumbersJson);
          const { runAceNetCheckDirect } = require('./js/acenet-scraper');
          
          // Send progress updates via the acenet-progress channel
          const result = await runAceNetCheckDirect(partNumbers, username, password, store, (progress) => {
            event.sender.send('acenet-progress', progress);
          });
          
          return JSON.stringify(result);
        } catch (parseError) {
          throw new Error(`Failed to parse part numbers: ${parseError.message}`);
        }
      } else {
        throw new Error('Missing required arguments for direct AceNet processing');
      }
    } else {
      // Handle other script types using the wrapper directly
      const config = {
        script_type: scriptType,
        input_file: args.params[1]
      };
      
      const result = await runWrapperDirectly(config, (updateData) => {
        // Convert processing updates to acenet-progress format
        if (updateData.type === 'progress') {
          event.sender.send('acenet-progress', {
            current: updateData.current,
            total: updateData.total,
            message: updateData.message
          });
        }
      });
      
      return JSON.stringify(result);
    }
  } catch (error) {
    console.error('Script execution failed:', error);
    throw error;
  }
});

// IPC handler for direct AceNet processing with part numbers
ipcMain.handle('process-acenet-direct', async (event, data) => {
  const { partNumbers, username, password, store } = data;
  console.log(`Processing ${partNumbers.length} part numbers directly with AceNet (Double-check enabled)`);
  
  try {
    const { runAceNetCheckDirect } = require('./js/acenet-scraper');
    
    // Run the AceNet check directly in this process
    const result = await runAceNetCheckDirect(partNumbers, username, password, store, (progress) => {
      // Forward progress updates to renderer
      event.sender.send('processing-update', {
        type: 'progress',
        current: progress.current || 0,
        total: progress.total || partNumbers.length,
        message: progress.message || 'Processing...'
      });
    });
    
    return result;
  } catch (error) {
    console.error('Direct AceNet process error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to open files
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to open file:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to clean up AceNet flag files
function cleanupAceNetFlags() {
  const tempDir = os.tmpdir();
  const pauseFlag = path.join(tempDir, 'acenet_pause.flag');
  const cancelFlag = path.join(tempDir, 'acenet_cancel.flag');
  
  try {
    if (fs.existsSync(pauseFlag)) {
      fs.unlinkSync(pauseFlag);
    }
    if (fs.existsSync(cancelFlag)) {
      fs.unlinkSync(cancelFlag);
    }
  } catch (e) {
    console.warn('Warning: Could not clean up flag files:', e.message);
  }
}

// IPC handlers for AceNet process control
ipcMain.handle('acenet-pause', async (event) => {
  const tempDir = os.tmpdir();
  const pauseFlag = path.join(tempDir, 'acenet_pause.flag');
  try {
    fs.writeFileSync(pauseFlag, 'paused');
    console.log('AceNet process paused');
    return { success: true };
  } catch (error) {
    console.error('Failed to pause AceNet process:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('acenet-resume', async (event) => {
  const tempDir = os.tmpdir();
  const pauseFlag = path.join(tempDir, 'acenet_pause.flag');
  try {
    if (fs.existsSync(pauseFlag)) {
      fs.unlinkSync(pauseFlag);
    }
    console.log('AceNet process resumed');
    return { success: true };
  } catch (error) {
    console.error('Failed to resume AceNet process:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('acenet-cancel', async (event) => {
  const tempDir = os.tmpdir();
  const cancelFlag = path.join(tempDir, 'acenet_cancel.flag');
  try {
    fs.writeFileSync(cancelFlag, 'cancelled');
    console.log('AceNet process cancelled');
    return { success: true };
  } catch (error) {
    console.error('Failed to cancel AceNet process:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to check if a Node.js package is installed
async function checkNodePackage(packageName) {
  return new Promise((resolve) => {
    try {
      const packagePath = require.resolve(packageName);
      const packageJson = require(path.join(packagePath, '../../package.json'));
      resolve({
        installed: true,
        version: packageJson.version || 'unknown'
      });
    } catch (error) {
      // Check if it's available in node_modules
      try {
        const packageJsonPath = path.join(process.cwd(), 'node_modules', packageName, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          resolve({
            installed: true,
            version: packageJson.version || 'unknown'
          });
        } else {
          resolve({
            installed: false,
            version: null
          });
        }
      } catch (err) {
        resolve({
          installed: false,
          version: null
        });
      }
    }
  });
} 