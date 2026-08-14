import Peer, { type MediaConnection } from "peerjs";

// STUN alone only gets two peers connected when at least one of them is on
// an easy (full-cone/restricted) NAT - which is most home/office networks,
// but not all (symmetric NAT, some mobile carriers, some corporate
// firewalls). Those pairs need a TURN relay, or the call just never
// connects with no obvious error - a common secondary cause of "can't hear
// each other" reports beyond outright signaling bugs. Set these three env
// vars to add one (e.g. from Twilio, Cloudflare, Xirsys, or metered.ca's
// free tier); without them this silently falls back to STUN-only.
const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

export function createPeer(): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          ...(turnUrl && turnUsername && turnCredential
            ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }]
            : []),
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
