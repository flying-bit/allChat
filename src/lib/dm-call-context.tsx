"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { createPeer, type MediaConnection } from "@/lib/peer";
import type Peer from "@/lib/peer";
import {
  dmIdFor,
  startDmCall,
  acceptDmCall,
  endDmCall,
  listenDmCall,
  listenIncomingDmCall,
} from "@/lib/db";
import { DM_CALL_RING_TIMEOUT_MS } from "@/lib/constants";
import type { DmIncomingCallData } from "@/types";

// 1:1 DM voice/video calling over PeerJS. Deliberately a separate provider
// from voice-context.tsx (server voice channels): that one is a "join a
// room, mesh with up to 4 peers" model with no ringing; this one is a
// "call a specific person, they can accept/decline" model where exactly
// one remote peer is ever involved, and camera can be toggled mid-call.
//
// PeerJS's MediaConnection has no supported way to add/remove a track on
// an already-connected call (no onnegotiationneeded handling in its
// Negotiator - confirmed against node_modules/peerjs/dist/peerjs.js), so
// turning the camera on/off doesn't try to renegotiate the existing
// connection. Instead it closes the connection and immediately re-`call()`s
// the other side with a freshly built local stream; the other side's
// `peer.on("call", ...)` handler (always registered, for the life of the
// call) answers it and swaps in the new stream. That handler is therefore
// also what establishes the very first connection, once the callee places
// the initial call() on accept.
interface ActiveDmCall {
  dmId: string;
  otherUid: string;
  // Whichever of the two participants is the callee - endDmCall needs it
  // regardless of which side (caller or callee) is hanging up.
  calleeUid: string;
  direction: "outgoing" | "incoming";
  status: "ringing" | "active";
}

interface DmCallContextValue {
  incomingCall: DmIncomingCallData | null;
  activeCall: ActiveDmCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOn: boolean;
  cameraBusy: boolean;
  startCall: (otherUid: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const DmCallContext = createContext<DmCallContextValue | null>(null);

export function DmCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<DmIncomingCallData | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveDmCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const callConnRef = useRef<MediaConnection | null>(null);
  const activeCallRef = useRef<ActiveDmCall | null>(null);
  const incomingCallRef = useRef<DmIncomingCallData | null>(null);
  const userRef = useRef(user);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const registerActiveCall = useCallback((call: MediaConnection) => {
    callConnRef.current?.close();
    callConnRef.current = call;
    call.on("stream", (stream) => setRemoteStream(stream));
    const clear = () => {
      if (callConnRef.current === call) {
        callConnRef.current = null;
        setRemoteStream(null);
      }
    };
    call.on("close", clear);
    call.on("error", clear);
  }, []);

  const teardownCallLocal = useCallback(() => {
    callConnRef.current?.close();
    callConnRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peerRef.current?.destroy();
    peerRef.current = null;
    remotePeerIdRef.current = null;
    setActiveCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOn(false);
  }, []);

  const hangUp = useCallback(() => {
    const call = activeCallRef.current;
    if (call) void endDmCall(call.dmId, call.calleeUid);
    teardownCallLocal();
  }, [teardownCallLocal]);

  const declineCall = useCallback(() => {
    const incoming = incomingCallRef.current;
    const uid = userRef.current?.uid;
    if (!incoming || !uid) return;
    void endDmCall(incoming.dmId, uid);
    setIncomingCall(null);
  }, []);

  // Global "is someone calling me" listener - lives here (not on the DM
  // page) so it fires no matter what the user is currently looking at.
  useEffect(() => {
    if (!user) return;
    return listenIncomingDmCall(user.uid, (call) => {
      if (call && activeCallRef.current) {
        // Already on a call - treat as busy instead of layering a second
        // ring on top of the active call UI.
        void endDmCall(call.dmId, user.uid);
        return;
      }
      setIncomingCall(call);
    });
  }, [user]);

  // Tracks the shared call record for the whole lifetime of an active call:
  // lets the caller learn the callee's peerId once they answer, and lets
  // either side detect the other hanging up (the node disappearing).
  useEffect(() => {
    const dmId = activeCall?.dmId;
    if (!dmId) return;
    return listenDmCall(dmId, (call) => {
      if (!call) {
        teardownCallLocal();
        return;
      }
      if (call.status === "active" && call.calleePeerId && !remotePeerIdRef.current) {
        remotePeerIdRef.current = call.calleePeerId;
        setActiveCall((prev) => (prev && prev.dmId === dmId ? { ...prev, status: "active" } : prev));
      }
    });
  }, [activeCall?.dmId, teardownCallLocal]);

  // Give up on an unanswered outgoing call after a while instead of
  // "Calling..." sitting there forever - there's no server-side timeout.
  useEffect(() => {
    if (!activeCall || activeCall.direction !== "outgoing" || activeCall.status !== "ringing") return;
    const timer = window.setTimeout(() => {
      void endDmCall(activeCall.dmId, activeCall.calleeUid);
      teardownCallLocal();
    }, DM_CALL_RING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [activeCall, teardownCallLocal]);

  // Leave any call in progress if the provider itself unmounts (sign out).
  useEffect(() => {
    return () => {
      const call = activeCallRef.current;
      if (call) void endDmCall(call.dmId, call.calleeUid);
      teardownCallLocal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = useCallback(
    async (otherUid: string) => {
      if (!user || activeCallRef.current) return;
      const dmId = dmIdFor(user.uid, otherUid);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert("Couldn't access the microphone. Check your browser permissions.");
        return;
      }
      let peer: Peer;
      try {
        peer = await createPeer();
      } catch {
        alert("Couldn't connect to the voice server, try again.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      peer.on("call", (call) => {
        call.answer(localStreamRef.current ?? undefined);
        registerActiveCall(call);
      });
      peerRef.current = peer;
      localStreamRef.current = stream;
      remotePeerIdRef.current = null;
      setLocalStream(stream);
      setActiveCall({ dmId, otherUid, calleeUid: otherUid, direction: "outgoing", status: "ringing" });
      await startDmCall(dmId, user.uid, otherUid, peer.id);
    },
    [user, registerActiveCall]
  );

  const acceptCall = useCallback(async () => {
    const incoming = incomingCallRef.current;
    if (!incoming || !user) return;
    setIncomingCall(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Couldn't access the microphone. Check your browser permissions.");
      void endDmCall(incoming.dmId, user.uid);
      return;
    }
    let peer: Peer;
    try {
      peer = await createPeer();
    } catch {
      alert("Couldn't connect to the voice server, try again.");
      stream.getTracks().forEach((t) => t.stop());
      void endDmCall(incoming.dmId, user.uid);
      return;
    }
    peer.on("call", (call) => {
      call.answer(localStreamRef.current ?? undefined);
      registerActiveCall(call);
    });
    peerRef.current = peer;
    localStreamRef.current = stream;
    remotePeerIdRef.current = incoming.callerPeerId;
    setLocalStream(stream);
    setActiveCall({
      dmId: incoming.dmId,
      otherUid: incoming.callerId,
      calleeUid: user.uid,
      direction: "incoming",
      status: "active",
    });
    try {
      // Can fail if the caller cancelled in the instant between the ring
      // showing up and this accept landing - dmCalls/{dmId} is gone by
      // then, so the rules reject this as an update to a nonexistent node.
      await acceptDmCall(incoming.dmId, user.uid, peer.id);
    } catch {
      alert("The call has ended.");
      teardownCallLocal();
      return;
    }
    const call = peer.call(incoming.callerPeerId, stream);
    registerActiveCall(call);
  }, [user, registerActiveCall, teardownCallLocal]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setMuted((prev) => {
      const next = !prev;
      stream.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    const oldStream = localStreamRef.current;
    const peer = peerRef.current;
    const remotePeerId = remotePeerIdRef.current;
    if (!oldStream || !peer || !remotePeerId || cameraBusy) return;
    setCameraBusy(true);
    try {
      let newStream: MediaStream;
      if (!cameraOn) {
        let videoStream: MediaStream;
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch {
          alert("Couldn't access the camera. Check your browser permissions.");
          return;
        }
        newStream = new MediaStream([...oldStream.getAudioTracks(), ...videoStream.getVideoTracks()]);
      } else {
        oldStream.getVideoTracks().forEach((t) => t.stop());
        newStream = new MediaStream(oldStream.getAudioTracks());
      }
      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setCameraOn(!cameraOn);
      const call = peer.call(remotePeerId, newStream);
      registerActiveCall(call);
    } finally {
      setCameraBusy(false);
    }
  }, [cameraOn, cameraBusy, registerActiveCall]);

  const value: DmCallContextValue = {
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    muted,
    cameraOn,
    cameraBusy,
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
  };

  return <DmCallContext.Provider value={value}>{children}</DmCallContext.Provider>;
}

export function useDmCall() {
  const ctx = useContext(DmCallContext);
  if (!ctx) throw new Error("useDmCall must be used within DmCallProvider");
  return ctx;
}
