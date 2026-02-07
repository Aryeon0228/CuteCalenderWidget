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

## EAS Build & App Store 제출

### iOS 빌드 번호 (IMPORTANT!)

App Store에 제출할 때마다 **buildNumber를 올려야 함**. 같은 번호로 두 번 제출 불가.

```json
// app.json
"ios": {
  "buildNumber": "8"  // 제출할 때마다 +1 (현재 8)
}
```

### 빌드 & 제출 명령어

```bash
# iOS 빌드 후 제출
eas build --platform ios
eas submit --platform ios

# Android 빌드 후 제출
eas build --platform android
eas submit --platform android

# 둘 다
eas build --platform all
```

### 빌드 전 필수 체크리스트 (IMPORTANT!)

**EAS는 GitHub 리포 기준으로 빌드함. 로컬 파일이 아님!**

```bash
# 빌드 전 반드시 이 순서로:
1. GitHub에서 PR 머지 확인
2. git stash                     # 로컬 변경사항 임시 저장 (unstaged changes 방지)
3. git pull origin main --rebase # 최신 코드 받기 (divergent branches 방지)
4. git stash drop                # stash 버리기 (origin/main이 정답이므로 pop 하지 말 것!)
5. grep buildNumber app.json     # 번호 확인
6. eas build --platform ios      # 빌드
7. eas submit --platform ios     # 제출
```

### 5. appVersionSource는 반드시 "local" (IMPORTANT!)

`eas.json`의 `appVersionSource`가 `"remote"`이면 **app.json의 buildNumber를 무시**하고 EAS 서버 자체 번호를 사용함.
app.json에서 아무리 번호를 올려도 반영 안 되는 원인.

```json
// eas.json - 반드시 "local"이어야 함
{
  "cli": {
    "appVersionSource": "local"
  }
}
```

| appVersionSource | 동작 |
|-----------------|------|
| `"local"` | app.json의 `buildNumber` 사용 (우리 방식) |
| `"remote"` | EAS 서버가 자체 관리하는 번호 사용 (app.json 무시!) |

### 흔한 실수

| 실수 | 해결 |
|------|------|
| "Already submitted this build" | `app.json`에서 `ios.buildNumber` 올리고 **다시 빌드** |
| 빌드는 했는데 번호 안 올림 | 번호 올린 후 **새로 빌드**해야 함 (submit만 다시 하면 안 됨) |
| 이전 버전으로 빌드됨 | `git pull origin main` 안 해서 로컬이 옛날 코드. **반드시 pull 먼저!** |
| git pull 시 divergent branches | `git pull origin main --rebase` 사용 |
| rebase 시 unstaged changes | `git stash && git pull origin main --rebase && git stash pop` |
| stash pop 후 app.json 충돌 | `git checkout origin/main -- app.json` (--theirs 쓰면 stash 버전 들어감!) |
| git 충돌로 app.json 꼬임 | `git checkout origin/main -- app.json` 후 번호 확인 |
| buildNumber 올렸는데 빌드에 반영 안 됨 | `eas.json`의 `appVersionSource`가 `"remote"`인지 확인. `"local"`로 변경 |

### 브랜치 정리 (주기적으로!)

```bash
# 머지된 로컬 브랜치 삭제 + 원격 추적 정리
git checkout main && git branch | grep -v "main" | xargs git branch -D && git remote prune origin
```

### slider iOS 빌드 에러

`@react-native-community/slider@5.0.1`은 iOS old arch에서 빌드 에러 발생.
`patch-package`로 패치 적용됨 (`patches/` 폴더).

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
| Expo Go 캐시로 구버전 표시 | `npx expo start --go --clear`, Expo Go 앱 삭제 후 재설치 |
| PR "nothing to compare" | 이미 머지된 상태. `git log --oneline origin/main` 으로 확인 |
