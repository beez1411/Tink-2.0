const { contextBridge, ipcRenderer } = require('electron')  

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  
  processFile: (options) => ipcRenderer.invoke('process-file', options),
  processAceNetDirect: (data) => ipcRenderer.invoke('process-acenet-direct', data),
  
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  installDependencies: () => ipcRenderer.invoke('install-dependencies'),
  
  onProcessingUpdate: (callback) => {
    ipcRenderer.on('processing-update', (event, data) => {
      callback(data);
    });
  },
  
  onInstallUpdate: (callback) => {
    ipcRenderer.on('install-update', (event, data) => callback(data));
  },
  
  // Update functions
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },
  
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  },
  
  restartApp: () => ipcRenderer.invoke('restart-app'),
  
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  saveToPO: (orderData) => ipcRenderer.invoke('save-to-po', orderData),
  
    exportAceNetResults: (resultsData, checkType) => ipcRenderer.invoke('export-acenet-results', resultsData, checkType),
  
  processPartNumberFile: (filePath) => ipcRenderer.invoke('process-part-number-file', filePath),
  
  // DevTools toggle for input field accessibility
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('processing-update');
    ipcRenderer.removeAllListeners('acenet-progress');
    ipcRenderer.removeAllListeners('acenet-complete');
    ipcRenderer.removeAllListeners('acenet-error');
  },

  // Phantom inventory window opener removed - now integrated into main UI
  
  // Manual phantom initialization
  forceInitializePhantom: () => ipcRenderer.invoke('phantom-force-initialize'),
  
  // Generic invoke function for IPC calls
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // API Configuration functions
  getApiConfigSummary: () => ipcRenderer.invoke('get-api-config-summary'),
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
  updateApiConfig: (configData) => ipcRenderer.invoke('update-api-config', configData),
  testApiConnection: () => ipcRenderer.invoke('test-api-connection'),
  resetApiConfig: () => ipcRenderer.invoke('reset-api-config'),
  getApiInventoryData: (options) => ipcRenderer.invoke('get-api-inventory-data', options),
  refreshApiInventory: () => ipcRenderer.invoke('refresh-api-inventory'),
  setApiEnabled: (enabled) => ipcRenderer.invoke('set-api-enabled', enabled),
  validateApiConfig: (config) => ipcRenderer.invoke('validate-api-config', config),
  
  // API inventory progress listener
  onApiInventoryProgress: (callback) => {
    ipcRenderer.on('api-inventory-progress', (event, data) => callback(data));
  },
  
  removeApiInventoryProgressListener: () => {
    ipcRenderer.removeAllListeners('api-inventory-progress');
  },
  
  // Menu action listeners
  onOpenApiConfiguration: (callback) => {
    ipcRenderer.on('open-api-configuration', callback);
  },
  
  onToggleApiMode: (callback) => {
    ipcRenderer.on('toggle-api-mode', callback);
  },
  
  onRefreshApiData: (callback) => {
    ipcRenderer.on('refresh-api-data', callback);
  },
  
  onTestApiConnection: (callback) => {
    ipcRenderer.on('test-api-connection', callback);
  },
  
  onFixInputFields: (callback) => {
    ipcRenderer.on('fix-input-fields', callback);
  },
  
  // Phantom inventory tools listeners
  onPhantomShowStats: (callback) => {
    ipcRenderer.on('phantom-show-stats', callback);
  },
  
  onPhantomSyncNetwork: (callback) => {
    ipcRenderer.on('phantom-sync-network', callback);
  },
  
  onPhantomExportReports: (callback) => {
    ipcRenderer.on('phantom-export-reports', callback);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic invoke method for IPC calls
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  runPython: (script, params) => ipcRenderer.invoke('run-python', { script, params }),
  saveTempFile: (file) => ipcRenderer.invoke('save-temp-file', file),
  acenetPause: () => ipcRenderer.invoke('acenet-pause'),
  acenetResume: () => ipcRenderer.invoke('acenet-resume'),
  acenetCancel: () => ipcRenderer.invoke('acenet-cancel'),
  onAcenetProgress: (callback) => {
    ipcRenderer.on('acenet-progress', (event, data) => callback(data));
  },
  removeAcenetProgressListener: () => {
    ipcRenderer.removeAllListeners('acenet-progress');
  }
});

// Add export functionality to the existing api object
contextBridge.exposeInMainWorld('exportAPI', {
    exportStockOutPredictions: (data) => ipcRenderer.invoke('export-stock-out-predictions', data)
});