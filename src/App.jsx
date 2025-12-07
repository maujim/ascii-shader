import React, { useRef, useState, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { useControls } from 'leva'
import { EffectComposer, RenderPass, EffectPass } from 'postprocessing'
import { Effect } from 'postprocessing'
import { Uniform, Color, CanvasTexture, NearestFilter, RepeatWrapping } from 'three'

extend({ EffectComposer, RenderPass, EffectPass })

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
    vec2 characterPosition = vec2(mod(characterIndex, SIZE.x), floor(characterIndex / SIZE.y));
    vec2 offset = vec2(characterPosition.x, -characterPosition.y) / SIZE;
    vec2 charUV = mod(uv * (cell / SIZE), 1.0 / SIZE) - vec2(0., 1.0 / SIZE) + offset;
    vec4 asciiCharacter = texture2D(uCharacters, charUV);
    asciiCharacter.rgb = uColor * asciiCharacter.r;
    asciiCharacter.a = pixelized.a;
    outputColor = asciiCharacter;
}
`

class ASCIIEffect extends Effect {
  constructor({ characters = 'abcd', fontSize = 54, cellSize = 16, color = '#ffffff', invert = false } = {}) {
    const uniforms = new Map([
      ['uCharacters', new Uniform(null)],
      ['uCellSize', new Uniform(cellSize)],
      ['uCharactersCount', new Uniform(characters.length)],
      ['uColor', new Uniform(new Color(color))],
      ['uInvert', new Uniform(invert)]
    ])
    super('ASCIIEffect', fragmentShader, { uniforms })
    this.updateCharacters(characters, fontSize)
  }

  updateCharacters(characters, fontSize) {
    const canvas = document.createElement('canvas')
    const SIZE = 1024
    const MAX_PER_ROW = 16
    const CELL = SIZE / MAX_PER_ROW
    canvas.width = canvas.height = SIZE
    
    const texture = new CanvasTexture(
      canvas,
      undefined,
      RepeatWrapping,
      RepeatWrapping,
      NearestFilter,
      NearestFilter
    )
    
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, SIZE, SIZE)
    context.font = `${fontSize}px monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = '#fff'
    
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i]
      const x = i % MAX_PER_ROW
      const y = Math.floor(i / MAX_PER_ROW)
      context.fillText(char, x * CELL + CELL / 2, y * CELL + CELL / 2)
    }
    
    texture.needsUpdate = true
    this.uniforms.get('uCharacters').value = texture
    this.uniforms.get('uCharactersCount').value = characters.length
  }
}

function TorusKnot(props) {
  const meshRef = useRef()
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  
  const { radius, tube, tubularSegments, radialSegments, p, q } = useControls('geometry', {
    radius: { value: 1, min: 0.1, max: 3, step: 0.1 },
    tube: { value: 0.3, min: 0.1, max: 1, step: 0.05 },
    tubularSegments: { value: 128, min: 3, max: 256, step: 1 },
    radialSegments: { value: 16, min: 3, max: 64, step: 1 },
    p: { value: 2, min: 1, max: 10, step: 1 },
    q: { value: 3, min: 1, max: 10, step: 1 }
  })
  
  useFrame((state, delta) => {
    meshRef.current.rotation.x += delta
    meshRef.current.rotation.y += delta * 0.5
  })
  
  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}>
      <torusKnotGeometry args={[radius, tube, tubularSegments, radialSegments, p, q]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  )
}

function Effects() {
  const { gl, scene, camera, size } = useThree()
  
  const { characters } = useControls('ascii', {
    characters: { value: 'abcd', label: 'character set' }
  })
  
  const composer = useMemo(() => {
    const comp = new EffectComposer(gl)
    comp.addPass(new RenderPass(scene, camera))
    return comp
  }, [gl, scene, camera])
  
  const asciiEffect = useMemo(() => new ASCIIEffect({ characters }), [])
  
  useEffect(() => {
    asciiEffect.updateCharacters(characters, 54)
  }, [characters, asciiEffect])
  
  const effectPass = useMemo(() => new EffectPass(camera, asciiEffect), [camera, asciiEffect])
  
  useEffect(() => {
    composer.addPass(effectPass)
    return () => composer.removePass(effectPass)
  }, [composer, effectPass])
  
  useEffect(() => {
    composer.setSize(size.width, size.height)
  }, [composer, size])
  
  useFrame(() => {
    composer.render()
  }, 1)
  
  return null
}

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <color attach="background" args={['black']} />
        <ambientLight intensity={Math.PI / 2} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
        <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
        <TorusKnot position={[0, 0, 0]} />
        <Effects />
      </Canvas>
    </div>
  )
}
