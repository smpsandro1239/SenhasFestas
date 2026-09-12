'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QrScannerProps {
  open: boolean;
  onResult: (code: string) => void;
  onClose: () => void;
  title?: string;
}

export function QrScanner({ open, onResult, onClose, title = 'Escanear código QR' }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError('');
      return;
    }

    let frameId = 0;
    let disposed = false;

    const scanLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        frameId = requestAnimationFrame(scanLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        frameId = requestAnimationFrame(scanLoop);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && code.data) {
        stopCamera();
        onResult(code.data);
        return;
      }
      frameId = requestAnimationFrame(scanLoop);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        frameId = requestAnimationFrame(scanLoop);
      } catch {
        if (!disposed) setError('Não foi possível aceder à câmara. Verifica as permissões do browser.');
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      stopCamera();
    };
  }, [open, onResult, stopCamera]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface-solid p-4 sm:p-6 shadow-elevated">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-zinc-50">{title}</h3>
            <p className="text-sm text-zinc-400 mt-0.5">Aponte a câmara para o código QR do cliente</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar scanner"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-surface transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-square">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" width={640} height={480} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 rounded-xl border-2 border-amber-300/70" />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl border border-border text-sm font-medium text-zinc-200 hover:bg-surface transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}