# AEMS Desktop App Assets

This directory contains the assets needed for the Electron desktop application.

## Required Icons

For a production build, you'll need to provide the following icon files:

### Windows
- `icon.ico` - Main application icon (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
- `tray-icon.png` - System tray icon (16x16, 24x24, 32x32)

### macOS
- `icon.icns` - macOS application icon (multiple sizes bundled)
- `tray-icon.png` - Menu bar icon (16x16, 32x32 for Retina)

### Linux
- `icon.png` - Application icon (512x512 recommended)
- `tray-icon.png` - System tray icon (16x16, 24x24, 32x32)

## Icon Guidelines

- Use the AEMS branding colors (teal/dark theme)
- Ensure icons are clear at small sizes (16x16)
- Follow platform-specific design guidelines
- Use transparent backgrounds where appropriate

## Temporary Placeholders

For development, we're using placeholder icons. Replace these with proper branded icons for production deployment.

## Creating Icons

You can use tools like:
- **GIMP** (free) - For creating and editing icons
- **Inkscape** (free) - For vector-based icons
- **Adobe Illustrator** - Professional vector graphics
- **Online converters** - For format conversion (PNG to ICO, etc.)

## Icon Sizes Reference

### Windows ICO format should include:
- 256x256 (32-bit)
- 128x128 (32-bit)
- 64x64 (32-bit)
- 48x48 (32-bit)
- 32x32 (32-bit)
- 16x16 (32-bit)

### macOS ICNS format should include:
- 1024x1024 (icon_512x512@2x)
- 512x512 (icon_512x512)
- 256x256 (icon_256x256@2x)
- 128x128 (icon_128x128)
- 64x64 (icon_32x32@2x)
- 32x32 (icon_32x32)
- 32x32 (icon_16x16@2x)
- 16x16 (icon_16x16)
