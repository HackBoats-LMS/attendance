"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type Human from "@vladmandic/human";
import type { Config as HumanConfig } from "@vladmandic/human";

import { enrollUserFace } from "../actions";

const HUMAN_CONFIG: Partial<HumanConfig> = {
  modelBasePath: "/models",
  debug: false,
  face: {
    enabled: true,
    detector: { rotation: true, return: true },
    mesh: { enabled: false },
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

type Status = "idle" | "loading" | "starting-camera" | "detecting" | "capturing" | "submitting" | "success" | "error";

export default function EnrollmentCamera() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const humanRef = useRef<Human | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const embeddingsRef = useRef<number[][]>([]);
  const lastCaptureRef = useRef<number>(0);
  const statusRef = useRef<Status>("idle");

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Initializing setup...");
  const [progress, setProgress] = useState(0);

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
      const now = performance.now();
      if (now - lastCaptureRef.current >= 500) {
        try {
          const res = await humanRef.current.detect(videoRef.current);
          const face = res.face?.[0];
          if (face && face.embedding && face.boxScore > 0.7) {
            if (statusRef.current !== "capturing") setStatusSynced("capturing");
            embeddingsRef.current.push(face.embedding as number[]);
            setProgress(Math.min((embeddingsRef.current.length / 3) * 100, 100));
            lastCaptureRef.current = now;
            if (embeddingsRef.current.length >= 3) {
              if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
              await submitEnrollment();
              return;
            } else {
              setMessage(`Capturing... (${embeddingsRef.current.length}/3)`);
            }
          } else {
            if (statusRef.current !== "detecting") setStatusSynced("detecting");
            setMessage("Please face the camera clearly.");
          }
        } catch {}
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
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatusSynced("detecting");
      setMessage("Look directly at the camera...");
      detectLoop();
    } catch (err) {
      console.error(err);
      setStatusSynced("error");
      setMessage("Camera access denied or unavailable.");
    }
  }, [detectLoop, setStatusSynced]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startCamera();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);


  const isActive = ["detecting", "capturing"].includes(status);

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
                setProgress(0);
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
              className="h-full bg-green-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-xs text-ink-muted mt-2">{Math.round(progress / 100 * 3)}/3 frames captured</p>
        </div>
      )}

      <div className="w-full card p-6">
        <h3 className="text-ink font-semibold mb-2">Instructions</h3>
        <p className="text-sm text-ink-muted">
          Please ensure you are in a well-lit environment and not wearing any face coverings like sunglasses.
          The system will automatically capture 3 frames when your face is clearly visible.
        </p>
      </div>
    </div>
  );
}
