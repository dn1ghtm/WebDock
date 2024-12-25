const path = require('path');
const { exec } = require('child_process');
const express = require('express');
const { executeAction } = require('./actions');
const multer = require('multer');
const fs = require('fs').promises;

// Get the executable's directory
const APP_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const DATA_FILE = path.join(APP_DIR, 'webdeck-data.json');

// Default data structure
const defaultData = {
    buttons: [],
    icons: {}
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
        const parsedData = JSON.parse(data);
        // If the file contains an array, convert it to our new format
        if (Array.isArray(parsedData)) {
            return {
                buttons: parsedData,
                icons: {}
            };
        }
        return parsedData;
    } catch {
        console.log('Creating new data file...');
        await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
}

// Save data to file
async function saveData(data) {
    try {
        if (!data.buttons) {
            // If we're passed just an array of buttons, convert it to our format
            data = {
                buttons: data,
                icons: {}
            };
        }
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
        res.json(data.buttons || []);
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

app.post('/api/buttons', async (req, res) => {
    try {
        const data = await loadData();
        data.buttons = req.body;
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

// SVG icons for the minimal set we need
const svgIcons = {
    play: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path fill="currentColor" d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>',
    forward: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.6 34.1 4.4L224 214.3V96c0-12.4 7.2-23.7 18.4-29s24.5-3.6 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4s-18.4-16.6-18.4-29V297.7L52.5 440.6z"/></svg>',
    backward: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M459.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4L288 214.3V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.6-34.1 4.4l-192 160C36.2 237.5 32 246.5 32 256s4.2 18.5 11.5 24.6l192 160c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V297.7L459.5 440.6z"/></svg>',
    window: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zM96 96H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>',
    terminal: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M9.4 86.6C-3.1 74.1-3.1 53.9 9.4 41.4s32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L178.7 256 9.4 86.6zM256 416H544c17.7 0 32 14.3 32 32s-14.3 32-32 32H256c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>',
    keyboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M64 112c-8.8 0-16 7.2-16 16V384c0 8.8 7.2 16 16 16H512c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H64zM0 128C0 92.7 28.7 64 64 64H512c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM176 320H400c8.8 0 16 7.2 16 16s-7.2 16-16 16H176c-8.8 0-16-7.2-16-16s7.2-16 16-16zm-72-72c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H120c-8.8 0-16-7.2-16-16zm128 0c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H248c-8.8 0-16-7.2-16-16zm144-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H376c-8.8 0-16-7.2-16-16s7.2-16 16-16zm80 16c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H472c-8.8 0-16-7.2-16-16zM96 208c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16zm144-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H240c-8.8 0-16-7.2-16-16s7.2-16 16-16zm112 16c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H368c-8.8 0-16-7.2-16-16zm144-16h32c8.8 0 16 7.2 16 16s-7.2 16-16 16H496c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/></svg>',
    cog: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>'
};

// CSS with icon classes
const commonCSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #1a1a1a; color: #ffffff; font-family: Arial, sans-serif; min-height: 100vh; margin: 0; padding: 10px; }
    .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 10px; }
    h1 { text-align: center; margin: 15px 0; color: #ffffff; font-size: clamp(24px, 5vw, 32px); }
    
    /* Icon styles */
    .icon {
        width: 24px;
        height: 24px;
        display: inline-block;
        margin-bottom: 8px;
    }
    .icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
    }
    
    /* Button styles */
    .stream-deck, .button-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
        margin: 20px 0;
    }
    
    .deck-button {
        aspect-ratio: 1;
        width: 100%;
        background-color: #3a3a3a;
        border: none;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s ease;
        color: white;
        padding: 10px;
        position: relative;
    }
    
    .button-image {
        width: 40%;
        height: 40%;
        object-fit: contain;
        border-radius: 5px;
        margin-bottom: 8px;
    }
    
    .deck-button:hover {
        background-color: #4a4a4a;
        transform: scale(1.02);
    }
    
    .deck-button span {
        font-size: 14px;
        text-align: center;
        word-wrap: break-word;
    }
    
    /* Admin styles */
    .add-button {
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
    }
    
    .delete-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        background: #ff4444;
        border: none;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        cursor: pointer;
        display: none;
    }
    
    .deck-button:hover .delete-btn {
        display: block;
    }
    
    /* Navigation */
    .admin-link, .user-link {
        position: fixed;
        bottom: 15px;
        right: 15px;
        color: #666;
        text-decoration: none;
        padding: 8px 12px;
        background-color: #2a2a2a;
        border-radius: 5px;
        transition: all 0.3s ease;
    }
    
    /* Modal styles */
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
    }

    .modal-content {
        background: #2a2a2a;
        padding: 20px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
    }

    .form-group {
        margin-bottom: 15px;
    }

    .form-group label {
        display: block;
        margin-bottom: 5px;
    }

    .form-group input,
    .form-group select {
        width: 100%;
        padding: 8px;
        border: 1px solid #444;
        border-radius: 4px;
        background: #333;
        color: white;
    }

    .button-group {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }

    .button-group button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .button-group button[type="submit"] {
        background: #4CAF50;
        color: white;
    }

    .button-group button[type="button"] {
        background: #666;
        color: white;
    }
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
    
    buttons.forEach((button) => {
        const buttonElement = document.createElement('button');
        buttonElement.className = 'deck-button';
        
        if (button.imageUrl) {
            const img = document.createElement('img');
            img.src = button.imageUrl;
            img.className = 'button-image';
            buttonElement.appendChild(img);
        } else {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon';
            iconDiv.innerHTML = getIconForButton(button);
            buttonElement.appendChild(iconDiv);
        }
        
        const label = document.createElement('span');
        label.textContent = button.name;
        buttonElement.appendChild(label);
        buttonElement.onclick = () => executeAction(button.action, button.params);
        grid.appendChild(buttonElement);
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

// Initial load
loadButtons();

// Refresh every second
setInterval(loadButtons, 1000);
`;

// Admin Panel JavaScript
const adminJS = `
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
            renderButtons(false); // Don't save after loading
        }
    } catch (error) {
        console.error('Error loading buttons:', error);
    }
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
    
    buttons.forEach((button, index) => {
        const buttonElement = document.createElement('button');
        buttonElement.className = 'deck-button';
        
        if (button.imageUrl) {
            const img = document.createElement('img');
            img.src = button.imageUrl;
            img.className = 'button-image';
            buttonElement.appendChild(img);
        } else {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'icon';
            iconDiv.innerHTML = getIconForButton(button);
            buttonElement.appendChild(iconDiv);
        }
        
        const label = document.createElement('span');
        label.textContent = button.name;
        buttonElement.appendChild(label);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteButton(index);
        };
        
        buttonElement.appendChild(deleteBtn);
        grid.appendChild(buttonElement);
    });

    if (shouldSave) {
        saveButtons();
    }
}

function deleteButton(index) {
    if (confirm('Are you sure you want to delete this button?')) {
        buttons.splice(index, 1);
        renderButtons();
    }
}

function addNewButton() {
    const modalHTML = \`
        <div id="buttonModal" class="modal">
            <div class="modal-content">
                <h2 style="margin-bottom: 20px;">Add New Button</h2>
                <form id="buttonForm">
                    <div class="form-group">
                        <label for="buttonName">Button Name:</label>
                        <input type="text" id="buttonName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Action Type:</label>
                        <select id="actionType">
                            <option value="command">Run Command</option>
                            <option value="media">Media Control</option>
                            <option value="application">Open Application</option>
                            <option value="keystroke">Send Keystroke</option>
                        </select>
                    </div>

                    <div id="commandDiv" class="form-group">
                        <label for="command">Command:</label>
                        <input type="text" id="command">
                    </div>

                    <div id="mediaDiv" class="form-group" style="display:none;">
                        <label for="mediaAction">Media Action:</label>
                        <select id="mediaAction">
                            <option value="play_pause">Play/Pause</option>
                            <option value="next">Next Track</option>
                            <option value="previous">Previous Track</option>
                        </select>
                    </div>

                    <div id="applicationDiv" class="form-group" style="display:none;">
                        <label for="appPath">Application Path:</label>
                        <input type="text" id="appPath">
                    </div>

                    <div id="keystrokeDiv" class="form-group" style="display:none;">
                        <label for="keystroke">Select Keystroke:</label>
                        <select id="keystroke">
                            <option value="MEDIA_PLAY_PAUSE">Play/Pause</option>
                            <option value="MEDIA_NEXT_TRACK">Next Track</option>
                            <option value="MEDIA_PREV_TRACK">Previous Track</option>
                            <option value="VOLUME_UP">Volume Up</option>
                            <option value="VOLUME_DOWN">Volume Down</option>
                            <option value="VOLUME_MUTE">Mute</option>
                            <option value="F13">F13</option>
                            <option value="F14">F14</option>
                            <option value="F15">F15</option>
                            <option value="F16">F16</option>
                            <option value="F17">F17</option>
                            <option value="F18">F18</option>
                            <option value="F19">F19</option>
                            <option value="HOME">Home</option>
                            <option value="END">End</option>
                            <option value="PAGEUP">Page Up</option>
                            <option value="PAGEDOWN">Page Down</option>
                        </select>
                    </div>

                    <div class="button-group">
                        <button type="submit" style="background: #4CAF50; color: white;">Add Button</button>
                        <button type="button" onclick="closeModal()" style="background: #666; color: white;">Cancel</button>
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

        buttons.push({ name, action, params });
        renderButtons();
        closeModal();
    });
}

function closeModal() {
    const modal = document.getElementById('buttonModal');
    if (modal) {
        modal.remove();
    }
}

// Initial load
loadButtons();

// Refresh every second
setInterval(loadButtons, 1000);
`;

// Serve user interface with embedded Font Awesome
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WebDeck - User Panel</title>
            <style>${commonCSS}</style>
        </head>
        <body>
            <div class="container">
                <h1>WebDeck</h1>
                <div class="stream-deck" id="buttonGrid"></div>
            </div>
            <a href="/admin" class="admin-link">
                <div class="icon">${svgIcons.cog}</div>
                <span>Admin Panel</span>
            </a>
            <script>${userJS}</script>
        </body>
        </html>
    `);
});

// Serve admin interface with embedded Font Awesome
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WebDeck - Admin Panel</title>
            <style>${commonCSS}</style>
        </head>
        <body>
            <div class="container">
                <h1>WebDeck Admin Panel</h1>
                <div class="button-grid" id="buttonGrid"></div>
                <button class="add-button" onclick="addNewButton()">Add New Button</button>
            </div>
            <a href="/" class="user-link">
                <div class="icon">${svgIcons.home}</div>
                <span>User Panel</span>
            </a>
            <script>${adminJS}</script>
        </body>
        </html>
    `);
});

// Start the server
async function startServer() {
    try {
        // Initialize data file before starting the server
        await initializeDataFile();
        
        app.listen(5000, () => {
            console.log('WebDeck is running!');
            console.log('Access it at: http://localhost:5000');
            console.log('Press Ctrl+C to stop the server');
            console.log('Data file location:', DATA_FILE);
            
            setTimeout(() => openWebDeck(5000), 1000);
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