# Claude Development Notes - GamePalette Mobile

## Package Management

### IMPORTANT: Always update package.json when installing new packages

When installing a new npm package, **ALWAYS** add it to `package.json` manually or use `npm install <package> --save`:

```bash
# CORRECT - adds to package.json automatically
npm install <package-name> --legacy-peer-deps

# After install, verify it's in package.json
```

**Why?** If packages are installed but not in `package.json`, deleting `node_modules` and reinstalling will cause missing module errors.

### Required flag for this project

Due to peer dependency conflicts, always use:
```bash
npm install --legacy-peer-deps
```

### Key dependencies (must be in package.json)
- `@react-native-community/slider` - Color count slider
- `upng-js` - PNG decoding for color extraction
- `babel-preset-expo` - Required for Expo builds
- `expo-image` - Image display with CSS filters (grayscale)

## Running the App

```bash
# Start with Expo Go (recommended)
npx expo start --go --clear

# If issues occur
rm -rf node_modules .expo
npm install --legacy-peer-deps
npx expo start --go --clear
```

## Features

### Color Extraction
- **Hue Histogram**: Fast, good for game art with clear color regions
- **K-Means**: More accurate, slower, good for photos

### Luminosity Histogram
- Analyzes brightness distribution
- Shows contrast %, dark/mid/bright percentages
- Runs in background after color extraction (non-blocking)

### Value Check (Grayscale)
- Uses `expo-image` with CSS `filter: 'grayscale(1)'`
- Toggle button in MAIN EXTRACTION section

## Code Structure

- `/src/screens/HomeScreen.tsx` - Main UI
- `/src/lib/colorExtractor.ts` - Color extraction & histogram analysis
- `/src/store/paletteStore.ts` - Zustand state for colors
- `/src/store/themeStore.ts` - Dark/light theme state

## Common Issues

| Issue | Solution |
|-------|----------|
| Missing module errors | Check `package.json`, run `npm install --legacy-peer-deps` |
| Expo Go not opening | Use `npx expo start --go --clear` |
| Slow extraction | Histogram runs in background, colors show first |
| UI not updating | `git pull`, delete `node_modules`, reinstall |
