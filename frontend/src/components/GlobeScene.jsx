import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function GlobeMesh({ isRunning }) {
  const outerRef = useRef()
  const innerRef = useRef()
  const ring0 = useRef()
  const ring1 = useRef()
  const ring2 = useRef()

  useFrame((_, delta) => {
    const speed = isRunning ? 0.65 : 0.18
    if (outerRef.current) {
      outerRef.current.rotation.y += delta * speed * 0.7
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * speed * 0.5
      innerRef.current.rotation.x += delta * speed * 0.2
    }
    const mult = isRunning ? 1.6 : 0.5
    if (ring0.current) { ring0.current.rotation.x += delta * 0.11 * mult; ring0.current.rotation.z += delta * 0.07 * mult }
    if (ring1.current) { ring1.current.rotation.x -= delta * 0.09 * mult; ring1.current.rotation.y += delta * 0.05 * mult }
    if (ring2.current) { ring2.current.rotation.z += delta * 0.06 * mult; ring2.current.rotation.y -= delta * 0.04 * mult }
  })

  const INK = '#1f3a2e'

  return (
    <group>
      <mesh ref={outerRef}>
        <sphereGeometry args={[1.42, 18, 12]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.08} />
      </mesh>

      <mesh ref={innerRef}>
        <sphereGeometry args={[1.08, 12, 8]} />
        <meshBasicMaterial color={INK} wireframe transparent opacity={0.32} />
      </mesh>

      <mesh ref={ring0} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.72, 0.016, 4, 72]} />
        <meshBasicMaterial color={INK} transparent opacity={0.18} />
      </mesh>

      <mesh ref={ring1} rotation={[Math.PI / 2 + 0.4, 0, 0.7]}>
        <torusGeometry args={[2.0, 0.014, 4, 72]} />
        <meshBasicMaterial color={INK} transparent opacity={0.12} />
      </mesh>

      <mesh ref={ring2} rotation={[Math.PI / 2 - 0.3, 0.5, 1.1]}>
        <torusGeometry args={[2.28, 0.012, 4, 72]} />
        <meshBasicMaterial color={INK} transparent opacity={0.07} />
      </mesh>

      <pointLight color="#c9a24b" intensity={isRunning ? 1.5 : 0.8} distance={7} />
    </group>
  )
}

function ParticleCloud() {
  const ref = useRef()

  const positions = useMemo(() => {
    const n = 1600
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const r = 2.6 + Math.random() * 3.8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.025
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#1f3a2e" size={0.022} transparent opacity={0.15} sizeAttenuation />
    </points>
  )
}

export function GlobeScene({ isRunning = false }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.05} />
      <GlobeMesh isRunning={isRunning} />
      <ParticleCloud />
    </Canvas>
  )
}
