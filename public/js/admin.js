let buttons = [];

const actionIcons = {
    'media': {
        'play_pause': 'fa-play',
        'next': 'fa-forward',
        'previous': 'fa-backward'
    },
    'application': 'fa-window-maximize',
    'command': 'fa-terminal',
    'keystroke': 'fa-keyboard'
};

const AVAILABLE_KEYSTROKES = {
    // Function keys
    'Function Keys': {
        'F13': 'F13',
        'F14': 'F14',
        'F15': 'F15',
        'F16': 'F16',
        'F17': 'F17',
        'F18': 'F18',
        'F19': 'F19',
        'F20': 'F20',
        'F24': 'F24'
    },
    // Media keys
    'Media Controls': {
        'Volume Up': 'VOLUME_UP',
        'Volume Down': 'VOLUME_DOWN',
        'Mute': 'VOLUME_MUTE',
        'Play/Pause': 'MEDIA_PLAY_PAUSE',
        'Next Track': 'MEDIA_NEXT_TRACK',
        'Previous Track': 'MEDIA_PREV_TRACK'
    },
    // Special keys
    'Special Keys': {
        'Print Screen': 'PRINTSCREEN',
        'Scroll Lock': 'SCROLLLOCK',
        'Pause': 'PAUSE',
        'Insert': 'INSERT',
        'Home': 'HOME',
        'Page Up': 'PAGEUP',
        'Delete': 'DELETE',
        'End': 'END',
        'Page Down': 'PAGEDOWN'
    },
    // Modifiers
    'Modifiers': {
        'Left Windows': 'LWIN',
        'Right Windows': 'RWIN',
        'Left Alt': 'LALT',
        'Right Alt': 'RALT',
        'Left Control': 'LCONTROL',
        'Right Control': 'RCONTROL',
        'Left Shift': 'LSHIFT',
        'Right Shift': 'RSHIFT'
    }
};

function getIconForButton(button) {
    if (button.action === 'media') {
        return actionIcons.media[button.params.action] || 'fa-music';
    }
    return actionIcons[button.action] || 'fa-circle';
}

async function loadButtons() {
    try {
        const response = await fetch('/api/buttons');
        buttons = await response.json();
        renderButtons();
    } catch (error) {
        console.error('Error loading buttons:', error);
        alert('Error loading buttons');
    }
}

async function saveButtons() {
    try {
        await fetch('/api/buttons', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(buttons)
        });
    } catch (error) {
        console.error('Error saving buttons:', error);
        alert('Error saving buttons');
    }
}

function renderButtons() {
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = '';
    
    buttons.forEach((button, index) => {
        const buttonElement = document.createElement('button');
        buttonElement.className = 'deck-button';
        
        // Add image or icon
        if (button.imageUrl) {
            const img = document.createElement('img');
            img.src = button.imageUrl;
            img.className = 'button-image';
            buttonElement.appendChild(img);
        } else {
            const icon = document.createElement('i');
            icon.className = `fas ${getIconForButton(button)}`;
            buttonElement.appendChild(icon);
        }
        
        // Add label
        const label = document.createElement('span');
        label.textContent = button.name;
        buttonElement.appendChild(label);
        
        // Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteButton(index);
        };
        
        buttonElement.appendChild(deleteBtn);
        buttonElement.onclick = () => executeAction(button.action, button.params);
        grid.appendChild(buttonElement);
    });

    saveButtons(); // Save to server whenever buttons change
}

function deleteButton(index) {
    if (confirm('Are you sure you want to delete this button?')) {
        buttons.splice(index, 1);
        renderButtons();
    }
}

async function executeAction(action, params) {
    try {
        const response = await fetch('/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, params })
        });
        
        const result = await response.json();
        if (result.status === 'error') {
            alert('Error: ' + result.error);
        } else {
            console.log('Success:', result);
        }
    } catch (error) {
        console.error('Error executing action:', error);
        alert('Error executing action: ' + error.message);
    }
}

async function uploadIcon(file) {
    const formData = new FormData();
    formData.append('icon', file);

    try {
        const response = await fetch('/api/upload-icon', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.status === 'error') {
            throw new Error(result.error);
        }
        return result.path;
    } catch (error) {
        console.error('Error uploading icon:', error);
        throw error;
    }
}

function createKeystrokeSelect() {
    let html = '<select id="keystroke" class="form-control">';
    
    for (const [category, keys] of Object.entries(AVAILABLE_KEYSTROKES)) {
        html += `<optgroup label="${category}">`;
        for (const [keyName, keyValue] of Object.entries(keys)) {
            html += `<option value="${keyValue}">${keyName}</option>`;
        }
        html += '</optgroup>';
    }
    
    html += '</select>';
    return html;
}

async function addNewButton() {
    // Create modal HTML
    const modalHTML = `
        <div id="buttonModal" class="modal">
            <div class="modal-content">
                <h2>Add New Button</h2>
                <form id="buttonForm">
                    <div class="form-group">
                        <label for="buttonName">Button Name:</label>
                        <input type="text" id="buttonName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Icon Type:</label>
                        <select id="iconType">
                            <option value="upload">Upload Custom Icon</option>
                            <option value="url">Use Image URL</option>
                            <option value="default">Use Default Icon</option>
                        </select>
                    </div>
                    
                    <div id="iconUploadDiv" class="form-group">
                        <label for="iconFile">Select Icon:</label>
                        <input type="file" id="iconFile" accept="image/*">
                        <div id="iconPreview"></div>
                    </div>
                    
                    <div id="iconUrlDiv" class="form-group" style="display:none;">
                        <label for="iconUrl">Image URL:</label>
                        <input type="url" id="iconUrl">
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
                        ${createKeystrokeSelect()}
                        <small style="color: #999; display: block; margin-top: 5px;">
                            Note: Some keys might not work on all operating systems
                        </small>
                    </div>

                    <div class="button-group">
                        <button type="submit" class="submit-btn">Add Button</button>
                        <button type="button" class="cancel-btn" onclick="closeModal()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add modal styles if not already present
    if (!document.getElementById('modalStyles')) {
        const styleSheet = document.createElement("style");
        styleSheet.id = 'modalStyles';
        styleSheet.textContent = `
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }

            .modal-content {
                background: #2a2a2a;
                padding: 20px;
                border-radius: 10px;
                width: 90%;
                max-width: 500px;
                color: white;
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
                border: 1px solid #3a3a3a;
                border-radius: 4px;
                background: #333;
                color: white;
            }

            .button-group {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }

            .submit-btn,
            .cancel-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }

            .submit-btn {
                background: #4CAF50;
                color: white;
            }

            .cancel-btn {
                background: #666;
                color: white;
            }

            #iconPreview {
                margin-top: 10px;
                max-width: 100px;
                max-height: 100px;
            }

            #iconPreview img {
                max-width: 100%;
                max-height: 100%;
                border-radius: 5px;
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // Add event listeners
    const modal = document.getElementById('buttonModal');
    const form = document.getElementById('buttonForm');
    const iconType = document.getElementById('iconType');
    const actionType = document.getElementById('actionType');
    const iconFile = document.getElementById('iconFile');

    iconType.addEventListener('change', () => {
        document.getElementById('iconUploadDiv').style.display = 
            iconType.value === 'upload' ? 'block' : 'none';
        document.getElementById('iconUrlDiv').style.display = 
            iconType.value === 'url' ? 'block' : 'none';
    });

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

    iconFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('iconPreview');
                preview.innerHTML = `<img src="${e.target.result}" alt="Icon preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let imageUrl = null;
        if (iconType.value === 'upload' && iconFile.files.length > 0) {
            imageUrl = await uploadIcon(iconFile.files[0]);
        } else if (iconType.value === 'url') {
            imageUrl = document.getElementById('iconUrl').value;
        }

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

        buttons.push({ name, action, params, imageUrl });
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

// Load buttons from server on startup
window.addEventListener('DOMContentLoaded', loadButtons); 