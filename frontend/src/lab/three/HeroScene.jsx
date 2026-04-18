import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Double-helix / DNA-like structure composed of paired spheres
 * with a translucent ribbon. Calm, pharmaceutical aesthetic.
 */
function Helix({ count = 40, radius = 1.6, height = 7 }) {
  const group = useRef()
  const left = useRef()
  const right = useRef()

  const positions = useMemo(() => {
    const arr = []
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const y = (t - 0.5) * height
      const angle = t * Math.PI * 6
      arr.push({ y, angle })
    }
    return arr
  }, [count, height])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (group.current) {
      group.current.rotation.y = t * 0.18
      group.current.rotation.x = Math.sin(t * 0.2) * 0.08
    }
  })

  return (
    <group ref={group}>
      {positions.map(({ y, angle }, i) => {
        const x1 = Math.cos(angle) * radius
        const z1 = Math.sin(angle) * radius
        const x2 = Math.cos(angle + Math.PI) * radius
        const z2 = Math.sin(angle + Math.PI) * radius
        const hue = 0.08 + (i / positions.length) * 0.05
        return (
          <group key={i}>
            <mesh position={[x1, y, z1]}>
              <sphereGeometry args={[0.11, 20, 20]} />
              <meshStandardMaterial
                color={new THREE.Color().setHSL(hue, 0.22, 0.55)}
                metalness={0.3}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[x2, y, z2]}>
              <sphereGeometry args={[0.11, 20, 20]} />
              <meshStandardMaterial
                color={new THREE.Color().setHSL(0.12, 0.35, 0.32)}
                metalness={0.3}
                roughness={0.35}
              />
            </mesh>
            {/* rung */}
            <mesh
              position={[(x1 + x2) / 2, y, (z1 + z2) / 2]}
              rotation={[0, angle, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.018, 0.018, radius * 2, 6]} />
              <meshStandardMaterial
                color="#2e5a47"
                transparent
                opacity={0.4}
                metalness={0.1}
                roughness={0.6}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Particles({ count = 220 }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 16
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2
    }
    return arr
  }, [count])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (ref.current) ref.current.rotation.y = t * 0.02
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#3a3f45"
        transparent
        opacity={0.55}
        sizeAttenuation
      />
    </points>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, -2, -3]} intensity={0.3} color="#c9a24b" />
      <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.8}>
        <Helix />
      </Float>
      <Particles />
      <Environment preset="studio" />
    </Canvas>
  )
}
