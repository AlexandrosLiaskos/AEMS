const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App information
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getDataPath: () => ipcRenderer.invoke('get-data-path'),

    // Dialog methods
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

    // System information
    platform: process.platform,
    isElectron: true,

    // Environment info
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
});

// Add desktop-specific styling when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add electron class to body for desktop-specific styling
    document.body.classList.add('electron-app');

    // Add platform-specific class
    document.body.classList.add(`platform-${process.platform}`);

    // Add development mode class if applicable
    if (process.env.NODE_ENV === 'development') {
        document.body.classList.add('development-mode');
    }

    console.log('🖥️  AEMS Desktop UI loaded');
    console.log(`📱 Platform: ${process.platform}`);
    console.log(`⚡ Electron: ${process.versions.electron}`);
});
