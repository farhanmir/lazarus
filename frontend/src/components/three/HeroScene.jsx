import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'

const Y_UP = new THREE.Vector3(0, 1, 0)

/**
 * Returns a quaternion that rotates the Y-axis to point from (ax,ay,az) toward (bx,by,bz).
 * Used to correctly orient cylinder meshes between two points.
 */
function quatBetween(ax, ay, az, bx, by, bz) {
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az).normalize()
  return new THREE.Quaternion().setFromUnitVectors(Y_UP, dir)
}

function Helix({ count = 36, radius = 1.6, height = 7 }) {
  const group = useRef()

  const { nodes, rungs, backboneA, backboneB } = useMemo(() => {
    // Build helix node positions for both strands
    const nodes = []
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1)
      const y = (t - 0.5) * height
      const angle = t * Math.PI * 6
      const x1 = Math.cos(angle) * radius
      const z1 = Math.sin(angle) * radius
      // Strand B is exactly opposite on the helix
      const x2 = -x1
      const z2 = -z1
      nodes.push({ y, x1, z1, x2, z2 })
    }

    // Rungs: horizontal cylinders connecting paired spheres across the two strands
    const rungs = nodes.map(({ x1, y, z1, x2, z2 }) => {
      const length = new THREE.Vector3(x2 - x1, 0, z2 - z1).length()
      return {
        pos: [(x1 + x2) / 2, y, (z1 + z2) / 2],
        q: quatBetween(x1, y, z1, x2, y, z2),
        length,
      }
    })

    // Backbone A: thin cylinders connecting consecutive strand-1 spheres
    const backboneA = []
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1]
      const length = new THREE.Vector3(b.x1 - a.x1, b.y - a.y, b.z1 - a.z1).length()
      backboneA.push({
        pos: [(a.x1 + b.x1) / 2, (a.y + b.y) / 2, (a.z1 + b.z1) / 2],
        q: quatBetween(a.x1, a.y, a.z1, b.x1, b.y, b.z1),
        length,
      })
    }

    // Backbone B: thin cylinders connecting consecutive strand-2 spheres
    const backboneB = []
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1]
      const length = new THREE.Vector3(b.x2 - a.x2, b.y - a.y, b.z2 - a.z2).length()
      backboneB.push({
        pos: [(a.x2 + b.x2) / 2, (a.y + b.y) / 2, (a.z2 + b.z2) / 2],
        q: quatBetween(a.x2, a.y, a.z2, b.x2, b.y, b.z2),
        length,
      })
    }

    return { nodes, rungs, backboneA, backboneB }
  }, [count, height, radius])

  // Shared materials
  const matA = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.09, 0.18, 0.68),
    metalness: 0.25,
    roughness: 0.38,
  }), [])

  const matB = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.11, 0.30, 0.48),
    metalness: 0.25,
    roughness: 0.38,
  }), [])

  const matBackbone = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2e5a47',
    transparent: true,
    opacity: 0.75,
    metalness: 0.15,
    roughness: 0.55,
  }), [])

  const matRung = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#3a6e5a',
    transparent: true,
    opacity: 0.45,
    metalness: 0.1,
    roughness: 0.65,
  }), [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (group.current) {
      group.current.rotation.y = t * 0.18
      group.current.rotation.x = Math.sin(t * 0.2) * 0.08
    }
  })

  return (
    <group ref={group}>
      {/* Strand A — nodes */}
      {nodes.map(({ x1, y, z1 }, i) => (
        <mesh key={`a-${i}`} position={[x1, y, z1]} material={matA}>
          <sphereGeometry args={[0.12, 18, 18]} />
        </mesh>
      ))}

      {/* Strand B — nodes */}
      {nodes.map(({ x2, y, z2 }, i) => (
        <mesh key={`b-${i}`} position={[x2, y, z2]} material={matB}>
          <sphereGeometry args={[0.12, 18, 18]} />
        </mesh>
      ))}

      {/* Backbone A — strand 1 spine */}
      {backboneA.map(({ pos, q, length }, i) => (
        <mesh key={`ba-${i}`} position={pos} quaternion={q} material={matBackbone}>
          <cylinderGeometry args={[0.03, 0.03, length, 6]} />
        </mesh>
      ))}

      {/* Backbone B — strand 2 spine */}
      {backboneB.map(({ pos, q, length }, i) => (
        <mesh key={`bb-${i}`} position={pos} quaternion={q} material={matBackbone}>
          <cylinderGeometry args={[0.03, 0.03, length, 6]} />
        </mesh>
      ))}

      {/* Rungs — horizontal crossbars between the two strands */}
      {rungs.map(({ pos, q, length }, i) => (
        <mesh key={`rung-${i}`} position={pos} quaternion={q} material={matRung}>
          <cylinderGeometry args={[0.016, 0.016, length, 6]} />
        </mesh>
      ))}
    </group>
  )
}

function Particles({ count = 180 }) {
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
    if (ref.current) ref.current.rotation.y = state.clock.getElapsedTime() * 0.02
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#3a3f45" transparent opacity={0.45} sizeAttenuation />
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
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 8, 5]} intensity={1.1} />
      <directionalLight position={[-5, -2, -3]} intensity={0.3} color="#c9a24b" />
      <Helix />
      <Particles />
      <Environment preset="studio" />
    </Canvas>
  )
}
