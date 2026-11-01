// The game's own screens, made of one thing: riveted zinc tags hanging on silk threads, swinging in on a spring. Real
// buttons (keyboard and touch), text set with textContent only.

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** A tag button. opts: { main, key, silk (px), small, onclick, delay, disabled, label } */
export function tag(text, opts = {}) {
  const cls = ['tag', opts.main ? 'main' : '', opts.small ? 'small' : '', opts.cls ?? ''].filter(Boolean).join(' ');
  const el = h(
    opts.onclick ? 'button' : 'div',
    {
      class: cls,
      type: opts.onclick ? 'button' : null,
      disabled: opts.disabled ? true : null,
      'aria-label': opts.label ?? null,
      style: `--silk:${opts.silk ?? 26}px;--delay:${opts.delay ?? 0}ms`,
      onclick: opts.onclick
        ? (e) => {
            e.stopPropagation();
            opts.onclick(e);
          }
        : null,
    },
    h('span', { class: 'face' }, text),
    opts.key ? h('kbd', { text: opts.key }) : null,
  );
  return el;
}

export function createUI(root) {
  let current = null;
  return {
    root,
    /** Replaces the screen. Returns the new layer. */
    show(name, build) {
      if (current) {
        const old = current;
        old.classList.add('leaving');
        old.querySelectorAll('button').forEach((b) => (b.disabled = true));
        setTimeout(() => old.remove(), 220);
      }
      current = null;
      if (!build) return null;
      const layer = h('div', { class: `screen ${name}`, 'data-screen': name });
      build(layer);
      root.append(layer);
      current = layer;
      const main = layer.querySelector('button.main:not([disabled])');
      if (main && !matchMedia('(pointer: coarse)').matches) setTimeout(() => main.focus({ preventScroll: true }), 30);
      return layer;
    },
    get current() {
      return current;
    },
    name() {
      return current?.dataset.screen ?? '';
    },
  };
}

/** Lays the screens out clear of the platform's buttons. */
export function setInsets(root, W, H, reserved) {
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  if (!reserved) {
    top = 70;
    bottom = 88;
  } else {
    for (const r of reserved) {
      if (r.kind === 'menu') {
        if (r.y < H / 2) top = Math.max(top, r.y + r.h);
        else bottom = Math.max(bottom, H - r.y);
      }
      if (r.kind === 'lobby') bottom = Math.max(bottom, H - r.y);
    }
  }
  root.style.setProperty('--top', `${top + 8}px`);
  root.style.setProperty('--bottom', `${bottom + 8}px`);
  root.style.setProperty('--left', `${left + 12}px`);
  root.style.setProperty('--right', `${right + 12}px`);
}

/** Three star slots, filled up to n. */
export function stars(n, size = 20, animate = false) {
  const wrap = h('span', { class: 'stars', 'aria-label': `${n} of 3 stars` });
  for (let i = 0; i < 3; i++) {
    const s = h('span', { class: `star ${i < n ? 'on' : ''} ${animate && i < n ? 'pop' : ''}`, style: `--d:${300 + i * 260}ms;font-size:${size}px` });
    s.textContent = '★';
    wrap.append(s);
  }
  return wrap;
}
