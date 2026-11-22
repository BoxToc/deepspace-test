/**
 * Kenney-style isometric renderer (browser side, bundled by render.mjs).
 *
 * Reproduces how Kenney's isometric packs are drawn, measured from the PNGs:
 *
 *   projection  true 2:1 dimetric — orthographic camera, azimuth 45°,
 *               elevation 30°. One tile (1×1 world units) is 132 px wide and
 *               its top diamond 66 px tall.
 *   lighting    no light falloff, specular or cast shadows: every face is its
 *               flat palette colour times a fixed tone — top 1.00, left face
 *               0.90, right face 0.70 (e.g. Kenney beige #d8d3bf / #c2beac /
 *               #979385). Curved surfaces blend between left and right.
 *   palette     the small set of flat colours the Kenney buildings use.
 *
 * World axes: +x is the grid column (screen ↘), +z the grid row (screen ↙),
 * +y up. The visible walls are the +z face (screen-left, lighter) and the
 * +x face (screen-right, darker) — the same faces the town's buildings show.
 */

import * as THREE from 'three'

/** Pixels per world unit along a horizontal axis: a tile's diagonal is 132 px. */
export const PX = 132 / Math.SQRT2
/** Pixels per world unit vertically (cos 30° foreshortening). */
export const PX_UP = PX * Math.cos(Math.PI / 6)
/** One Kenney storey (34 px) in world units. */
export const STOREY = 34 / PX_UP
/** Convert a vertical pixel measurement to world units. */
export const upPx = (px) => px / PX_UP

/** Colours as they appear on a TOP face (tone 1.0). Measured from the Kenney PNGs. */
export const PALETTE = {
  concrete: '#d8d3bf', // pavements, parapets, base slabs
  concreteDark: '#c2beac',
  dirt: '#ba8b5c', // shows as #a77d53 (left) / #81603e (right)
  brick: '#cf9c68', // orange roofs
  red: '#c45b5b', // shows as #b15252 left
  green: '#6a8b35',
  window: '#7aa3ad',
  slate: '#838383', // grey roofs: #757575 left, #5c5c5c right
  steel: '#9aa1a3',
  dark: '#5a5a5a',
  yellow: '#f0c34a',
  white: '#ecebe4',
}

export const TONES = { top: 1.0, left: 0.9, right: 0.7 }

const vertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uTones;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    float up = clamp(n.y, 0.0, 1.0);
    // Wall tone by compass direction: +z (screen-left) → left tone,
    // +x (screen-right) → right tone, curved walls in between.
    float t = length(n.xz) > 1e-4 ? clamp(atan(max(n.x, 0.0), max(n.z, 0.0)) / 1.5707963, 0.0, 1.0) : 0.5;
    float wall = mix(uTones.y, uTones.z, t);
    float tone = mix(wall, uTones.x, up);
    if (n.y < 0.0) tone = uTones.z * 0.85; // undersides (rarely visible)
    gl_FragColor = vec4(uColor * tone, 1.0);
  }
`

const materials = new Map()
/** Flat Kenney-shaded material for a palette name or a hex colour. */
export function mat(color) {
  const hex = PALETTE[color] ?? color
  if (!materials.has(hex)) {
    // The shader writes these sRGB values straight to the PNG (no colour management).
    materials.set(
      hex,
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color().setStyle(hex, THREE.NoColorSpace) },
          uTones: { value: new THREE.Vector3(TONES.top, TONES.left, TONES.right) },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
      }),
    )
  }
  return materials.get(hex)
}

// ── Primitive helpers (sizes in world units; y is the BOTTOM of the shape) ──

export function box(color, [sx, sy, sz], [x, y, z] = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color))
  m.position.set(x, y + sy / 2, z)
  return m
}

export function cylinder(color, radius, height, [x, y, z] = [0, 0, 0], segments = 20, radiusTop = radius) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radius, height, segments), mat(color))
  m.position.set(x, y + height / 2, z)
  return m
}

/** A horizontal cylinder lying along the x (axis 'x') or z axis. y is its bottom. */
export function pipe(color, radius, length, [x, y, z], axis = 'x', segments = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), mat(color))
  if (axis === 'x') m.rotation.z = Math.PI / 2
  else m.rotation.x = Math.PI / 2
  m.position.set(x, y + radius, z)
  return m
}

/**
 * A flat 2-D shape (points in the face's own [u, v] units) extruded `depth`
 * out of a wall. face 'z' = the left (+z) wall at z = at; face 'x' = the right
 * (+x) wall at x = at. u runs along the wall to the right on screen, v up.
 */
export function decal(color, points, face, at, [u0, v0], depth = 0.012) {
  const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u, v)))
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  const m = new THREE.Mesh(g, mat(color))
  if (face === 'z') {
    // +z wall: u runs along +x, which is screen-right on this face.
    m.position.set(u0, v0, at)
  } else {
    m.rotation.y = Math.PI / 2
    m.position.set(at, v0, -u0)
  }
  return m
}

/** Lightning bolt outline, ~1 unit tall, origin at bottom-left. */
export const BOLT = [
  [0.55, 1],
  [0.15, 0.45],
  [0.42, 0.45],
  [0.3, 0],
  [0.85, 0.6],
  [0.56, 0.6],
  [0.75, 1],
]

export function scaled(points, s) {
  return points.map(([u, v]) => [u * s, v * s])
}

/**
 * A Kenney-style gable roof over [x0, x1] × [z0, z1] sitting at height y:
 * gable ends in `wallColor`, two sloped slabs in `roofColor` with a small
 * overhang. The ridge runs along x (axis 'x') or z.
 */
export function gableRoof(roofColor, wallColor, [x0, x1], [z0, z1], y, rise, axis = 'x', overhang = 0.025) {
  const g = new THREE.Group()
  const along = axis === 'x' ? [x0, x1] : [z0, z1]
  const across = axis === 'x' ? [z0, z1] : [x0, x1]
  const half = (across[1] - across[0]) / 2
  const mid = (across[0] + across[1]) / 2
  // Gable-end prism (wall colour).
  const shape = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)])
  const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: along[1] - along[0], bevelEnabled: false }), mat(wallColor))
  // Two roof slabs, each running from the ridge down past the eave by `overhang`.
  const L = Math.hypot(half, rise)
  const angle = Math.atan2(rise, half)
  const len = along[1] - along[0] + overhang * 2
  const t = 0.022
  const slabLen = L + overhang
  for (const side of [-1, 1]) {
    // Centre: middle of the ridge→eave line, nudged down-slope by half the overhang and up by half the thickness.
    const acrossC = mid + side * (half / 2 + (overhang / 2) * (half / L)) - side * (t / 2) * (rise / L)
    const yC = y + rise / 2 - (overhang / 2) * (rise / L) + (t / 2) * (half / L)
    const alongC = (along[0] + along[1]) / 2
    if (axis === 'x') {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(len, t, slabLen), mat(roofColor))
      slab.rotation.x = side * angle
      slab.position.set(alongC, yC, acrossC)
      g.add(slab)
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(slabLen, t, len), mat(roofColor))
      slab.rotation.z = -side * angle
      slab.position.set(acrossC, yC, alongC)
      g.add(slab)
    }
  }
  if (axis === 'x') {
    // Shape lies in local XY (x = across = world z); extrude along local z → world −x.
    prism.rotation.y = -Math.PI / 2
    prism.position.set(along[1], y, mid)
  } else {
    prism.position.set(mid, y, along[0])
  }
  g.add(prism)
  return g
}

/** A solid of revolution around the y axis from [radius, height] profile points. */
export function lathe(color, profile, [x, y, z], segments = 28) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segments), mat(color))
  m.position.set(x, y, z)
  return m
}

/** A low-poly puff (smoke, steam, bushes). */
export function puff(color, radius, [x, y, z]) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat(color))
  m.position.set(x, y, z)
  return m
}

// ── Rendering ───────────────────────────────────────────────────────────────

/**
 * Render `object` to a transparent PNG. Returns { url, width, height, anchor }.
 *
 *   width/height  canvas size in px
 *   anchor        pixel where the world origin (the cell's ground centre) lands
 *   supersample   render this many times larger, then downscale (anti-aliasing)
 *   trimTop       crop empty rows above the art (keeping `trimTop` px); the
 *                 returned anchor accounts for the crop
 */
export function renderToDataURL(object, { width = 132, height = 160, anchor = [66, height - 34], supersample = 4, trimTop } = {}) {
  const ss = supersample
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(width * ss, height * ss, false)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace // shader writes final sRGB values

  const [ax, ay] = anchor
  // `anchor` is measured from the top-left, so ay px lie above the origin.
  const camera = new THREE.OrthographicCamera(-ax / PX, (width - ax) / PX, ay / PX, -(height - ay) / PX, -100, 100)
  const dir = new THREE.Vector3(Math.sin(Math.PI / 4) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), Math.cos(Math.PI / 4) * Math.cos(Math.PI / 6))
  camera.position.copy(dir.multiplyScalar(20))
  camera.up.set(0, 1, 0)
  camera.lookAt(0, 0, 0)

  const scene = new THREE.Scene()
  scene.add(object)
  renderer.render(scene, camera)

  // Downscale in halving steps for clean edges.
  let src = renderer.domElement
  let w = width * ss
  let h = height * ss
  while (w > width) {
    const nw = Math.max(width, Math.round(w / 2))
    const nh = Math.max(height, Math.round(h / 2))
    const c = document.createElement('canvas')
    c.width = nw
    c.height = nh
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, nw, nh)
    src = c
    w = nw
    h = nh
  }
  renderer.dispose()
  let [ox, oy] = anchor
  let outH = height
  if (trimTop !== undefined) {
    const data = src.getContext('2d').getImageData(0, 0, width, height).data
    let first = 0
    search: for (; first < height; first++) for (let x = 0; x < width; x++) if (data[(first * width + x) * 4 + 3] > 0) break search
    const cut = Math.max(0, first - trimTop)
    if (cut > 0) {
      const c = document.createElement('canvas')
      c.width = width
      c.height = height - cut
      c.getContext('2d').drawImage(src, 0, -cut)
      src = c
      outH = height - cut
      oy -= cut
    }
  }
  return { url: src.toDataURL('image/png'), width, height: outH, anchor: [ox, oy] }
}
