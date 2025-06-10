const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

// Path to Node.js wrapper script
let WRAPPER_PATH;
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  WRAPPER_PATH = path.join(__dirname, 'js', 'wrapper.js');
} else {
  WRAPPER_PATH = path.join(process.resourcesPath, 'js', 'wrapper.js');
}

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
  
  return new Promise((resolve, reject) => {
    // Clean up any existing flag files for AceNet processes
    if (scriptType === 'check_acenet') {
      cleanupAceNetFlags();
    }

    // Create a temporary config file with parameters
    const configPath = path.join(app.getPath('temp'), 'inventory_config.json');
    const config = {
      script_type: scriptType,
      input_file: filePath,
      output_file: path.join(path.dirname(filePath), `output_${Date.now()}.xlsx`),
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
    
    fs.writeFileSync(configPath, JSON.stringify(config));

    // Spawn Node.js process
    pythonProcess = spawn('node', [WRAPPER_PATH, configPath]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      output += dataStr;
      
      // Check for progress updates
      if (dataStr.includes('PROGRESS:')) {
        const match = dataStr.match(/PROGRESS:(\d+)\/(\d+):(.+)/);
        if (match) {
          event.sender.send('processing-update', {
            type: 'progress',
            current: parseInt(match[1]),
            total: parseInt(match[2]),
            message: match[3].trim()
          });
        }
      } else if (dataStr.includes('PARTNUMBER_FILE:')) {
        // Extract partnumber file path
        const match = dataStr.match(/PARTNUMBER_FILE:\s*(.+)/);
        if (match) {
          config.partnumber_file = match[1].trim();
        }
        event.sender.send('processing-update', {
          type: 'log',
          message: dataStr.trim()
        });
      } else {
        event.sender.send('processing-update', {
          type: 'log',
          message: dataStr.trim()
        });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      event.sender.send('processing-update', {
        type: 'error',
        message: data.toString().trim()
      });
    });

    pythonProcess.on('close', (code) => {
      // Clean up temp config
      try {
        fs.unlinkSync(configPath);
      } catch (e) {}

      // Clean up flag files for AceNet processes
      if (scriptType === 'check_acenet') {
        cleanupAceNetFlags();
      }

      if (code === 0) {
        resolve({
          success: true,
          output: output,
          outputFile: config.output_file,
          partnumberFile: config.partnumber_file || null
        });
      } else {
        reject({
          success: false,
          error: errorOutput || 'Process failed with code ' + code
        });
      }
    });
  });
});

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
        reject({ success: false, error: 'Installation failed' });
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

// IPC handler to run Node.js scripts
ipcMain.handle('run-python', async (event, args) => {
  return new Promise((resolve, reject) => {
    console.log('Starting Node.js script execution...');
    console.log('Wrapper path:', WRAPPER_PATH);
    console.log('Script parameters:', args.params);

    const py = spawn('node', [WRAPPER_PATH, ...args.params]);
    let output = '';
    let error = '';

    py.stdout.on('data', (data) => {
      const chunk = data.toString();
      console.log('Node.js stdout:', chunk);
      output += chunk;
      
      // Send progress updates to renderer
      if (chunk.includes('PROGRESS:')) {
        const match = chunk.match(/PROGRESS:(\d+)\/(\d+):(.+)/);
        if (match) {
          event.sender.send('acenet-progress', {
            current: parseInt(match[1]),
            total: parseInt(match[2]),
            message: match[3].trim()
          });
        }
      }
    });

    py.stderr.on('data', (data) => {
      const chunk = data.toString();
      console.error('Node.js stderr:', chunk);
      error += chunk;
    });

    py.on('error', (err) => {
      console.error('Failed to start Node.js process:', err);
      reject(new Error(`Failed to start Node.js process: ${err.message}`));
    });

    py.on('close', (code) => {
      console.log('Node.js process exited with code:', code);
      
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Node.js script failed with code ${code}: ${error}`));
      }
    });
  });
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