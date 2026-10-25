export interface MediaGeometry {
  x: number; y: number; width: number; height: number;
  viewportWidth: number; viewportHeight: number;
  pointerX: number; pointerY: number; scrollX: number; scrollY: number;
}
export interface CropBox { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number }
const geometryKeys: (keyof MediaGeometry)[] = ['x', 'y', 'width', 'height', 'viewportWidth', 'viewportHeight', 'pointerX', 'pointerY', 'scrollX', 'scrollY'];

/** CSS pixels; screenshot pixels are scaled independently for devicePixelRatio. */
export function mediaCrop(value: MediaGeometry): CropBox {
  if (!value || geometryKeys.some(key => typeof value[key] !== 'number' || !Number.isFinite(value[key]))) throw new Error('The image position could not be read. Right-click it again.');
  if (value.viewportWidth < 1 || value.viewportHeight < 1 || value.viewportWidth > 20000 || value.viewportHeight > 20000 || value.width < 8 || value.height < 8) throw new Error('Choose a visible image or video.');
  const left = Math.max(0, value.x), top = Math.max(0, value.y);
  const right = Math.min(value.viewportWidth, value.x + value.width), bottom = Math.min(value.viewportHeight, value.y + value.height);
  if (right - left < 8 || bottom - top < 8 || value.pointerX < left || value.pointerX > right || value.pointerY < top || value.pointerY > bottom) throw new Error('The object moved. Right-click it again.');
  const width = Math.min(320, right - left), height = Math.min(320, bottom - top);
  return { x: Math.max(left, Math.min(right - width, value.pointerX - width / 2)), y: Math.max(top, Math.min(bottom - height, value.pointerY - height / 2)), width, height, viewportWidth: value.viewportWidth, viewportHeight: value.viewportHeight };
}
/** Cropping near an edge shifts the image, so the cursor is not necessarily centered. */
export function cropFocus(box: CropBox, pointer: Pick<MediaGeometry, 'pointerX' | 'pointerY'>): { x: number; y: number } {
  return { x: Math.max(0, Math.min(1, (pointer.pointerX - box.x) / box.width)), y: Math.max(0, Math.min(1, (pointer.pointerY - box.y) / box.height)) };
}
export function sameGeometry(a: MediaGeometry, b: MediaGeometry): boolean {
  return !!a && !!b && geometryKeys.every(key => Number.isFinite(a[key]) && Number.isFinite(b[key]) && Math.abs(a[key] - b[key]) < 1);
}
