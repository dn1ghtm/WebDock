const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const server = require('./server');

let mainWindow;
let tray;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true
        },
        icon: path.join(__dirname, 'public/icons/app-icon.png')
    });

    // Load the index.html file
    mainWindow.loadURL('http://localhost:5000');

    // Create tray icon
    tray = new Tray(path.join(__dirname, 'public/icons/tray-icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open WebDeck',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'Admin Panel',
            click: () => {
                mainWindow.loadURL('http://localhost:5000/admin.html');
                mainWindow.show();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('WebDeck');
    tray.setContextMenu(contextMenu);

    // Minimize to tray when closing window
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle app quitting
app.on('before-quit', () => {
    app.isQuitting = true;
}); 