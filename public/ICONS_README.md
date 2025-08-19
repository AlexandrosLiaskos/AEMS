# Application Icons

To complete the Electron application setup, you need to add the following icon files:

## Required Icons

1. **icon.png** - Linux AppImage icon (512x512 pixels recommended)
2. **icon.ico** - Windows executable icon (contains multiple sizes: 16x16, 32x32, 48x48, 256x256)
3. **icon.icns** - macOS application icon (contains multiple sizes)

## Icon Requirements

- **PNG Format**: Use for Linux builds (icon.png)
- **ICO Format**: Use for Windows builds (icon.ico) 
- **ICNS Format**: Use for macOS builds (icon.icns)

## Recommended Sizes

- **Base Size**: 512x512 pixels
- **Windows ICO**: Should contain 16x16, 32x32, 48x48, and 256x256 sizes
- **macOS ICNS**: Should contain multiple sizes from 16x16 to 1024x1024

## Tools for Icon Creation

- **Online Converters**: Use services like favicon.io or convertio.co
- **ImageMagick**: Command-line tool for batch conversion
- **GIMP**: Free image editor with icon export capabilities
- **Sketch/Figma**: Professional design tools

## Temporary Solution

For testing purposes, you can temporarily remove the icon references from package.json or use placeholder icons until proper icons are created.
