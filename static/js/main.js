const buttons = [
    {
        name: 'Media Play/Pause',
        action: 'media',
        params: { action: 'play_pause' }
    },
    {
        name: 'Open Chrome',
        action: 'application',
        params: { path: 'chrome.exe' }
    },
    {
        name: 'Next Track',
        action: 'media',
        params: { action: 'next' }
    }
];

function renderButtons() {
    const grid = document.getElementById('buttonGrid');
    grid.innerHTML = '';
    
    buttons.forEach((button, index) => {
        const buttonElement = document.createElement('button');
        buttonElement.className = 'deck-button';
        buttonElement.textContent = button.name;
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
        console.log(result);
    } catch (error) {
        console.error('Error executing action:', error);
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
    } else if (action === 'media') {
        params.action = prompt('Enter media action (play_pause/next/previous):');
    } else if (action === 'application') {
        params.path = prompt('Enter application path:');
    }
    
    buttons.push({ name, action, params });
    renderButtons();
}

// Initial render
renderButtons(); 