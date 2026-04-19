// [FEATURE: barcode_scanning]
// Camera-based barcode and QR scanner using @zxing/browser.
// Must be dynamically imported with ssr: false to avoid Next.js SSR issues.
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onScan: (result: string) => void;
  onClose: () => void;
  hint?: string;
}

export function BarcodeScanner({ onScan, onClose, hint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const readerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      try {
        setScanning(true);
        // Dynamically import to avoid SSR errors
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        if (!videoRef.current) return;

        await reader.decodeFromVideoDevice(
          undefined, // use default camera
          videoRef.current,
          (result, err) => {
            if (!active) return;
            if (result) {
              onScan(result.getText());
              onClose();
            }
            // Ignore err — zxing emits errors when no barcode found in frame
          }
        );
      } catch (e) {
        if (!active) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          setError("Camera permission denied. Please allow camera access and try again.");
        } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
          setError("No camera found on this device.");
        } else {
          setError("Unable to start camera: " + msg);
        }
      } finally {
        if (active) setScanning(false);
      }
    }

    startScanner();

    return () => {
      active = false;
      if (readerRef.current) {
        try { readerRef.current.reset(); } catch { /* */ }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-background border border-border rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Scan Barcode</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Camera view */}
        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          {/* Crosshair overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-32 relative">
              {/* Corner marks */}
              {[
                "top-0 left-0 border-t-2 border-l-2",
                "top-0 right-0 border-t-2 border-r-2",
                "bottom-0 left-0 border-b-2 border-l-2",
                "bottom-0 right-0 border-b-2 border-r-2",
              ].map((classes, i) => (
                <div key={i} className={`absolute w-5 h-5 border-primary ${classes}`} />
              ))}
              {/* Scan line animation */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/60 animate-bounce" style={{ animationDuration: "1.5s" }} />
            </div>
          </div>

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
              <p className="text-white text-sm text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            {hint ?? "Point camera at a barcode or QR code"}
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
