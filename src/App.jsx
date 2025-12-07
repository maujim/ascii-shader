import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useControls } from "leva";
import { Effect } from "postprocessing";
import { Uniform, CanvasTexture, NearestFilter, RepeatWrapping } from "three";

// 1. The Fragment Shader
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
`;

// 2. The Custom Post-Processing Effect Class
class AsciiEffect extends Effect {
  constructor({
    characters = " .:,'-^=*+?!|0#X%WM@",
    fontSize = 54,
    cellSize = 22,
    color = "#ffffff",
    invert = false,
  }) {
    const uniforms = new Map([
      ["uCharacters", new Uniform(null)],
      ["uCellSize", new Uniform(cellSize)],
      ["uCharactersCount", new Uniform(characters.length)],
      ["uColor", new Uniform(color)],
      ["uInvert", new Uniform(invert)],
    ]);

    super("AsciiEffect", fragmentShader, { uniforms });

    const charactersTexture = this.createCharactersTexture(
      characters,
      fontSize,
    );
    this.uniforms.get("uCharacters").value = charactersTexture;
  }

  createCharactersTexture(characters, fontSize) {
    const canvas = document.createElement("canvas");
    const size = 1024;
    const rows = 16;
    const step = size / rows;

    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d");

    if (!context) throw new Error("Context not available");

    context.clearRect(0, 0, size, size);
    context.font = `${fontSize}px arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";

    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      const x = i % rows;
      const y = Math.floor(i / rows);
      context.fillText(char, x * step + step / 2, y * step + step / 2);
    }

    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;

    return texture;
  }
}

// 3. The 3D Component
function TorusKnot(props) {
  const ref = useRef();
  const [hovered, setHover] = useState(false);
  const [clicked, setClick] = useState(false);

  useFrame((state, delta) => {
    if (ref.current) {
      ref.current.rotation.x += 0.66 * delta;
      ref.current.rotation.y += 0.66 * delta;
    }
  });

  const config = useControls("TorusKnotGeometry", {
    radius: { value: 2, min: 0, max: 10 },
    tube: { value: 0.5, min: 0, max: 2 },
    tubularSegments: { value: 96, min: 3, max: 300, step: 1 },
    radialSegments: { value: 8, min: 3, max: 64, step: 1 },
    p: { value: 2, min: 1, max: 20, step: 1 },
    q: { value: 3, min: 1, max: 20, step: 1 },
    scale: { value: 0.75, min: 0.1, max: 5 },
  });

  return (
    <mesh
      {...props}
      ref={ref}
      scale={config.scale}
      onClick={() => setClick(!clicked)}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <torusKnotGeometry
        args={[
          config.radius,
          config.tube,
          config.tubularSegments,
          config.radialSegments,
          config.p,
          config.q,
        ]}
      />
      <meshStandardMaterial color={hovered ? "hotpink" : "orange"} />
    </mesh>
  );
}

// 4. The Main Application
export default function App() {
  const { chars } = useControls("ASCII Shader", {
    chars: " .,=mukund",
  });

  const effect = useMemo(() => {
    return new AsciiEffect({
      characters: chars,
      fontSize: 54,
      cellSize: 22,
      color: "#ffffff",
      invert: false,
    });
  }, [chars]);

  return (
    // Style applied here to force full screen dimensions
    <Canvas
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "black",
      }}
    >
      <color attach="background" args={["black"]} />

      <ambientLight intensity={Math.PI / 2} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        decay={0}
        intensity={Math.PI}
      />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />

      <TorusKnot position={[0, 0, 0]} />

      <EffectComposer>
        <primitive object={effect} />
      </EffectComposer>
    </Canvas>
  );
}
