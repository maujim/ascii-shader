import React, { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useControls } from 'leva'

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
