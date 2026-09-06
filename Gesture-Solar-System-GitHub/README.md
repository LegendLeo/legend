# Gesture Solar System

An interactive React + TypeScript + Vite observatory for exploring a 3D solar system with hand gestures.

部署到 GitHub Pages：参阅 [中文部署说明](DEPLOY.md)。仓库内已包含自动构建和发布工作流。

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (the current workspace is running at `http://localhost:5173/`). The interface is in Simplified Chinese. Click `开启` in the camera panel and allow camera access when the browser asks. The hand model and WASM runtime are bundled under `public/`, so hand tracking does not depend on a CDN at runtime. If access is declined, mouse orbit/scroll and the keyboard shortcuts remain available.

## Controls

- `Space` pause/resume, `R` reset, `1`-`8` focus a planet, `9` focus the Sun
- `+` / `-` change time flow, `L` toggle orbit lines, `H` open the gesture guide
- Drag the scene to orbit and scroll to zoom
- `Escape` returns to free exploration; the mode button also switches between free and focused views

## Gesture controls

| Gesture | Action |
| --- | --- |
| One open palm held still briefly | Pause/resume once per presentation |
| Open palm moving slowly sideways/up/down | Rotate the camera or adjust elevation |
| Fist held briefly | Reset camera, time flow, and selection |
| Thumb/index pinch, then change the gap | Spread to zoom in, close to zoom out |
| One index finger extended | Move the mirrored cursor; dwell on a planet to select it |
| Two open hands | Spread to increase time flow; bring together to decrease it |
| Quick horizontal open-palm swipe | Cycle to the previous/next planet |
| Index and middle fingers extended | Toggle orbit lines, labels, and grid together |

Two-hand time control takes priority over single-palm commands. Both hands have their own skeleton and gesture readout. Release a discrete gesture before repeating it; brief tracking gaps preserve the latch to avoid accidental toggles. Moving hands and changing hand count recalibrate the motion baseline. The hand button pauses gesture commands without stopping video; the crosshair button recalibrates tracking.

The percentage represents geometric and temporal gesture stability, not MediaPipe's left/right classification score. Gesture tracking depends on the hands being visible, sufficiently lit, and separated in the camera image.

## Verification

`npm test` runs recorded/synthetic landmark regressions with Node.js 22.18+ (or Node.js 24). Browser tests in `work/` exercise the real scene controls and camera lifecycle. Local model tests use public MediaPipe image fixtures rather than the physical camera.

## Camera troubleshooting

Camera capture is released on pause, startup failure, tracking failure, and page exit. Use `重试` after an error to start a fresh session.

- `NotReadableError` means the device did not start. Close other tabs or apps using the camera, then retry. Device, driver, or Windows privacy settings can also cause this error.
- `NotAllowedError` means access was blocked. Allow camera access in the site's permissions and Windows Settings > Privacy & security > Camera.
- Model errors are separate from camera permissions. The local model is reloaded on retry, after the previous capture has been released.

For a previous page that left the camera active, close that tab before reopening the localhost URL in a single browser tab.

Hand inference uses the CPU to reduce competition with the 3D scene for GPU resources. Two-hand detection remains enabled.

The scene and camera have independent error recovery. A scene rendering error or WebGL context loss releases the camera and displays `三维场景已暂停`; use `重试` to rebuild the scene, then start the camera again. `摄像头模块已暂停` restores only the camera controls. Unexpected application render errors display a recovery screen instead of clearing the page. Expand `错误详情` to inspect the reported exception.

If the browser itself crashes and no recovery screen appears, reopen the localhost page. Application recovery handles React render errors and WebGL context-loss events; browser process crashes require restarting the page.

An `insertBefore` error during camera startup can occur when a browser translator replaces text nodes used by React. The page opts out of automatic translation and keeps dynamic button icons and text in separate elements. After updating an already translated page, choose `Show original` in the browser translation menu, then reload with `Ctrl+F5`. Camera permissions do not resolve this DOM error.
