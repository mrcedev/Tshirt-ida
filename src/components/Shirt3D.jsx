import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VIEWBOX } from '../lib/garments'

// T-shirt model from the Poimandres t-shirt configurator example (MIT license, © 2024 Poimandres).
const MODEL_URL = `${import.meta.env.BASE_URL}models/shirt.glb`
const FOV = 25
// Where the 2D editor's tee outline sits on its canvas (sleeve tips, collar, hem). These points are
// pinned to the edges of the 3D model, so a design lands in the same place in 2D and 3D.
const OUTLINE = { left: 4, right: 396, top: 22, bottom: 428 }

let modelPromise
function loadModel() {
  modelPromise ??= new GLTFLoader().loadAsync(MODEL_URL).catch((err) => {
    modelPromise = null
    throw err
  })
  return modelPromise
}

// Teach the model's fabric material to show the print. The front and back print canvases are
// projected straight onto the shirt (like a projector), blending around the side seams.
function addPrintProjection(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    const varyings = 'varying vec3 vPrintPos;\nvarying vec3 vPrintNormal;\n'
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrintPos = position;\nvPrintNormal = normal;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${varyings}uniform sampler2D uPrintFront;\nuniform sampler2D uPrintBack;\nuniform vec2 uPrintMin;\nuniform vec2 uPrintSize;\n`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 printUv = (vPrintPos.xy - uPrintMin) / uPrintSize;
        float facing = smoothstep(-0.3, 0.3, normalize(vPrintNormal).z);
        vec4 frontInk = texture2D(uPrintFront, printUv);
        vec4 backInk = texture2D(uPrintBack, vec2(1.0 - printUv.x, printUv.y));
        vec4 ink = mix(backInk, frontInk, facing);
        // No print on the inside of the shirt (seen through the neck opening).
        if (dot(normalize(vNormal), normalize(vViewPosition)) < -0.2) ink = vec4(0.0);
        diffuseColor.rgb = ink.rgb + diffuseColor.rgb * (1.0 - ink.a);`,
      )
  }
  material.customProgramCacheKey = () => 'print-projection'
}

// A soft round shadow texture for the floor under the shirt.
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,.28)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// Interactive 3D t-shirt. `front` and `back` are canvases holding the print; bump `version`
// whenever they've been redrawn. `side` turns the shirt to face front or back.
// Designs can be picked and dragged on the shirt: clicks are turned into 2D design coordinates
// and passed to `getLayerAt(side, x, y)`, `onSelect(id, side)` and `onMoveLayer(side, id, x, y)`.
export default function Shirt3D({ color, front, back, version, side, autoRotate, getLayerAt, onSelect, onMoveLayer }) {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const propsRef = useRef({ color, side })
  // Latest callbacks, read by the pointer handlers that are set up only once.
  const callbacks = useRef(null)
  callbacks.current = { getLayerAt, onSelect, onMoveLayer, side }
  // Set when picking a design on the other side changes `side`, so the camera doesn't spin away.
  const pickedSide = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const mount = mountRef.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setStatus('unsupported')
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.NeutralToneMapping // keeps garment colors true to the swatches
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envMap
    // Matching key lights front and back, so both sides of the shirt are lit evenly.
    const key = new THREE.DirectionalLight(0xffffff, 0.8)
    key.position.set(1, 2, 3)
    scene.add(key)
    const backKey = new THREE.DirectionalLight(0xffffff, 0.8)
    backKey.position.set(-1, 2, -3)
    scene.add(backKey)

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50)
    camera.position.set(0, 0, 2)

    // ---- Picking & dragging designs on the shirt ----
    // Registered before OrbitControls so a press on a design can stop the shirt from rotating.
    const canvas = renderer.domElement
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let drag = null
    let press = null

    // Where on the design (2D garment coordinates) the pointer touches the shirt, or null.
    const pick = (e) => {
      if (!state.mesh) return null
      const rect = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(state.mesh, false)[0]
      if (!hit) return null
      const p = state.mesh.worldToLocal(hit.point.clone())
      // Front or back is decided by the surface direction, exactly like the print projection.
      const n = state.mesh.geometry.attributes.normal
      const nz = n.getZ(hit.face.a) + n.getZ(hit.face.b) + n.getZ(hit.face.c)
      const hitSide = nz >= 0 ? 'front' : 'back'
      const u = (p.x - uniforms.uPrintMin.value.x) / uniforms.uPrintSize.value.x
      const v = (p.y - uniforms.uPrintMin.value.y) / uniforms.uPrintSize.value.y
      return { side: hitSide, x: (hitSide === 'back' ? 1 - u : u) * VIEWBOX.w, y: (1 - v) * VIEWBOX.h }
    }

    const selectOnSide = (id, s) => {
      if (s !== callbacks.current.side) pickedSide.current = s
      callbacks.current.onSelect?.(id, s)
    }

    const onPointerDown = (e) => {
      if (e.button !== 0) return
      press = { x: e.clientX, y: e.clientY }
      const at = pick(e)
      const layer = at && callbacks.current.getLayerAt?.(at.side, at.x, at.y)
      if (!layer) return
      e.stopImmediatePropagation() // don't rotate the shirt
      press = null
      drag = { id: layer.id, side: at.side, dx: at.x - layer.x, dy: at.y - layer.y, autoRotate: controls.autoRotate }
      controls.autoRotate = false
      selectOnSide(layer.id, at.side)
      canvas.setPointerCapture(e.pointerId)
      canvas.style.cursor = 'grabbing'
    }

    const onPointerMove = (e) => {
      if (drag) {
        // A design stays on its own side; past the side seam it simply stops following.
        const at = pick(e)
        if (at?.side === drag.side) callbacks.current.onMoveLayer?.(drag.side, drag.id, at.x - drag.dx, at.y - drag.dy)
        return
      }
      if (e.buttons) return // rotating the shirt
      const at = pick(e)
      canvas.style.cursor = at && callbacks.current.getLayerAt?.(at.side, at.x, at.y) ? 'move' : ''
    }

    const onPointerUp = (e) => {
      if (drag) {
        controls.autoRotate = drag.autoRotate
        drag = null
        canvas.style.cursor = 'move'
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
        return
      }
      // A click (not a rotate) on empty fabric or the background clears the selection.
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 4) callbacks.current.onSelect?.(null)
      press = null
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.minDistance = 0.6
    controls.maxDistance = 3
    controls.minPolarAngle = Math.PI * 0.25
    controls.maxPolarAngle = Math.PI * 0.68
    controls.autoRotateSpeed = 2

    const textures = [front, back].map((canvas) => {
      const t = new THREE.CanvasTexture(canvas)
      t.colorSpace = THREE.SRGBColorSpace
      t.premultiplyAlpha = true
      t.anisotropy = renderer.capabilities.getMaxAnisotropy()
      return t
    })
    const uniforms = {
      uPrintFront: { value: textures[0] },
      uPrintBack: { value: textures[1] },
      uPrintMin: { value: new THREE.Vector2() },
      uPrintSize: { value: new THREE.Vector2(1, 1) },
    }

    const shadowMap = shadowTexture()
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.visible = false
    scene.add(shadow)

    const targetColor = new THREE.Color(propsRef.current.color)
    const state = { material: null, mesh: null, targetColor, turnTo: null, size: null }
    let disposed = false

    loadModel()
      .then((gltf) => {
        if (disposed) return
        let source
        gltf.scene.traverse((o) => {
          if (o.isMesh && !source) source = o
        })
        const geometry = source.geometry
        geometry.computeBoundingBox()
        const box = geometry.boundingBox
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())

        // Map the 2D canvas onto the model: OUTLINE edges → model bounds.
        const sx = size.x / (OUTLINE.right - OUTLINE.left)
        const sy = size.y / (OUTLINE.bottom - OUTLINE.top)
        uniforms.uPrintSize.value.set(VIEWBOX.w * sx, VIEWBOX.h * sy)
        uniforms.uPrintMin.value.set(box.min.x - OUTLINE.left * sx, box.min.y - (VIEWBOX.h - OUTLINE.bottom) * sy)

        const material = source.material.clone()
        material.color.copy(targetColor)
        material.roughness = 0.95
        material.metalness = 0
        // The model's baked shadow map has a large dark patch on the back (it was baked against a wall),
        // so leave it out; folds still get shading from the shape and the fabric normal map.
        material.aoMap = null
        addPrintProjection(material, uniforms)
        state.material = material

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.copy(center).negate()
        scene.add(mesh)
        state.mesh = mesh

        shadow.scale.set(size.x * 1.5, size.z * 3, 1)
        shadow.position.y = -size.y / 2 - 0.02
        shadow.visible = true

        state.size = size
        fit()
        camera.position.set(0, 0, camera.position.length() * (propsRef.current.side === 'back' ? -1 : 1))
        setStatus('ready')
      })
      .catch(() => !disposed && setStatus('error'))

    // Frame the whole shirt for the current box size.
    const fit = () => {
      if (!state.size) return
      const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * 2
      const dist = Math.max((state.size.y * 1.3) / tan, (state.size.x * 1.3) / (tan * camera.aspect))
      camera.position.setLength(dist + state.size.z / 2)
    }

    let fitted = false
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (!fitted && state.size) {
        fit()
        fitted = true
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    const up = new THREE.Vector3(0, 1, 0)
    let raf
    const tick = () => {
      // Smoothly turn to the front or back when the side changes.
      if (state.turnTo !== null) {
        let delta = state.turnTo - controls.getAzimuthalAngle()
        delta = Math.atan2(Math.sin(delta), Math.cos(delta))
        if (Math.abs(delta) < 0.002) state.turnTo = null
        else camera.position.applyAxisAngle(up, delta * 0.12)
      }
      if (state.material) state.material.color.lerp(state.targetColor, 0.15)
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    sceneRef.current = { state, textures, controls }
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      controls.dispose()
      textures.forEach((t) => t.dispose())
      state.material?.dispose()
      shadow.geometry.dispose()
      shadow.material.dispose()
      shadowMap.dispose()
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
  }, [front, back])

  useEffect(() => {
    propsRef.current.color = color
    sceneRef.current?.state.targetColor.set(color)
  }, [color])

  useEffect(() => {
    sceneRef.current?.textures.forEach((t) => (t.needsUpdate = true))
  }, [version])

  useEffect(() => {
    propsRef.current.side = side
    // Picking a design on the shirt switches the side tab, but the camera should stay put.
    if (pickedSide.current === side) {
      pickedSide.current = null
      return
    }
    if (sceneRef.current) sceneRef.current.state.turnTo = side === 'back' ? Math.PI : 0
  }, [side])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.controls.autoRotate = autoRotate
  }, [autoRotate])

  return (
    <div className="stage-3d-wrap">
      <div ref={mountRef} className="stage-3d" aria-label="3D preview, drag to rotate, scroll to zoom" />
      {status !== 'ready' && (
        <div className="stage-3d-status muted">
          {status === 'loading' && 'Loading 3D model…'}
          {status === 'error' && 'The 3D model could not be loaded. Please try again.'}
          {status === 'unsupported' && '3D preview isn’t supported in this browser.'}
        </div>
      )}
    </div>
  )
}
