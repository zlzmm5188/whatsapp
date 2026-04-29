import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import {
  SocketEvents,
  type CallAcceptPayload,
  type CallCancelPayload,
  type CallEndPayload,
  type CallIcePayload,
  type CallKind,
  type CallRejectPayload,
  type CallSdpPayload,
  type IncomingCallPayload,
  type PublicUser,
} from "@im/shared";
import { getSocket } from "../api/socket";
import { haptic } from "../utils/haptics";

// Status machine for a 1:1 call.
//   idle      → no call in progress
//   outgoing  → caller dialed, waiting for callee accept
//   incoming  → callee is being rung
//   connecting→ both sides accepted; SDP/ICE exchange in progress
//   active    → media flowing
type CallStatus =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connecting"
  | "active";

// Public ICE servers — Google STUN + metered openrelay TURN. The TURN
// credentials are public and rate-limited; for production traffic you'd
// swap for a paid plan or your own coturn.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

function genCallId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const useCallStore = defineStore("call", () => {
  const status = ref<CallStatus>("idle");
  const callId = ref<string | null>(null);
  const peer = ref<PublicUser | null>(null);
  const kind = ref<CallKind>("audio");
  // True if this client is the caller (made the offer); false if callee.
  const isCaller = ref<boolean>(false);
  // UI toggles
  const muted = ref<boolean>(false);
  const cameraOff = ref<boolean>(false);
  // Connection start time (when status flips to "active") for elapsed timer.
  const startedAt = ref<number | null>(null);
  // Last error message to surface in UI.
  const errorMessage = ref<string | null>(null);

  // Non-reactive (shallowRef so Vue doesn't try to deeply track media):
  const localStream = shallowRef<MediaStream | null>(null);
  const remoteStream = shallowRef<MediaStream | null>(null);
  const pc = shallowRef<RTCPeerConnection | null>(null);
  // ICE candidates that arrive before remoteDescription is set must be
  // queued and applied once we have the remote SDP, otherwise they'll
  // be rejected with InvalidStateError.
  const pendingIce = shallowRef<RTCIceCandidateInit[]>([]);
  // Have we registered the socket listeners yet? (idempotent)
  let listenersBound = false;
  // Outgoing-call ringing timeout (auto-cancel after N seconds).
  let ringTimeout: ReturnType<typeof setTimeout> | null = null;

  const inCall = computed(() => status.value !== "idle");

  function bindSocketListeners(): void {
    if (listenersBound) return;
    const s = getSocket();
    if (!s) return;
    listenersBound = true;

    s.on(SocketEvents.CallInvite, (payload: IncomingCallPayload) => {
      onIncomingInvite(payload);
    });
    s.on(SocketEvents.CallAccept, (payload: CallAcceptPayload) => {
      void onAcceptFromCallee(payload);
    });
    s.on(SocketEvents.CallReject, (payload: CallRejectPayload) => {
      onRejectFromCallee(payload);
    });
    s.on(SocketEvents.CallCancel, (payload: CallCancelPayload) => {
      onCancelFromCaller(payload);
    });
    s.on(SocketEvents.CallEnd, (payload: CallEndPayload) => {
      onEndFromPeer(payload);
    });
    s.on(SocketEvents.CallSdp, (payload: CallSdpPayload) => {
      void onRemoteSdp(payload);
    });
    s.on(SocketEvents.CallIce, (payload: CallIcePayload) => {
      void onRemoteIce(payload);
    });
    s.on(
      SocketEvents.CallBusy,
      (payload: { callId: string; peerId: string }) => {
        if (payload.callId === callId.value) {
          errorMessage.value = "对方正在通话中";
          haptic("warn");
          teardown(false);
        }
      },
    );
  }

  function reset(): void {
    status.value = "idle";
    callId.value = null;
    peer.value = null;
    kind.value = "audio";
    isCaller.value = false;
    muted.value = false;
    cameraOff.value = false;
    startedAt.value = null;
    pendingIce.value = [];
    if (ringTimeout) {
      clearTimeout(ringTimeout);
      ringTimeout = null;
    }
  }

  function teardown(notifyPeer: boolean): void {
    if (notifyPeer && callId.value && peer.value) {
      const s = getSocket();
      if (s) {
        if (status.value === "outgoing") {
          s.emit(SocketEvents.CallCancel, {
            callId: callId.value,
            peerId: peer.value.id,
          });
        } else if (status.value === "incoming") {
          s.emit(SocketEvents.CallReject, {
            callId: callId.value,
            peerId: peer.value.id,
            reason: "declined",
          });
        } else if (
          status.value === "connecting" ||
          status.value === "active"
        ) {
          s.emit(SocketEvents.CallEnd, {
            callId: callId.value,
            peerId: peer.value.id,
          });
        }
      }
    }

    if (pc.value) {
      try {
        pc.value.ontrack = null;
        pc.value.onicecandidate = null;
        pc.value.onconnectionstatechange = null;
        pc.value.close();
      } catch {
        // ignore
      }
      pc.value = null;
    }
    if (localStream.value) {
      for (const t of localStream.value.getTracks()) t.stop();
      localStream.value = null;
    }
    remoteStream.value = null;
    reset();
  }

  function ensurePeerConnection(): RTCPeerConnection {
    if (pc.value) return pc.value;
    const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    conn.onicecandidate = (e) => {
      if (!e.candidate) return;
      const s = getSocket();
      if (!s || !callId.value || !peer.value) return;
      s.emit(SocketEvents.CallIce, {
        callId: callId.value,
        peerId: peer.value.id,
        candidate: e.candidate.toJSON(),
      });
    };
    conn.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) {
        remoteStream.value = stream;
      } else {
        // Fallback: build a stream from the track.
        const ms = remoteStream.value ?? new MediaStream();
        ms.addTrack(e.track);
        remoteStream.value = ms;
      }
    };
    conn.onconnectionstatechange = () => {
      const st = conn.connectionState;
      if (st === "connected") {
        if (status.value !== "active") {
          status.value = "active";
          startedAt.value = Date.now();
          haptic("success");
        }
      } else if (st === "failed" || st === "disconnected" || st === "closed") {
        if (status.value === "connecting" || status.value === "active") {
          errorMessage.value = "连接断开";
          teardown(true);
        }
      }
    };
    pc.value = conn;
    return conn;
  }

  async function getLocalMedia(k: CallKind): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video:
        k === "video"
          ? { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: "user" }
          : false,
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  // Caller flow ----------------------------------------------------------
  async function invite(peerUser: PublicUser, k: CallKind): Promise<void> {
    if (status.value !== "idle") return;
    bindSocketListeners();
    const s = getSocket();
    if (!s) {
      errorMessage.value = "未连接到服务器";
      return;
    }
    errorMessage.value = null;
    callId.value = genCallId();
    peer.value = peerUser;
    kind.value = k;
    isCaller.value = true;
    status.value = "outgoing";
    haptic("tap");

    try {
      localStream.value = await getLocalMedia(k);
    } catch (err) {
      errorMessage.value =
        err instanceof Error ? `无法访问设备：${err.message}` : "无法访问设备";
      reset();
      return;
    }

    s.emit(
      SocketEvents.CallInvite,
      {
        callId: callId.value,
        peerId: peerUser.id,
        kind: k,
      },
      (resp: { ok: boolean; error?: string } | undefined) => {
        if (!resp?.ok) {
          errorMessage.value = resp?.error ?? "呼叫失败";
          teardown(false);
        }
      },
    );

    // Auto-cancel if no answer in 45s.
    ringTimeout = setTimeout(() => {
      if (status.value === "outgoing") {
        errorMessage.value = "对方未接听";
        teardown(true);
      }
    }, 45000);
  }

  // Callee flow ----------------------------------------------------------
  function onIncomingInvite(payload: IncomingCallPayload): void {
    if (status.value !== "idle") {
      // Already in a call — auto-reject. The server also guards against
      // this but client-side double-check avoids a race during teardown.
      const s = getSocket();
      if (s) {
        s.emit(SocketEvents.CallReject, {
          callId: payload.callId,
          peerId: payload.fromUser.id,
          reason: "busy",
        });
      }
      return;
    }
    callId.value = payload.callId;
    peer.value = payload.fromUser;
    kind.value = payload.kind;
    isCaller.value = false;
    status.value = "incoming";
    haptic("tap");
  }

  async function accept(): Promise<void> {
    if (status.value !== "incoming" || !callId.value || !peer.value) return;
    const s = getSocket();
    if (!s) return;
    haptic("tap");
    try {
      localStream.value = await getLocalMedia(kind.value);
    } catch (err) {
      errorMessage.value =
        err instanceof Error ? `无法访问设备：${err.message}` : "无法访问设备";
      teardown(true);
      return;
    }
    status.value = "connecting";
    s.emit(SocketEvents.CallAccept, {
      callId: callId.value,
      peerId: peer.value.id,
    });
    // The actual offer comes from the caller next. We don't create the
    // PC yet — wait for the SDP offer to know what to answer.
  }

  function reject(): void {
    if (status.value !== "incoming") return;
    haptic("warn");
    teardown(true);
  }

  // Both ----------------------------------------------------------------
  function hangup(): void {
    if (status.value === "idle") return;
    haptic("warn");
    teardown(true);
  }

  function toggleMute(): void {
    if (!localStream.value) return;
    muted.value = !muted.value;
    for (const t of localStream.value.getAudioTracks()) {
      t.enabled = !muted.value;
    }
    haptic("tap");
  }

  function toggleCamera(): void {
    if (!localStream.value) return;
    cameraOff.value = !cameraOff.value;
    for (const t of localStream.value.getVideoTracks()) {
      t.enabled = !cameraOff.value;
    }
    haptic("tap");
  }

  // Server -> caller: callee accepted. Caller now creates the PC, attaches
  // its local tracks, builds an offer, and sends it.
  async function onAcceptFromCallee(_payload: CallAcceptPayload): Promise<void> {
    if (!isCaller.value) return;
    if (status.value !== "outgoing") return;
    if (ringTimeout) {
      clearTimeout(ringTimeout);
      ringTimeout = null;
    }
    status.value = "connecting";
    const conn = ensurePeerConnection();
    if (localStream.value) {
      for (const t of localStream.value.getTracks()) {
        conn.addTrack(t, localStream.value);
      }
    }
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    const s = getSocket();
    if (!s || !callId.value || !peer.value) return;
    s.emit(SocketEvents.CallSdp, {
      callId: callId.value,
      peerId: peer.value.id,
      sdp: { type: offer.type, sdp: offer.sdp },
    });
  }

  function onRejectFromCallee(payload: CallRejectPayload): void {
    if (payload.callId !== callId.value) return;
    errorMessage.value =
      payload.reason === "busy" ? "对方正在通话中" : "对方拒接";
    teardown(false);
  }

  function onCancelFromCaller(payload: CallCancelPayload): void {
    if (payload.callId !== callId.value) return;
    errorMessage.value = "对方已取消";
    teardown(false);
  }

  function onEndFromPeer(payload: CallEndPayload): void {
    if (payload.callId !== callId.value) return;
    teardown(false);
  }

  // Either side: incoming SDP. If we're callee, this is the offer — we
  // answer. If we're caller, this is the answer — we set it as remote.
  async function onRemoteSdp(payload: CallSdpPayload): Promise<void> {
    if (payload.callId !== callId.value) return;
    const conn = ensurePeerConnection();
    if (payload.sdp.type === "offer") {
      // Callee path: attach local tracks (if any), set remote, answer.
      if (localStream.value) {
        for (const t of localStream.value.getTracks()) {
          // addTrack is idempotent-ish; guard against double-add.
          if (!conn.getSenders().some((sn) => sn.track === t)) {
            conn.addTrack(t, localStream.value);
          }
        }
      }
      await conn.setRemoteDescription({
        type: "offer",
        sdp: payload.sdp.sdp,
      });
      await flushPendingIce();
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      const s = getSocket();
      if (!s || !callId.value || !peer.value) return;
      s.emit(SocketEvents.CallSdp, {
        callId: callId.value,
        peerId: peer.value.id,
        sdp: { type: answer.type, sdp: answer.sdp },
      });
    } else if (payload.sdp.type === "answer") {
      await conn.setRemoteDescription({
        type: "answer",
        sdp: payload.sdp.sdp,
      });
      await flushPendingIce();
    }
  }

  async function onRemoteIce(payload: CallIcePayload): Promise<void> {
    if (payload.callId !== callId.value) return;
    const conn = pc.value;
    // No PC yet (or no remote SDP yet): queue and apply later.
    if (!conn || !conn.remoteDescription) {
      pendingIce.value = [...pendingIce.value, payload.candidate];
      return;
    }
    try {
      await conn.addIceCandidate(payload.candidate);
    } catch {
      // ignore — non-fatal in most cases
    }
  }

  async function flushPendingIce(): Promise<void> {
    const conn = pc.value;
    if (!conn) return;
    const queued = pendingIce.value;
    if (queued.length === 0) return;
    pendingIce.value = [];
    for (const c of queued) {
      try {
        await conn.addIceCandidate(c);
      } catch {
        // ignore
      }
    }
  }

  function clearError(): void {
    errorMessage.value = null;
  }

  return {
    // state
    status,
    callId,
    peer,
    kind,
    isCaller,
    muted,
    cameraOff,
    startedAt,
    errorMessage,
    localStream,
    remoteStream,
    inCall,
    // actions
    bindSocketListeners,
    invite,
    accept,
    reject,
    hangup,
    toggleMute,
    toggleCamera,
    clearError,
  };
});
