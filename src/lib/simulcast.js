/**
 * Simulcast / bandwidth helpers for mesh (P2P) publishers.
 */

/** Default three-layer video encodings (suitable for addTransceiver sendEncodings). */
export function defaultSimulcastEncodings() {
  return [
    { rid: "q", scaleResolutionDownBy: 4, maxBitrate: 150_000 },
    { rid: "h", scaleResolutionDownBy: 2, maxBitrate: 500_000 },
    { rid: "f", maxBitrate: 1_200_000 },
  ];
}

/**
 * Apply degradation: prefer lower layer when packet loss high.
 * @param {RTCRtpSender} sender
 * @param {'high'|'medium'|'low'} tier
 */
export async function setSenderBandwidthTier(sender, tier = "high") {
  if (!sender || typeof sender.getParameters !== "function") return;
  const params = sender.getParameters();
  if (!params.encodings || !params.encodings.length) {
    params.encodings = [{}];
  }
  const maxByTier = {
    low: 200_000,
    medium: 600_000,
    high: 1_500_000,
  };
  const max = maxByTier[tier] || maxByTier.high;
  params.encodings = params.encodings.map((enc, i) => ({
    ...enc,
    active: true,
    maxBitrate: Math.round(max / (i + 1)),
  }));
  try {
    await sender.setParameters(params);
  } catch {
    /* some browsers reject mid-call changes */
  }
}

/**
 * Prefer adding video transceiver with simulcast when creating offers (mesh path).
 * @param {RTCPeerConnection} pc
 * @param {MediaStreamTrack} track
 */
export function addSimulcastVideoTrack(pc, track) {
  if (!pc || !track) return null;
  try {
    return pc.addTransceiver(track, {
      direction: "sendrecv",
      sendEncodings: defaultSimulcastEncodings(),
    });
  } catch {
    return pc.addTrack(track);
  }
}
