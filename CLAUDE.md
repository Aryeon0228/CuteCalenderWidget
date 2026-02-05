# Claude Development Notes - Pixel Paw (GamePalette Mobile)

## Project Info

- **App Name**: Pixel Paw
- **Bundle ID**: com.studioaryeon.pixelpaw
- **Expo SDK**: 54
- **React**: 19.1.0
- **React Native**: 0.81.5
- **Node.js**: 20+ required (glob@13 needs Node 20 || >=22)

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

`.npmrc` file is configured with `legacy-peer-deps=true` for EAS builds.

### Key dependencies (must be in package.json)
- `@react-native-community/slider` - Color count slider
- `upng-js` - PNG decoding for color extraction
- `babel-preset-expo` - Required for Expo builds
- `expo-image` - Image display with CSS filters (grayscale)

## EAS Build - Critical Rules

### 1. package-lock.json MUST match package.json

EAS runs `npm ci`, which strictly follows the lockfile. If package.json is updated but the lockfile is stale, the build WILL fail.

**After changing ANY version in package.json:**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
# Then commit BOTH package.json AND package-lock.json
```

### 2. Verify package versions exist before writing to package.json

Always run `npm view <package>@<version> version` to confirm a version exists on npm before adding it. Never guess version numbers.

```bash
# CORRECT - verify first
npm view expo-image@3 version --json

# WRONG - guessing version numbers like ~3.1.11 (doesn't exist)
```

### 3. Node.js version must be set in eas.json

EAS defaults to Node 18 which is too old for SDK 54. Set it explicitly:
```json
{
  "build": {
    "base": {
      "node": "20.18.0"
    },
    "production": {
      "extends": "base"
    }
  }
}
```

### 4. New Architecture (newArchEnabled)

Set to `false` in app.json. Enabling it causes Yoga `StyleSizeLength` build errors with some dependencies.

## Running the App

```bash
# Start with Expo Go (recommended)
npx expo start --go --clear

# If issues occur
rm -rf node_modules .expo package-lock.json
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
- Applies grayscale to palette colors only (not original image)
- Toggle button below style filters

## Code Structure

- `/src/screens/HomeScreen.tsx` - Main UI
- `/src/lib/colorExtractor.ts` - Color extraction & histogram analysis
- `/src/lib/colorUtils.ts` - Color harmony, grayscale, adjustments
- `/src/store/paletteStore.ts` - Zustand state for colors
- `/src/store/themeStore.ts` - Dark/light theme state
- `/src/store/premiumStore.ts` - Premium/ad state

## Common Issues

| Issue | Solution |
|-------|----------|
| Missing module errors | Check `package.json`, run `npm install --legacy-peer-deps` |
| Expo Go not opening | Use `npx expo start --go --clear` |
| Slow extraction | Histogram runs in background, colors show first |
| UI not updating | `git pull`, delete `node_modules`, reinstall |
| EAS "Install dependencies" fail | Regenerate `package-lock.json` and commit it |
| EAS Node version error | Set `node: "20.18.0"` in `eas.json` build profile |
| Yoga StyleSizeLength error | Set `newArchEnabled: false` in `app.json` |
| npm ERESOLVE error | Use `--legacy-peer-deps`, check `.npmrc` exists |
