const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Set up Electron environment variables before importing other modules
process.env.AEMS_MODE = 'desktop';

// Configure platform-specific data directory using Electron's app.getPath
const setupDataDirectory = () => {
    try {
        // Use Electron's built-in path resolution for cross-platform compatibility
        let baseDir;

        if (process.platform === 'win32') {
            // Windows: Use APPDATA directory (%APPDATA%\AEMS)
            baseDir = path.join(app.getPath('appData'), 'AEMS');
        } else if (process.platform === 'darwin') {
            // macOS: Use Application Support directory (~/Library/Application Support/AEMS)
            baseDir = path.join(app.getPath('appData'), 'AEMS');
        } else {
            // Linux: Use .config directory (~/.config/AEMS)
            baseDir = path.join(app.getPath('home'), '.config', 'AEMS');
        }

        // Set the environment variable for the application to use
        // Note: EnvironmentDetector will add 'aems-data' subdirectory to this path
        process.env.AEMS_DATA_DIR = baseDir;

        // The actual data directory will be baseDir/aems-data
        const actualDataDir = path.join(baseDir, 'aems-data');

        // Ensure the base directory exists
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        console.log(`📁 Electron base directory: ${baseDir}`);
        console.log(`📁 Actual data directory will be: ${actualDataDir}`);
        return baseDir;
    } catch (error) {
        console.error('Failed to setup data directory:', error);
        // Fallback to default behavior
        return null;
    }
};

// Set up data directory before importing the server
setupDataDirectory();

// Import the Express server after environment setup
let server;
let mainWindow;
let serverPort = 3000;

const createWindow = () => {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js') // We'll create this if needed
        },
        icon: path.join(__dirname, 'public', 'icon.png'), // Add icon if available
        show: false // Don't show until ready
    });

    // Load the app - wait for server to be ready
    const loadApp = () => {
        mainWindow.loadURL(`http://localhost:${serverPort}`)
            .then(() => {
                console.log('✅ Electron window loaded successfully');
                mainWindow.show();
            })
            .catch((error) => {
                console.error('Failed to load app in Electron window:', error);
                // Retry after a short delay
                setTimeout(loadApp, 1000);
            });
    };

    // Start loading after a short delay to ensure server is ready
    setTimeout(loadApp, 2000);

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Development tools
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
};

const startExpressServer = () => {
    return new Promise((resolve, reject) => {
        try {
            // Import the server module
            const serverModule = require('./server.js');

            // The server should already be starting due to our modifications
            // Wait a bit for it to be ready
            setTimeout(() => {
                server = serverModule.server;
                console.log('✅ Express server started in Electron');
                resolve();
            }, 2000);

        } catch (error) {
            console.error('Failed to start Express server:', error);
            reject(error);
        }
    });
};

// App event handlers
app.whenReady().then(async () => {
    console.log('🚀 Electron app is ready');

    try {
        // Start the Express server first
        await startExpressServer();

        // Then create the window
        createWindow();

        // Handle app activation (macOS)
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });

    } catch (error) {
        console.error('Failed to initialize Electron app:', error);
        app.quit();
    }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    // On macOS, keep the app running even when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle app quit
app.on('before-quit', () => {
    console.log('🔄 Electron app is quitting...');

    // Close the Express server if it exists
    if (server && server.close) {
        server.close(() => {
            console.log('✅ Express server closed');
        });
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// IPC handlers for communication between main and renderer processes
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-data-directory', () => {
    return process.env.AEMS_DATA_DIR;
});

ipcMain.handle('show-message-box', async (event, options) => {
    const result = await dialog.showMessageBox(mainWindow, options);
    return result;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result;
});

// Export for potential use by other modules
module.exports = { app, mainWindow };
