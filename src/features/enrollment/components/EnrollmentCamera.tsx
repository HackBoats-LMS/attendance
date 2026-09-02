"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type Human from "@vladmandic/human";
import type { Config as HumanConfig } from "@vladmandic/human";
import { computeEAR } from "@/lib/ear";

import { enrollUserFace } from "../actions";

const CAPTURE_INTERVAL_MS = 1000; // 1 second between each captured frame
const REQUIRED_FRAMES = 10;       // capture 10 frames for a robust profile
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

const HUMAN_CONFIG: Partial<HumanConfig> = {
  modelBasePath: "/models",
  debug: false,
  face: {
    enabled: true,
    detector: { rotation: true, return: true },
    mesh: { enabled: true }, // Required for blink (EAR) detection
    description: { enabled: true },
    iris: { enabled: false },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
};

type Status = "idle" | "loading" | "starting-camera" | "blink-required" | "detecting" | "capturing" | "submitting" | "success" | "error";

export default function EnrollmentCamera() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const humanRef = useRef<Human | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const embeddingsRef = useRef<number[][]>([]);
  const lastCaptureRef = useRef<number>(0);
  const statusRef = useRef<Status>("idle");
  const unmountedRef = useRef(false);

  // Blink detection state
  const earHistoryRef = useRef<number[]>([]);
  const hasBlinkedRef = useRef<boolean>(false);
  const framesSinceStartRef = useRef<number>(0);

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Initializing setup...");
  const [progress, setProgress] = useState(0);
  const [blinkConfirmed, setBlinkConfirmed] = useState(false);

  const setStatusSynced = useCallback((s: Status) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const submitEnrollment = useCallback(async () => {
    setStatusSynced("submitting");
    setMessage("Processing face data...");
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const embeds = embeddingsRef.current;
    if (embeds.length === 0) return;

    const len = embeds[0].length;
    const avg = new Array(len).fill(0);
    for (const emb of embeds) {
      for (let i = 0; i < len; i++) avg[i] += emb[i];
    }
    for (let i = 0; i < len; i++) avg[i] /= embeds.length;

    try {
      const res = await enrollUserFace(avg);
      if (res.ok) {
        setStatusSynced("success");
        setMessage("Enrollment successful!");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setStatusSynced("error");
        setMessage(res.error || "Enrollment failed.");
      }
    } catch {
      setStatusSynced("error");
      setMessage("Network error. Please try again.");
    }
  }, [router, setStatusSynced]);

  const detectLoop = useCallback(() => {
    const loop = async () => {
      if (!humanRef.current || !videoRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Skip first few frames while camera warms up
      framesSinceStartRef.current++;
      if (framesSinceStartRef.current < 10) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      try {
        const res = await humanRef.current.detect(videoRef.current);
        const face = res.face?.[0];

        if (face && face.embedding && face.mesh && face.boxScore > 0.7) {

          // ── Blink detection (EAR) ──────────────────────────────────────
          const leftEAR  = computeEAR(face.mesh as [number, number, number][], LEFT_EYE);
          const rightEAR = computeEAR(face.mesh as [number, number, number][], RIGHT_EYE);
          const avgEAR   = (leftEAR + rightEAR) / 2;

          earHistoryRef.current.push(avgEAR);
          if (earHistoryRef.current.length > 20) earHistoryRef.current.shift();

          // Detect open→close→open blink pattern
          if (!hasBlinkedRef.current && earHistoryRef.current.length >= 10) {
            const history = earHistoryRef.current;
            let state = 0;
            for (const ear of history) {
              if      (state === 0 && ear >= 0.28) state = 1; // baseline open
              else if (state === 1 && ear <= 0.25) state = 2; // eye closed (blink dip)
              else if (state === 2 && ear >= 0.28) { state = 3; break; } // re-opened
            }
            if (state === 3) {
              hasBlinkedRef.current = true;
              setBlinkConfirmed(true);
            }
          }
          // ──────────────────────────────────────────────────────────────

          // Only start capturing AFTER a blink has been detected
          if (!hasBlinkedRef.current) {
            if (statusRef.current !== "blink-required") setStatusSynced("blink-required");
            setMessage("Please blink once to verify liveness...");
            animFrameRef.current = requestAnimationFrame(loop);
            return;
          }

          // Capture a frame every CAPTURE_INTERVAL_MS
          const now = performance.now();
          if (now - lastCaptureRef.current >= CAPTURE_INTERVAL_MS) {
            if (statusRef.current !== "capturing") setStatusSynced("capturing");
            embeddingsRef.current.push(face.embedding as number[]);
            const captured = embeddingsRef.current.length;
            setProgress(Math.min((captured / REQUIRED_FRAMES) * 100, 100));
            setMessage(`Capturing... (${captured}/${REQUIRED_FRAMES})`);
            lastCaptureRef.current = now;

            if (captured >= REQUIRED_FRAMES) {
              if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
              await submitEnrollment();
              return;
            }
          } else {
            if (statusRef.current === "detecting") {
              setMessage("Face detected. Hold still...");
            }
          }

        } else {
          // No face / low quality face
          if (statusRef.current !== "detecting" && statusRef.current !== "blink-required") {
            setStatusSynced("detecting");
          }
          if (statusRef.current === "detecting" || statusRef.current === "blink-required") {
            setMessage("Please face the camera clearly.");
          }
        }
      } catch {
        // Ignore transient detection errors and keep looping
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [setStatusSynced, submitEnrollment]);

  const startCamera = useCallback(async () => {
    setTimeout(() => {
      setStatusSynced("loading");
      setMessage("Loading AI models...");
    }, 0);
    try {
      const { default: HumanClass } = await import("@vladmandic/human");
      if (!humanRef.current) {
        humanRef.current = new HumanClass(HUMAN_CONFIG);
        await humanRef.current.load();
      }
      setStatusSynced("starting-camera");
      setMessage("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (unmountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatusSynced("detecting");
      setMessage("Look directly at the camera...");
      framesSinceStartRef.current = 0;
      detectLoop();
    } catch {
      setStatusSynced("error");
      setMessage("Camera access denied or unavailable.");
    }
  }, [detectLoop, setStatusSynced]);

  useEffect(() => {
    unmountedRef.current = false;
    startCamera();
    return () => {
      unmountedRef.current = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (humanRef.current) {
        try { (humanRef.current as unknown as { dispose?: () => void }).dispose?.(); } catch {}
        humanRef.current = null;
      }
    };
  }, [startCamera]);

  const isActive = ["blink-required", "detecting", "capturing"].includes(status);

  return (
    <div className="flex-1 flex flex-col items-center p-6 w-full max-w-2xl mx-auto z-10 relative">
      <div className="w-full mb-8 text-center mt-10">
        <h1 className="text-4xl font-heading font-bold text-ink tracking-tight mb-2">Face Enrollment</h1>
        <p className="text-ink-muted">Set up your face profile for quick attendance check-ins.</p>
      </div>

      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden card mb-6">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 transform -scale-x-100 ${isActive ? "opacity-100" : "opacity-30"}`}
          playsInline
          muted
        />

        {isActive && (
          <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${status === "capturing" ? "bg-scan-accent/10" : ""}`}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M15,10 L10,10 L10,15" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.9" />
              <path d="M85,10 L90,10 L90,15" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.9" />
              <path d="M15,90 L10,90 L10,85" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.9" />
              <path d="M85,90 L90,90 L90,85" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.9" />
            </svg>

            {/* Blink badge */}
            <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${blinkConfirmed ? "bg-green-500/90 text-white" : "bg-white/80 text-ink-muted"}`}>
              <span className={`w-2 h-2 rounded-full ${blinkConfirmed ? "bg-white" : "bg-amber-400 animate-pulse"}`} />
              {blinkConfirmed ? "Liveness ✓" : "Blink required"}
            </div>
          </div>
        )}

        <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 transition-all duration-500 ${isActive ? "bg-transparent pointer-events-none" : "bg-white/80"}`}>
          <div className="flex items-center justify-center mb-6 min-h-[120px]">
            {["loading", "starting-camera", "submitting"].includes(status) && (
              <div className="w-12 h-12 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin" />
            )}
            {status === "success" && (
              <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-5xl font-bold border border-green-200">
                ✓
              </div>
            )}
            {status === "error" && (
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl font-bold border border-red-200">
                ✗
              </div>
            )}
          </div>
          {!isActive && (
            <p className="text-xl font-heading font-semibold text-ink text-center">{message}</p>
          )}
          {status === "error" && (
            <button
              className="mt-6 btn-primary"
              onClick={() => {
                setStatusSynced("idle");
                embeddingsRef.current = [];
                earHistoryRef.current = [];
                hasBlinkedRef.current = false;
                framesSinceStartRef.current = 0;
                setProgress(0);
                setBlinkConfirmed(false);
                startCamera();
              }}
            >
              Try Again
            </button>
          )}
        </div>
      </div>

      {isActive && (
        <div className="w-full card p-5 mb-6">
          <p className="text-center font-medium text-ink mb-3 text-sm">{message}</p>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-xs text-ink-muted mt-2">{embeddingsRef.current.length}/{REQUIRED_FRAMES} frames captured</p>
        </div>
      )}

      <div className="w-full card p-6">
        <h3 className="text-ink font-semibold mb-2">Instructions</h3>
        <ol className="text-sm text-ink-muted space-y-1 list-decimal list-inside">
          <li>Ensure you are in a well-lit environment with no face coverings.</li>
          <li><strong className="text-ink">Blink once</strong> when prompted to verify you are a real person.</li>
          <li>Hold still while the system captures {REQUIRED_FRAMES} frames over ~{REQUIRED_FRAMES} seconds.</li>
        </ol>
      </div>
    </div>
  );
}
