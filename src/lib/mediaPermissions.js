/**
 * Media permission helpers (E-703 light).
 */
export async function probeMediaPermissions() {
  const result = { camera: "unknown", microphone: "unknown" };
  try {
    if (!navigator.permissions?.query) return result;
    const cam = await navigator.permissions.query({ name: "camera" });
    result.camera = cam.state;
    const mic = await navigator.permissions.query({ name: "microphone" });
    result.microphone = mic.state;
  } catch {
    /* Safari often throws on camera permission query */
  }
  return result;
}

export function mediaModeFromPermissions(perms) {
  const camOk = perms.camera === "granted";
  const micOk = perms.microphone === "granted";
  if (camOk && micOk) return "full";
  if (micOk && !camOk) return "audio-only";
  if (!micOk && !camOk && perms.camera === "denied" && perms.microphone === "denied")
    return "view-only";
  return "prompt";
}
