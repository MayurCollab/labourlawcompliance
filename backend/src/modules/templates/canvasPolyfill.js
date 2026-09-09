/**
 * pdfjs-dist expects browser canvas globals. On Node < 22.3 it cannot load
 * @napi-rs/canvas itself (missing process.getBuiltinModule), so we seed them.
 */
import { DOMMatrix, Path2D } from '@napi-rs/canvas';

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = DOMMatrix;
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = Path2D;
}
