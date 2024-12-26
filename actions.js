const { exec } = require('child_process');
const path = require('path');
const os = require('os');

function executeAction(action, params) {
    return new Promise((resolve, reject) => {
        switch (action) {
            case 'application':
                const platform = os.platform();
                let command;

                switch (platform) {
                    case 'win32':
                        command = `start "" "${params.path}"`;
                        break;
                    case 'darwin': // macOS
                        command = `open "${params.path}"`;
                        break;
                    case 'linux':
                        command = `xdg-open "${params.path}"`;
                        break;
                    default:
                        reject(new Error(`Unsupported platform: ${platform}`));
                        return;
                }

                exec(command, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ status: 'success' });
                    }
                });
                break;

            case 'command':
                if (!params.command) {
                    reject(new Error('No command specified'));
                    return;
                }
                executeCommand(params.command)
                    .then(resolve)
                    .catch(reject);
                break;

            case 'media':
                if (!params.action) {
                    reject(new Error('No media action specified'));
                    return;
                }
                controlMedia(params.action)
                    .then(resolve)
                    .catch(reject);
                break;

            case 'keystroke':
                if (!params.key) {
                    reject(new Error('No key specified'));
                    return;
                }
                sendKeystroke(params.key)
                    .then(resolve)
                    .catch(reject);
                break;

            default:
                reject(new Error(`Unknown action: ${action}`));
        }
    });
}

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({ output: stdout });
        });
    });
}

function controlMedia(action) {
    // Using specific commands for each OS
    const commands = {
        win32: {
            'play_pause': 'powershell -c "(Add-Type -AssemblyName System.Windows.Forms);[System.Windows.Forms.SendKeys]::SendWait(' + "'{MEDIA_PLAY_PAUSE}'" + ')"',
            'next': 'powershell -c "(Add-Type -AssemblyName System.Windows.Forms);[System.Windows.Forms.SendKeys]::SendWait(' + "'{MEDIA_NEXT_TRACK}'" + ')"',
            'previous': 'powershell -c "(Add-Type -AssemblyName System.Windows.Forms);[System.Windows.Forms.SendKeys]::SendWait(' + "'{MEDIA_PREV_TRACK}'" + ')"'
        },
        darwin: {  // macOS
            'play_pause': 'osascript -e "tell application \"System Events\" to key code 16 using {command down}"',
            'next': 'osascript -e "tell application \"System Events\" to key code 17 using {command down}"',
            'previous': 'osascript -e "tell application \"System Events\" to key code 18 using {command down}"'
        },
        linux: {
            'play_pause': 'xdotool key XF86AudioPlay',
            'next': 'xdotool key XF86AudioNext',
            'previous': 'xdotool key XF86AudioPrev'
        }
    };

    const platform = process.platform;
    const command = commands[platform]?.[action];
    
    if (!command) {
        return Promise.reject(new Error('Unsupported platform or action'));
    }

    return executeCommand(command);
}

function sendKeystroke(key) {
    const platform = process.platform;
    let command;

    if (platform === 'darwin') {  // macOS
        // Extended keyMap for macOS
        const keyMap = {
            // Function keys
            'F13': '105',
            'F14': '107',
            'F15': '113',
            'F16': '106',
            'F17': '64',
            'F18': '79',
            'F19': '80',
            // Media keys
            'MEDIA_PLAY_PAUSE': '100',  // Play/Pause
            'MEDIA_NEXT_TRACK': '101',  // Next Track
            'MEDIA_PREV_TRACK': '98',   // Previous Track
            'VOLUME_UP': '111',         // Volume Up
            'VOLUME_DOWN': '103',       // Volume Down
            'VOLUME_MUTE': '102',       // Mute
            // Special keys
            'HOME': '115',
            'END': '119',
            'PAGEUP': '116',
            'PAGEDOWN': '121',
            'DELETE': '117',
            'INSERT': '114'
        };
        
        const keyCode = keyMap[key.toUpperCase()];
        if (!keyCode) {
            throw new Error(`Unsupported key: ${key} for macOS`);
        }
        
        // For media keys, we need to use special key codes
        if (key.startsWith('MEDIA_') || key.startsWith('VOLUME_')) {
            command = `osascript -e 'tell application "System Events" to key code ${keyCode}'`;
        } else {
            command = `osascript -e 'tell application "System Events" to key code ${keyCode}'`;
        }
    } else if (platform === 'win32') {  // Windows
        // For Windows, we can use the key names directly
        command = `powershell -c "(Add-Type -AssemblyName System.Windows.Forms);[System.Windows.Forms.SendKeys]::SendWait('{${key}}')"`;
    } else {  // Linux
        // Map keys to xdotool format
        const linuxKeyMap = {
            'MEDIA_PLAY_PAUSE': 'XF86AudioPlay',
            'MEDIA_NEXT_TRACK': 'XF86AudioNext',
            'MEDIA_PREV_TRACK': 'XF86AudioPrev',
            'VOLUME_UP': 'XF86AudioRaiseVolume',
            'VOLUME_DOWN': 'XF86AudioLowerVolume',
            'VOLUME_MUTE': 'XF86AudioMute'
        };
        
        const xdoKey = linuxKeyMap[key] || key;
        command = `xdotool key ${xdoKey}`;
    }

    return executeCommand(command);
}

module.exports = { executeAction }; 