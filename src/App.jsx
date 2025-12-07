import React, { useRef, useState, useMemo, useEffect, useLayoutEffect } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { useControls, button } from 'leva'
import { Effect } from 'postprocessing'
import { Uniform, CanvasTexture, NearestFilter, RepeatWrapping, Box3, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

// --- 1. ASCII SHADER & EFFECT ---

const fragmentShader = `
uniform sampler2D uCharacters;
uniform float uCharactersCount;
uniform float uCellSize;
uniform bool uInvert;
uniform vec3 uColor;

const vec2 SIZE = vec2(16.);

vec3 greyscale(vec3 color, float strength) {
    float g = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(color, vec3(g), strength);
}

vec3 greyscale(vec3 color) {
    return greyscale(color, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cell = resolution / uCellSize;
    vec2 grid = 1.0 / cell;
    vec2 pixelizedUV = grid * (0.5 + floor(uv / grid));
    vec4 pixelized = texture2D(inputBuffer, pixelizedUV);
    float greyscaled = greyscale(pixelized.rgb).r;

    if (uInvert) {
        greyscaled = 1.0 - greyscaled;
    }

    float characterIndex = floor((uCharactersCount - 1.0) * greyscaled);
    float scaleFactor = max(1.0, float(uCharactersCount) / 20.0);
    characterIndex = floor(characterIndex * scaleFactor);

    vec2 characterPosition = vec2(mod(characterIndex, SIZE.x), floor(characterIndex / SIZE.y));
    vec2 offset = vec2(characterPosition.x, -characterPosition.y) / SIZE;
    vec2 charUV = mod(uv * (cell / SIZE), 1.0 / SIZE) - vec2(0., 1.0 / SIZE) + offset;
    vec4 asciiCharacter = texture2D(uCharacters, charUV);

    asciiCharacter.rgb = pixelized.rgb * asciiCharacter.r;
    asciiCharacter.a = pixelized.a;

    float boundarySize = 0.1;
    float transitionStart = 0.5 - (boundarySize / 16.0);
    float transitionEnd = 0.5 + (boundarySize / 8.0);

    float blendFactor = smoothstep(transitionStart, transitionEnd, uv.x); 
    vec4 originalColor = texture2D(inputBuffer, uv);
    outputColor = mix(originalColor, asciiCharacter, blendFactor);
}
`

class AsciiEffect extends Effect {
  constructor({ characters = " .:,'-^=*+?!|0#X%WM@", fontSize = 54, cellSize = 22, color = "#ffffff", invert = false }) {
    const uniforms = new Map([
      ["uCharacters", new Uniform(null)],
      ["uCellSize", new Uniform(cellSize)],
      ["uCharactersCount", new Uniform(characters.length)],
      ["uColor", new Uniform(color)],
      ["uInvert", new Uniform(invert)]
    ])

    super("AsciiEffect", fragmentShader, { uniforms })

    const charactersTexture = this.createCharactersTexture(characters, fontSize)
    this.uniforms.get("uCharacters").value = charactersTexture
  }

  createCharactersTexture(characters, fontSize) {
    const canvas = document.createElement("canvas")
    const size = 1024
    const rows = 16
    const step = size / rows

    canvas.width = canvas.height = size
    const context = canvas.getContext("2d")
    
    if (!context) throw new Error("Context not available")

    context.clearRect(0, 0, size, size)
    context.font = `${fontSize}px arial`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = "#fff"

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]
      const x = i % rows
      const y = Math.floor(i / rows)
      context.fillText(char, x * step + step / 2, y * step + step / 2)
    }

    const texture = new CanvasTexture(canvas)
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    texture.needsUpdate = true

    return texture
  }
}

// --- 2. GEOMETRY COMPONENTS ---

function TorusKnotGeometry() {
  const config = useControls("Model Parameters", {
    radius: { value: 2, min: 0, max: 10 },
    tube: { value: 0.5, min: 0, max: 2 },
    tubularSegments: { value: 96, min: 3, max: 300, step: 1 },
    radialSegments: { value: 8, min: 3, max: 64, step: 1 },
    p: { value: 2, min: 1, max: 20, step: 1 },
    q: { value: 3, min: 1, max: 20, step: 1 },
  })
  
  return <torusKnotGeometry args={[config.radius, config.tube, config.tubularSegments, config.radialSegments, config.p, config.q]} />
}

function BoxGeometry() {
  const config = useControls("Model Parameters", {
    width: { value: 3, min: 1, max: 10 },
    height: { value: 3, min: 1, max: 10 },
    depth: { value: 3, min: 1, max: 10 },
    widthSegments: { value: 1, min: 1, max: 20, step: 1 },
  })

  return <boxGeometry args={[config.width, config.height, config.depth, config.widthSegments, config.widthSegments, config.widthSegments]} />
}

function SphereGeometry() {
  const config = useControls("Model Parameters", {
    radius: { value: 2.5, min: 0.5, max: 10 },
    widthSegments: { value: 32, min: 3, max: 64, step: 1 },
    heightSegments: { value: 16, min: 2, max: 32, step: 1 },
  })

  return <sphereGeometry args={[config.radius, config.widthSegments, config.heightSegments]} />
}

function IcosahedronGeometry() {
  const config = useControls("Model Parameters", {
    radius: { value: 2.5, min: 0.5, max: 10 },
    detail: { value: 0, min: 0, max: 5, step: 1 },
  })

  return <icosahedronGeometry args={[config.radius, config.detail]} />
}

function CustomGeometry({ url }) {
  const gltf = useLoader(GLTFLoader, url)
  const ref = useRef()

  // Auto-centering and scaling logic
  useLayoutEffect(() => {
    if (ref.current) {
      const box = new Box3().setFromObject(ref.current)
      const size = new Vector3()
      box.getSize(size)
      const center = new Vector3()
      box.getCenter(center)

      // Reset position to center
      ref.current.position.set(-center.x, -center.y, -center.z)

      // Scale to fit a normalized box (e.g., max dimension of 4)
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 4 / maxDim
      ref.current.scale.set(scale, scale, scale)
    }
  }, [gltf])

  return (
    <group>
      <primitive ref={ref} object={gltf.scene} />
    </group>
  )
}

// --- 3. ROTATING WRAPPER COMPONENT ---

function RotatingMesh({ children, scale = 1 }) {
  const ref = useRef()
  const [hovered, setHover] = useState(false)
  const [clicked, setClick] = useState(false)

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x += 0.66 * delta
      ref.current.rotation.y += 0.66 * delta
    }
  })

  return (
    <mesh
      ref={ref}
      scale={scale}
      onClick={() => setClick(!clicked)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {children}
      <meshStandardMaterial color={hovered ? "hotpink" : "orange"} />
    </mesh>
  )
}

// --- 4. SCENE COMPONENT ---

function Scene({ inputRef, customModelUrl }) {
  // Global controls
  // We use the "api" returned by useControls (the second argument `set`) to programmatically update controls
  const [{ chars, model, scale }, setControls] = useControls("Settings", () => ({
    chars: " .,=mukund",
    // Button to trigger file input (ref is passed from App)
    upload: button(() => inputRef.current?.click()),
    model: { 
      value: 'TorusKnot', 
      options: ['TorusKnot', 'Box', 'Sphere', 'Icosahedron', 'Custom'] 
    },
    scale: { value: 0.75, min: 0.1, max: 3 },
  }))

  // Automatically switch the dropdown to 'Custom' when a new file is uploaded
  useEffect(() => {
    if (customModelUrl) {
      setControls({ model: 'Custom' })
    }
  }, [customModelUrl, setControls])

  // Create effect
  const effect = useMemo(() => {
    return new AsciiEffect({
      characters: chars,
      fontSize: 54,
      cellSize: 22,
      color: "#ffffff",
      invert: false
    })
  }, [chars])

  return (
    <>
      <color attach="background" args={["black"]} />
      
      <ambientLight intensity={Math.PI / 2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

      <RotatingMesh scale={scale}>
        {model === 'TorusKnot' && <TorusKnotGeometry />}
        {model === 'Box' && <BoxGeometry />}
        {model === 'Sphere' && <SphereGeometry />}
        {model === 'Icosahedron' && <IcosahedronGeometry />}
        {model === 'Custom' && customModelUrl && <CustomGeometry url={customModelUrl} />}
      </RotatingMesh>

      <EffectComposer>
        <primitive object={effect} />
      </EffectComposer>
    </>
  )
}

// --- 5. MAIN ENTRY ---

export default function App() {
  const inputRef = useRef(null)
  const [customModelUrl, setCustomModelUrl] = useState(null)

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setCustomModelUrl(url)
    }
  }

  return (
    <>
      {/* HTML Input must be OUTSIDE the Canvas */}
      <input 
        type="file" 
        ref={inputRef} 
        style={{ display: 'none' }} 
        accept=".glb,.gltf"
        onChange={handleFileUpload}
      />

      <Canvas style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'black' }}>
        <Scene inputRef={inputRef} customModelUrl={customModelUrl} />
      </Canvas>
    </>
  )
}
