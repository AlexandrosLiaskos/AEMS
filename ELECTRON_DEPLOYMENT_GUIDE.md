# AEMS Electron Application Deployment Guide

## Overview

The AEMS (Agentic Email Management System) has been successfully converted to an Electron desktop application with the following features:

- ✅ Cross-platform desktop application (Windows, macOS, Linux)
- ✅ Platform-specific data storage (Windows APPDATA, macOS Application Support, Linux .config)
- ✅ Integrated Express server running within Electron
- ✅ Proper application lifecycle management
- ✅ Secure IPC communication between main and renderer processes
- ✅ Automated build and packaging system

## Platform-Specific Storage

### Windows
- **Data Directory**: `%APPDATA%\AEMS\aems-data\`
- **Backup Directory**: `%APPDATA%\AEMS\aems-backups\`

### macOS
- **Data Directory**: `~/Library/Application Support/AEMS/aems-data/`
- **Backup Directory**: `~/Library/Application Support/AEMS/aems-backups/`

### Linux
- **Data Directory**: `~/.config/AEMS/aems-data/`
- **Backup Directory**: `~/.config/AEMS/aems-backups/`

## Development Commands

```bash
# Run in development mode
npm run electron-dev

# Run regular web version
npm run start

# Build for all platforms
npm run build

# Build for specific platforms
npm run build-win    # Windows
npm run build-mac    # macOS
npm run build-linux  # Linux
```

## Building for Windows

To create a Windows installer from any platform:

```bash
npm run build-win
```

This will create:
- `dist/AEMS - Agentic Email Management System Setup 1.0.0.exe` - Windows installer
- `dist/win-unpacked/` - Unpacked Windows application

## Building for macOS

To create a macOS DMG from macOS:

```bash
npm run build-mac
```

This will create:
- `dist/AEMS - Agentic Email Management System-1.0.0.dmg` - macOS installer

## Building for Linux

To create a Linux AppImage:

```bash
npm run build-linux
```

This will create:
- `dist/AEMS - Agentic Email Management System-1.0.0.AppImage` - Portable Linux app

## Application Features

### Environment Detection
The application automatically detects whether it's running in:
- **Desktop Mode**: When launched via Electron
- **CLI Mode**: When run as a regular Node.js application

### Data Storage
- Uses platform-appropriate directories automatically
- Maintains the same JSON-based database structure
- Includes automated backup system
- File locking prevents data corruption

### Security
- Context isolation enabled
- Node integration disabled in renderer
- Secure IPC communication via preload script
- External links open in system browser

## Configuration Files

### main.js
- Electron main process entry point
- Handles application lifecycle
- Configures platform-specific storage
- Manages Express server integration

### preload.js
- Secure bridge between main and renderer processes
- Exposes safe APIs to the web interface
- Maintains security boundaries

### package.json
- Contains Electron build configuration
- Defines platform-specific build targets
- Includes all necessary dependencies

## Troubleshooting

### Common Issues

1. **Port Conflicts**: The app uses port 3000 by default. Ensure it's available.
2. **Permissions**: On Linux/macOS, ensure the AppImage has execute permissions.
3. **Missing Icons**: Icons are optional but recommended for professional appearance.

### Environment Variables

The application respects these environment variables:
- `AEMS_MODE=desktop` - Forces desktop mode
- `AEMS_DATA_DIR` - Custom data directory base path
- `NODE_ENV=development` - Enables development features

## Next Steps

1. **Add Application Icons**: Create proper icons for all platforms (see public/ICONS_README.md)
2. **Code Signing**: Sign the application for distribution (especially important for Windows/macOS)
3. **Auto-Updates**: Implement automatic update mechanism using electron-updater
4. **Testing**: Test on target platforms to ensure compatibility

## Distribution

The built applications are self-contained and include:
- Node.js runtime
- Chromium browser engine
- All application dependencies
- Platform-specific optimizations

Users can run the application without installing Node.js or any other dependencies.
