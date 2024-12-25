let buttons = [];

function renderButtons() {
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = '';
    
    buttons.forEach((button) => {
        const buttonElement = document.createElement('button');
        buttonElement.className = 'deck-button';
        buttonElement.textContent = button.name;
        buttonElement.onclick = () => executeAction(button.action, button.params);
        grid.appendChild(buttonElement);
    });

    // Save buttons to localStorage
    localStorage.setItem('webdeckButtons', JSON.stringify(buttons));
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

function addNewButton() {
    const name = prompt('Enter button name:');
    if (!name) return;
    
    const action = prompt('Enter action type (command/media/application):');
    if (!action) return;
    
    let params = {};
    if (action === 'command') {
        params.command = prompt('Enter command to execute:');
        if (!params.command) return;
    } else if (action === 'media') {
        params.action = prompt('Enter media action (play_pause/next/previous):');
        if (!params.action) return;
    } else if (action === 'application') {
        params.path = prompt('Enter application path:');
        if (!params.path) return;
    } else {
        alert('Invalid action type!');
        return;
    }
    
    buttons.push({ name, action, params });
    renderButtons();
}

// Load saved buttons from localStorage on startup
window.addEventListener('DOMContentLoaded', () => {
    const savedButtons = localStorage.getItem('webdeckButtons');
    if (savedButtons) {
        buttons = JSON.parse(savedButtons);
    }
    renderButtons();
}); 