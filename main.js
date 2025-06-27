const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

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
  
  try {
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
ipcMain.handle('export-acenet-results', async (event, resultsData) => {
  try {
    const ExcelJS = require('exceljs');
    const os = require('os');
    const path = require('path');
    
    // Get current date for filename
    const now = new Date();
    const dateStr = now.getFullYear() + 
                   String(now.getMonth() + 1).padStart(2, '0') + 
                   String(now.getDate()).padStart(2, '0');
    
    // Create filename: AceNet Results YYYYMMDD.xlsx
    const filename = `AceNet Results ${dateStr}.xlsx`;
    
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
    const worksheet = workbook.addWorksheet('AceNet Results');
    
    // Define column mapping and colors to match UI and screenshot
    const columnConfig = [
      { column: 'A', header: 'No Discovery', color: 'FFFD7E14', key: 'No Discovery' },        // Orange
      { column: 'B', header: '', color: null, key: 'spacer' },                               // Spacer
      { column: 'C', header: 'No Asterisk(*)', color: 'FFFF1744', key: 'No Asterisk(*)' }, // Red
      { column: 'D', header: '', color: null, key: 'spacer' },                               // Spacer
      { column: 'E', header: 'Cancelled', color: 'FF6F42C1', key: 'Cancelled' },            // Purple
      { column: 'F', header: '', color: null, key: 'spacer' },                               // Spacer
      { column: 'G', header: 'On Order', color: 'FF28A745', key: 'On Order' },              // Green
      { column: 'H', header: '', color: null, key: 'spacer' },                               // Spacer
      { column: 'I', header: 'No Location', color: 'FF9C27B0', key: 'No Location' },        // Purple
      { column: 'J', header: '', color: null, key: 'spacer' },                               // Spacer
      { column: 'K', header: 'Not in AceNet', color: 'FF2196F3', key: 'Not in AceNet' },    // Blue
      { column: 'L', header: '', color: null, key: 'spacer' },                               // Spacer
      { column: 'M', header: 'Not in RSC', color: 'FF6C757D', key: 'Not in RSC' }           // Gray
    ];
    
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
          const columnLetter = categoryToColumn[category.name];
          
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