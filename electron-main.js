const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

// Try to load electron-updater with error handling
let autoUpdater;
try {
    autoUpdater = require('electron-updater').autoUpdater;
} catch (error) {
    console.warn('electron-updater not available:', error.message);
    autoUpdater = null;
}

// Keep global references
let mainWindow;
let tray;
let server;
let serverPort;

// Set data directory for Electron mode
process.env.AEMS_DATA_DIR = app.getPath('userData');
process.env.AEMS_MODE = 'desktop';

// Single instance enforcement
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, focus our window instead
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
}

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false, // Don't show until ready
        icon: getAppIcon(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'electron-preload.js'),
            sandbox: false // Needed for our existing frontend
        },
        titleBarStyle: 'default',
        autoHideMenuBar: true
    });

    // Start Express server on dynamic port
    const expressApp = require('./server');
    server = expressApp.listen(0, 'localhost', () => {
        serverPort = server.address().port;
        console.log(`🖥️  Electron: Express server running on port ${serverPort}`);

        // Load the app
        mainWindow.loadURL(`http://localhost:${serverPort}`);

        // Show window when ready
        mainWindow.once('ready-to-show', () => {
            if (!isDev) {
                // In production, start minimized to tray
                createTray();
                mainWindow.hide();
            } else {
                // In development, show the window
                mainWindow.show();
                if (isDev) {
                    mainWindow.webContents.openDevTools();
                }
            }
        });
    });

    // Handle window events
    setupWindowEvents();
}

function getAppIcon() {
    // Try to load the app icon, fallback to default if not found
    try {
        const iconPath = path.join(__dirname, 'assets', 'icon.png');
        return nativeImage.createFromPath(iconPath);
    } catch (error) {
        console.log('Could not load app icon, using default');
        return null;
    }
}

function setupWindowEvents() {
    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle window minimize - hide to tray instead
    mainWindow.on('minimize', (event) => {
        if (tray && !isDev) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Handle window close - minimize to tray instead of quit
    mainWindow.on('close', (event) => {
        if (!app.isQuiting && tray && !isDev) {
            event.preventDefault();
            mainWindow.hide();

            // Show notification on first minimize
            if (!mainWindow.hasBeenMinimized) {
                tray.displayBalloon({
                    title: 'AEMS',
                    content: 'AEMS is running in the background. Click the tray icon to open.',
                    icon: getAppIcon()
                });
                mainWindow.hasBeenMinimized = true;
            }
        }
    });

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle navigation
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        // Only allow navigation to our local server
        if (parsedUrl.origin !== `http://localhost:${serverPort}`) {
            event.preventDefault();
        }
    });
}

function createTray() {
    try {
        const trayIcon = getAppIcon();
        tray = new Tray(trayIcon || nativeImage.createEmpty());

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Open AEMS',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Check for Updates',
                click: () => {
                    if (!isDev) {
                        autoUpdater.checkForUpdatesAndNotify();
                    } else {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Development Mode',
                            message: 'Auto-updates are disabled in development mode.'
                        });
                    }
                }
            },
            {
                label: 'About',
                click: () => {
                    dialog.showMessageBox(mainWindow, {
                        type: 'info',
                        title: 'About AEMS',
                        message: 'Agentic Email Management System',
                        detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nData: ${app.getPath('userData')}`
                    });
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    app.isQuiting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Agentic Email Management System');
        tray.setContextMenu(contextMenu);

        // Double click to show/hide window
        tray.on('double-click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });

        console.log('🔔 System tray created');
    } catch (error) {
        console.error('Failed to create system tray:', error);
    }
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-data-path', () => {
    return app.getPath('userData');
});

ipcMain.handle('show-message-box', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

// App event handlers
app.whenReady().then(() => {
    createWindow();

    // Set up auto-updater
    if (!isDev) {
        setupAutoUpdater();
    }
});

app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        if (!tray) {
            app.quit();
        }
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', () => {
    app.isQuiting = true;

    // Close Express server
    if (server) {
        server.close();
    }
});

function setupAutoUpdater() {
    // Auto-updater events
    autoUpdater.on('update-available', () => {
        if (tray) {
            tray.displayBalloon({
                title: 'Update Available',
                content: 'A new version is being downloaded...',
                icon: getAppIcon()
            });
        }
    });

    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded successfully',
            detail: 'The application will restart to apply the update.',
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (error) => {
        console.error('Auto-updater error:', error);
    });

    // Check for updates on startup
    autoUpdater.checkForUpdatesAndNotify();

    // Check for updates every 6 hours
    setInterval(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 6 * 60 * 60 * 1000);
}

// Handle certificate errors (for development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (isDev) {
        // In development, ignore certificate errors
        event.preventDefault();
        callback(true);
    } else {
        // In production, use default behavior
        callback(false);
    }
});

console.log(`🖥️  AEMS Desktop starting...`);
console.log(`📁 Data directory: ${app.getPath('userData')}`);
