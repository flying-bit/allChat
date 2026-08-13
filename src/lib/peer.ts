import Peer, { type MediaConnection } from "peerjs";

export function createPeer(): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });
    peer.once("open", () => resolve(peer));
    peer.once("error", (err) => reject(err));
  });
}

/**
 * Drives onLevel(0..1) from a MediaStream's audio energy, for speaking indicators.
 * Returns a cleanup function.
 */
export function watchAudioLevel(stream: MediaStream, onLevel: (level: number) => void) {
  const AudioContextCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextCtor();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;

  const tick = () => {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    onLevel(sum / data.length / 255);
    raf = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(raf);
    source.disconnect();
    analyser.disconnect();
    void audioCtx.close();
  };
}

export type { MediaConnection };
export default Peer;
