import { useEffect, useRef, useState } from 'react';
import { Crop, X } from 'lucide-react';

type Box = { x: number; y: number; width: number; height: number };
type Props = { image: string; onApply: (image: string) => void; onClose: () => void };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Cropping happens locally; only the resulting selection is sent to discovery. */
export function CropDialog({ image, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Box>({ x: 10, y: 10, width: 80, height: 80 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);

  function point(event: React.PointerEvent) {
    const bounds = surfaceRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width * 100, 0, 100), y: clamp((event.clientY - bounds.top) / bounds.height * 100, 0, 100) };
  }

  function update(key: keyof Box, value: number) {
    if (!Number.isFinite(value)) return;
    setBox(current => {
      const next = { ...current, [key]: value };
      next.x = clamp(next.x, 0, 99);
      next.y = clamp(next.y, 0, 99);
      next.width = clamp(next.width, 1, 100 - next.x);
      next.height = clamp(next.height, 1, 100 - next.y);
      return next;
    });
  }

  function apply() {
    const selected = imageRef.current;
    if (!selected || !ready) return;
    try {
      const canvas = document.createElement('canvas');
      const sourceWidth = selected.naturalWidth * box.width / 100;
      const sourceHeight = selected.naturalHeight * box.height / 100;
      const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable');
      ctx.drawImage(selected, selected.naturalWidth * box.x / 100, selected.naturalHeight * box.y / 100, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      onApply(canvas.toDataURL('image/jpeg', 0.88));
    } catch {
      setError('This image cannot be cropped directly. Use “Capture page” to select it from a screenshot instead.');
    }
  }

  return <dialog ref={dialog} className="sheet crop-dialog" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="crop-title">
    <header className="sheet-header"><div><span className="section-context"><Crop size={15} /> Select an object</span><h2 id="crop-title">Just the part you want.</h2></div><button className="icon-button" onClick={onClose} aria-label="Close image crop"><X size={20} /></button></header>
    <p className="muted crop-instructions">Drag around the object. You can also adjust the selection with the fields below.</p>
    <div className="crop-surface" ref={surfaceRef} onPointerDown={event => {
      if (!ready) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const pointOnImage = point(event);
      const start = { x: Math.min(pointOnImage.x, 99), y: Math.min(pointOnImage.y, 99) };
      drag.current = start; setBox({ ...start, width: 1, height: 1 });
    }} onPointerMove={event => {
      if (!drag.current) return;
      const next = point(event); const start = drag.current;
      const x = Math.min(start.x, next.x); const y = Math.min(start.y, next.y);
      setBox({ x, y, width: clamp(Math.abs(start.x - next.x), 1, 100 - x), height: clamp(Math.abs(start.y - next.y), 1, 100 - y) });
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img ref={imageRef} src={image} alt="Captured page to crop" draggable={false} onLoad={() => setReady(true)} onError={() => setError('The image could not be loaded. Capture the page again.')} />
      {ready && <div className="crop-selection" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%` }}><span /><span /><span /><span /></div>}
    </div>
    <div className="crop-fields">{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{({ x: 'Left', y: 'Top', width: 'Width', height: 'Height' })[key]} %<input type="number" min={key === 'x' || key === 'y' ? 0 : 1} max={100} step={1} value={Math.round(box[key])} onChange={event => update(key, event.target.valueAsNumber)} /></label>)}</div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <footer className="sheet-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!ready} onClick={apply}><Crop size={16} /> Use this selection</button></footer>
  </dialog>;
}
