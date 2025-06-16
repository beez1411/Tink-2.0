const { contextBridge, ipcRenderer } = require('electron');

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
    ipcRenderer.on('processing-update', (event, data) => callback(data));
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
  
  restartApp: () => ipcRenderer.invoke('restart-app'),
  
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
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