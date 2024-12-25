let buttons = [];

// Map of action types to Font Awesome icons
const actionIcons = {
    'media': {
        'play_pause': 'fa-play',
        'next': 'fa-forward',
        'previous': 'fa-backward'
    },
    'application': 'fa-window-maximize',
    'command': 'fa-terminal'
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
    }
}

function renderButtons() {
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = '';
    
    buttons.forEach((button) => {
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
        
        // Create label
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, params })
        });
        
        const result = await response.json();
        if (result.status === 'error') {
            console.error('Error:', result.error);
        } else {
            console.log('Success:', result);
        }
    } catch (error) {
        console.error('Error executing action:', error);
    }
}

// Load buttons from server on startup
window.addEventListener('DOMContentLoaded', loadButtons);

// Add periodic refresh to get updates from other clients
setInterval(loadButtons, 5000); // Refresh every 5 seconds 