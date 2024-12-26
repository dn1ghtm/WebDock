const path = require('path');
const { exec } = require('child_process');
const express = require('express');
const { executeAction } = require('./actions');
const multer = require('multer');
const fs = require('fs').promises;
const os = require('os');

// Remove electron dependency
// const { dialog } = require('electron');

// Function to get local IP addresses
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const interfaceName of Object.keys(interfaces)) {
        for (const interface of interfaces[interfaceName]) {
            // Skip internal and non-IPv4 addresses
            if (interface.family === 'IPv4' && !interface.internal) {
                addresses.push(interface.address);
            }
        }
    }
    
    return addresses;
}

// Get the executable's directory
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const DATA_FILE = path.join(APP_DIR, 'webdeck-data.json');

// Default data structure
const defaultData = {
    groups: []
};

// Initialize data file if it doesn't exist
async function initializeDataFile() {
    try {
        await fs.access(DATA_FILE);
        console.log('Data file exists');
    } catch {
        console.log('Creating new data file...');
        await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
        console.log('Data file created at:', DATA_FILE);
    }
}

// Load or create data file
async function loadData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading data:', error);
        console.log('Creating new data file...');
        await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
}

// Save data to file
async function saveData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('Data saved to:', DATA_FILE);
    } catch (error) {
        console.error('Error saving data:', error);
        throw error;
    }
}

const app = express();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve icons from data file
app.get('/icons/:filename', async (req, res) => {
    try {
        const data = await loadData();
        const icon = data.icons[req.params.filename];
        if (icon) {
            const buffer = Buffer.from(icon.data, 'base64');
            res.writeHead(200, {
                'Content-Type': icon.mimetype,
                'Content-Length': buffer.length
            });
            res.end(buffer);
        } else {
            res.status(404).send('Icon not found');
        }
    } catch (error) {
        res.status(500).send('Error loading icon');
    }
});

app.use(express.json());

// API endpoints
app.post('/api/upload-icon', upload.single('icon'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', error: 'No file uploaded' });
    }
    try {
        const filename = Date.now() + '-' + req.file.originalname;
        const data = await loadData();
        
        data.icons[filename] = {
            data: req.file.buffer.toString('base64'),
            mimetype: req.file.mimetype
        };
        
        await saveData(data);
        
        res.json({ 
            status: 'success', 
            path: '/icons/' + filename 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.get('/api/buttons', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data.groups || []);
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.post('/api/buttons', async (req, res) => {
    try {
        const data = await loadData();
        data.groups = req.body; // Save the entire groups array
        await saveData(data);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.post('/execute', async (req, res) => {
    const { action, params } = req.body;
    try {
        const result = await executeAction(action, params);
        res.json({ status: 'success', result });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// Add a new endpoint for file picking
app.post('/api/pick-file', async (req, res) => {
    try {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Applications', extensions: ['exe', 'app', 'dmg', 'AppImage'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            res.json({ status: 'success', path: result.filePaths[0] });
        } else {
            res.json({ status: 'cancelled' });
        }
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// SVG icons for the minimal set we need
const svgIcons = {
    play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>',
    forward: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4L224 214.3V96c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4s-18.4-16.6-18.4-29V297.7L52.5 440.6z"/></svg>',
    backward: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M459.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4L288 214.3V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4l-192 160C36.2 237.5 32 246.5 32 256s4.2 18.5 11.5 24.6l192 160c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V297.7L459.5 440.6z"/></svg>',
    window: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zM96 96H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>',
    terminal: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M9.4 86.6C-3.1 74.1-3.1 53.9 9.4 41.4s32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L178.7 256 9.4 86.6zM256 416H544c17.7 0 32 14.3 32 32s-14.3 32-32 32H256c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>',
    keyboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M64 112c-8.8 0-16 7.2-16 16V384c0 8.8 7.2 16 16 16H512c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H64zM0 128C0 92.7 28.7 64 64 64H512c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM176 320H400c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16zm-72-72c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H120c-8.8 0-16-7.2-16-16zm128 0c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H248c-8.8 0-16-7.2-16-16s7.2-16 16-16zm144-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H376c-8.8 0-16-7.2-16-16s7.2-16 16-16zm80 16c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H472c-8.8 0-16-7.2-16-16zM96 208c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16zm144-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H240c-8.8 0-16-7.2-16-16s7.2-16 16-16zm112 16c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16s7.2-16 16-16zm144-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H496c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>',
    cog: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>'
};

// CSS Themes
const themes = {
    original: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #1a1a1a; color: #ffffff; font-family: Arial, sans-serif; min-height: 100vh; margin: 0; padding: 10px; }
        /* ... rest of your original CSS ... */
    `,
    
    modern: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #ffffff;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1 {
            text-align: center;
            margin: 20px 0;
            color: #ffffff;
            font-size: clamp(24px, 5vw, 32px);
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, #2a2a2a);
            border: var(--button-border, none);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, white);
            padding: 15px;
            position: relative;
            margin: 0 auto;
        }
        
        .deck-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.2);
            background: linear-gradient(145deg, #333, #3a3a3a);
        }
        
        .deck-button:active {
            transform: translateY(1px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .button-image {
            width: 45%;
            height: 45%;
            object-fit: contain;
            border-radius: 8px;
            margin-bottom: 10px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }
        
        .icon {
            width: 32px;
            height: 32px;
            margin-bottom: 10px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }
        
        .deck-button span {
            font-size: 14px;
            text-align: center;
            word-wrap: break-word;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }
        
        .delete-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255,67,67,0.9);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            display: none;
            transition: all 0.2s ease;
        }
        
        .deck-button:hover .delete-btn {
            display: block;
        }
        
        .delete-btn:hover {
            background: #ff4343;
            transform: scale(1.1);
        }
        
        .add-button {
            background: linear-gradient(145deg, #4CAF50, #45a049);
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .add-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0,0,0,0.2);
        }
        
        .quick-app-btn {
            background: linear-gradient(145deg, #3a3a3a, #333);
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            color: white;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s ease;
            margin: 4px;
        }
        
        .quick-app-btn:hover {
            background: linear-gradient(145deg, #444, #3a3a3a);
            transform: translateY(-1px);
        }
    `,
    
    dark: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            background: #000000;
            color: #ffffff;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1 {
            text-align: center;
            margin: 20px 0;
            color: #00ff00;
            font-size: clamp(24px, 5vw, 32px);
            text-shadow: 0 0 10px rgba(0,255,0,0.5);
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, #2a2a2a);
            border: var(--button-border, none);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, white);
            padding: 15px;
            position: relative;
            margin: 0 auto;
        }
        
        .deck-button:hover {
            background: #222;
            box-shadow: 0 0 20px rgba(0,255,0,0.3);
        }
    `,
    
    light: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            background: #f0f0f0;
            color: #333;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        h1 {
            text-align: center;
            margin: 20px 0;
            color: #333;
            font-size: clamp(24px, 5vw, 32px);
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, #2a2a2a);
            border: var(--button-border, none);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, white);
            padding: 15px;
            position: relative;
            margin: 0 auto;
        }
        
        .deck-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
    `,
    
    retro: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            background: #2b0053;
            color: #fff;
            font-family: 'Courier New', monospace;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            text-shadow: 2px 2px #ff00ff;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            border: 2px solid #ff00ff;
            border-radius: 0;
            box-shadow: 5px 5px 0 #ff00ff;
        }
        
        h1 {
            text-align: center;
            margin: 20px 0;
            color: #00ffff;
            font-size: clamp(24px, 5vw, 32px);
            text-transform: uppercase;
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, #2b0053);
            border: var(--button-border, none);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, #fff);
            padding: 15px;
            position: relative;
            text-transform: uppercase;
            font-weight: bold;
            margin: 0 auto;
        }
        
        .deck-button:hover {
            background: #000099;
            border-color: #00ffff;
            color: #ff00ff;
        }
    `,
    
    neon: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            background: #0f0f0f;
            color: #fff;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        @keyframes neonPulse {
            0% { text-shadow: 0 0 7px #fff, 0 0 10px #fff, 0 0 21px #fff, 0 0 42px #0fa, 0 0 82px #0fa, 0 0 92px #0fa, 0 0 102px #0fa, 0 0 151px #0fa; }
            100% { text-shadow: 0 0 4px #fff, 0 0 7px #fff, 0 0 18px #fff, 0 0 38px #0fa, 0 0 73px #0fa, 0 0 80px #0fa, 0 0 94px #0fa, 0 0 140px #0fa; }
        }

        h1 {
            text-align: center;
            margin: 20px 0;
            color: #fff;
            font-size: clamp(24px, 5vw, 32px);
            animation: neonPulse 1.5s infinite alternate;
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, #0f0f0f);
            border: var(--button-border, none);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, #fff);
            padding: 15px;
            position: relative;
            box-shadow: 0 0 10px rgba(0,255,170,0.3);
            margin: 0 auto;
        }
        
        .deck-button:hover {
            background: #222;
            box-shadow: 0 0 20px rgba(0,255,170,0.5), inset 0 0 10px rgba(0,255,170,0.3);
            transform: translateY(-2px);
        }
    `,
    
    cyberpunk: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes glitch {
            0% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(-2px, -2px); }
            60% { transform: translate(2px, 2px); }
            80% { transform: translate(2px, -2px); }
            100% { transform: translate(0); }
        }
        
        body { 
            background: linear-gradient(45deg, #120458 0%, #000000 100%);
            color: #fff;
            font-family: 'Segoe UI', Arial, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        h1 {
            text-align: center;
            margin: 20px 0;
            color: #ff2a6d;
            font-size: clamp(24px, 5vw, 32px);
            text-transform: uppercase;
            position: relative;
        }
        
        h1:hover {
            animation: glitch 0.3s infinite;
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, rgba(18,4,88,0.8));
            border: var(--button-border, 2px solid #05d9e8);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, #05d9e8);
            padding: 15px;
            position: relative;
            overflow: hidden;
            margin: 0 auto;
        }
        
        .deck-button::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(
                45deg,
                transparent,
                transparent 40%,
                rgba(5,217,232,0.1) 40%,
                rgba(5,217,232,0.1) 60%,
                transparent 60%
            );
            transform: rotate(45deg);
            transition: all 0.3s ease;
        }
        
        .deck-button:hover::before {
            animation: shine 1.5s infinite;
        }
        
        @keyframes shine {
            0% { transform: rotate(45deg) translateY(-100%); }
            100% { transform: rotate(45deg) translateY(100%); }
        }
    `,
    
    minimal: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            background: #ffffff;
            color: #333;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1 {
            text-align: center;
            margin: 20px 0;
            color: #333;
            font-size: clamp(24px, 5vw, 32px);
            font-weight: 300;
        }
        
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 20px;
            padding: 20px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: #ffffff;
            border: 1px solid #eee;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.2s ease;
            color: #333;
            padding: 15px;
            position: relative;
            margin: 0 auto;
        }
        
        .deck-button:hover {
            border-color: #333;
            transform: translateY(-1px);
        }
        
        .deck-button:active {
            transform: translateY(0);
        }
    `
};

// Update theme switcher with new themes
const themeSwitcher = `
    <div class="theme-switcher" style="text-align: center; margin-bottom: 20px;">
        <button onclick="switchTheme('original')" class="theme-btn">Original</button>
        <button onclick="switchTheme('modern')" class="theme-btn">Modern</button>
        <button onclick="switchTheme('dark')" class="theme-btn">Matrix</button>
        <button onclick="switchTheme('light')" class="theme-btn">Light</button>
        <button onclick="switchTheme('retro')" class="theme-btn">Retro</button>
        <button onclick="switchTheme('neon')" class="theme-btn">Neon</button>
        <button onclick="switchTheme('cyberpunk')" class="theme-btn">Cyberpunk</button>
        <button onclick="switchTheme('minimal')" class="theme-btn">Minimal</button>
    </div>
`;

// Add theme button styles
const themeButtonStyles = `
    .theme-btn {
        background: #444;
        color: white;
        border: none;
        padding: 8px 16px;
        margin: 0 5px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .theme-btn:hover {
        background: #555;
        transform: translateY(-2px);
    }
`;

// Add theme switching functionality
const themeScript = `
    function switchTheme(theme) {
        const styleElement = document.getElementById('theme-style');
        styleElement.textContent = themes[theme];
        localStorage.setItem('preferred-theme', theme);
    }

    // Load preferred theme
    window.addEventListener('DOMContentLoaded', () => {
        const preferredTheme = localStorage.getItem('preferred-theme') || 'modern';
        switchTheme(preferredTheme);
    });
`;

// User Panel JavaScript
const userJS = `
// SVG icons definition
const svgIcons = {
    play: '${svgIcons.play}',
    forward: '${svgIcons.forward}',
    backward: '${svgIcons.backward}',
    window: '${svgIcons.window}',
    terminal: '${svgIcons.terminal}',
    keyboard: '${svgIcons.keyboard}',
    cog: '${svgIcons.cog}',
    home: '${svgIcons.home}'
};

// Action icons mapping
const actionIcons = {
    'media': {
        'play_pause': 'play',
        'next': 'forward',
        'previous': 'backward'
    },
    'application': 'window',
    'command': 'terminal',
    'keystroke': 'keyboard'
};

let buttons = [];
let wakeLockObj = null;
let noSleepVideo = null;

// Combined approach to prevent screen dimming
async function preventSleep() {
    try {
        // Method 1: Wake Lock API
        if ('wakeLock' in navigator) {
            wakeLockObj = await navigator.wakeLock.request('screen');
            console.log('Wake Lock is active');
        }

        // Method 2: Video loop method
        if (!noSleepVideo) {
            noSleepVideo = document.createElement('video');
            noSleepVideo.setAttribute('playsinline', '');
            noSleepVideo.setAttribute('muted', '');
            noSleepVideo.setAttribute('loop', '');
            noSleepVideo.setAttribute('autoplay', '');
            noSleepVideo.style.width = '1px';
            noSleepVideo.style.height = '1px';
            noSleepVideo.style.position = 'absolute';
            noSleepVideo.style.opacity = '0.01';
            
            // Create a minimal video source
            const source = document.createElement('source');
            source.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA7RtZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1NSByMjkwMSA3ZDBmZjIyIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxOCAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA3//728P4FNjuZQQAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACGHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAAAAAEAAAAAAZBtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAEAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE7bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA+3N0YmwAAACXc3RzZAAAAAAAAAABAAAAh2F2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAgACAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAxYXZjQwFkAAr/4QAYZ2QACqzZX4iIhAAAAwAEAAADAFA8SJZYAQAGaOvjyyLAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAQAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAsUAAAABAAAAFHN0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU4LjI5LjEwMA==';
            source.type = 'video/mp4';
            noSleepVideo.appendChild(source);
            
            document.body.appendChild(noSleepVideo);
            noSleepVideo.play().catch(e => console.log('Video play error:', e));
        }

        // Method 3: Periodic interaction simulation
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                document.body.style.opacity = '0.99999999';
                setTimeout(() => {
                    document.body.style.opacity = '1';
                }, 1000);
            }
        }, 30000);

    } catch (err) {
        console.error('Sleep prevention setup failed:', err);
    }
}

// Handle visibility changes
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        await preventSleep();
        if (noSleepVideo) {
            noSleepVideo.play().catch(e => console.log('Video play error:', e));
        }
    }
});

function getIconForButton(button) {
    if (button.action === 'media') {
        return svgIcons[actionIcons.media[button.params.action]] || svgIcons.play;
    }
    return svgIcons[actionIcons[button.action]] || svgIcons.cog;
}

async function loadButtons() {
    try {
        const response = await fetch('/api/buttons');
        const newButtons = await response.json();
        if (JSON.stringify(buttons) !== JSON.stringify(newButtons)) {
            buttons = newButtons;
            renderButtons();
        }
    } catch (error) {
        console.error('Error loading buttons:', error);
    }
}

function renderButtons() {
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = '';
    
    if (!buttons || buttons.length === 0) {
        grid.innerHTML = \`
            <div class="empty-state">
                <div class="empty-message">
                    <svg class="empty-icon" viewBox="0 0 24 24" width="48" height="48">
                        <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                    <h2>No Buttons Configured</h2>
                    <p>Visit the admin panel to add buttons</p>
                    <a href="/admin" class="admin-link-button">Open Admin Panel</a>
                </div>
            </div>
        \`;
        return;
    }
    
    buttons.forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.className = 'button-group';
        
        const groupButton = document.createElement('button');
        groupButton.className = 'deck-button group-button';
        
        // Function to update group button appearance
        const updateGroupButton = (isOpen) => {
            groupButton.innerHTML = \`
                <div class="icon">\${isOpen ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"/></svg>' : 
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 0v64h64V96H64zm384 0H192v64H448V96zM64 224v64h64V224H64zm384 0H192v64H448V224zM64 352v64h64V352H64zm384 0H192v64H448V352z"/></svg>'
                }</div>
                <span>\${isOpen ? 'Close' : group.name}</span>
            \`;
        };

        // Initial button state
        updateGroupButton(false);

        let nestedButtons = null;
        let isOpen = false;
        
        groupButton.onclick = () => {
            isOpen = !isOpen;
            updateGroupButton(isOpen);

            // If nested buttons are already shown, hide them
            if (nestedButtons) {
                nestedButtons.remove();
                nestedButtons = null;
                return;
            }
            
            // Remove any other open nested buttons and reset other group buttons
            const existingNested = document.querySelectorAll('.nested-buttons');
            existingNested.forEach(el => el.remove());
            document.querySelectorAll('.group-button').forEach(btn => {
                if (btn !== groupButton) {
                    btn.innerHTML = \`
                        <div class="icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zm64 0v64h64V96H64zm384 0H192v64H448V96zM64 224v64h64V224H64zm384 0H192v64H448V224zM64 352v64h64V352H64zm384 0H192v64H448V352z"/></svg></div>
                        <span>\${group.name}</span>
                    \`;
                }
            });
            
            // Create and show nested buttons
            nestedButtons = document.createElement('div');
            nestedButtons.className = 'nested-buttons';
            
            group.buttons.forEach(button => {
                const buttonElement = document.createElement('button');
                buttonElement.className = 'deck-button nested-button';
                buttonElement.innerHTML = \`
                    <div class="icon">\${getIconForButton(button)}</div>
                    <span>\${button.name}</span>
                \`;
                buttonElement.onclick = (e) => {
                    e.stopPropagation(); // Prevent triggering parent button
                    executeAction(button.action, button.params);
                };
                nestedButtons.appendChild(buttonElement);
            });
            
            groupElement.appendChild(nestedButtons);
        };

        groupElement.appendChild(groupButton);
        grid.appendChild(groupElement);
    });
}

async function executeAction(action, params) {
    try {
        const response = await fetch('/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, params })
        });
        
        const result = await response.json();
        if (result.status === 'error') {
            console.error('Error:', result.error);
        }
    } catch (error) {
        console.error('Error executing action:', error);
    }
}

// Initialize everything when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    await preventSleep();
    loadButtons();
});

// Refresh every second
setInterval(loadButtons, 1000);
`;

// Add a function to find common application paths
function getCommonAppPaths() {
    const platform = os.platform();
    const paths = {
        chrome: {
            win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            darwin: '/Applications/Google Chrome.app',
            linux: '/usr/bin/google-chrome'
        },
        firefox: {
            win32: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
            darwin: '/Applications/Firefox.app',
            linux: '/usr/bin/firefox'
        },
        notepad: {
            win32: 'C:\\Windows\\System32\\notepad.exe',
            darwin: '/System/Applications/TextEdit.app',
            linux: '/usr/bin/gedit'
        },
        calculator: {
            win32: 'calc.exe',
            darwin: '/System/Applications/Calculator.app',
            linux: '/usr/bin/gnome-calculator'
        },
        spotify: {
            win32: 'C:\\Users\\%USERNAME%\\AppData\\Roaming\\Spotify\\Spotify.exe',
            darwin: '/Applications/Spotify.app',
            linux: '/usr/bin/spotify'
        },
        vscode: {
            win32: 'C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe',
            darwin: '/Applications/Visual Studio Code.app',
            linux: '/usr/bin/code'
        }
    };

    // Replace %USERNAME% with actual username on Windows
    if (platform === 'win32') {
        const username = os.userInfo().username;
        Object.keys(paths).forEach(app => {
            if (paths[app].win32.includes('%USERNAME%')) {
                paths[app].win32 = paths[app].win32.replace('%USERNAME%', username);
            }
        });
    }

    return paths;
}

// Add endpoint to get application paths
app.get('/api/app-paths', (req, res) => {
    const paths = getCommonAppPaths();
    res.json({
        platform: os.platform(),
        paths: paths
    });
});

// Admin Panel JavaScript
const adminJS = `
let buttons = [];
let appPaths = {};
let currentPlatform = '';

// SVG icons definition
const svgIcons = {
    play: '${svgIcons.play}',
    forward: '${svgIcons.forward}',
    backward: '${svgIcons.backward}',
    window: '${svgIcons.window}',
    terminal: '${svgIcons.terminal}',
    keyboard: '${svgIcons.keyboard}',
    cog: '${svgIcons.cog}'
};

const actionIcons = {
    'media': {
        'play_pause': 'play',
        'next': 'forward',
        'previous': 'backward'
    },
    'application': 'window',
    'command': 'terminal',
    'keystroke': 'keyboard'
};

async function loadAppPaths() {
    try {
        const response = await fetch('/api/app-paths');
        const data = await response.json();
        appPaths = data.paths;
        currentPlatform = data.platform;
    } catch (error) {
        console.error('Error loading app paths:', error);
    }
}

async function loadButtons() {
    try {
        const response = await fetch('/api/buttons');
        const newButtons = await response.json();
        if (JSON.stringify(buttons) !== JSON.stringify(newButtons)) {
            buttons = newButtons;
            renderButtons(false);
        }
    } catch (error) {
        console.error('Error loading buttons:', error);
    }
}

function getIconForButton(button) {
    if (button.action === 'media') {
        return svgIcons[actionIcons.media[button.params.action]] || svgIcons.play;
    }
    return svgIcons[actionIcons[button.action]] || svgIcons.cog;
}

async function saveButtons() {
    try {
        await fetch('/api/buttons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buttons)
        });
    } catch (error) {
        console.error('Error saving buttons:', error);
    }
}

function renderButtons(shouldSave = true) {
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = '';
    
    if (!buttons || buttons.length === 0) {
        grid.innerHTML = \`
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <p style="opacity: 0.7; margin-bottom: 20px;">No buttons yet. Click "Add Button" to get started!</p>
            </div>
        \`;
        return;
    }

    buttons.forEach((item, index) => {
        if (item.buttons) {
            // This is a group
            const groupElement = document.createElement('div');
            groupElement.className = 'button-group';
            groupElement.style.gridColumn = '1/-1';
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            groupHeader.innerHTML = \`
                <input type="text" class="group-name" value="\${item.name}" placeholder="Group Name">
                <button class="delete-group-btn" onclick="deleteGroup(\${index})">×</button>
            \`;
            
            groupHeader.querySelector('.group-name').onchange = (e) => {
                item.name = e.target.value;
                saveButtons();
            };
            
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'button-grid';
            buttonsContainer.style.marginTop = '15px';
            
            item.buttons.forEach((button, buttonIndex) => {
                const buttonElement = createButtonElement(button, index, buttonIndex);
                buttonsContainer.appendChild(buttonElement);
            });
            
            const addButton = document.createElement('button');
            addButton.className = 'action-btn';
            addButton.style.width = '100%';
            addButton.style.marginTop = '10px';
            addButton.innerHTML = \`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 4C11.4477 4 11 4.44772 11 5V11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13V5C13 4.44772 12.5523 4 12 4Z"/>
                </svg>
                Add Button to Group
            \`;
            addButton.onclick = () => addNewButton(index);
            
            groupElement.appendChild(groupHeader);
            groupElement.appendChild(buttonsContainer);
            groupElement.appendChild(addButton);
            grid.appendChild(groupElement);
        } else {
            // This is a single button
            const buttonElement = createButtonElement(item, 'root', index);
            grid.appendChild(buttonElement);
        }
    });

    if (shouldSave) {
        saveButtons();
    }
}

function createButtonElement(button, groupIndex, buttonIndex) {
    const buttonElement = document.createElement('div');
    buttonElement.className = 'deck-button';
    buttonElement.innerHTML = \`
        <div class="icon">\${getIconForButton(button)}</div>
        <input type="text" class="button-name" value="\${button.name}" placeholder="Button Name">
        <button class="delete-btn" onclick="deleteButton('\${groupIndex}', \${buttonIndex})">×</button>
        <button class="edit-btn" onclick="editButton('\${groupIndex}', \${buttonIndex})">✎</button>
    \`;
    
    buttonElement.querySelector('.button-name').onchange = (e) => {
        if (groupIndex === 'root') {
            buttons[buttonIndex].name = e.target.value;
        } else {
            buttons[groupIndex].buttons[buttonIndex].name = e.target.value;
        }
        saveButtons();
    };
    
    return buttonElement;
}

function deleteButton(groupIndex, buttonIndex) {
    if (confirm('Are you sure you want to delete this button?')) {
        if (groupIndex === 'root') {
            buttons.splice(buttonIndex, 1);
        } else {
            buttons[groupIndex].buttons.splice(buttonIndex, 1);
            // Remove group if empty
            if (buttons[groupIndex].buttons.length === 0) {
                buttons.splice(groupIndex, 1);
            }
        }
        renderButtons();
    }
}

function deleteGroup(groupIndex) {
    if (confirm('Are you sure you want to delete this group and all its buttons?')) {
        buttons.splice(groupIndex, 1);
        renderButtons();
    }
}

function addNewGroup() {
    buttons.push({
        name: 'New Group',
        buttons: []
    });
    renderButtons();
}

function addNewButton(groupIndex = null) {
    showButtonModal((button) => {
        if (groupIndex !== null) {
            buttons[groupIndex].buttons.push(button);
        } else {
            buttons.push(button);
        }
        renderButtons();
    });
}

function editButton(groupIndex, buttonIndex) {
    const button = groupIndex === 'root' ? buttons[buttonIndex] : buttons[groupIndex].buttons[buttonIndex];
    showButtonModal((updatedButton) => {
        if (groupIndex === 'root') {
            buttons[buttonIndex] = updatedButton;
        } else {
            buttons[groupIndex].buttons[buttonIndex] = updatedButton;
        }
        renderButtons();
    }, button);
}

function showButtonModal(onSave, existingButton = null) {
    const modalHTML = \`
        <div class="modal">
            <div class="modal-content">
                <h2 style="margin-bottom: 20px;">\${existingButton ? 'Edit Button' : 'Add New Button'}</h2>
                <form id="buttonForm">
                    <div class="form-group">
                        <label for="buttonName">Button Name:</label>
                        <input type="text" id="buttonName" value="\${existingButton ? existingButton.name : ''}" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Action Type:</label>
                        <select id="actionType">
                            <option value="command" \${existingButton && existingButton.action === 'command' ? 'selected' : ''}>Run Command</option>
                            <option value="media" \${existingButton && existingButton.action === 'media' ? 'selected' : ''}>Media Control</option>
                            <option value="application" \${existingButton && existingButton.action === 'application' ? 'selected' : ''}>Open Application</option>
                            <option value="keystroke" \${existingButton && existingButton.action === 'keystroke' ? 'selected' : ''}>Send Keystroke</option>
                        </select>
                    </div>

                    <div id="commandDiv" class="form-group" style="display:\${!existingButton || existingButton.action === 'command' ? 'block' : 'none'};">
                        <label for="command">Command:</label>
                        <input type="text" id="command" value="\${existingButton && existingButton.action === 'command' ? existingButton.params.command : ''}">
                    </div>

                    <div id="mediaDiv" class="form-group" style="display:\${existingButton && existingButton.action === 'media' ? 'block' : 'none'};">
                        <label for="mediaAction">Media Action:</label>
                        <select id="mediaAction">
                            <option value="play_pause" \${existingButton && existingButton.params.action === 'play_pause' ? 'selected' : ''}>Play/Pause</option>
                            <option value="next" \${existingButton && existingButton.params.action === 'next' ? 'selected' : ''}>Next Track</option>
                            <option value="previous" \${existingButton && existingButton.params.action === 'previous' ? 'selected' : ''}>Previous Track</option>
                        </select>
                    </div>

                    <div id="applicationDiv" class="form-group" style="display:\${existingButton && existingButton.action === 'application' ? 'block' : 'none'};">
                        <label for="appPath">Application Path:</label>
                        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                            <input type="text" id="appPath" style="flex-grow: 1;" value="\${existingButton && existingButton.action === 'application' ? existingButton.params.path : ''}" placeholder="Enter application path">
                        </div>
                        <div class="quick-apps">
                            <button type="button" onclick="setAppPath('chrome')" class="quick-app-btn">Chrome</button>
                            <button type="button" onclick="setAppPath('firefox')" class="quick-app-btn">Firefox</button>
                            <button type="button" onclick="setAppPath('notepad')" class="quick-app-btn">Notepad</button>
                            <button type="button" onclick="setAppPath('calculator')" class="quick-app-btn">Calculator</button>
                            <button type="button" onclick="setAppPath('spotify')" class="quick-app-btn">Spotify</button>
                            <button type="button" onclick="setAppPath('vscode')" class="quick-app-btn">VS Code</button>
                        </div>
                    </div>

                    <div id="keystrokeDiv" class="form-group" style="display:\${existingButton && existingButton.action === 'keystroke' ? 'block' : 'none'};">
                        <label for="keystroke">Select Keystroke:</label>
                        <select id="keystroke">
                            <option value="MEDIA_PLAY_PAUSE" \${existingButton && existingButton.params.key === 'MEDIA_PLAY_PAUSE' ? 'selected' : ''}>Play/Pause</option>
                            <option value="MEDIA_NEXT_TRACK" \${existingButton && existingButton.params.key === 'MEDIA_NEXT_TRACK' ? 'selected' : ''}>Next Track</option>
                            <option value="MEDIA_PREV_TRACK" \${existingButton && existingButton.params.key === 'MEDIA_PREV_TRACK' ? 'selected' : ''}>Previous Track</option>
                            <option value="VOLUME_UP" \${existingButton && existingButton.params.key === 'VOLUME_UP' ? 'selected' : ''}>Volume Up</option>
                            <option value="VOLUME_DOWN" \${existingButton && existingButton.params.key === 'VOLUME_DOWN' ? 'selected' : ''}>Volume Down</option>
                            <option value="VOLUME_MUTE" \${existingButton && existingButton.params.key === 'VOLUME_MUTE' ? 'selected' : ''}>Mute</option>
                        </select>
                    </div>

                    <div class="button-group">
                        <button type="submit">\${existingButton ? 'Save Changes' : 'Add Button'}</button>
                        <button type="button" onclick="closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    \`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const actionType = document.getElementById('actionType');
    const form = document.getElementById('buttonForm');

    actionType.addEventListener('change', () => {
        document.getElementById('commandDiv').style.display = 
            actionType.value === 'command' ? 'block' : 'none';
        document.getElementById('mediaDiv').style.display = 
            actionType.value === 'media' ? 'block' : 'none';
        document.getElementById('applicationDiv').style.display = 
            actionType.value === 'application' ? 'block' : 'none';
        document.getElementById('keystrokeDiv').style.display = 
            actionType.value === 'keystroke' ? 'block' : 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('buttonName').value;
        const action = actionType.value;
        let params = {};

        switch (action) {
            case 'command':
                params.command = document.getElementById('command').value;
                break;
            case 'media':
                params.action = document.getElementById('mediaAction').value;
                break;
            case 'application':
                params.path = document.getElementById('appPath').value;
                break;
            case 'keystroke':
                params.key = document.getElementById('keystroke').value;
                break;
        }

        onSave({ name, action, params });
        closeModal();
    });
}

function closeModal() {
    const modal = document.getElementById('buttonModal');
    if (modal) {
        modal.remove();
    }
}

function setAppPath(app) {
    const appPath = document.getElementById('appPath');
    if (appPaths[app] && appPaths[app][currentPlatform]) {
        appPath.value = appPaths[app][currentPlatform];
    }
}

// Initialize everything when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    await loadAppPaths();
    loadButtons();
});

// Refresh every second
setInterval(loadButtons, 1000);
`;

// Add theme management endpoint
app.post('/api/theme', async (req, res) => {
    try {
        const data = await loadData();
        data.currentTheme = req.body.theme;
        await saveData(data);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.get('/api/theme', async (req, res) => {
    try {
        const data = await loadData();
        res.json({ theme: data.currentTheme || 'modern' });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// Update the admin page to include theme management
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WebDeck - Admin Panel</title>
            <style id="theme-style"></style>
            <style>
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }

                h1 {
                    text-align: center;
                    margin-bottom: 30px;
                    color: #fff;
                }

                .theme-switcher {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-bottom: 40px;
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    border-radius: 10px;
                }

                .theme-btn {
                    background: rgba(255,255,255,0.1);
                    color: inherit;
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 8px 16px;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .theme-btn:hover {
                    background: rgba(255,255,255,0.2);
                    transform: translateY(-2px);
                }

                .actions-bar {
                    display: flex;
                    justify-content: center;
                    gap: 10px;
                    margin-bottom: 30px;
                }

                .action-btn {
                    background: rgba(76,175,80,0.2);
                    color: inherit;
                    border: 1px solid rgba(76,175,80,0.3);
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .action-btn:hover {
                    background: rgba(76,175,80,0.3);
                    transform: translateY(-2px);
                }

                .action-btn svg {
                    width: 20px;
                    height: 20px;
                }

                .button-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .deck-button {
                    position: relative;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    padding: 15px;
                    aspect-ratio: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .deck-button:hover {
                    background: rgba(255,255,255,0.15);
                    transform: translateY(-2px);
                }

                .deck-button .icon {
                    width: 32px;
                    height: 32px;
                    margin-bottom: 10px;
                    opacity: 0.8;
                }

                .button-name {
                    width: 100%;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: inherit;
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 14px;
                    margin-top: 10px;
                    text-align: center;
                }

                .delete-btn, .edit-btn {
                    position: absolute;
                    top: 8px;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                    display: none;
                    transition: all 0.2s ease;
                    font-size: 14px;
                }

                .delete-btn {
                    right: 8px;
                    background: rgba(255,67,67,0.2);
                    color: #ff4343;
                }

                .edit-btn {
                    right: 40px;
                    background: rgba(255,255,255,0.2);
                    color: inherit;
                }

                .deck-button:hover .delete-btn,
                .deck-button:hover .edit-btn {
                    display: block;
                }

                .delete-btn:hover,
                .edit-btn:hover {
                    transform: scale(1.1);
                }

                .user-link {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(255,255,255,0.1);
                    color: inherit;
                    text-decoration: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                    border: 1px solid rgba(255,255,255,0.2);
                }

                .user-link:hover {
                    background: rgba(255,255,255,0.2);
                    transform: translateY(-2px);
                }

                @media (max-width: 768px) {
                    .button-grid {
                        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    }
                }

                @media (max-width: 480px) {
                    .button-grid {
                        grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                    }
                }
            </style>
            <script>
                const themes = ${JSON.stringify(themes)};
                
                async function switchTheme(theme) {
                    const styleElement = document.getElementById('theme-style');
                    styleElement.textContent = themes[theme];
                    
                    try {
                        await fetch('/api/theme', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ theme })
                        });
                    } catch (error) {
                        console.error('Error saving theme:', error);
                    }
                }

                async function loadTheme() {
                    try {
                        const response = await fetch('/api/theme');
                        const data = await response.json();
                        switchTheme(data.theme || 'modern');
                    } catch (error) {
                        console.error('Error loading theme:', error);
                        switchTheme('modern');
                    }
                }
            </script>
        </head>
        <body>
            <div class="container">
                <h1>WebDeck Admin Panel</h1>
                ${themeSwitcher}
                <div class="actions-bar">
                    <button class="action-btn" onclick="addNewButton()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4C11.4477 4 11 4.44772 11 5V11H5C4.44772 11 4 11.4477 4 12C4 12.5523 4.44772 13 5 13H11V19C11 19.5523 11.4477 20 12 20C12.5523 20 13 19.5523 13 19V13H19C19.5523 13 20 12.5523 20 12C20 11.4477 19.5523 11 19 11H13V5C13 4.44772 12.5523 4 12 4Z"/>
                        </svg>
                        Add Button
                    </button>
                    <button class="action-btn" onclick="addNewGroup()">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2 4C2 3.44772 2.44772 3 3 3H10C10.5523 3 11 3.44772 11 4V11C11 11.5523 10.5523 12 10 12H3C2.44772 12 2 11.5523 2 11V4ZM13 4C13 3.44772 13.4477 3 14 3H21C21.5523 3 22 3.44772 22 4V11C22 11.5523 21.5523 12 21 12H14C13.4477 12 13 11.5523 13 11V4ZM2 15C2 14.4477 2.44772 14 3 14H10C10.5523 14 11 14.4477 11 15V22C11 22.5523 10.5523 23 10 23H3C2.44772 23 2 22.5523 2 22V15ZM13 15C13 14.4477 13.4477 14 14 14H21C21.5523 14 22 14.4477 22 15V22C22 22.5523 21.5523 23 21 23H14C13.4477 23 13 22.5523 13 22V15Z"/>
                        </svg>
                        Create Group
                    </button>
                </div>
                <div class="button-grid" id="buttonGrid"></div>
            </div>
            <a href="/" class="user-link">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                User Panel
            </a>
            <script>${adminJS}</script>
            <script>loadTheme();</script>
        </body>
        </html>
    `);
});

// Update the user page HTML
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WebDeck</title>
            <style id="theme-style"></style>
            <style>
                .empty-state {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 400px;
                    width: 100%;
                }
                
                .empty-message {
                    text-align: center;
                    padding: 40px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 12px;
                    backdrop-filter: blur(10px);
                    max-width: 400px;
                    margin: 0 auto;
                }
                
                .empty-message h2 {
                    margin: 20px 0 10px;
                    font-size: 24px;
                }
                
                .empty-message p {
                    margin-bottom: 25px;
                    opacity: 0.8;
                }
                
                .empty-icon {
                    opacity: 0.7;
                    margin-bottom: 10px;
                }
                
                .admin-link-button {
                    display: inline-block;
                    padding: 12px 24px;
                    background: rgba(255,255,255,0.2);
                    color: inherit;
                    text-decoration: none;
                    border-radius: 6px;
                    transition: all 0.3s ease;
                }
                
                .admin-link-button:hover {
                    background: rgba(255,255,255,0.3);
                    transform: translateY(-2px);
                }
            </style>
            <script>
                const themes = ${JSON.stringify(themes)};
                let lastButtonCount = 0;
                
                async function loadTheme() {
                    try {
                        const response = await fetch('/api/theme');
                        const data = await response.json();
                        document.getElementById('theme-style').textContent = themes[data.theme || 'modern'];
                    } catch (error) {
                        console.error('Error loading theme:', error);
                        document.getElementById('theme-style').textContent = themes.modern;
                    }
                }

                async function loadButtons() {
                    try {
                        const response = await fetch('/api/buttons');
                        const buttons = await response.json();
                        const grid = document.getElementById('buttonGrid');
                        
                        // Only update if the number of buttons has changed
                        if (buttons.length !== lastButtonCount) {
                            lastButtonCount = buttons.length;
                            
                            if (!buttons || buttons.length === 0) {
                                grid.innerHTML = \`
                                    <div class="empty-state">
                                        <div class="empty-message">
                                            <svg class="empty-icon" viewBox="0 0 24 24" width="48" height="48">
                                                <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                            </svg>
                                            <h2>No Buttons Configured</h2>
                                            <p>Visit the admin panel to add buttons</p>
                                            <a href="/admin" class="admin-link-button">Open Admin Panel</a>
                                        </div>
                                    </div>
                                \`;
                            } else {
                                // Your existing button rendering code
                                ${userJS}
                                renderButtons();
                            }
                        }
                    } catch (error) {
                        console.error('Error loading buttons:', error);
                    }
                }

                // Initial load
                loadTheme();
                loadButtons();

                // Check for theme changes every 5 seconds
                setInterval(loadTheme, 5000);

                // Check for button changes every 2 seconds
                setInterval(loadButtons, 2000);
            </script>
        </head>
        <body>
            <div class="container">
                <h1>WebDeck</h1>
                <div id="buttonGrid"></div>
            </div>
        </body>
        </html>
    `);
});

// Add empty state styles to all themes
Object.keys(themes).forEach(theme => {
    themes[theme] += `
        .empty-state {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
            width: 100%;
        }
        
        .empty-message {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
            max-width: 400px;
            margin: 0 auto;
        }
        
        .empty-message h2 {
            margin: 20px 0 10px;
            font-size: 24px;
        }
        
        .empty-message p {
            margin-bottom: 25px;
            opacity: 0.8;
        }
        
        .empty-icon {
            opacity: 0.7;
            margin-bottom: 10px;
        }
        
        .admin-link-button {
            display: inline-block;
            padding: 12px 24px;
            background: rgba(255,255,255,0.2);
            color: inherit;
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.3s ease;
        }
        
        .admin-link-button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
    `;
});

// Update the modal styles in each theme
Object.keys(themes).forEach(theme => {
    themes[theme] += `
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }
        
        .modal-content {
            background: var(--modal-bg, #2a2a2a);
            color: var(--modal-text, #fff);
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            border: var(--modal-border, 1px solid rgba(255,255,255,0.1));
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: var(--modal-label, rgba(255,255,255,0.9));
        }
        
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 10px;
            border-radius: 6px;
            border: var(--modal-input-border, 1px solid rgba(255,255,255,0.2));
            background: var(--modal-input-bg, rgba(255,255,255,0.1));
            color: var(--modal-input-text, #fff);
            font-size: 14px;
        }
        
        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: var(--modal-input-focus, rgba(255,255,255,0.5));
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
        }
        
        .button-group button {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .button-group button[type="submit"] {
            background: var(--modal-submit-bg, #4CAF50);
            color: white;
        }
        
        .button-group button[type="button"] {
            background: var(--modal-cancel-bg, rgba(255,255,255,0.1));
            color: var(--modal-cancel-text, #fff);
        }
        
        .button-group button:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .quick-apps {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }
        
        .quick-app-btn {
            background: var(--modal-quick-app-bg, rgba(255,255,255,0.1));
            color: var(--modal-quick-app-text, #fff);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        
        .quick-app-btn:hover {
            background: var(--modal-quick-app-hover, rgba(255,255,255,0.2));
            transform: translateY(-1px);
        }
    `;
});

// Add theme-specific modal variables
themes.modern += `
    :root {
        --modal-bg: linear-gradient(145deg, #2a2a2a, #333);
        --modal-border: 1px solid rgba(255,255,255,0.1);
        --modal-input-bg: rgba(0,0,0,0.2);
        --modal-submit-bg: linear-gradient(145deg, #4CAF50, #45a049);
    }
`;

themes.dark += `
    :root {
        --modal-bg: #000;
        --modal-border: 1px solid #00ff00;
        --modal-text: #00ff00;
        --modal-label: #00ff00;
        --modal-input-bg: #111;
        --modal-input-border: 1px solid #00ff00;
        --modal-input-text: #00ff00;
        --modal-submit-bg: #008800;
        --modal-quick-app-bg: rgba(0,255,0,0.1);
        --modal-quick-app-hover: rgba(0,255,0,0.2);
    }
`;

themes.light += `
    :root {
        --modal-bg: #fff;
        --modal-text: #333;
        --modal-label: #666;
        --modal-input-bg: #f5f5f5;
        --modal-input-border: 1px solid #ddd;
        --modal-input-text: #333;
        --modal-submit-bg: #4CAF50;
        --modal-cancel-bg: #eee;
        --modal-cancel-text: #666;
        --modal-quick-app-bg: #eee;
        --modal-quick-app-hover: #ddd;
    }
`;

themes.retro += `
    :root {
        --modal-bg: #000033;
        --modal-border: 2px solid #ff00ff;
        --modal-text: #00ffff;
        --modal-label: #ff00ff;
        --modal-input-bg: #000066;
        --modal-input-border: 2px solid #00ffff;
        --modal-input-text: #00ffff;
        --modal-submit-bg: #ff00ff;
        --modal-quick-app-bg: #000066;
        --modal-quick-app-hover: #000099;
    }
`;

themes.neon += `
    :root {
        --modal-bg: rgba(15,15,15,0.95);
        --modal-border: 1px solid #0fa;
        --modal-text: #0fa;
        --modal-label: #0fa;
        --modal-input-bg: rgba(0,255,170,0.1);
        --modal-input-border: 1px solid #0fa;
        --modal-input-text: #0fa;
        --modal-submit-bg: #0fa;
        --modal-quick-app-bg: rgba(0,255,170,0.2);
        --modal-quick-app-hover: rgba(0,255,170,0.3);
    }
`;

themes.cyberpunk += `
    :root {
        --modal-bg: rgba(18,4,88,0.95);
        --modal-border: 2px solid #ff2a6d;
        --modal-text: #05d9e8;
        --modal-label: #ff2a6d;
        --modal-input-bg: rgba(5,217,232,0.1);
        --modal-input-border: 2px solid #05d9e8;
        --modal-input-text: #05d9e8;
        --modal-submit-bg: #ff2a6d;
        --modal-quick-app-bg: rgba(255,42,109,0.2);
        --modal-quick-app-hover: rgba(255,42,109,0.3);
    }
`;

// Update the grid CSS in all themes
Object.keys(themes).forEach(theme => {
    // First, find and replace the existing grid styles
    themes[theme] = themes[theme].replace(
        /\.stream-deck,\s*\.button-grid\s*{[^}]+}/,
        `.stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 15px;
            padding: 15px;
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
        }`
    );

    // Then, find and replace the button styles
    themes[theme] = themes[theme].replace(
        /\.deck-button\s*{[^}]+}/,
        `.deck-button {
            aspect-ratio: 1;
            width: 100%;
            max-width: 150px;
            height: auto;
            background: var(--button-bg, #2a2a2a);
            border: var(--button-border, none);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
            color: var(--button-text, white);
            padding: 15px;
            position: relative;
            margin: 0 auto;
        }`
    );
});

// Add responsive grid styles to all themes
Object.keys(themes).forEach(theme => {
    themes[theme] += `
        @media (max-width: 768px) {
            .stream-deck, .button-grid {
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 10px;
                padding: 10px;
            }
            
            .deck-button {
                max-width: 120px;
                padding: 10px;
            }
        }

        @media (max-width: 480px) {
            .stream-deck, .button-grid {
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 8px;
                padding: 8px;
            }
            
            .deck-button {
                max-width: 100px;
                padding: 8px;
            }
        }
    `;
});

// Add styles for nested buttons
const commonCSS = `
    /* ... previous CSS ... */
    
    .nested-buttons {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 10px;
    }
`;

// Add styles for nested buttons
Object.keys(themes).forEach(theme => {
    themes[theme] += `
        .button-group {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }
        
        .group-button {
            width: 100% !important;
            max-width: 150px !important;
            background: var(--group-button-bg, linear-gradient(145deg, #2a2a2a, #333)) !important;
            border: var(--group-button-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease !important;
        }
        
        .group-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
            border-color: var(--group-button-hover-border, rgba(255,255,255,0.2)) !important;
        }
        
        .nested-buttons {
            position: relative;
            width: 100%;
            max-width: 150px;
            background: transparent;
            padding: 10px 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 10px;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .nested-button {
            width: 100% !important;
            max-width: 150px !important;
            height: 150px !important;
            aspect-ratio: 1 !important;
            padding: 15px !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 10px;
            background: var(--group-button-bg, linear-gradient(145deg, #2a2a2a, #333)) !important;
            border: var(--group-button-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease !important;
        }
        
        .nested-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
            border-color: var(--group-button-hover-border, rgba(255,255,255,0.2)) !important;
        }
        
        .nested-button .icon {
            width: 32px !important;
            height: 32px !important;
            margin-bottom: 10px !important;
            opacity: 0.8;
        }
        
        .nested-button span {
            text-align: center !important;
            font-size: 1em !important;
        }
    `;
});

// Add theme-specific styles
themes.dark += `
    :root {
        --nested-bg: rgba(0,0,0,0.95);
        --nested-border: 1px solid #00ff00;
        --group-button-bg: #000;
        --group-button-border: 1px solid #00ff00;
        --group-button-hover-border: #00ff00;
        --nested-button-bg: rgba(0,255,0,0.1);
        --nested-button-hover-bg: rgba(0,255,0,0.2);
    }
`;

themes.light += `
    :root {
        --nested-bg: rgba(255,255,255,0.95);
        --nested-border: 1px solid #ddd;
        --group-button-bg: #fff;
        --group-button-border: 1px solid #ddd;
        --group-button-hover-border: #999;
        --nested-button-bg: #f5f5f5;
        --nested-button-hover-bg: #eee;
    }
`;

themes.retro += `
    :root {
        --nested-bg: rgba(0,0,51,0.95);
        --nested-border: 2px solid #ff00ff;
        --group-button-bg: #000033;
        --group-button-border: 2px solid #ff00ff;
        --group-button-hover-border: #ff00ff;
        --nested-button-bg: rgba(255,0,255,0.1);
        --nested-button-hover-bg: rgba(255,0,255,0.2);
    }
`;

themes.neon += `
    :root {
        --nested-bg: rgba(15,15,15,0.95);
        --nested-border: 1px solid #0fa;
        --group-button-bg: #0f0f0f;
        --group-button-border: 1px solid #0fa;
        --group-button-hover-border: #0fa;
        --nested-button-bg: rgba(0,255,170,0.1);
        --nested-button-hover-bg: rgba(0,255,170,0.2);
    }
`;

themes.cyberpunk += `
    :root {
        --nested-bg: rgba(18,4,88,0.95);
        --nested-border: 2px solid #ff2a6d;
        --group-button-bg: #120458;
        --group-button-border: 2px solid #ff2a6d;
        --group-button-hover-border: #ff2a6d;
        --nested-button-bg: rgba(255,42,109,0.1);
        --nested-button-hover-bg: rgba(255,42,109,0.2);
    }
`;

// Add styles for nested buttons
Object.keys(themes).forEach(theme => {
    themes[theme] += `
        .button-group {
            position: relative;
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            width: auto;
            gap: 2px;
        }
        
        .group-button {
            width: 100% !important;
            max-width: 150px !important;
            background: var(--group-button-bg, linear-gradient(145deg, #2a2a2a, #333)) !important;
            border: var(--group-button-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease !important;
        }
        
        .group-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
            border-color: var(--group-button-hover-border, rgba(255,255,255,0.2)) !important;
        }
        
        .nested-buttons {
            display: flex;
            flex-direction: row;
            gap: 2px;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateX(-2px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .nested-button {
            width: 150px !important;
            height: 150px !important;
            aspect-ratio: 1 !important;
            padding: 15px !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 10px;
            background: var(--group-button-bg, linear-gradient(145deg, #2a2a2a, #333)) !important;
            border: var(--group-button-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease !important;
        }
        
        .nested-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
            border-color: var(--group-button-hover-border, rgba(255,255,255,0.2)) !important;
        }
        
        .nested-button .icon {
            width: 32px !important;
            height: 32px !important;
            margin-bottom: 10px !important;
            opacity: 0.8;
        }
        
        .nested-button span {
            text-align: center !important;
            font-size: 1em !important;
        }

        /* Update grid styles to handle horizontal groups */
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(auto, max-content)) !important;
            gap: 20px;
            padding: 20px;
            justify-content: center;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .button-group {
                flex-direction: column;
                align-items: center;
            }
            
            .nested-buttons {
                margin-top: 2px;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .nested-button {
                width: 120px !important;
                height: 120px !important;
            }
        }

        @media (max-width: 480px) {
            .nested-button {
                width: 100px !important;
                height: 100px !important;
            }
        }
    `;
});

// Remove all previous theme style additions and add this single, clean version
Object.keys(themes).forEach(theme => {
    themes[theme] += `
        .button-group {
            position: relative;
            display: inline-flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 0;
        }
        
        .group-button {
            width: 150px !important;
            height: 150px !important;
            background: var(--group-button-bg, linear-gradient(145deg, #2a2a2a, #333)) !important;
            border: var(--group-button-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease !important;
            margin: 0 !important;
            padding: 15px !important;
        }
        
        .group-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
            border-color: var(--group-button-hover-border, rgba(255,255,255,0.2)) !important;
        }
        
        .nested-buttons {
            display: inline-flex;
            flex-direction: row;
            gap: 0;
            margin: 0;
            padding: 0;
            animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateX(-2px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        .nested-button {
            width: 150px !important;
            height: 150px !important;
            padding: 15px !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            gap: 10px;
            background: var(--group-button-bg, linear-gradient(145deg, #2a2a2a, #333)) !important;
            border: var(--group-button-border, 1px solid rgba(255,255,255,0.1)) !important;
            transition: all 0.3s ease !important;
            margin: 0 !important;
        }
        
        .nested-button:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2) !important;
            border-color: var(--group-button-hover-border, rgba(255,255,255,0.2)) !important;
        }
        
        .deck-button {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        
        .deck-button .icon {
            width: 32px !important;
            height: 32px !important;
            margin-bottom: 10px !important;
            opacity: 0.8;
        }
        
        .deck-button span {
            text-align: center !important;
            font-size: 1em !important;
        }

        /* Grid layout */
        .stream-deck, .button-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(auto, max-content)) !important;
            gap: 20px;
            padding: 20px;
            justify-content: center;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
            .button-group {
                flex-direction: column;
                align-items: center;
            }
            
            .nested-buttons {
                margin-top: 0;
                flex-wrap: wrap;
                justify-content: center;
            }
            
            .group-button,
            .nested-button {
                width: 120px !important;
                height: 120px !important;
            }
        }

        @media (max-width: 480px) {
            .group-button,
            .nested-button {
                width: 100px !important;
                height: 100px !important;
            }
        }
    `;
});

// Start the server
async function startServer() {
    try {
        await initializeDataFile();
        const port = 5000;
        const localIPs = getLocalIPs();
        
        app.listen(port, () => {
            console.log('\nWebDeck is running!');
            console.log('\nAccess URLs:');
            console.log(`Local: http://localhost:${port}`);
            localIPs.forEach(ip => {
                console.log(`Network: http://${ip}:${port}`);
            });
            console.log('\nAdmin Panel:');
            console.log(`Local: http://localhost:${port}/admin`);
            localIPs.forEach(ip => {
                console.log(`Network: http://${ip}:${port}/admin`);
            });
            console.log('\nData file location:', DATA_FILE);
            console.log('\nPress Ctrl+C to stop the server');
            
            setTimeout(() => openWebDeck(port), 1000);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Open the default browser to the WebDeck URL
function openWebDeck(port) {
    const url = `http://localhost:${port}`;
    switch (process.platform) {
        case 'darwin':
            exec(`open ${url}`);
            break;
        case 'win32':
            exec(`start ${url}`);
            break;
        default:
            exec(`xdg-open ${url}`);
    }
}

startServer(); 