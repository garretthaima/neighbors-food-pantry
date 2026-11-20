import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (barcode: string) => void;
}

// Holding a can in front of the camera decodes it many times a second.
const REPEAT_GUARD_MS = 2500;

/** Reads barcodes from the phone or laptop camera. The decoder loads on first use. */
export function CameraScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let stop: (() => void) | undefined;
    let last = { code: '', at: 0 };

    void (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        const hints = new Map<unknown, unknown>([
          [
            DecodeHintType.POSSIBLE_FORMATS,
            [BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8],
          ],
        ]);
        const reader = new BrowserMultiFormatReader(hints as never, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current!,
          (result) => {
            if (!result) return;
            const code = result.getText();
            const now = Date.now();
            if (code === last.code && now - last.at < REPEAT_GUARD_MS) return;
            last = { code, at: now };
            onScanRef.current(code);
          },
        );
        if (stopped) controls.stop();
        else stop = () => controls.stop();
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'The browser blocked the camera. Allow camera access for this site, then try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device.'
              : 'The camera could not start. It only works on a secure (https) address.',
        );
      }
    })();

    return () => {
      stopped = true;
      stop?.();
    };
  }, []);

  if (error) {
    return (
      <p className="field-error" role="alert">
        {error}
      </p>
    );
  }
  return (
    <div className="camera">
      <video ref={videoRef} muted playsInline />
      <p className="muted">Hold the barcode flat and steady in front of the camera.</p>
    </div>
  );
}
