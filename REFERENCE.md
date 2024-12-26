# WebDeck Technical Reference

## Project Overview
WebDeck is a web-based Stream Deck alternative that creates a local server accessible across the home network. It allows users to create customizable buttons for various actions like running commands, controlling media, launching applications, and sending keystrokes.

## Core Components

### 1. Server (`start-server.js`)
- **Express Server**: Handles all HTTP requests and serves the web interface
- **Port**: Runs on port 5000 by default
- **Data Storage**: Uses a local JSON file (`webdeck-data.json`) for persistent storage

### 2. Data Structure
```javascript
{
  "groups": [
    {
      "name": "Group Name",
      "buttons": [
        {
          "name": "Button Name",
          "action": "action_type",
          "params": {
            // Action-specific parameters
          }
        }
      ]
    }
  ],
  "icons": {},
  "currentTheme": "theme_name"
}
```

### 3. Action Types
1. **Command** (`command`)
   - Executes terminal commands
   - Parameters: `{ "command": "command_string" }`

2. **Media Control** (`media`)
   - Controls media playback
   - Parameters: `{ "action": "play_pause|next|previous" }`

3. **Application** (`application`)
   - Launches applications
   - Parameters: `{ "path": "application_path" }`

4. **Keystroke** (`keystroke`)
   - Sends keyboard shortcuts
   - Parameters: `{ "key": "MEDIA_PLAY_PAUSE|MEDIA_NEXT_TRACK|..." }`

## User Interface Components

### 1. Admin Panel (`/admin`)
- Button management interface
- Theme selection
- Group creation and management
- Button configuration modal

### 2. User Panel (`/`)
- Main interface for button execution
- Responsive grid layout
- Group expansion/collapse functionality
- Theme-aware design

## Themes
Available themes with customizable properties:
- Modern (default)
- Dark
- Light
- Retro
- Neon
- Cyberpunk
- Minimal

### Theme Structure
```css
{
  "--button-bg": "background_color",
  "--button-border": "border_style",
  "--button-text": "text_color",
  "--group-button-bg": "group_background",
  "--group-button-border": "group_border",
  "--nested-button-bg": "nested_background"
}
```

## API Endpoints

### Button Management
- `GET /api/buttons` - Retrieve all buttons
- `POST /api/buttons` - Update buttons
- `POST /execute` - Execute button action

### Theme Management
- `GET /api/theme` - Get current theme
- `POST /api/theme` - Set theme

### Icon Management
- `GET /icons/:filename` - Retrieve icon
- `POST /api/upload-icon` - Upload new icon

### Application Paths
- `GET /api/app-paths` - Get common application paths

## Event System

### Button Events
1. **Click Events**
   - Single button execution
   - Group expansion/collapse
   - Nested button execution

### Auto-refresh System
- Button state refresh: Every 1 second
- Theme state refresh: Every 5 seconds

## Screen Wake Prevention
Multiple approaches implemented:
1. Wake Lock API
2. Video loop method
3. Periodic interaction simulation

## Responsive Design
Three breakpoints implemented:
- Desktop: > 768px
- Tablet: 768px - 481px
- Mobile: ≤ 480px

## Development Guidelines

### Adding New Actions
1. Add action type to action handler
2. Update button modal interface
3. Add corresponding icon
4. Implement execution logic

### Creating New Themes
1. Define base colors and styles
2. Include modal styles
3. Add responsive adjustments
4. Define button states

### Button Group Implementation
1. Group container structure
2. Nested button handling
3. State management
4. Animation system

## Common Customizations

### Adding New Button Types
```javascript
// 1. Add to action types
const actionTypes = {
  'new_action': {
    icon: 'icon_name',
    handler: async (params) => {
      // Implementation
    }
  }
}

// 2. Add to modal interface
const modalFields = `
  <div id="newActionDiv" class="form-group">
    // Field definition
  </div>
`
```

### Custom Theme Creation
```css
themes.custom = `
  * { box-sizing: border-box; }
  body {
    // Base styles
  }
  .deck-button {
    // Button styles
  }
  // Additional component styles
`;
```

## Security Considerations
1. Local network access only
2. Command execution restrictions
3. File access limitations
4. Input sanitization

## Performance Optimization
1. Throttled refresh rates
2. Lazy loading of icons
3. Minimal DOM updates
4. Efficient event delegation

## Troubleshooting

### Common Issues
1. **Button Not Responding**
   - Check action configuration
   - Verify permissions
   - Check network connectivity

2. **Group Display Issues**
   - Clear browser cache
   - Check theme compatibility
   - Verify DOM structure

3. **Action Execution Failures**
   - Check system permissions
   - Verify path configurations
   - Check action parameters

### Debug Mode
Enable console logging for detailed operation information:
```javascript
const DEBUG = true;
function debug(msg) {
  if (DEBUG) console.log(`[WebDeck Debug] ${msg}`);
}
``` 