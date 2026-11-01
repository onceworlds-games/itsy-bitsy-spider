// One spout's whole scene: the pipe, the building behind it, the ground, the roof and the sky, built once per level and
// swapped in when the run on screen changes.

import * as THREE from 'three';
import { buildPipe } from './pipe.js';
import { buildFacade } from './facade.js';
import { themeFor } from './themes.js';

const cache = new Map();

export function worldFor(level, def) {
  const key = level;
  let w = cache.get(key);
  if (w) return w;
  const theme = themeFor(def);
  const group = new THREE.Group();
  const pipe = buildPipe(level, theme);
  const facade = buildFacade(level, theme);
  group.add(pipe.group, facade.group);
  w = { level, theme, group, pipe, facade, update: (t, mood) => facade.update?.(t, mood) };
  cache.set(key, w);
  return w;
}
