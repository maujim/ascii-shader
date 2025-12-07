import React, { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useControls } from 'leva'

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

    // Scale greyscale value to the range of the available character set
    float characterIndex = floor((uCharactersCount - 1.0) * greyscaled);

    // If there are fewer characters, we want to avoid the space character being overly dominant.
    // This adjustment ensures that fewer characters (e.g., 6) still fill the entire space.
    float scaleFactor = max(1.0, float(uCharactersCount) / 20.0);
    characterIndex = floor(characterIndex * scaleFactor);

    // Map the character index to the correct character in the set
    vec2 characterPosition = vec2(mod(characterIndex, SIZE.x), floor(characterIndex / SIZE.y));
    vec2 offset = vec2(characterPosition.x, -characterPosition.y) / SIZE;
    vec2 charUV = mod(uv * (cell / SIZE), 1.0 / SIZE) - vec2(0., 1.0 / SIZE) + offset;
    vec4 asciiCharacter = texture2D(uCharacters, charUV);

    asciiCharacter.rgb = pixelized.rgb * asciiCharacter.r;
    asciiCharacter.a = pixelized.a;

    float boundarySize = 0.1;
    float transitionStart = 0.5 - (boundarySize / 16.0);
    float transitionEnd = 0.5 + (boundarySize / 8.0);

    // smooth transition between regular and ascii
    float blendFactor = smoothstep(transitionStart, transitionEnd, uv.x); // Adjust 0.45 - 0.55 for a smoother or sharper transition
    vec4 originalColor = texture2D(inputBuffer, uv);
    outputColor = mix(originalColor, asciiCharacter, blendFactor);
}
`

function TorusKnot(props) {
  const meshRef = useRef()
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  
  const { characters } = useControls('ascii', {
    characters: { value: 'abcd', label: 'character set' }
  })
  
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
    if (meshRef.current.material.uniforms) {
      meshRef.current.material.uniforms.time.value = state.clock.elapsedTime
    }
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
      <shaderMaterial
        fragmentShader={fragmentShader}
        uniforms={{
          time: { value: 0 }
        }}
      />
    </mesh>
  )
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
      </Canvas>
    </div>
  )
}
