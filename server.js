const express = require('express');
const { executeAction } = require('./actions');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

const app = express();
const port = 5000;
const BUTTONS_FILE = 'app.json';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/icons/')
    },
    filename: function (req, file, cb) {
        // Use timestamp + original name to avoid conflicts
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

// Create public and icons directories if they don't exist
async function ensureDirectories() {
    try {
        await fs.mkdir(path.join(__dirname, 'public'), { recursive: true });
        await fs.mkdir(path.join(__dirname, 'public/icons'), { recursive: true });
    } catch (error) {
        console.log('Directories already exist');
    }
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Add upload endpoint
app.post('/api/upload-icon', upload.single('icon'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ status: 'error', error: 'No file uploaded' });
    }
    res.json({ 
        status: 'success', 
        path: '/icons/' + req.file.filename 
    });
});

// Load buttons from file
async function loadButtons() {
    try {
        const data = await fs.readFile(BUTTONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return empty array
        return [];
    }
}

// Save buttons to file
async function saveButtons(buttons) {
    await fs.writeFile(BUTTONS_FILE, JSON.stringify(buttons, null, 2));
}

// Get buttons
app.get('/api/buttons', async (req, res) => {
    try {
        const buttons = await loadButtons();
        res.json(buttons);
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// Save buttons
app.post('/api/buttons', async (req, res) => {
    try {
        const buttons = req.body;
        await saveButtons(buttons);
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

// Call this before starting the server
ensureDirectories().then(() => {
    app.listen(port, () => {
        console.log(`WebDeck running at http://localhost:${port}`);
    });
}); 