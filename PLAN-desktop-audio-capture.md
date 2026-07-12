# Implementation Plan: Desktop Audio Capture

## Summary

Add a `"desktop"` live input mode that captures system/desktop audio via the Screen Capture API (`getDisplayMedia`). This mirrors the existing `"microphone"` mode — both produce a `MediaStream` wired into the same `Player` audio graph — so the implementation follows established patterns exactly.

---

## Prerequisites / Browser Support

| Browser | Desktop audio | Notes |
|---------|--------------|-------|
| Chrome / Edge 105+ | Full | Tab, window, or system audio via `systemAudio: "include"` |
| Firefox | Partial | Tab audio only |
| Safari | None | No audio track from `getDisplayMedia` |

The feature should degrade gracefully: hide/disable the option when `getDisplayMedia` is unavailable.

---

## Files to Modify (in dependency order)

### 1. `src/lib/audio/Player.ts`

**Goal:** Extend `InputMode` and add a `useDesktopAudio` method.

| Change | Details |
|--------|---------|
| Line 8 — Expand `InputMode` type | `export type InputMode = "file" \| "microphone" \| "midi" \| "desktop";` |
| New method `useDesktopAudio` | Identical signature and body to `useMicrophone`, but sets `this.mode = "desktop"`. |
| `play()` method (~line 212) | Add a `mode === "desktop"` branch — copy the `mode === "microphone"` branch exactly (they share the same `streamSource` + `liveActive` logic). |
| `pause()` method (~line 250) | Add a `mode === "desktop"` branch — copy the `mode === "microphone"` branch. |
| `stop()` method (~line 276) | Change the condition from `mode === "microphone" \|\| mode === "midi"` to `mode === "microphone" \|\| mode === "desktop" \|\| mode === "midi"`. |
| `hasAudio()` (~line 301) | Add `\|\| this.mode === "desktop"` alongside `"microphone"`. |
| `isLive()` (~line 379) | Add `\|\| this.mode === "desktop"`. |
| `getCapabilities()` (~line 393) | `usesVolume` condition: add `this.mode !== "desktop"` is NOT excluded (desktop should use volume/gain like mic). No change needed here unless you want to suppress volume for desktop — leave as-is. |

**Reference implementation for the new method:**

```ts
useDesktopAudio(
  stream: MediaStream,
  analyzerNode: AudioNode,
  sourceLabel = "Desktop Audio",
) {
  this.clearSource();

  this.mode = "desktop";
  this.sourceLabel = sourceLabel;
  this.stream = stream;
  this.streamAnalyzer = analyzerNode;
  this.streamSource = this.audioContext.createMediaStreamSource(stream);
  this.reconnectLiveNodes();
  this.liveActive = true;

  this.emit("source-change");
  this.emit("play");
  this.emit("playback-change");
}
```

---

### 2. `src/lib/types.ts`

**Goal:** Add `"desktop"` to the `inputMode` field in `RenderFrameData`.

| Change | Details |
|--------|---------|
| Line 16 | `inputMode?: "file" \| "microphone" \| "midi" \| "desktop" \| null;` |

---

### 3. `src/app/actions/audio.ts`

**Goal:** Add `"desktop"` to all relevant union types, add `desktopSupported` state, and export a `connectDesktopAudio()` action.

#### 3a. Update types and state

| Change | Details |
|--------|---------|
| `AudioState.liveInputMode` (line 16) | `"microphone" \| "midi" \| "desktop"` |
| `AudioState.mode` (line 17) | `"file" \| "microphone" \| "midi" \| "desktop"` |
| Add field `AudioState.desktopAudioSupported` | `boolean` |
| `initialState` (line 34) | Add `desktopAudioSupported: false` |
| `updateAudioState` type (line 68) | Update the `mode` discriminant to include `"desktop"` |
| `resetSourceState` parameter (line 74) | Update to include `"desktop"` |

#### 3b. Add `connectDesktopAudio` action (new exported function)

Place it after `connectMicrophone` (~line 403). Pattern follows `connectMicrophone` closely:

```ts
export async function connectDesktopAudio() {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getDisplayMedia
  ) {
    raiseError("Desktop audio capture is not supported in this browser.");
    return false;
  }

  updateAudioState({ loading: true });
  detachMidiInput();
  player.clearSource();

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // required by spec
      audio: true,
      // @ts-expect-error -- systemAudio is Chrome 105+ only
      systemAudio: "include",
    });

    // Drop video tracks — we only need the audio
    for (const track of stream.getVideoTracks()) {
      track.stop();
    }

    if (stream.getAudioTracks().length === 0) {
      throw new Error(
        "No audio track was shared. Select a source that includes audio.",
      );
    }

    // Listen for user stopping the share via the browser chrome
    stream.getAudioTracks()[0].addEventListener("ended", () => {
      setLiveModeEnabled(false);
    });

    const label = stream.getAudioTracks()[0]?.label || "Desktop Audio";
    player.useDesktopAudio(stream, analyzer.analyzer, label);
    player.setInputGain(audioStore.getState().liveInputGain / 100);

    appStore.setState({
      statusText: trimChars(`Live: ${label}`),
    });

    updateAudioState({
      liveModeEnabled: true,
      liveInputMode: "desktop",
      mode: "desktop",
      file: "",
      source: null,
      sourceLabel: label,
      duration: 0,
      tags: null,
      loading: false,
    });

    return true;
  } catch (error) {
    // User cancelled the picker — not a real error
    if (error instanceof Error && error.name === "NotAllowedError") {
      updateAudioState({ loading: false });
      return false;
    }

    raiseError("Failed to capture desktop audio.", error);
    resetSourceState("desktop");
    return false;
  }
}
```

#### 3c. Update `refreshInputOptions`

Add a desktop-audio support check:

```ts
export async function refreshInputOptions() {
  await refreshMicrophoneDevices();
  await syncMidiInputs();

  const desktopAudioSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia;

  updateAudioState({ desktopAudioSupported });
}
```

#### 3d. Update `setLiveInputMode`

Change the parameter type to `"microphone" | "midi" | "desktop"`.

#### 3e. Update `setLiveModeEnabled`

In the `enabled === true` branch (~line 488–496), extend the status text logic:

```ts
appStore.setState({
  statusText:
    liveInputMode === "microphone"
      ? "Input mode: choose a microphone"
      : liveInputMode === "desktop"
        ? "Input mode: desktop audio"
        : "Input mode: choose a MIDI input",
});
```

---

### 4. `src/app/components/player/LiveModePanel.tsx`

**Goal:** Add `"desktop"` to the input mode selector and show a "Capture" button (no device list needed — the browser picker handles source selection).

| Change | Details |
|--------|---------|
| Import `connectDesktopAudio` from `@/app/actions/audio` | |
| Add to `liveInputItems` array | `{ id: "desktop", label: "Desktop Audio" }` |
| Add a third conditional branch for `liveInputMode === "desktop"` | Render a "Capture" button that calls `connectDesktopAudio()` |
| Update `setLiveInputMode` call type cast | `as "microphone" \| "midi" \| "desktop"` |

**Desktop branch JSX:**

```tsx
{liveInputMode === "desktop" && (
  <button
    type="button"
    className="inline-flex h-8 items-center rounded border border-input bg-input/30 px-2.5 text-sm text-neutral-300 shadow-xs transition-colors hover:bg-input/50 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-50"
    disabled={loading}
    onClick={() => void connectDesktopAudio()}
  >
    Capture Desktop Audio
  </button>
)}
```

---

### 5. `src/app/components/player/LiveInputButton.tsx`

**Goal:** Support the desktop mode alongside microphone.

| Change | Details |
|--------|---------|
| Import `connectDesktopAudio` | |
| Add state selector for `desktopAudioSupported` | |
| Change icon dynamically | Show `Monitor` (from lucide-react) when `liveInputMode === "desktop"`, else `Mic` |
| Update `isMicrophoneMode` → rename to `isStreamMode` | `const isStreamMode = liveInputMode === "microphone" \|\| liveInputMode === "desktop";` |
| Update `hasSource` check | `player.getMode() === "microphone" \|\| player.getMode() === "desktop"` |
| Update `handleClick` | If `liveInputMode === "desktop"` and no source: call `connectDesktopAudio()` instead of `connectMicrophone()` |
| Hide the button when `liveInputMode === "midi"` (unchanged) | |

---

### 6. `src/app/components/player/LiveInputGain.tsx`

**Goal:** Show the gain slider for desktop audio too (it uses the same `inputGain` node).

| Change | Details |
|--------|---------|
| Line 10 — condition | Change `liveInputMode !== "microphone"` to `liveInputMode !== "microphone" && liveInputMode !== "desktop"` (i.e. only hide for MIDI). |

---

### 7. `src/app/components/player/PlayButtons.tsx`

**Goal:** Add tooltip text for the desktop mode.

| Change | Details |
|--------|---------|
| ~Line 66–70 — `playTitle` ternary | Add `mode === "desktop" ? "Capture desktop audio" :` before the `mode === "midi"` branch. |

---

### 8. `src/app/components/player/ProgressControl.tsx`

**Goal:** Add status text for desktop mode in the live-mode progress area.

| Change | Details |
|--------|---------|
| ~Line 66–70 — `liveText` ternary | Add: `mode === "desktop" ? sourceLabel \|\| "Live desktop audio" :` between the microphone and midi branches. |

---

### 9. `src/app/components/player/VolumeControl.tsx`

**Goal:** Volume control visibility for desktop mode.

| Change | Details |
|--------|---------|
| ~Line 25 — condition | Change `mode === "microphone" \|\| mode === "midi"` to `mode === "microphone" \|\| mode === "desktop" \|\| mode === "midi"` |

This hides the master volume during desktop capture (same rationale as microphone — volume would feed back). If you want to keep volume visible, skip this change.

---

### 10. `src/app/components/player/LiveModeToggle.tsx`

**No changes required.** This component only toggles `liveModeEnabled` on/off and doesn't reference specific modes.

---

## TypeScript Considerations

`getDisplayMedia` with `systemAudio` is not yet in all TS lib typings. Add a one-line ambient declaration in a new or existing `*.d.ts` file:

**File:** `src/types/media.d.ts` (new)

```ts
interface DisplayMediaStreamOptions {
  systemAudio?: "include" | "exclude";
}
```

Or use `@ts-expect-error` inline (shown in the action code above).

---

## Testing Checklist

1. [ ] Open app in Chrome. Click Live mode → select "Desktop Audio" → click "Capture Desktop Audio".
2. [ ] Browser picker appears. Choose a tab/screen with audio playing.
3. [ ] Confirm the analyser/visualizer reacts to the desktop audio.
4. [ ] Input gain slider appears and adjusts level.
5. [ ] Clicking Stop ends the capture. Clicking the browser's "Stop sharing" badge also ends it.
6. [ ] Switching to Microphone mode while desktop is active cleans up the stream.
7. [ ] In Firefox: confirm it works for tab audio at minimum.
8. [ ] In Safari: confirm the "Desktop Audio" option is hidden or disabled (feature detection).
9. [ ] Confirm no regressions: file playback, microphone, and MIDI modes still work.

---

## Implementation Order

1. `src/lib/types.ts` — trivial type expansion
2. `src/lib/audio/Player.ts` — add `useDesktopAudio`, expand `InputMode`, update `play/pause/stop/isLive/hasAudio`
3. `src/app/actions/audio.ts` — state fields, `connectDesktopAudio`, update helpers
4. `src/types/media.d.ts` — ambient type (if needed)
5. `src/app/components/player/LiveModePanel.tsx` — dropdown option + capture button
6. `src/app/components/player/LiveInputButton.tsx` — icon + click handler
7. `src/app/components/player/LiveInputGain.tsx` — show for desktop
8. `src/app/components/player/PlayButtons.tsx` — tooltip text
9. `src/app/components/player/ProgressControl.tsx` — status text
10. `src/app/components/player/VolumeControl.tsx` — visibility
