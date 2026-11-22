import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, StopCircle } from 'lucide-react';

interface QrCameraScannerProps {
  onScan: (code: string) => void;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({ onScan }) => {
  const [active, setActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const stopCamera = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setErrorMsg('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Peramban tidak mendukung akses kamera langsung. Gunakan input kode token QR manual.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setActive(true);

      requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        void video.play();

        const tick = () => {
          const vid = videoRef.current;
          const canvas = canvasRef.current;
          if (!vid || !canvas || !streamRef.current) return;

          if (vid.readyState === vid.HAVE_ENOUGH_DATA && vid.videoWidth > 0) {
            canvas.width = vid.videoWidth;
            canvas.height = vid.videoHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (decoded && decoded.data) {
                onScanRef.current(decoded.data.trim());
                stopCamera();
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      });
    } catch {
      stopCamera();
      setErrorMsg(
        'Izin kamera ditolak atau kamera tidak terdeteksi di perangkat ini. Anda tetap dapat mengetik atau memilih token QR secara langsung.'
      );
    }
  };

  return (
    <div className="mt-3 space-y-2.5">
      {!active ? (
        <button
          type="button"
          onClick={startCamera}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#C8A053]/60 bg-[#FAF7F2] px-3 py-2 text-xs font-bold text-[#381E5A] hover:bg-[#F3ECE0] cursor-pointer"
        >
          <Camera className="h-4 w-4 text-[#0C3328]" />
          <span>Buka Kamera Scan QR Member</span>
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-[#C8A053]/60 bg-stone-950 p-2.5">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-32 rounded-xl border-2 border-[#E8CA82]/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex items-center justify-between gap-2 text-[11px] text-stone-200">
            <span>Arahkan kamera ke tiket QR HP member...</span>
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-1 rounded-md bg-rose-700 px-2.5 py-1 font-semibold text-white hover:bg-rose-600 cursor-pointer"
            >
              <StopCircle className="h-3.5 w-3.5" />
              Stop
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {errorMsg}
        </p>
      )}
    </div>
  );
};
