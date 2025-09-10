const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// Enhanced Phantom Inventory System
const PhantomSetup = require('./js/phantom-setup');
let phantomSetup = null;

// Persistent inventory data storage
let persistentInventoryData = {
  filePath: null,
  fileName: null,
  fileSize: null,
  loadDate: null,
  data: null,
  analysisResults: null
};

// Persistent data file path - use user data directory to avoid permission issues
const getUserDataDirectory = () => {
  try {
    // Use Electron's userData path
    return app.getPath('userData');
  } catch (error) {
    // Fallback to user's home directory
    return path.join(os.homedir(), '.tink2-data');
  }
};

const PERSISTENT_DATA_FILE = path.join(getUserDataDirectory(), 'persistent_inventory_data.json');

// Save persistent inventory data to file
async function savePersistentInventoryData() {
  try {
    // Ensure user data directory exists
    const userDataDir = path.dirname(PERSISTENT_DATA_FILE);
    await fs.promises.mkdir(userDataDir, { recursive: true });
    
    const dataToSave = {
      ...persistentInventoryData,
      // Don't save the full data array to avoid huge files, just metadata
      dataCount: persistentInventoryData.data ? persistentInventoryData.data.length : 0,
      data: null // We'll keep data in memory and reload from original file
    };
    
    await fs.promises.writeFile(PERSISTENT_DATA_FILE, JSON.stringify(dataToSave, null, 2));
    console.log('Saved persistent inventory metadata');
  } catch (error) {
    console.error('Error saving persistent inventory data:', error);
  }
}

// Load persistent inventory data from file
async function loadPersistentInventoryData() {
  try {
    if (fs.existsSync(PERSISTENT_DATA_FILE)) {
      const savedData = JSON.parse(await fs.promises.readFile(PERSISTENT_DATA_FILE, 'utf8'));
      
      // Restore metadata
      persistentInventoryData.filePath = savedData.filePath;
      persistentInventoryData.fileName = savedData.fileName;
      persistentInventoryData.fileSize = savedData.fileSize;
      persistentInventoryData.loadDate = savedData.loadDate;
      persistentInventoryData.analysisResults = savedData.analysisResults;
      
      // Try to reload data from the original file if it still exists
      if (savedData.filePath && fs.existsSync(savedData.filePath)) {
        console.log('Reloading inventory data from:', savedData.filePath);
        const reloadedData = await loadInventoryFromFile(savedData.filePath);
        if (reloadedData) {
          persistentInventoryData.data = reloadedData;
          console.log(`Restored persistent inventory data: ${savedData.fileName} with ${reloadedData.length} items`);
          return true;
        }
      }
      
      console.log('Persistent inventory file no longer exists, clearing saved data');
      await clearPersistentInventoryData();
    }
  } catch (error) {
    console.error('Error loading persistent inventory data:', error);
  }
  return false;
}

// Clear persistent inventory data
async function clearPersistentInventoryData() {
  persistentInventoryData = {
    filePath: null,
    fileName: null,
    fileSize: null,
    loadDate: null,
    data: null,
    analysisResults: null
  };
  
  try {
    if (fs.existsSync(PERSISTENT_DATA_FILE)) {
      await fs.promises.unlink(PERSISTENT_DATA_FILE);
    }
  } catch (error) {
    console.error('Error clearing persistent data file:', error);
  }
}

// Load inventory data from file
async function loadInventoryFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    if (lines.length < 2) {
      return null;
    }

    const headers = lines[0].split('\t');
    const inventoryData = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = line.split('\t');
        const item = {};
        
        headers.forEach((header, index) => {
          item[header.trim()] = values[index] ? values[index].trim() : '';
        });
        
        inventoryData.push(item);
      }
    }

    return inventoryData;
  } catch (error) {
    console.error('Error loading inventory from file:', error);
    return null;
  }
}

// Helper function to find accessible desktop or documents directory
function findAccessibleDirectory() {
  const alternateDesktops = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'OneDrive', 'Desktop'), // OneDrive Desktop
    path.join(os.homedir(), 'OneDrive - Ace Hardware', 'Desktop'), // Corporate OneDrive
    path.join(os.homedir(), 'Documents'), // Fallback to Documents
    os.homedir() // Final fallback to home directory
  ];
  
  // Find the first existing directory with write permissions
  for (const testPath of alternateDesktops) {
    try {
      if (fs.existsSync(testPath)) {
        // Test if we can write to this directory
        const testFile = path.join(testPath, `test_${Date.now()}.tmp`);
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile); // Clean up test file
        
        return testPath;
      }
    } catch (testError) {
      // Continue to next path if this one doesn't work
      continue;
    }
  }
  
  throw new Error('No accessible desktop or documents directory found');
}

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
      nodeIntegration: false,
      // Fix cache issues by disabling certain features
      webSecurity: false,
      enableRemoteModule: false,
      allowRunningInsecureContent: true
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

// Create native menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'API Configuration...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-api-configuration');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle API Mode',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('toggle-api-mode');
            }
          }
        },
        {
          label: 'Refresh API Data',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('refresh-api-data');
            }
          }
        },
        {
          label: 'Test API Connection',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('test-api-connection');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Fix Input Fields',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('fix-input-fields');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Phantom Inventory Statistics',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('phantom-show-stats');
            }
          }
        },
        {
          label: 'Sync Phantom Network Data',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('phantom-sync-network');
            }
          }
        },
        {
          label: 'Export Phantom Reports',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('phantom-export-reports');
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: async () => {
            if (autoUpdater) {
              try {
                await autoUpdater.checkForUpdatesAndNotify();
                if (mainWindow) {
                  mainWindow.webContents.send('manual-update-check');
                }
              } catch (error) {
                console.error('Manual update check failed:', error);
                dialog.showErrorBox('Update Check Failed', `Could not check for updates: ${error.message}`);
              }
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Updates Unavailable',
                message: 'Auto-updater is not available in development mode.'
              });
            }
          }
        },
        {
          label: 'About Tink 2.0',
          click: () => {
            const packageJson = require('./package.json');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Tink 2.0',
              message: 'Tink 2.0',
              detail: `Version: ${packageJson.version}\nInventory processing application\n© 2024 1411 Capital Inc`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Fix cache issues by setting cache path and disabling hardware acceleration
  app.setPath('userData', path.join(os.homedir(), '.tink2-cache'));
  app.commandLine.appendSwitch('--disable-gpu');
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  
  createWindow();
  createMenu();

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
        // Notify renderer process about update errors
        if (mainWindow) {
          mainWindow.webContents.send('update-error', {
            message: `Auto-update failed: ${err.message}`,
            error: err.toString()
          });
        }
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
  
  console.log('Processing file request:', { filePath, scriptType, fileExists: filePath ? fs.existsSync(filePath) : false });
  
  try {
    // Check if file exists before processing
    if (filePath && !fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Clean up any existing flag files for AceNet processes
    if (scriptType === 'check_acenet') {
      cleanupAceNetFlags();
    }

    // Handle special case for AceNet using suggested order file
    let actualInputFile = filePath;
    let outputDir = filePath ? path.dirname(filePath) : findAccessibleDirectory();
    
    if (scriptType === 'check_acenet' && filePath === 'USE_SUGGESTED_ORDER') {
      // Look for suggested order files on desktop and in project directory
      const desktop = findAccessibleDirectory();
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
      current_month: currentMonth,
      apiData: options.apiData || null // Pass API data if provided
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
      debug: result.debug || {},
      // Include stock-out prediction results
      predictions: result.predictions || [],
      stats: result.stats || {},
      canExportToExcel: result.canExportToExcel || false
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
    
    // Check if this is API data instead of file data
    let orderResult;
    if (config.apiData) {
      // Process API data directly
      orderResult = await generateSuggestedOrder({
        apiData: config.apiData,
        outputFile: outputFile,
        supplierNumber: 10,
        daysThreshold: daysThreshold,
        currentMonth: config.current_month,
        onOrderData: config.onOrderData || {}
      });
    } else {
      // Process file data
      orderResult = await generateSuggestedOrder({
        inputFile: filePath,
        outputFile: outputFile,
        supplierNumber: 10,
        daysThreshold: daysThreshold,
        currentMonth: config.current_month,
        onOrderData: config.onOrderData || {}
      });
    }
   
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
    
  } else if (scriptType === 'stock_out_prediction') {
    progressCallback({
      type: 'log',
      message: 'Analyzing sales patterns for stock-out prediction (JavaScript version)...'
    });
    
    const { StockOutAnalyzer } = require('./js/stock-out-analyzer');
    const outputFile = config.output_file;
    
    // Create config file for JavaScript analyzer
    const configData = {
      input_file: config.input_file,
      onOrderData: config.onOrderData || {},
      output_file: outputFile
    };
    
    const configFile = path.join(__dirname, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
    
    try {
      // Use the JavaScript analyzer directly
      const analyzer = new StockOutAnalyzer(configFile);
      
      // Override console.log to capture progress messages
      const originalLog = console.log;
      console.log = (message) => {
        originalLog(message);
        if (typeof message === 'string' && 
            (message.includes('Processing chunk') || message.includes('Loading') || message.includes('Found'))) {
          progressCallback({
            type: 'log',
            message: message
          });
        }
      };
      
      const results = await analyzer.runAnalysis();
      
      // Restore original console.log
      console.log = originalLog;
      
      // Clean up config file
      try {
        if (fs.existsSync(configFile)) {
          fs.unlinkSync(configFile);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up config file:', cleanupError);
      }
      
      if (results.success) {
        const predictions = results.predictions || [];
        const stats = results.summary || {};
        
        // Transform predictions to match expected format
        const transformedPredictions = predictions.map(pred => ({
          'Part number': pred.partNumber,
          'Description 1': pred.description,
          'Current Stock': pred.currentStock,
          'Baseline Velocity': pred.baselineVelocity,
          'Recent Velocity': pred.recentVelocity,
          'Drop %': pred.dropPercentage,
          'Confidence': pred.confidence,
          'Priority Score': pred.priorityScore,
          'Suggested Qty': pred.suggestedQty,
          'Unit Cost': pred.unitCost,
          'Min Order Qty': pred.minOrderQty,
          'Supplier': pred.supplier
        }));
        
        progressCallback({
          type: 'log',
          message: `Analysis complete: Found ${transformedPredictions.length} items with potential stock-out risk across ${stats.supplierCount || 'multiple'} suppliers`
        });
        
        result = {
          success: true,
          output: `Stock-out analysis complete. Found ${transformedPredictions.length} potential stock-out items.`,
          predictions: transformedPredictions,
          stats: stats,
          processed_items: transformedPredictions.length,
          // Add a flag to indicate we can export to Excel later
          canExportToExcel: true
        };
      } else {
        throw new Error(results.error || 'Analysis failed');
      }
      
    } catch (analysisError) {
      console.error('Error running stock-out analysis:', analysisError);
      throw new Error(`Failed to run analysis: ${analysisError.message}`);
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

// IPC handler to toggle DevTools (for input field accessibility fix)
ipcMain.handle('toggle-devtools', async (event) => {
  try {
    if (mainWindow) {
      console.log('Toggling DevTools to fix input accessibility...');
      
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
      
      // Close DevTools immediately after opening to simulate the toggle effect
      setTimeout(() => {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        }
      }, 100);
      
      return { success: true };
    }
    return { success: false, error: 'No main window available' };
  } catch (error) {
    console.error('Error toggling DevTools:', error);
    return { success: false, error: error.message };
  }
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

// IPC handler to save PO file
ipcMain.handle('save-to-po', async (event, orderData) => {
  try {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    // Get current date for filename
    const now = new Date();
    const dateStr = now.getFullYear() + 
                   String(now.getMonth() + 1).padStart(2, '0') + 
                   String(now.getDate()).padStart(2, '0');
    
    // Create filename: Tink PO YYYYMMDD.txt
    const filename = `Tink PO ${dateStr}.txt`;
    
    // Use helper function to find accessible directory
    const desktopPath = findAccessibleDirectory();
    const filePath = path.join(desktopPath, filename);
    
    // Create file content with tab-separated values
    let content = 'PARTNUMBER\tSUPPLIER_NUMBER1\tQUANTITY\tMKTCOST\n';
    
    orderData.forEach(item => {
      // Format: PARTNUMBER	SUPPLIER_NUMBER1	QUANTITY	MKTCOST
      // Use dynamic supplier number from original inventory data, fallback to '10'
      const supplierNumber = item.supplierNumber || '10';
      const partNumber = item.partNumber || item.sku || '';
      const quantity = item.quantity || 0;
      const cost = item.cost || '';
      
      content += `${partNumber}\t${supplierNumber}\t${quantity}\t${cost}\n`;
    });
    
    // Write the file with proper error handling
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`PO file saved: ${filePath}`);
    console.log(`Items saved: ${orderData.length}`);
    console.log(`Desktop path used: ${desktopPath}`);
    
    return {
      success: true,
      filePath: filePath,
      itemCount: orderData.length,
      directory: desktopPath
    };
    
  } catch (error) {
    console.error('Error saving PO file:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      path: error.path
    });
    
    return {
      success: false,
      error: error.message,
      details: `${error.code || 'UNKNOWN_ERROR'}: ${error.message}`
    };
  }
});

// IPC handler to export AceNet results to Excel
ipcMain.handle('export-acenet-results', async (event, resultsData, checkType = 'acenet') => {
  try {
    const ExcelJS = require('exceljs');
    const os = require('os');
    const path = require('path');
    
    // Get current date for filename
    const now = new Date();
    const dateStr = now.getFullYear() + 
                   String(now.getMonth() + 1).padStart(2, '0') + 
                   String(now.getDate()).padStart(2, '0');
    
    // Create appropriate filename based on check type
    const filename = checkType === 'planogram' 
      ? `On Planogram Results ${dateStr}.xlsx`
      : `AceNet Results ${dateStr}.xlsx`;
    
    // Use helper function to find accessible directory
    const desktopPath = findAccessibleDirectory();
    const filePath = path.join(desktopPath, filename);
    
    // Create new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'Tink 2.0';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Create single worksheet with column-based layout
    const worksheetName = checkType === 'planogram' ? 'On Planogram Results' : 'AceNet Results';
    const worksheet = workbook.addWorksheet(worksheetName);
    
    // Define different column configurations based on check type
    let columnConfig;
    
    if (checkType === 'planogram') {
      // For planogram: Only Has Asterisk, Cancelled (Closeout), and Not in RSC
      columnConfig = [
        { column: 'A', header: 'Has Asterisk', color: 'FF28A745', key: 'Has Asterisk (*)' },   // Green
        { column: 'B', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'C', header: 'Cancelled', color: 'FF6F42C1', key: 'Cancelled' },            // Purple (Closeout)
        { column: 'D', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'E', header: 'Not in RSC', color: 'FF6C757D', key: 'Not in RSC' }           // Gray
      ];
    } else {
      // For standard AceNet: All columns except Has Asterisk
      columnConfig = [
        { column: 'A', header: 'No Discovery', color: 'FFFD7E14', key: 'No Discovery' },        // Orange
        { column: 'B', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'C', header: 'No Asterisk(*)', color: 'FFFF1744', key: 'No Asterisk(*)' }, // Red
        { column: 'D', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'E', header: 'Cancelled', color: 'FF6F42C1', key: 'Cancelled' },            // Purple
        { column: 'F', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'G', header: 'On Order', color: 'FFFFC107', key: 'On Order' },              // Yellow
        { column: 'H', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'I', header: 'No Location', color: 'FFE83E8C', key: 'No Location' },        // Pink
        { column: 'J', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'K', header: 'Not in AceNet', color: 'FF2196F3', key: 'Not in AceNet' },    // Blue
        { column: 'L', header: '', color: null, key: 'spacer' },                               // Spacer
        { column: 'M', header: 'Not in RSC', color: 'FF6C757D', key: 'Not in RSC' }           // Gray
      ];
    }
    
    // Set up headers and column formatting
    columnConfig.forEach(config => {
      const cell = worksheet.getCell(`${config.column}1`);
      cell.value = config.header;
      
      if (config.color) {
        // Style header with color background, bold white text
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: config.color }
        };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Set column width based on header text length
        worksheet.getColumn(config.column).width = Math.max(config.header.length * 1.2, 15);
      } else {
        // Spacer columns - minimal width
        worksheet.getColumn(config.column).width = 3;
      }
    });
    
    // Process categorized results and populate columns
    let totalItems = 0;
    
    console.log('Export data received:', {
      hasResultsData: !!resultsData,
      hasCategorizedResults: !!(resultsData && resultsData.categorizedResults),
      isArray: Array.isArray(resultsData?.categorizedResults),
      categoriesCount: resultsData?.categorizedResults?.length,
      categories: resultsData?.categorizedResults?.map(c => ({ name: c.name, partsCount: c.parts?.length }))
    });
    
    if (resultsData && resultsData.categorizedResults && Array.isArray(resultsData.categorizedResults)) {
      // Create a map to find the correct column for each category
      const categoryToColumn = {};
      columnConfig.forEach(config => {
        if (config.key !== 'spacer') {
          categoryToColumn[config.key] = config.column;
        }
      });
      
      resultsData.categorizedResults.forEach(category => {
        if (category && category.name && category.parts && Array.isArray(category.parts) && category.parts.length > 0) {
          console.log(`Processing category: "${category.name}", parts: ${category.parts.length}`);
          const columnLetter = categoryToColumn[category.name];
          console.log(`Column mapping: "${category.name}" -> column "${columnLetter}"`);
          
          if (columnLetter) {
            totalItems += category.parts.length;
            
            // Add part numbers starting from row 2
            category.parts.forEach((part, index) => {
              const partData = typeof part === 'object' ? part : { partNumber: part };
              const partNumber = partData.partNumber || part;
              const row = index + 2; // Start from row 2 (row 1 is header)
              
              const cell = worksheet.getCell(`${columnLetter}${row}`);
              cell.value = partNumber;
              
              // Style part number cells
              cell.font = { name: 'Consolas', size: 10 }; // Monospace font like in screenshot
              cell.alignment = { horizontal: 'left', vertical: 'top' };
              
              // Highlight rows that need manual review with yellow background
              if (partData.needsManualReview) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFFF00' } // Yellow
                };
                cell.font = { ...cell.font, bold: true };
              }
            });
            
            // Auto-size column based on content
            const headerLength = category.name.length;
            let maxContentLength = headerLength;
            
            category.parts.forEach(part => {
              const partData = typeof part === 'object' ? part : { partNumber: part };
              const partNumber = partData.partNumber || part;
              maxContentLength = Math.max(maxContentLength, partNumber.toString().length);
            });
            
            worksheet.getColumn(columnLetter).width = Math.max(maxContentLength * 1.1, 15);
          }
        }
      });
    }
    
    // Add borders to make it look cleaner
    const maxRow = worksheet.rowCount || 1;
    columnConfig.forEach(config => {
      if (config.key !== 'spacer') {
        for (let row = 1; row <= Math.max(maxRow, 50); row++) {
          const cell = worksheet.getCell(`${config.column}${row}`);
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        }
      }
    });
    
    // Freeze the header row
    worksheet.views = [
      { state: 'frozen', ySplit: 1 }
    ];
    
    // Save the file
    await workbook.xlsx.writeFile(filePath);
    
    console.log(`AceNet Excel file saved: ${filePath}`);
    console.log(`Categories processed: ${resultsData.categorizedResults?.length || 0}`);
    console.log(`Total items: ${totalItems}`);
    
    return {
      success: true,
      filePath: filePath,
      categoriesCount: resultsData.categorizedResults?.length || 0,
      totalItems: totalItems
    };
    
  } catch (error) {
    console.error('Error creating AceNet Excel file:', error);
    return {
      success: false,
      error: error.message
    };
  }
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
  const { partNumbers, username, password, store, checkType } = data;
  console.log(`Processing ${partNumbers.length} part numbers directly with AceNet (Double-check enabled) - Check type: ${checkType || 'standard'}`);
  
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
    }, checkType);
    
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

// IPC handler to process part number files
ipcMain.handle('process-part-number-file', async (event, filePath) => {
  try {
    const ExcelJS = require('exceljs');
    const fs = require('fs');
    const path = require('path');
    
    const partNumbers = [];
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.txt') {
      // Process text file
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && !trimmedLine.startsWith('//')) {
          // Clean the line and handle multiple separators
          const cleanedLine = trimmedLine.replace(/[\s,;|\t]+/g, ' ').trim();
          
          // Split by spaces in case multiple part numbers are on one line
          const possibleParts = cleanedLine.split(/\s+/);
          
          for (const part of possibleParts) {
            // Skip common non-part-number words and column headers
            const skipWords = [
              'part', 'number', 'sku', 'item', 'code', 'description', 'qty', 'quantity',
              'partnumber', 'part_number', 'supplier_number1', 'supplier_number', 'supplier',
              'mktcost', 'cost', 'price', 'total', 'amount', 'value', 'soh', 'stock',
              'on_order', 'onorder', 'order', 'min_order_qty', 'moq', 'category',
              'vendor', 'manufacturer', 'brand', 'upc', 'barcode', 'location'
            ];
            if (skipWords.includes(part.toLowerCase())) {
              continue;
            }
            
            // Check if it looks like a part number
            if (part.length >= 3 && part.match(/^[A-Za-z0-9][A-Za-z0-9\-\.\_]*[A-Za-z0-9]$/)) {
              const partNumber = part.toUpperCase();
              if (!partNumbers.includes(partNumber)) {
                partNumbers.push(partNumber);
              }
            } else if (part.length >= 2 && part.match(/^[A-Za-z0-9\-\.\_]+$/)) {
              // Accept shorter alphanumeric codes as well
              const partNumber = part.toUpperCase();
              if (!partNumbers.includes(partNumber)) {
                partNumbers.push(partNumber);
              }
            }
          }
        }
      }
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      // Process Excel file
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      // Try to find part numbers in the first worksheet
      const worksheet = workbook.worksheets[0];
      
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          const cellValue = cell.value;
          if (cellValue) {
            let potentialPartNumber = '';
            
            if (typeof cellValue === 'string') {
              potentialPartNumber = cellValue.trim();
            } else if (typeof cellValue === 'number') {
              potentialPartNumber = cellValue.toString();
            } else if (cellValue.text) {
              // Handle rich text cells
              potentialPartNumber = cellValue.text.trim();
            }
            
            if (potentialPartNumber) {
              // Clean and validate the potential part number
              // Remove extra whitespace and common separators
              const cleanedValue = potentialPartNumber.replace(/[\s,;|]+/g, ' ').trim();
              
              // Split by spaces in case multiple part numbers are in one cell
              const possibleParts = cleanedValue.split(/\s+/);
              
                             for (const part of possibleParts) {
                 // Skip common non-part-number words and column headers
                 const skipWords = [
                   'part', 'number', 'sku', 'item', 'code', 'description', 'qty', 'quantity',
                   'partnumber', 'part_number', 'supplier_number1', 'supplier_number', 'supplier',
                   'mktcost', 'cost', 'price', 'total', 'amount', 'value', 'soh', 'stock',
                   'on_order', 'onorder', 'order', 'min_order_qty', 'moq', 'category',
                   'vendor', 'manufacturer', 'brand', 'upc', 'barcode', 'location'
                 ];
                 if (skipWords.includes(part.toLowerCase())) {
                   continue;
                 }
                 
                 // Check if it looks like a part number (at least 3 characters, alphanumeric with dashes/dots)
                 if (part.length >= 3 && part.match(/^[A-Za-z0-9][A-Za-z0-9\-\.\_]*[A-Za-z0-9]$/)) {
                   const partNumber = part.toUpperCase();
                   if (!partNumbers.includes(partNumber)) {
                     partNumbers.push(partNumber);
                   }
                 } else if (part.length >= 2 && part.match(/^[A-Za-z0-9\-\.\_]+$/)) {
                   // Accept shorter alphanumeric codes as well
                   const partNumber = part.toUpperCase();
                   if (!partNumbers.includes(partNumber)) {
                     partNumbers.push(partNumber);
                   }
                 }
               }
            }
          }
        });
      });
    } else {
      throw new Error('Unsupported file format. Please use .txt, .xlsx, or .xls files.');
    }
    
    console.log(`Extracted ${partNumbers.length} part numbers from ${filePath}`);
    
    return {
      success: true,
      partNumbers: partNumbers,
      totalFound: partNumbers.length
    };
    
  } catch (error) {
    console.error('Error processing part number file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// New function to export stock-out predictions to Excel
async function exportStockOutPredictionsToExcel(predictions, stats) {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    
    // Create predictions worksheet
    const worksheet = workbook.addWorksheet('Stock Out Predictions');
    
    // Define headers
    const headers = [
      'Part number', 'Description 1', 'Current Stock', 'Baseline Velocity', 'Recent Velocity',
      'Drop %', 'Confidence', 'Priority Score', 'Suggested Qty', 'Unit Cost', 'Min Order Qty', 'Supplier'
    ];
    
    // Add headers
    worksheet.addRow(headers);
    
    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    
    // Add data rows
    predictions.forEach(prediction => {
      const row = [
        prediction['Part number'],
        prediction['Description 1'],
        prediction['Current Stock'],
        prediction['Baseline Velocity'],
        prediction['Recent Velocity'],
        prediction['Drop %'],
        prediction['Confidence'],
        prediction['Priority Score'],
        prediction['Suggested Qty'],
        prediction['Unit Cost'],
        prediction['Min Order Qty'],
        prediction['Supplier']
      ];
      worksheet.addRow(row);
    });
    
    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 15;
    });
    
    // Create summary worksheet
    const summaryWorksheet = workbook.addWorksheet('Summary');
    summaryWorksheet.addRow(['Metric', 'Value']);
    
    // Style summary headers
    const summaryHeaderRow = summaryWorksheet.getRow(1);
    summaryHeaderRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });
    
    // Add summary data
    const summaryData = [
      ['Total Items with Stock Out Risk', predictions.length],
      ['High Confidence Predictions (≥70%)', stats.high_confidence || 0],
      ['Medium Confidence Predictions (50-69%)', stats.medium_confidence || 0],
      ['Low Confidence Predictions (30-49%)', stats.low_confidence || 0],
      ['Average Confidence Score', stats.average_confidence ? `${stats.average_confidence.toFixed(1)}%` : '0%'],
      ['Total Suggested Order Value', stats.total_suggested_value ? `$${stats.total_suggested_value.toFixed(2)}` : '$0.00']
    ];
    
    summaryData.forEach(row => summaryWorksheet.addRow(row));
    
    // Auto-fit summary columns
    summaryWorksheet.columns.forEach((column) => {
      column.width = 30;
    });
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const desktopPath = path.join(require('os').homedir(), 'Desktop');
    const filename = path.join(desktopPath, `Stock Out Predictions -- ${timestamp}.xlsx`);
    
    // Write file
    await workbook.xlsx.writeFile(filename);
    
    console.log(`Excel file saved to: ${filename}`);
    return filename;
    
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
}

// Add new IPC handler for Excel export
ipcMain.handle('export-stock-out-predictions', async (event, data) => {
  try {
    const { predictions, stats } = data;
    const filename = await exportStockOutPredictionsToExcel(predictions, stats);
    return { success: true, filename };
  } catch (error) {
    console.error('Error exporting stock-out predictions:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// Enhanced Phantom Inventory IPC Handlers
// ========================================

// Initialize phantom setup on app start
app.whenReady().then(async () => {
  console.log('Application ready, creating phantom setup instance...');
  
  // Check for critical dependencies
  await checkCriticalDependencies();
  
  try {
    phantomSetup = new PhantomSetup();
    console.log('PhantomSetup instance created successfully');
    
    // Load persistent inventory data if available
    const dataLoaded = await loadPersistentInventoryData();
    if (dataLoaded) {
      console.log('Persistent inventory data loaded successfully');
    }
  } catch (error) {
    console.error('Error creating phantom setup instance:', error);
    console.error('Stack trace:', error.stack);
    
    // Show user-friendly error dialog
    if (mainWindow) {
      dialog.showErrorBox('Initialization Error', 
        `Failed to initialize application components: ${error.message}\n\n` +
        'Please try restarting the application or contact support if the problem persists.'
      );
    }
  }
});

// Check for critical dependencies and show helpful error messages
async function checkCriticalDependencies() {
  const issues = [];
  
  try {
    // Check if Puppeteer is available
    require('puppeteer');
  } catch (error) {
    issues.push('Puppeteer web scraping library is missing');
  }
  
  try {
    // Check if ExcelJS is available
    require('exceljs');
  } catch (error) {
    issues.push('ExcelJS library is missing');
  }
  
  // Check if Puppeteer cache directory exists
  const puppeteerCacheDir = path.join(__dirname, 'puppeteer-cache');
  if (!fs.existsSync(puppeteerCacheDir)) {
    issues.push('Puppeteer browser cache directory is missing');
  }
  
  // Check if Chrome browser is installed
  const chromeDir = path.join(puppeteerCacheDir, 'chrome');
  if (!fs.existsSync(chromeDir) || fs.readdirSync(chromeDir).length === 0) {
    issues.push('Chrome browser is not installed for web scraping');
  }
  
  if (issues.length > 0) {
    console.warn('Dependency issues detected:');
    issues.forEach(issue => console.warn(`- ${issue}`));
    
    // Try to auto-fix some issues
    try {
      if (!fs.existsSync(puppeteerCacheDir)) {
        fs.mkdirSync(puppeteerCacheDir, { recursive: true });
        console.log('Created puppeteer-cache directory');
      }
      
      // Try to install Chrome if missing
      const chromeDir = path.join(puppeteerCacheDir, 'chrome');
      if (!fs.existsSync(chromeDir) || fs.readdirSync(chromeDir).length === 0) {
        console.log('Attempting to install Chrome browser...');
        const { spawn } = require('child_process');
        const installProcess = spawn('npx', ['puppeteer', 'browsers', 'install', 'chrome'], {
          env: { ...process.env, PUPPETEER_CACHE_DIR: puppeteerCacheDir },
          stdio: 'inherit'
        });
        
        installProcess.on('close', (code) => {
          if (code === 0) {
            console.log('Chrome browser installed successfully');
          } else {
            console.warn('Failed to install Chrome browser automatically');
          }
        });
      }
    } catch (fixError) {
      console.error('Error attempting to fix dependencies:', fixError.message);
    }
  }
}

// Run phantom setup wizard
ipcMain.handle('phantom-setup-wizard', async () => {
  try {
    if (!phantomSetup) {
      phantomSetup = new PhantomSetup();
    }
    const result = await phantomSetup.runSetupWizard();
    return { success: true, data: result };
  } catch (error) {
    console.error('Error running phantom setup wizard:', error);
    return { success: false, error: error.message };
  }
});

// Complete phantom setup with selected store
ipcMain.handle('phantom-complete-setup', async (event, storeId) => {
  try {
    if (!phantomSetup) {
      phantomSetup = new PhantomSetup();
    }
    const result = await phantomSetup.completeSetup(storeId);
    return result;
  } catch (error) {
    console.error('Error completing phantom setup:', error);
    return { success: false, error: error.message };
  }
});

// Manual initialization trigger
ipcMain.handle('phantom-force-initialize', async (event) => {
  try {
    console.log('Manual phantom initialization requested');
    
    if (!phantomSetup) {
      phantomSetup = new PhantomSetup();
    }
    
    const isSetup = await phantomSetup.isSetupComplete();
    if (!isSetup) {
      return { success: false, error: 'Phantom system is not set up. Please complete setup first.' };
    }
    
    if (phantomSetup.isInitialized) {
      return { success: true, message: 'Phantom system is already initialized' };
    }
    
    const initResult = await phantomSetup.initializePhantomSystem();
    console.log('Manual initialization result:', initResult);
    
    return { success: true, message: 'Phantom system initialized successfully', data: initResult };
  } catch (error) {
    console.error('Error during manual phantom initialization:', error);
    return { success: false, error: error.message };
  }
});

// Get phantom system status
ipcMain.handle('phantom-get-status', async () => {
  try {
    if (!phantomSetup) {
      phantomSetup = new PhantomSetup();
    }
    const status = await phantomSetup.getSystemStatus();
    return { success: true, data: status };
  } catch (error) {
    console.error('Error getting phantom status:', error);
    return { success: false, error: error.message };
  }
});

// Analyze inventory for phantom inventory
ipcMain.handle('phantom-analyze-inventory', async (event, inventoryData) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const results = await phantomDetector.analyzeInventory(inventoryData);
    return { success: true, data: results };
  } catch (error) {
    console.error('Error analyzing phantom inventory:', error);
    return { success: false, error: error.message };
  }
});

// Generate daily verification list
ipcMain.handle('phantom-generate-verification-list', async (event, inventoryData) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const results = await phantomDetector.generateDailyVerificationList(inventoryData);
    return { success: true, data: results };
  } catch (error) {
    console.error('Error generating verification list:', error);
    return { success: false, error: error.message };
  }
});

// Record verification result
ipcMain.handle('phantom-record-verification', async (event, verificationData) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const { partNumber, predicted, actualStock, notes } = verificationData;
    const result = await phantomDetector.recordVerificationResult(partNumber, predicted, actualStock, notes);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error recording verification:', error);
    return { success: false, error: error.message };
  }
});

// Complete verification handler removed - using phantom-complete-verification-new instead

// Batch complete verifications
ipcMain.handle('phantom-batch-complete-verifications', async (event, verificationResults) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const results = await phantomDetector.batchCompleteVerifications(verificationResults);
    return { success: true, data: results };
  } catch (error) {
    console.error('Error batch completing verifications:', error);
    return { success: false, error: error.message };
  }
});

// Get system statistics
ipcMain.handle('phantom-get-stats', async () => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const stats = phantomDetector.getSystemStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Error getting phantom stats:', error);
    return { success: false, error: error.message };
  }
});

// Generate comprehensive report
ipcMain.handle('phantom-generate-report', async () => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const report = await phantomDetector.generateComprehensiveReport();
    return { success: true, data: report };
  } catch (error) {
    console.error('Error generating phantom report:', error);
    return { success: false, error: error.message };
  }
});

// Export phantom data
ipcMain.handle('phantom-export-data', async () => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const filename = await phantomDetector.exportAllData();
    return { success: true, data: { filename } };
  } catch (error) {
    console.error('Error exporting phantom data:', error);
    return { success: false, error: error.message };
  }
});

// Import phantom data
ipcMain.handle('phantom-import-data', async (event, filename) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const result = await phantomDetector.importData(filename);
    return result;
  } catch (error) {
    console.error('Error importing phantom data:', error);
    return { success: false, error: error.message };
  }
});

// Reset phantom setup
ipcMain.handle('phantom-reset-setup', async () => {
  try {
    if (!phantomSetup) {
      phantomSetup = new PhantomSetup();
    }
    const result = await phantomSetup.resetSetup();
    return result;
  } catch (error) {
    console.error('Error resetting phantom setup:', error);
    return { success: false, error: error.message };
  }
}); 

// Phantom inventory window functionality removed - now integrated into main UI

// Get inventory data from main window
ipcMain.handle('get-inventory-data', async (event) => {
    try {
        // First check if we have persistent inventory data
        if (persistentInventoryData.data && persistentInventoryData.data.length > 0) {
            console.log(`Returning persistent inventory data with ${persistentInventoryData.data.length} items`);
            return { 
                success: true, 
                data: persistentInventoryData.data,
                isPersistent: true,
                fileName: persistentInventoryData.fileName,
                loadDate: persistentInventoryData.loadDate
            };
        }

        // Then try to get processed inventory data from global variables
        const processedData = await new Promise((resolve) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.executeJavaScript(`
                    window.latestInventoryData || window.processedData || null
                `).then(resolve).catch((error) => {
                    console.error('Error accessing processed data:', error);
                    resolve(null);
                });
            } else {
                resolve(null);
            }
        });

        if (processedData && processedData.length > 0) {
            console.log(`Returning processed data with ${processedData.length} items`);
            return { success: true, data: processedData };
        }

        // If no processed data, try to get the selected file information
        const selectedFile = await new Promise((resolve) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.executeJavaScript(`
                    window.selectedFile ? JSON.parse(JSON.stringify(window.selectedFile)) : null
                `).then(resolve).catch((error) => {
                    console.error('Error accessing selectedFile:', error);
                    resolve(null);
                });
            } else {
                resolve(null);
            }
        });

        if (!selectedFile) {
            return { success: false, error: 'No inventory file has been imported. Please import an inventory file first using the Import Inventory button.' };
        }

        // Handle API data
        if (selectedFile.isApiData && selectedFile.data) {
            console.log(`Returning API data with ${selectedFile.data.length} items`);
            return { success: true, data: selectedFile.data };
        }

        // Handle file data
        if (!selectedFile.path || selectedFile.path === 'API_DATA') {
            return { success: false, error: 'No valid file path available' };
        }

        // Read and parse the inventory file
        const fs = require('fs');
        if (!fs.existsSync(selectedFile.path)) {
            return { success: false, error: 'Selected inventory file not found: ' + selectedFile.path };
        }

        const content = fs.readFileSync(selectedFile.path, 'utf8');
        const lines = content.split('\n');
        
        if (lines.length < 2) {
            return { success: false, error: 'Invalid inventory file format' };
        }

        const headers = lines[0].split('\t');
        const inventoryData = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const values = line.split('\t');
                const item = {};
                
                headers.forEach((header, index) => {
                    item[header.trim()] = values[index] ? values[index].trim() : '';
                });
                
                inventoryData.push(item);
            }
        }

        console.log(`Returning file data with ${inventoryData.length} items`);
        
        // Save this as persistent data for future sessions
        persistentInventoryData = {
            filePath: selectedFile.path,
            fileName: selectedFile.name || path.basename(selectedFile.path),
            fileSize: selectedFile.size || fs.statSync(selectedFile.path).size,
            loadDate: new Date().toISOString(),
            data: inventoryData,
            analysisResults: null
        };
        
        // Save to disk (async, don't wait)
        savePersistentInventoryData().catch(console.error);
        
        return { success: true, data: inventoryData };
    } catch (error) {
        console.error('Error getting inventory data:', error);
        return { success: false, error: error.message };
    }
});

// Get persistent inventory data info
ipcMain.handle('get-persistent-inventory-info', async (event) => {
    try {
        if (persistentInventoryData.data && persistentInventoryData.data.length > 0) {
            return {
                success: true,
                info: {
                    fileName: persistentInventoryData.fileName,
                    fileSize: persistentInventoryData.fileSize,
                    loadDate: persistentInventoryData.loadDate,
                    itemCount: persistentInventoryData.data.length,
                    hasAnalysisResults: !!persistentInventoryData.analysisResults
                }
            };
        }
        return { success: false, error: 'No persistent inventory data available' };
    } catch (error) {
        console.error('Error getting persistent inventory info:', error);
        return { success: false, error: error.message };
    }
});

// Clear persistent inventory data
ipcMain.handle('clear-persistent-inventory', async (event) => {
    try {
        await clearPersistentInventoryData();
        console.log('Persistent inventory data cleared');
        return { success: true };
    } catch (error) {
        console.error('Error clearing persistent inventory data:', error);
        return { success: false, error: error.message };
    }
});

// Handle saving feedback data for ML learning
ipcMain.handle('save-feedback-data', async (event, feedbackData) => {
    try {
        const feedbackFile = path.join(__dirname, 'data', 'feedback_data.json');
        
        // Ensure data directory exists
        const dataDir = path.dirname(feedbackFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Read existing feedback data
        let allFeedback = [];
        if (fs.existsSync(feedbackFile)) {
            const existingData = await fs.promises.readFile(feedbackFile, 'utf8');
            allFeedback = JSON.parse(existingData);
        }
        
        // Add new feedback
        allFeedback.push({
            ...feedbackData,
            id: Date.now() + Math.random(), // Simple unique ID
            savedAt: new Date().toISOString()
        });
        
        // Keep only last 5000 feedback entries
        if (allFeedback.length > 5000) {
            allFeedback = allFeedback.slice(-5000);
        }
        
        // Save back to file
        await fs.promises.writeFile(feedbackFile, JSON.stringify(allFeedback, null, 2));
        
        console.log('Feedback data saved to file:', feedbackFile);
        return { success: true, count: allFeedback.length };
        
    } catch (error) {
        console.error('Error saving feedback data:', error);
        return { success: false, error: error.message };
    }
});

// Handle getting feedback data for reports
ipcMain.handle('get-feedback-data', async () => {
    try {
        const feedbackFile = path.join(__dirname, 'data', 'feedback_data.json');
        
        if (!fs.existsSync(feedbackFile)) {
            return { success: true, data: [] };
        }
        
        const data = await fs.promises.readFile(feedbackFile, 'utf8');
        const feedbackData = JSON.parse(data);
        
        return { success: true, data: feedbackData };
        
    } catch (error) {
        console.error('Error reading feedback data:', error);
        return { success: false, error: error.message, data: [] };
    }
});

// Handle saving persistent order data
ipcMain.handle('save-persistent-order-data', async (event, orderData) => {
    try {
        const orderFile = path.join(__dirname, 'data', 'persistent_order_data.json');
        
        // Ensure data directory exists
        const dataDir = path.dirname(orderFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Save order data
        await fs.promises.writeFile(orderFile, JSON.stringify(orderData, null, 2));
        
        console.log('Persistent order data saved to file:', orderFile);
        return { success: true };
        
    } catch (error) {
        console.error('Error saving persistent order data:', error);
        return { success: false, error: error.message };
    }
});

// Handle clearing persistent order data
ipcMain.handle('clear-persistent-order-data', async () => {
    try {
        const orderFile = path.join(__dirname, 'data', 'persistent_order_data.json');
        
        if (fs.existsSync(orderFile)) {
            await fs.promises.unlink(orderFile);
            console.log('Persistent order data file deleted');
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('Error clearing persistent order data:', error);
        return { success: false, error: error.message };
    }
});

// Save analysis results to persistent data
ipcMain.handle('save-analysis-results', async (event, analysisResults) => {
    try {
        if (persistentInventoryData.data) {
            persistentInventoryData.analysisResults = analysisResults;
            await savePersistentInventoryData();
            console.log('Analysis results saved to persistent data');
            return { success: true };
        }
        return { success: false, error: 'No persistent inventory data to save results to' };
    } catch (error) {
        console.error('Error saving analysis results:', error);
        return { success: false, error: error.message };
    }
});

// Analyze phantom inventory (short name for popup window)
ipcMain.handle('phantom-analyze', async (event, inventoryData) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    if (!inventoryData || !Array.isArray(inventoryData)) {
        throw new Error('No inventory data provided');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const results = await phantomDetector.analyzeInventory(inventoryData);
    
    // Add store information to the phantom candidates for verification consistency
    let currentStore = null;
    
    // Method 1: Try getCurrentStore() function
    try {
      if (phantomSetup && typeof phantomSetup.getCurrentStore === 'function') {
        currentStore = phantomSetup.getCurrentStore();
        if (currentStore && currentStore.id) {
          console.log(`[STORE TRACKING] Got store from getCurrentStore(): ${currentStore.id}`);
        }
      }
    } catch (error) {
      console.log('[STORE TRACKING] Method 1 failed - phantomSetup.getCurrentStore():', error.message);
    }
    
    // Method 2: Check if phantomSetup has store property directly
    if (!currentStore || !currentStore.id) {
      if (phantomSetup && phantomSetup.store && phantomSetup.store.id) {
        currentStore = phantomSetup.store;
        console.log(`[STORE TRACKING] Got store from phantomSetup.store: ${currentStore.id}`);
      }
    }
    
    // Method 3: Check if phantomSetup has selectedStore or currentStore properties
    if (!currentStore || !currentStore.id) {
      if (phantomSetup && phantomSetup.selectedStore && phantomSetup.selectedStore.id) {
        currentStore = phantomSetup.selectedStore;
        console.log(`[STORE TRACKING] Got store from phantomSetup.selectedStore: ${currentStore.id}`);
      } else if (phantomSetup && phantomSetup.currentStore && phantomSetup.currentStore.id) {
        currentStore = phantomSetup.currentStore;
        console.log(`[STORE TRACKING] Got store from phantomSetup.currentStore: ${currentStore.id}`);
      }
    }
    
    // Method 4: Debug phantomSetup structure
    if (!currentStore || !currentStore.id) {
      console.log('[STORE TRACKING] DEBUG - phantomSetup structure:', {
        hasGetCurrentStore: phantomSetup && typeof phantomSetup.getCurrentStore === 'function',
        hasStore: phantomSetup && !!phantomSetup.store,
        hasSelectedStore: phantomSetup && !!phantomSetup.selectedStore,
        hasCurrentStore: phantomSetup && !!phantomSetup.currentStore,
        phantomSetupKeys: phantomSetup ? Object.keys(phantomSetup) : 'null'
      });
    }
    
    // Add store info to phantom candidates
    if (results.phantomCandidates && currentStore && currentStore.id) {
      results.phantomCandidates = results.phantomCandidates.map(candidate => ({
        ...candidate,
        storeId: currentStore.id,
        storeName: currentStore.displayName || currentStore.name || currentStore.id
      }));
      
      console.log(`[STORE TRACKING] ✅ Enhanced ${results.phantomCandidates.length} phantom candidates with store info: ${currentStore.id}`);
    } else {
      console.log(`[STORE TRACKING] ❌ Could not add store info - currentStore:`, currentStore, 'candidatesExist:', !!results.phantomCandidates);
    }
    
    return { success: true, data: results };
  } catch (error) {
    console.error('Error analyzing phantom inventory:', error);
    return { success: false, error: error.message };
  }
});

// Generate verification list (short name for popup window)
ipcMain.handle('phantom-generate-verification', async (event, inventoryData) => {
  console.log('Legacy phantom-generate-verification handler - redirecting to new handler');
  return handlePhantomGenerateVerificationData(inventoryData, true); // Generate Excel by default for legacy calls
});

// New handler for phantom verification data generation
ipcMain.handle('phantom-generate-verification-data', async (event, options) => {
  return handlePhantomGenerateVerificationData(options.phantomCandidates, options.generateExcel || false);
});

// Unified phantom verification data handler
async function handlePhantomGenerateVerificationData(phantomCandidates, generateExcel = false) {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    if (!phantomCandidates || !Array.isArray(phantomCandidates)) {
        throw new Error('No phantom candidates data provided');
    }
    
    console.log(`Generating verification data for ${phantomCandidates.length} phantom candidates`);
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    
    // Create verification workflow instance - use the same store that was used for analysis
    const VerificationWorkflow = require('./js/verification-workflow');
    let storeId = null;
    
    // First priority: Get store from phantom setup (the store used for analysis)
    try {
      if (phantomSetup && phantomSetup.getCurrentStore) {
        const currentStore = phantomSetup.getCurrentStore();
        if (currentStore && currentStore.id) {
          storeId = currentStore.id;
          console.log(`Using store from phantom analysis: ${storeId}`);
        }
      }
    } catch (error) {
      console.log('Could not get store from phantom setup:', error.message);
    }
    
    // Second priority: Extract store from the phantom candidates themselves
    if (!storeId && phantomCandidates && phantomCandidates.length > 0) {
      // Look for store ID in the candidate data
      const firstCandidate = phantomCandidates[0];
      if (firstCandidate.storeId) {
        storeId = firstCandidate.storeId;
        console.log(`Using store from phantom candidates: ${storeId}`);
      } else {
        // Also check if the phantom setup has the store info in a different way
        console.log('No storeId found in phantom candidates, checking phantom setup state...');
        if (phantomSetup && phantomSetup.store && phantomSetup.store.id) {
          storeId = phantomSetup.store.id;
          console.log(`Using store from phantom setup state: ${storeId}`);
        }
      }
    }
    
    // Third priority: Get current store from phantom setup
    if (!storeId && phantomSetup) {
      try {
        const currentStore = phantomSetup.getCurrentStore();
        if (currentStore && currentStore.id) {
          storeId = currentStore.id;
          console.log(`Using store from phantom setup getCurrentStore(): ${storeId}`);
        }
      } catch (error) {
        console.log('Could not get current store from phantom setup:', error.message);
      }
    }
    
    // Fourth priority: Check phantom setup properties
    if (!storeId && phantomSetup) {
      if (phantomSetup.currentStore && phantomSetup.currentStore.id) {
        storeId = phantomSetup.currentStore.id;
        console.log(`Using store from phantom setup currentStore property: ${storeId}`);
      } else if (phantomSetup.storeId) {
        storeId = phantomSetup.storeId;
        console.log(`Using store from phantom setup storeId property: ${storeId}`);
      }
    }
    
    // Last resort: Throw error instead of using wrong store
    if (!storeId) {
      throw new Error('Could not determine store ID for verification workflow. Please ensure phantom system is properly initialized for a specific store.');
    }
    
    console.log(`Using existing verification workflow for store: ${storeId}`);
    // Use the existing verification workflow from phantom detector instead of creating new one
    const workflow = phantomDetector.verificationWorkflow;
    
    // Generate verification list from phantom candidates
    const results = await workflow.generateDailyVerificationList(phantomCandidates);
    
    // If Excel generation is requested, create the file
    if (generateExcel && results.locationGroups && results.locationGroups.length > 0) {
      const ExcelJS = require('exceljs');
      const path = require('path');
      const os = require('os');
      
      try {
        const desktopPath = findAccessibleDirectory(); // Use the existing helper function
        const timestamp = new Date().toISOString().split('T')[0];
        const storeId = phantomSetup.getCurrentStore().id;
        const filename = `Phantom_Inventory_Verification_${storeId}_${timestamp}.xlsx`;
        const filePath = path.join(desktopPath, filename);
        
        const workbook = new ExcelJS.Workbook();
        
        // Create ONE unified verification sheet instead of separate location sheets
        const worksheet = workbook.addWorksheet('Phantom Inventory Verification');
        
        // Configure column widths and properties
        worksheet.columns = [
          { header: 'Part Number', key: 'partNumber', width: 18 },
          { header: 'Description', key: 'description', width: 40 },
          { header: 'Current Stock', key: 'currentStock', width: 16 },
          { header: 'Location', key: 'location', width: 18 },
          { header: 'Risk Score', key: 'riskScore', width: 14 },
          { header: 'Actual Count', key: 'actualCount', width: 16 },
          { header: 'Notes', key: 'notes', width: 35 },
          { header: 'Verified By', key: 'verifiedBy', width: 20 },
          { header: 'Date', key: 'date', width: 15 }
        ];
        
        // Collect all items from all location groups into one unified list
        const allItems = [];
        if (results.locationGroups && Array.isArray(results.locationGroups)) {
          results.locationGroups.forEach(locationGroup => {
            if (locationGroup.items && Array.isArray(locationGroup.items)) {
              allItems.push(...locationGroup.items);
            }
          });
        }
        
        // Sort by part number for easier lookup during verification
        allItems.sort((a, b) => (a.partNumber || '').localeCompare(b.partNumber || ''));
        
        // Add all items to the single unified sheet
        allItems.forEach(item => {
          worksheet.addRow({
            partNumber: item.partNumber,
            description: item.description,
            currentStock: item.currentStock,
            location: item.location,
            riskScore: item.riskScore,
            actualCount: '', // Actual Count - to be filled during verification
            notes: '', // Notes - to be filled during verification
            verifiedBy: '', // Verified By - to be filled during verification
            date: new Date().toLocaleDateString() // Date
          });
        });
        
        // Style the headers
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4472C4' }
        };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Style all cells with borders and proper alignment
        worksheet.eachRow((row, rowNumber) => {
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // Add borders to all cells
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            
            // Center align specific columns:
            // Column 3: Current Stock
            // Column 5: Risk Score  
            // Column 6: Actual Count
            // Column 9: Date
            if (colNumber === 3 || colNumber === 5 || colNumber === 6 || colNumber === 9) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
              // Left align other columns except numbers
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
          });
          
          // Set row height for better visibility
          row.height = 22;
        });
        
        // Auto-size columns based on header length + buffer
        const headers = ['Part Number', 'Description', 'Current Stock', 'Location', 'Risk Score', 'Actual Count', 'Notes', 'Verified By', 'Date'];
        headers.forEach((header, index) => {
          const column = worksheet.getColumn(index + 1);
          const headerLength = header.length;
          let maxContentLength = headerLength;
          
          // Check content length for better sizing
          column.eachCell({ includeEmpty: false }, cell => {
            if (cell.value) {
              const contentLength = cell.value.toString().length;
              if (contentLength > maxContentLength) {
                maxContentLength = contentLength;
              }
            }
          });
          
          // Set column width with some padding
          column.width = Math.max(maxContentLength + 3, headerLength + 2);
        });
        
        console.log(`Created unified verification sheet with ${allItems.length} items from ${results.locationGroups?.length || 0} location groups`);
        
        // Save the workbook
        await workbook.xlsx.writeFile(filePath);
        console.log(`Generated verification sheets saved to: ${filePath}`);
        
        results.filename = filePath;
      } catch (excelError) {
        console.warn('Failed to generate Excel file:', excelError.message);
        // Don't fail the whole operation if Excel generation fails
      }
    }
    
    // Return the results with verification data
    const totalLocationGroups = (results.locationGroups && Array.isArray(results.locationGroups)) ? results.locationGroups.length : 0;
    const totalItems = (results.locationGroups && Array.isArray(results.locationGroups)) ? 
      results.locationGroups.reduce((sum, group) => sum + (group.items ? group.items.length : 0), 0) : 
      phantomCandidates.length;
    
    console.log(`Verification generation completed: ${totalItems} items across ${totalLocationGroups} location groups`);
    console.log(`Sheet info: ${results.totalSheets} total sheets, current sheet: ${results.currentSheet}, verification sheets: ${results.verificationSheets?.length || 0}`);
    
    return { 
      success: true, 
      data: results.locationGroups || [],
      items: results.items || phantomCandidates, // Include the actual items for easy access
      totalCandidates: results.totalCandidates || phantomCandidates.length,
      dailyList: results.dailyList || totalItems,
      locationGroups: results.locationGroups || [],
      estimatedTime: results.estimatedTime || Math.ceil(phantomCandidates.length * 2), // 2 mins per item estimate
      highPriorityItems: results.highPriorityItems || phantomCandidates.filter(item => (item.riskScore || 0) > 70).length,
      filename: results.filename || 'Verification data generated successfully',
      message: `Successfully generated ${results.totalSheets || 1} verification sheets for ${results.totalCandidates || phantomCandidates.length} items`,
      // NEW: Include all sheet management data from results
      totalSheets: results.totalSheets || 1,
      currentSheet: results.currentSheet || 0,
      verificationSheets: results.verificationSheets || []
    };
  } catch (error) {
    console.error('Error generating verification list:', error);
    return { success: false, error: error.message };
  }
}

// Sync network data
ipcMain.handle('phantom-sync-network', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const syncManager = phantomDetector.syncManager;
    const phantomML = phantomDetector.phantomML;
    
    const results = await syncManager.syncPhantomInventoryData(phantomSetup.currentStore.id, phantomML);
    return { success: true, data: results };
  } catch (error) {
    console.error('Error syncing network data:', error);
    return { success: false, error: error.message };
  }
});

// Export reports
ipcMain.handle('phantom-export-reports', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const reportPath = await phantomDetector.generateComprehensiveReport();
    return { success: true, data: { reportPath } };
  } catch (error) {
    console.error('Error exporting reports:', error);
    return { success: false, error: error.message };
  }
});

// API Configuration IPC Handlers
const APIConfigManager = require('./js/api-config-manager');
const PaladinAPIClient = require('./js/paladin-api-client');
const apiConfigManager = new APIConfigManager();

// Get API configuration summary
ipcMain.handle('get-api-config-summary', async (event) => {
  try {
    const summary = apiConfigManager.getConfigSummary();
    return { success: true, data: summary };
  } catch (error) {
    console.error('Error getting API config summary:', error);
    return { success: false, error: error.message };
  }
});

// Get full API configuration
ipcMain.handle('get-api-config', async (event) => {
  try {
    const config = apiConfigManager.getConfig();
    return { success: true, data: config };
  } catch (error) {
    console.error('Error getting API config:', error);
    return { success: false, error: error.message };
  }
});

// Update API configuration
ipcMain.handle('update-api-config', async (event, configData) => {
  try {
    const { paladin, general, networkSync } = configData;
    
    let success = true;
    
    if (paladin) {
      success = apiConfigManager.updatePaladinConfig(paladin);
    }
    
    if (general && success) {
      success = apiConfigManager.updateGeneralConfig(general);
    }
    
    if (networkSync && success) {
      success = apiConfigManager.updateNetworkSyncConfig(networkSync);
    }
    
    if (success) {
      return { success: true, message: 'Configuration updated successfully' };
    } else {
      return { success: false, error: 'Failed to save configuration' };
    }
  } catch (error) {
    console.error('Error updating API config:', error);
    return { success: false, error: error.message };
  }
});

// Test API connection
ipcMain.handle('test-api-connection', async (event) => {
  try {
    const result = await apiConfigManager.testPaladinConnection(PaladinAPIClient);
    return { success: true, data: result };
  } catch (error) {
    console.error('Error testing API connection:', error);
    return { success: false, error: error.message };
  }
});

// Test Network Sync connection
ipcMain.handle('test-network-sync', async (event, { syncUrl, apiKey, storeId }) => {
  try {
    const http = require('http');
    const https = require('https');
    
    return new Promise((resolve, reject) => {
      const url = new URL(syncUrl + '/api/health');
      const httpModule = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Tink-2.0-Network-Test'
        }
      };
      
      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300 && response.status === 'healthy') {
              resolve({ success: true, stores: response.stores || 0 });
            } else {
              resolve({ success: false, error: `Server error: ${response.error || 'Unknown error'}` });
            }
          } catch (parseError) {
            resolve({ success: false, error: 'Invalid server response' });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({ success: false, error: `Connection failed: ${error.message}` });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Connection timeout' });
      });
      
      req.end();
    });
  } catch (error) {
    console.error('Error testing network sync:', error);
    return { success: false, error: error.message };
  }
});

// Reset API configuration
ipcMain.handle('reset-api-config', async (event) => {
  try {
    const success = apiConfigManager.resetConfig();
    if (success) {
      return { success: true, message: 'Configuration reset to defaults' };
    } else {
      return { success: false, error: 'Failed to reset configuration' };
    }
  } catch (error) {
    console.error('Error resetting API config:', error);
    return { success: false, error: error.message };
  }
});

// Get inventory data from API
ipcMain.handle('get-api-inventory-data', async (event, options = {}) => {
  try {
    const paladinConfig = apiConfigManager.getPaladinConfig();
    
    if (!paladinConfig.enabled) {
      return { success: false, error: 'API is not enabled' };
    }
    
    const validation = apiConfigManager.validatePaladinConfig();
    if (!validation.isValid) {
      return { success: false, error: `Invalid configuration: ${validation.errors.join(', ')}` };
    }
    
    const client = new PaladinAPIClient(paladinConfig);
    
    // Get all inventory items with progress callback
    const result = await client.getAllInventoryItems({
      supplierFilter: options.supplierFilter || paladinConfig.defaultSupplierFilter,
      includeZeroStock: options.includeZeroStock || paladinConfig.includeZeroStock,
      onProgress: (progress) => {
        event.sender.send('api-inventory-progress', progress);
      }
    });
    
    if (result.success) {
      // Convert to Tink format
      const tinkData = client.convertToTinkFormat(result.items);
      return { success: true, data: tinkData, totalItems: result.totalItems };
    } else {
      return { success: false, error: 'Failed to fetch inventory data' };
    }
  } catch (error) {
    console.error('Error getting API inventory data:', error);
    return { success: false, error: error.message };
  }
});

// Refresh API inventory data
ipcMain.handle('refresh-api-inventory', async (event) => {
  try {
    const result = await ipcMain.emit('get-api-inventory-data', event);
    return result;
  } catch (error) {
    console.error('Error refreshing API inventory:', error);
    return { success: false, error: error.message };
  }
});

// Set API enabled/disabled
ipcMain.handle('set-api-enabled', async (event, enabled) => {
  try {
    const success = apiConfigManager.setPaladinEnabled(enabled);
    if (success) {
      return { success: true, message: `API ${enabled ? 'enabled' : 'disabled'} successfully` };
    } else {
      return { success: false, error: 'Failed to update API status' };
    }
  } catch (error) {
    console.error('Error setting API enabled:', error);
    return { success: false, error: error.message };
  }
});

// Validate API configuration
ipcMain.handle('validate-api-config', async (event, config) => {
  try {
    const validation = apiConfigManager.validatePaladinConfig(config);
    return { success: true, data: validation };
  } catch (error) {
    console.error('Error validating API config:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// VERIFICATION QUEUE & SYSTEM MANAGEMENT HANDLERS
// ========================================

// Get system stats
ipcMain.handle('phantom-get-system-stats', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    const syncManager = phantomDetector.syncManager;
    const phantomML = phantomDetector.phantomML;
    
    const stats = {
      verification: {
        pending: verificationWorkflow.verificationQueue.length,
        active: verificationWorkflow.activeVerifications.size,
        completed: verificationWorkflow.completedVerifications.size
      },
      network: {
        totalStores: syncManager.stores.size,
        totalVerifications: Array.from(syncManager.stores.values()).reduce((sum, store) => sum + (store.verificationCount || 0), 0),
        accuracy: syncManager.calculateNetworkAccuracy()
      },
      ml: {
        trainingData: phantomML.verificationResults.size,
        accuracy: phantomML.calculateOverallAccuracy(),
        categories: phantomML.categoryPatterns.size
      }
    };
    
    return { success: true, data: stats };
  } catch (error) {
    console.error('Error getting system stats:', error);
    return { success: false, error: error.message };
  }
});

// Get verification queue
ipcMain.handle('phantom-get-verification-queue', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    const data = {
      pending: verificationWorkflow.verificationQueue,
      active: Array.from(verificationWorkflow.activeVerifications.values()),
      completed: Array.from(verificationWorkflow.completedVerifications.values())
    };
    
    return { success: true, data };
  } catch (error) {
    console.error('Error getting verification queue:', error);
    return { success: false, error: error.message };
  }
});

// Change store
ipcMain.handle('phantom-change-store', async (event, newStoreId) => {
  try {
    if (!phantomSetup) {
      throw new Error('Phantom system not available');
    }
    
    // Save current store information
    const storeInfo = getStoreInfo(newStoreId);
    await phantomSetup.completeSetup(newStoreId, storeInfo);
    
    return { success: true };
  } catch (error) {
    console.error('Error changing store:', error);
    return { success: false, error: error.message };
  }
});

// Sync network data - UPDATED to fix duplicate handler error
ipcMain.handle('phantom-sync-network-new', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const syncManager = phantomDetector.syncManager;
    const phantomML = phantomDetector.phantomML;
    
    // Create network data if it doesn't exist
    await ensureNetworkDataExists();
    
    // Force sync
    await syncManager.syncPhantomInventoryData(phantomDetector.storeId, phantomML);
    
    return { success: true };
  } catch (error) {
    console.error('Error syncing network:', error);
    return { success: false, error: error.message };
  }
});

// Get ML data
ipcMain.handle('phantom-get-ml-data', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const phantomML = phantomDetector.phantomML;
    
    const data = {
      overview: {
        totalVerifications: phantomML.verificationResults.size,
        accuracy: phantomML.calculateOverallAccuracy(),
        learningProgress: Math.min(100, (phantomML.verificationResults.size / 100) * 100),
        lastUpdated: new Date().toISOString()
      },
      categories: Object.fromEntries(phantomML.categoryPatterns.entries()),
      network: {
        connectedStores: phantomDetector.syncManager.stores.size,
        sharedLearnings: phantomDetector.syncManager.getNetworkStats()
      }
    };
    
    return { success: true, data };
  } catch (error) {
    console.error('Error getting ML data:', error);
    return { success: false, error: error.message };
  }
});

// Export verification sheets to Excel
ipcMain.handle('phantom-export-verification-excel', async (event, { verificationData, phantomCandidates, exportCurrentSheetOnly, currentSheetItems }) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }

    // If exporting current sheet only, use current sheet items without regenerating workflow
    if (exportCurrentSheetOnly && currentSheetItems) {
      console.log(`Exporting current sheet only with ${currentSheetItems.length} items`);
      
      const ExcelJS = require('exceljs');
      const path = require('path');
      
      const desktopPath = findAccessibleDirectory();
      const timestamp = new Date().toISOString().split('T')[0];
      const storeId = phantomSetup.getCurrentStore().id;
      const filename = `Phantom_Current_Sheet_${storeId}_${timestamp}.xlsx`;
      const filePath = path.join(desktopPath, filename);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Current Sheet Verification');
      
      worksheet.columns = [
        { header: 'Part Number', key: 'partNumber', width: 18 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Current Stock', key: 'currentStock', width: 16 },
        { header: 'Location', key: 'location', width: 18 },
        { header: 'Risk Score', key: 'riskScore', width: 14 },
        { header: 'Actual Count', key: 'actualCount', width: 16 },
        { header: 'Notes', key: 'notes', width: 35 },
        { header: 'Verified By', key: 'verifiedBy', width: 20 },
        { header: 'Date', key: 'date', width: 15 }
      ];
      
      currentSheetItems.forEach(item => {
        worksheet.addRow({
          partNumber: item.partNumber,
          description: item.description,
          currentStock: item.currentStock,
          location: item.location,
          riskScore: item.riskScore,
          actualCount: '',
          notes: '',
          verifiedBy: '',
          date: new Date().toLocaleDateString()
        });
      });
      
      // Style the headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      
      await workbook.xlsx.writeFile(filePath);
      return { success: true, filePath: filePath };
    }

    // Otherwise, export all sheets
    const result = await handlePhantomGenerateVerificationData(phantomCandidates || verificationData.items || [], true);
    
    if (result.success && result.filename) {
      return { success: true, filePath: result.filename };
    } else {
      return { success: false, error: 'Failed to generate Excel file' };
    }
  } catch (error) {
    console.error('Error exporting verification Excel:', error);
    return { success: false, error: error.message };
  }
});

// Print verification sheets (create Excel and open)
ipcMain.handle('phantom-print-verification-excel', async (event, { verificationData, phantomCandidates, printCurrentSheetOnly, currentSheetItems }) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }

    // If printing current sheet only, create Excel for current sheet without regenerating workflow
    if (printCurrentSheetOnly && currentSheetItems) {
      console.log(`Printing current sheet only with ${currentSheetItems.length} items`);
      
      const ExcelJS = require('exceljs');
      const path = require('path');
      
      const desktopPath = findAccessibleDirectory();
      const timestamp = new Date().toISOString().split('T')[0];
      const storeId = phantomSetup.getCurrentStore().id;
      const filename = `Phantom_Print_Sheet_${storeId}_${timestamp}.xlsx`;
      const filePath = path.join(desktopPath, filename);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Current Sheet Verification');
      
      worksheet.columns = [
        { header: 'Part Number', key: 'partNumber', width: 18 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Current Stock', key: 'currentStock', width: 16 },
        { header: 'Location', key: 'location', width: 18 },
        { header: 'Risk Score', key: 'riskScore', width: 14 },
        { header: 'Actual Count', key: 'actualCount', width: 16 },
        { header: 'Notes', key: 'notes', width: 35 },
        { header: 'Verified By', key: 'verifiedBy', width: 20 },
        { header: 'Date', key: 'date', width: 15 }
      ];
      
      currentSheetItems.forEach(item => {
        worksheet.addRow({
          partNumber: item.partNumber,
          description: item.description,
          currentStock: item.currentStock,
          location: item.location,
          riskScore: item.riskScore,
          actualCount: '',
          notes: '',
          verifiedBy: '',
          date: new Date().toLocaleDateString()
        });
      });
      
      // Style the headers
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      
      await workbook.xlsx.writeFile(filePath);
      
      // Open the file in the default application for printing
      const { shell } = require('electron');
      shell.openPath(filePath);
      
      return { success: true, filePath: filePath };
    }

    // Otherwise, print all sheets
    const result = await handlePhantomGenerateVerificationData(phantomCandidates || verificationData.items || [], true);
    
    if (result.success && result.filename) {
      // Open the file in the default application for printing
      const { shell } = require('electron');
      shell.openPath(result.filename);
      
      return { success: true, filePath: result.filename };
    } else {
      return { success: false, error: 'Failed to generate Excel file for printing' };
    }
  } catch (error) {
    console.error('Error preparing verification sheets for printing:', error);
    return { success: false, error: error.message };
  }
});

// Generate PDF for verification sheet
ipcMain.handle('phantom-generate-sheet-pdf', async (event, { sheetData, sheetName }) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }

    const path = require('path');
    const fs = require('fs').promises;
    
    const desktopPath = findAccessibleDirectory();
    const timestamp = new Date().toISOString().split('T')[0];
    const storeId = phantomSetup.getCurrentStore().id;
    const filename = `${sheetName.replace(/\s+/g, '_')}_${storeId}_${timestamp}.html`;
    const filePath = path.join(desktopPath, filename);
    
    // Create HTML content for the verification sheet
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${sheetName}</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                font-size: 12px;
            }
            .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
            }
            .header h1 { 
                margin: 0; 
                font-size: 18px; 
                color: #333;
            }
            .header p { 
                margin: 5px 0; 
                color: #666;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 20px;
            }
            th, td { 
                border: 1px solid #333; 
                padding: 8px; 
                text-align: left;
            }
            th { 
                background-color: #f5f5f5; 
                font-weight: bold;
                font-size: 11px;
            }
            td { 
                font-size: 10px;
                height: 25px;
            }
            .part-number { width: 20%; }
            .description { width: 45%; }
            .current-stock { width: 15%; text-align: center; }
            .actual-count { width: 20%; background-color: #f9f9f9; }
            .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #ccc;
                font-size: 10px;
                color: #666;
            }
            @media print {
                body { margin: 10px; }
                .header { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${sheetName}</h1>
            <p>Store: ${phantomSetup.getCurrentStore().displayName}</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <p>Items: ${sheetData.items ? sheetData.items.length : 0}</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th class="part-number">Part Number</th>
                    <th class="description">Description</th>
                    <th class="current-stock">Current Stock</th>
                    <th class="actual-count">Actual Count</th>
                </tr>
            </thead>
            <tbody>
                ${sheetData.items ? sheetData.items.map(item => `
                    <tr>
                        <td class="part-number">${item.partNumber || ''}</td>
                        <td class="description">${item.description || ''}</td>
                        <td class="current-stock">${item.currentStock || 0}</td>
                        <td class="actual-count"></td>
                    </tr>
                `).join('') : ''}
            </tbody>
        </table>
        
        <div class="footer">
            <p><strong>Instructions:</strong> Physically count each item and record the actual count in the "Actual Count" column.</p>
            <p><strong>Verified by:</strong> _________________ <strong>Date/Time:</strong> _________________</p>
        </div>
    </body>
    </html>`;

    // Write HTML file instead of PDF (more reliable)
    await fs.writeFile(filePath, htmlContent, 'utf-8');
    
    // Open the HTML file in default browser for printing
    const { shell } = require('electron');
    shell.openPath(filePath);
    
    return { success: true, filePath: filePath };
    
  } catch (error) {
    console.error('Error generating verification sheet PDF:', error);
    return { success: false, error: error.message };
  }
});

// ML Feedback - Process validation results and improve learning
ipcMain.handle('phantom-ml-feedback', async (event, validationResults) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const phantomML = phantomDetector.phantomML;
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    console.log(`Processing ML feedback for ${validationResults.length} validation results`);
    
    let correctPredictions = 0;
    let totalPredictions = validationResults.length;
    
    // Process each validation result
    for (const result of validationResults) {
      // Determine if the ML prediction was correct
      const originalPredictedPhantom = result.riskScore > 70; // Assuming risk score > 70 means predicted phantom
      const actuallyPhantom = result.wasPhantom;
      
      if (originalPredictedPhantom === actuallyPhantom) {
        correctPredictions++;
      }
      
      // Add verification result to ML learning
      phantomML.verificationResults.set(result.partNumber, {
        partNumber: result.partNumber,
        systemStock: result.systemStock,
        actualCount: result.actualCount,
        wasPhantom: result.wasPhantom,
        originalRiskScore: result.riskScore,
        category: result.category,
        unitCost: result.unitCost,
        riskFactors: result.riskFactors,
        verifiedBy: result.verifiedBy,
        verificationDate: result.verificationDate,
        notes: result.notes
      });
    }
    
    // Calculate overall accuracy
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
    const previousAccuracy = phantomML.calculateOverallAccuracy() * 100;
    const learningImprovement = accuracy - previousAccuracy;
    
    // Save updated ML data
    await phantomML.saveMLData();
    
    // NEW: Complete current sheet and move to next if available
    try {
      const sheetCompletion = await verificationWorkflow.completeCurrentSheet(validationResults);
      
      return { 
        success: true, 
        data: {
          accuracy,
          learningImprovement,
          totalVerifications: phantomML.verificationResults.size,
          // NEW: Sheet completion info
          sheetCompletion: sheetCompletion,
          hasNextSheet: sheetCompletion.hasNextSheet,
          nextSheet: sheetCompletion.nextSheet
        }
      };
    } catch (sheetError) {
      // If sheet completion fails, still return success for ML feedback
      console.warn('Sheet completion failed:', sheetError.message);
      
      return { 
        success: true, 
        data: {
          accuracy,
          learningImprovement,
          totalVerifications: phantomML.verificationResults.size
        }
      };
    }
    
  } catch (error) {
    console.error('Error processing ML feedback:', error);
    return { success: false, error: error.message };
  }
});

// NEW: Get verification sheets summary
ipcMain.handle('phantom-get-sheets-summary', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }

    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    const summary = verificationWorkflow.getSheetsSummary();
    return { success: true, data: summary };
  } catch (error) {
    console.error('Error getting sheets summary:', error);
    return { success: false, error: error.message };
  }
});

// NEW: Select a specific verification sheet
ipcMain.handle('phantom-select-sheet', async (event, sheetId) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }

    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    const selectedSheet = await verificationWorkflow.selectSheet(sheetId);
    return { success: true, data: selectedSheet };
  } catch (error) {
    console.error('Error selecting sheet:', error);
    return { success: false, error: error.message };
  }
});

// NEW: Get current verification sheet data
ipcMain.handle('phantom-get-current-sheet', async (event) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }

    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    const currentSheet = verificationWorkflow.getCurrentSheet();
    const summary = verificationWorkflow.getSheetsSummary();
    
    return { 
      success: true, 
      data: {
        currentSheet,
        summary
      }
    };
  } catch (error) {
    console.error('Error getting current sheet:', error);
    return { success: false, error: error.message };
  }
});

// Start verification - UPDATED to fix duplicate handler error
ipcMain.handle('phantom-start-verification-new', async (event, verificationId, assignedTo) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    const result = await verificationWorkflow.startVerification(verificationId, assignedTo);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error starting verification:', error);
    return { success: false, error: error.message };
  }
});

// Complete verification - UPDATED to fix duplicate handler error
ipcMain.handle('phantom-complete-verification-new', async (event, verificationId, results) => {
  try {
    if (!phantomSetup || !phantomSetup.isInitialized) {
      throw new Error('Phantom system not initialized');
    }
    
    const phantomDetector = phantomSetup.getPhantomDetector();
    const verificationWorkflow = phantomDetector.verificationWorkflow;
    
    const result = await verificationWorkflow.completeVerification(verificationId, results);
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Error completing verification:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to ensure network data exists
async function ensureNetworkDataExists() {
  const fs = require('fs').promises;
  const networkDataFile = 'phantom_network_data.json';
  
  try {
    await fs.access(networkDataFile);
    console.log('Network data file exists');
  } catch (error) {
    // File doesn't exist, create it
    console.log('Creating initial network data file...');
    const initialNetworkData = {
      timestamp: new Date().toISOString(),
      totalVerifications: 0,
      networkAccuracy: 0,
      categoryPatterns: {},
      modelWeights: {
        velocityDrop: 0.8,
        stockAmount: 0.3,
        unitCost: 0.5,
        riskScore: 0.9
      },
      verificationPatterns: {},
      commonRiskFactors: {}
    };
    
    try {
      await fs.writeFile(networkDataFile, JSON.stringify(initialNetworkData, null, 2));
      console.log('Successfully created initial network data file');
    } catch (writeError) {
      console.error('Error creating network data file:', writeError);
      throw writeError;
    }
  }
}

// Helper function to get store info
function getStoreInfo(storeId) {
  const storeMap = {
    '16719': { id: '16719', displayName: '16719 - Fairview', location: 'Fairview' },
    '17521': { id: '17521', displayName: '17521 - Eagle', location: 'Eagle' },
    '18179': { id: '18179', displayName: '18179 - Broadway', location: 'Broadway' },
    '18181': { id: '18181', displayName: '18181 - State', location: 'State' }
  };
  
  return storeMap[storeId] || { id: storeId, displayName: `Store ${storeId}`, location: 'Unknown' };
}