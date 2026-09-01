"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type Human from "@vladmandic/human";
import type { Config as HumanConfig } from "@vladmandic/human";
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import StatusChip from "@/components/ui/StatusChip";
import { recordAttendance, checkoutAttendance, getTodayAttendance } from "../actions";
import { computeEAR } from "@/lib/ear";

const DETECTION_THROTTLE_MS = 100;
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

const HUMAN_CONFIG: Partial<HumanConfig> = {
  modelBasePath: "/models",
  debug: false,
  face: {
    enabled: true,
    detector: { rotation: true, return: true },
    mesh: { enabled: true },
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

type Status =
  | "idle"
  | "loading-model"
  | "camera-starting"
  | "detecting"
  | "capturing"
  | "submitting"
  | "success"
  | "error"
  | "already-done"
  | "ready-to-checkout"
  | "checked-out";

type Mode = "check-in" | "check-out";

type TodayRecord = {
  id: string;
  date: string;
  takenAt: string | Date;
  matchConfidence: number;
  checkOutAt: string | Date | null;
  checkOutConfidence: number | null;
  userId: string;
};

export default function AttendanceCamera() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const humanRef = useRef<Human | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastDetectionRef = useRef<number>(0);
  const framesSinceStartRef = useRef<number>(0);
  const belowThresholdFramesRef = useRef<number>(0);
  const earHistoryRef = useRef<number[]>([]);
  const hasBlinkedRef = useRef<boolean>(false);
  const unmountedRef = useRef<boolean>(false);
  const alreadyDoneRef = useRef<boolean>(false);

  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState("Initializing…");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [mode, setMode] = useState<Mode>("check-in");
  const modeRef = useRef<Mode>("check-in");
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);



  const captureAndSubmit = useCallback(async (embedding: number[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setStatus("submitting");
    setStatusMessage(modeRef.current === "check-in" ? "Verifying identity…" : "Verifying identity for check-out…");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const photoDataUrl = canvas.toDataURL("image/jpeg", 0.85);

    streamRef.current?.getTracks().forEach((t) => t.stop());

    try {
      const formData = new FormData();
      formData.append("embedding", JSON.stringify(embedding));
      
      const res = await fetch(photoDataUrl);
      const blob = await res.blob();
      formData.append("photo", blob, "photo.jpg");

      formData.append("localDate", new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD local time

      const action = modeRef.current === "check-in" ? recordAttendance : checkoutAttendance;
      const data = await action(formData);
      
      if (data.ok) {
        setStatus(modeRef.current === "check-in" ? "success" : "checked-out");
        setConfidence(data.confidence ?? null);
        const rawCheckOut = (data as { checkOutAt?: string }).checkOutAt;
        const checkOutTime = rawCheckOut
          ? new Date(rawCheckOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
          : null;
        setStatusMessage(
          modeRef.current === "check-in"
            ? "Attendance recorded successfully!"
            : checkOutTime ? `Checked out at ${checkOutTime}` : "Checked out successfully!"
        );
      } else if (data.status === 409) {
        setStatus("already-done");
        setStatusMessage(data.error ?? "Already recorded for today.");
      } else {
        setStatus("error");
        setErrorMessage(data.error ?? "Verification failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  }, []);

  const runDetection = useCallback(async () => {
    const human = humanRef.current;
    const video = videoRef.current;
    if (!human || !video || video.readyState < 2) return;

    framesSinceStartRef.current++;
    if (framesSinceStartRef.current < 10) return;

    const result = await human.detect(video);
    const face = result.face?.[0];
    
    if (!face || !face.embedding || !face.mesh) {
      belowThresholdFramesRef.current = 0; // Reset face frame counter if no face
      return;
    }

    // Calculate EAR
    const leftEAR = computeEAR(face.mesh as [number, number, number][], LEFT_EYE);
    const rightEAR = computeEAR(face.mesh as [number, number, number][], RIGHT_EYE);
    const avgEAR = (leftEAR + rightEAR) / 2;

    earHistoryRef.current.push(avgEAR);
    if (earHistoryRef.current.length > 20) {
      earHistoryRef.current.shift();
    }

    // Blink detection: Look for open (>=0.28) -> closed (<=0.25) -> open (>=0.28)
    if (!hasBlinkedRef.current && earHistoryRef.current.length >= 10) {
      const history = earHistoryRef.current;
      let state = 0;
      for (const ear of history) {
        if (state === 0 && ear >= 0.28) state = 1; // baseline open
        else if (state === 1 && ear <= 0.25) state = 2; // dip
        else if (state === 2 && ear >= 0.28) {
          state = 3; // return to open
          break;
        }
      }
      if (state === 3) {
        hasBlinkedRef.current = true;
      }
    }

    belowThresholdFramesRef.current++;

    // Require BOTH 15 stable frames AND a genuine blink
    if (belowThresholdFramesRef.current >= 15 && hasBlinkedRef.current) {
      setStatus("capturing");
      setStatusMessage("Face and blink detected! Capturing…");
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      await captureAndSubmit(face.embedding as number[]);
    } else if (belowThresholdFramesRef.current >= 15 && !hasBlinkedRef.current) {
      setStatusMessage("Please blink to verify liveness…");
    }
  }, [captureAndSubmit]);

  const detectLoop = useCallback(() => {
    const loop = async () => {
      if (!humanRef.current || !videoRef.current) {
        animFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      const now = performance.now();
      if (now - lastDetectionRef.current >= DETECTION_THROTTLE_MS) {
        lastDetectionRef.current = now;
        try {
          await runDetection();
        } catch (err: unknown) {
          if (err instanceof Error && (err.message.includes("Device") || err.message.includes("GPUBuffer"))) {
            humanRef.current = null;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            setStatus("error");
            setErrorMessage("Camera device was lost. Please refresh the page and try again.");
            return;
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [runDetection]);

  const startCamera = useCallback(async () => {
    if (alreadyDoneRef.current) return;
    setStatus("loading-model");
    setStatusMessage("Loading face recognition model…");

    try {
      const { default: HumanClass } = await import("@vladmandic/human");
      if (!humanRef.current) {
        humanRef.current = new HumanClass(HUMAN_CONFIG);
        await humanRef.current.load();
      }
      setStatus("camera-starting");
      setStatusMessage("Starting camera…");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      if (unmountedRef.current || alreadyDoneRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("detecting");
      setStatusMessage("Look at the camera and hold still…");
      framesSinceStartRef.current = 0;
      detectLoop();
    } catch {
      setStatus("error");
      setErrorMessage("Could not access camera. Please grant camera permission and try again.");
    }
  }, [detectLoop]);

  useEffect(() => {
    unmountedRef.current = false;
    
    const init = async () => {
      try {
        const data = await getTodayAttendance();
        if (unmountedRef.current) return;
        
        if (data.record) {
          setTodayRecord(data.record);
          if (data.record.checkOutAt) {
            alreadyDoneRef.current = true;
            setStatus("checked-out");
            setStatusMessage(
              `Checked in at ${new Date(data.record.takenAt).toLocaleTimeString([], { timeZone: "Asia/Kolkata" })} — Checked out at ${new Date(data.record.checkOutAt).toLocaleTimeString([], { timeZone: "Asia/Kolkata" })}`
            );
          } else {
            alreadyDoneRef.current = true;
            setStatus("ready-to-checkout");
            setMode("check-out");
            modeRef.current = "check-out";
            setStatusMessage("Ready to check out. Click the button below to turn on the camera.");
          }
        } else {
          startCamera();
        }
      } catch {
        // getTodayAttendance failed (e.g. session expired) — proceed to camera anyway
        if (!unmountedRef.current) startCamera();
      }
    };
    
    init();
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

  const isActive = ["detecting", "capturing", "submitting"].includes(status);

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    modeRef.current = newMode;
    setStatus("idle");
    setErrorMessage("");
    setConfidence(null);
    alreadyDoneRef.current = false;
    belowThresholdFramesRef.current = 0;
    framesSinceStartRef.current = 0;
    startCamera();
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-surface-border">
        <div className="flex items-center justify-between px-4 py-3 max-w-2xl mx-auto w-full">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-surface-border shadow-sm hover:bg-surface/80 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 text-ink" />
          </button>
          <h1 className="text-base font-semibold text-ink">Attendance</h1>
          <div className="w-9 h-9" />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center p-4 md:p-6 w-full max-w-2xl mx-auto z-10 relative">
        {/* Mode Switcher */}
        {todayRecord && !todayRecord.checkOutAt && status !== "checked-out" && (
          <div className="w-full mb-4 flex gap-2">
            <button
              onClick={() => handleModeSwitch("check-in")}
              className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all bg-chip-gray text-chip-gray-text cursor-not-allowed"
              disabled
            >
              Clock In (done)
            </button>
            <button
              onClick={() => handleModeSwitch("check-out")}
              className="flex-1 py-2.5 rounded-full text-sm font-medium transition-all btn-primary"
            >
              Check Out
            </button>
          </div>
        )}

        {/* Camera Card */}
        <div className="relative w-full rounded-2xl overflow-hidden card p-0 mb-6 md:mb-8">
          <div className="relative w-full aspect-[3/4] md:aspect-[4/3]">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 transform -scale-x-100 ${isActive ? "opacity-100" : "opacity-60"}`}
              playsInline
              muted
              aria-label="Live camera feed for attendance capture"
            />
            <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />

            {/* Overlay tint when active */}
            <div
              className={`absolute inset-0 transition-all duration-500 pointer-events-none ${
                isActive
                  ? "bg-scan-accent/10"
                  : status === "capturing"
                  ? "bg-primary/10"
                  : "bg-ink/5"
              }`}
            />

            {/* Corner bracket viewfinder guides */}
            {isActive && (
              <>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-56 md:h-56">
                  {/* Top-left */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white/80 rounded-tl-md" />
                  {/* Top-right */}
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white/80 rounded-tr-md" />
                  {/* Bottom-left */}
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white/80 rounded-bl-md" />
                  {/* Bottom-right */}
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white/80 rounded-br-md" />
                </div>
              </>
            )}



            {/* Status overlay on camera */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center p-6 z-10 transition-all duration-500 ${
                isActive || status === "capturing"
                  ? "pointer-events-none"
                  : "bg-surface/80 backdrop-blur-sm"
              }`}
            >
              <div className="flex items-center justify-center mb-4 min-h-[120px]">
                {["loading-model", "camera-starting", "submitting"].includes(status) && (
                  <div className="w-12 h-12 border-4 border-surface-border border-t-primary rounded-full animate-spin" />
                )}
                {(status === "success" || status === "already-done") && (
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <CheckIcon className="w-8 h-8" />
                  </div>
                )}
                {status === "ready-to-checkout" && (
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
                    <InformationCircleIcon className="w-8 h-8" />
                  </div>
                )}
                {status === "checked-out" && (
                  <div className="w-16 h-16 bg-scan-accent/10 text-scan-accent rounded-full flex items-center justify-center">
                    <CheckIcon className="w-8 h-8" />
                  </div>
                )}
                {status === "error" && (
                  <div className="w-16 h-16 bg-chip-red text-chip-red-text rounded-full flex items-center justify-center">
                    <XMarkIcon className="w-8 h-8" />
                  </div>
                )}
              </div>

              {!["detecting", "capturing"].includes(status) && (
                <p className="text-sm font-medium text-ink text-center">{statusMessage}</p>
              )}

              {status === "error" && errorMessage && (
                <div className="text-xs text-ink-muted mt-2 max-w-[280px] text-center">{errorMessage}</div>
              )}

              {status === "success" && confidence !== null && (
                <div className="mt-3">
                  <StatusChip label={`Match: ${(confidence * 100).toFixed(1)}%`} variant="green" />
                </div>
              )}

              {status === "error" && (
                <button
                  className="mt-5 btn-primary text-sm"
                  onClick={() => {
                    setStatus("idle");
                    setErrorMessage("");
                    belowThresholdFramesRef.current = 0;
                    framesSinceStartRef.current = 0;
                    startCamera();
                  }}
                >
                  Try Again
                </button>
              )}

              {status === "already-done" && mode === "check-in" && (
                <button
                  className="mt-5 btn-primary text-sm"
                  onClick={() => handleModeSwitch("check-out")}
                >
                  Check Out Instead
                </button>
              )}

              {status === "ready-to-checkout" && (
                <button
                  className="mt-5 btn-primary text-sm px-6"
                  onClick={() => handleModeSwitch("check-out")}
                >
                  Start Check Out
                </button>
              )}
            </div>

          </div>
        </div>

        {/* How it works card */}
        <div className="w-full card mb-6">
          <h3 className="text-ink font-semibold mb-4 flex items-center gap-2 text-sm">
            <InformationCircleIcon className="w-4 h-4 text-primary" />
            How it works
          </h3>
          <ol className="list-decimal list-inside text-sm text-ink-muted space-y-2 ml-1 marker:text-primary marker:font-semibold">
            <li>Camera opens automatically</li>
            <li>Look straight at the camera</li>
            <li>Hold still for a moment</li>
            <li>{mode === "check-in" ? "Your attendance is recorded" : "Your check-out is recorded"}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
