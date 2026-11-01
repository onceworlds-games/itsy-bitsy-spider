// The camera: world units (y up) to the canvas's device pixels. The translation is snapped to whole device pixels so the
// cached static bands and the live layers line up exactly.

export function createView() {
  return { W: 1, H: 1, pr: 1, z: 1, s: 1, Wd: 1, Hd: 1, camX: 0, camY: 0, tx: 0, ty: 0, x0: 0, x1: 0, y0: 0, y1: 0, viewW: 1, viewH: 1, landscape: false };
}

/** Fits the zoom to the screen: at least `minW` × `minH` world units in view. */
export function fitView(view, W, H, pr, { minW = 360, minH = 640, minHLand = 560 } = {}) {
  view.W = W;
  view.H = H;
  view.pr = pr;
  view.Wd = Math.round(W * pr);
  view.Hd = Math.round(H * pr);
  view.landscape = W > H * 1.15;
  const mh = view.landscape ? minHLand : minH;
  view.z = Math.min(W / minW, H / mh);
  view.s = view.z * pr;
  view.viewW = W / view.z;
  view.viewH = H / view.z;
}

export function setCamera(view, x, y) {
  view.tx = Math.round(view.Wd / 2 - x * view.s);
  view.ty = Math.round(view.Hd / 2 + y * view.s);
  view.camX = (view.Wd / 2 - view.tx) / view.s;
  view.camY = (view.ty - view.Hd / 2) / view.s;
  view.x0 = -view.tx / view.s;
  view.x1 = (view.Wd - view.tx) / view.s;
  view.y1 = view.ty / view.s;
  view.y0 = (view.ty - view.Hd) / view.s;
}

/** World transform on a context (device pixels, y up). */
export function worldTransform(ctx, view) {
  ctx.setTransform(view.s, 0, 0, -view.s, view.tx, view.ty);
}

/** Screen transform (CSS pixels). */
export function screenTransform(ctx, view) {
  ctx.setTransform(view.pr, 0, 0, view.pr, 0, 0);
}

export const toScreenX = (view, x) => (x * view.s + view.tx) / view.pr;
export const toScreenY = (view, y) => (-y * view.s + view.ty) / view.pr;
export const toWorldY = (view, sy) => (view.ty - sy * view.pr) / view.s;
