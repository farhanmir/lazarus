import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Html, MeshTransmissionMaterial, Environment, Stars } from '@react-three/drei'
import * as THREE from 'three'

const AGENT_META = [
  { id: 'scout', label: 'Scout',         color: '#d4c48a', backendAliases: ['advocate', 'advocate_iteration'] },
  { id: 'skeptic', label: 'Skeptic',     color: '#9b3d3d', backendAliases: ['skeptic', 'skeptic_iteration'] },
  { id: 'coroner', label: 'Coroner',     color: '#8e9fa8', backendAliases: ['parallel_evidence', 'evidence_curator', 'evidence_iteration'] },
  { id: 'defibrillator', label: 'Defib', color: '#c9a24b', backendAliases: ['assessment', 'assessment_iteration', 'judge', 'hitl_router'] },
  { id: 'trial_strategist', label: 'Strategist', color: '#2e5a47', backendAliases: ['trial_strategist'] },
]

/* Central asset nucleus — glass sphere that intensifies with progress */
function Nucleus({ intensity = 0, running }) {
  const ref = useRef()
  const innerRef = useRef()
  useFrame((state, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.2
      ref.current.rotation.x += dt * 0.08
    }
    if (innerRef.current) {
      const t = state.clock.getElapsedTime()
      const base = 1 + intensity * 0.12
      const pulse = running ? Math.sin(t * 3) * 0.04 : 0
      innerRef.current.scale.setScalar(base + pulse)
    }
  })

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[1.2, 1]} />
        <MeshTransmissionMaterial
          thickness={0.6}
          roughness={0.05}
          transmission={1}
          ior={1.35}
          chromaticAberration={0.03}
          backside
          color={'#f2efe7'}
        />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshStandardMaterial
          color={'#c9a24b'}
          emissive={'#c9a24b'}
          emissiveIntensity={0.3 + intensity * 1.2}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

/* One agent orb. Pulses when running. Glows when complete. */
function AgentOrb({ position, status, color, label, onHover }) {
  const ref = useRef()
  const ring = useRef()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (ref.current) {
      // subtle bob
      ref.current.position.y = position[1] + Math.sin(t * 1.2 + position[0]) * 0.05
    }
    if (ring.current) {
      ring.current.rotation.z += 0.012
    }
  })

  const emissive = status === 'running'
    ? 1.2 + Math.sin(Date.now() * 0.006) * 0.4
    : status === 'completed' ? 0.7 : 0.08
  const statusColor = status === 'failed' ? '#9b3d3d' : color
  const opacity = status === 'pending' ? 0.6 : 1

  return (
    <group position={position} ref={ref} onPointerOver={() => onHover?.(label)} onPointerOut={() => onHover?.(null)}>
      {/* Orb */}
      <mesh>
        <sphereGeometry args={[0.36, 48, 48]} />
        <meshPhysicalMaterial
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={emissive}
          metalness={0.2}
          roughness={0.2}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
          transparent
          opacity={opacity}
        />
      </mesh>

      {/* Halo ring when running */}
      {status === 'running' && (
        <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.55, 64]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Completion halo */}
      {status === 'completed' && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.48, 64]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Label */}
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#14171a',
          background: 'rgba(255,255,255,0.7)',
          padding: '3px 8px',
          border: '1px solid rgba(20,23,26,0.14)',
          whiteSpace: 'nowrap',
          transform: 'translateY(36px)',
          backdropFilter: 'blur(6px)',
        }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

/* Beam connecting a running agent to the nucleus */
function Beam({ from, to, active, color }) {
  const ref = useRef()
  const fromVec = useMemo(() => new THREE.Vector3(...from), [from])
  const toVec = useMemo(() => new THREE.Vector3(...to), [to])
  const mid = useMemo(() => fromVec.clone().add(toVec).multiplyScalar(0.5), [fromVec, toVec])
  const length = useMemo(() => fromVec.distanceTo(toVec), [fromVec, toVec])
  const quat = useMemo(() => {
    const dir = toVec.clone().sub(fromVec).normalize()
    const up = new THREE.Vector3(0, 1, 0)
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir)
    return q
  }, [fromVec, toVec])

  useFrame(() => {
    if (ref.current && active) {
      ref.current.material.opacity = 0.35 + Math.sin(Date.now() * 0.004) * 0.25
    } else if (ref.current) {
      ref.current.material.opacity = Math.max(0, ref.current.material.opacity - 0.01)
    }
  })

  return (
    <mesh ref={ref} position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.02, 0.02, length, 8, 1, true]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/* Rotating ring of orbits — the scene root */
function OrbitSystem({ agents, intensity, running }) {
  const group = useRef()
  useFrame((state, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.06
    }
  })

  const radius = 3.2
  const positions = useMemo(
    () =>
      AGENT_META.map((_, i) => {
        const angle = (i / AGENT_META.length) * Math.PI * 2
        return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
      }),
    [],
  )

  const statusByAgent = useMemo(() => {
    const map = {}
    AGENT_META.forEach((a) => { map[a.id] = 'pending' })
    // Map backend agent names to frontend IDs via aliases
    AGENT_META.forEach((meta) => {
      const aliases = meta.backendAliases || [meta.id]
      for (const alias of aliases) {
        const match = agents.find((a) => a.agent_name === alias && a.status === 'completed')
        if (match) { map[meta.id] = 'completed'; break }
      }
      if (map[meta.id] === 'pending') {
        for (const alias of aliases) {
          const match = agents.find((a) => a.agent_name === alias)
          if (match) { map[meta.id] = match.status; break }
        }
      }
    })
    return map
  }, [agents])

  return (
    <group ref={group}>
      <Nucleus intensity={intensity} running={running} />
      {AGENT_META.map((a, i) => {
        const pos = positions[i]
        const status = statusByAgent[a.id] ?? 'pending'
        return (
          <React.Fragment key={a.id}>
            <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
              <AgentOrb
                position={pos}
                status={status}
                color={a.color}
                label={a.label}
              />
            </Float>
            <Beam
              from={[0, 0, 0]}
              to={pos}
              active={status === 'running'}
              color={a.color}
            />
          </React.Fragment>
        )
      })}
    </group>
  )
}

function AmbientParticles({ count = 400 }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 8
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])

  useFrame((state, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.015
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
      <pointsMaterial size={0.03} color="#2e5a47" transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

export default function AgentOrbitScene({ steps = [], running = false }) {
  const completed = steps.filter((s) => s.status === 'completed').length
  const intensity = completed / 5

  return (
    <Canvas
      camera={{ position: [0, 2.2, 7.5], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 8, 4]} intensity={1.1} />
      <directionalLight position={[-4, 2, -4]} intensity={0.4} color="#c9a24b" />
      <pointLight position={[0, 0, 0]} intensity={1.5 + intensity * 2} color="#c9a24b" distance={6} />

      <OrbitSystem agents={steps} intensity={intensity} running={running} />
      <AmbientParticles />
      <Stars radius={30} depth={40} count={500} factor={2} saturation={0} fade speed={0.4} />
      <Environment preset="studio" />
    </Canvas>
  )
}
