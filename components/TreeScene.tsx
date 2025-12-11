import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Environment, 
  Sparkles, 
  ContactShadows,
  MeshReflectorMaterial,
  shaderMaterial
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { TreeConfig, TreeMorphState } from '../types';

// --- Shaders ---

const FoliageMaterial = shaderMaterial(
  {
    uTime: 0,
    uProgress: 0, // 0 = Scattered, 1 = Tree
    uColor: new THREE.Color("#023E24"), // Emerald
    uGlowColor: new THREE.Color("#FFD700"), // Gold
    uPixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 2.0
  },
  // Vertex Shader
  `
    uniform float uTime;
    uniform float uProgress;
    uniform float uPixelRatio;
    
    attribute vec3 aTargetPos;
    attribute float aRandom;
    attribute float aSize;
    
    varying float vAlpha;
    varying float vRandom;
    varying vec3 vPos;

    // Cubic ease out function for smoother transition
    float easeOutCubic(float x) {
      return 1.0 - pow(1.0 - x, 3.0);
    }

    void main() {
      vRandom = aRandom;
      
      // Interpolation logic
      float t = easeOutCubic(uProgress);
      
      // Mix positions
      vec3 pos = mix(position, aTargetPos, t);
      
      // Breathing effect (active mostly when formed as tree)
      float breath = sin(uTime * 2.0 + aRandom * 10.0) * 0.03 * t;
      pos += normal * breath; // Expand along normal roughly (using position as normal approx for sphere/cone)

      // Jitter when scattered
      float jitter = sin(uTime + aRandom * 50.0) * 0.1 * (1.0 - t);
      pos.x += jitter;
      pos.y += jitter;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      // Size attenuation
      gl_PointSize = (aSize * 30.0 * uPixelRatio) * (1.0 / -mvPosition.z);
      
      // Scale down slightly when scattering to look like dust
      gl_PointSize *= (0.5 + 0.5 * t);

      gl_Position = projectionMatrix * mvPosition;
      
      vPos = pos;
      vAlpha = 0.6 + 0.4 * sin(uTime * 1.5 + aRandom * 20.0);
    }
  `,
  // Fragment Shader
  `
    uniform vec3 uColor;
    uniform vec3 uGlowColor;
    varying float vAlpha;
    varying float vRandom;

    void main() {
      // Circular soft particle
      vec2 center = vec2(0.5);
      float dist = distance(gl_PointCoord, center);
      
      if (dist > 0.5) discard;
      
      // Soft edge
      float strength = 1.0 - smoothstep(0.3, 0.5, dist);
      
      // Inner glow logic
      vec3 finalColor = mix(uColor, uGlowColor, strength * 0.4 * vRandom);
      
      // Extra highlight in center
      if (dist < 0.1) finalColor += 0.2;

      gl_FragColor = vec4(finalColor, vAlpha * strength);
      
      // Tone mapping fix for standard THREE pipeline (approximation)
      gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(1.0/2.2)); 
    }
  `
);

extend({ FoliageMaterial });

// --- Materials for Mesh Objects ---

const GoldMaterial = new THREE.MeshStandardMaterial({
  color: "#FFD700",
  roughness: 0.1,
  metalness: 1.0,
  emissive: "#8A6E36",
  emissiveIntensity: 0.2
});

const GiftMaterial = new THREE.MeshStandardMaterial({
  color: "#590e0e", // Velvet Red
  roughness: 0.4,
  metalness: 0.6,
  emissive: "#200000",
  emissiveIntensity: 0.1
});

// --- Helper Math ---

const randomInSphere = (radius: number, biasY: number = 0): THREE.Vector3 => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random()) * radius;
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta) + biasY,
    r * Math.cos(phi)
  );
};

// --- Components ---

const StarTopper = ({ morphState }: { morphState: TreeMorphState }) => {
  const ref = useRef<THREE.Group>(null);
  const currentPos = useRef(new THREE.Vector3(0, 4.2, 0));
  
  const treePos = new THREE.Vector3(0, 4.2, 0);
  const scatterPos = useMemo(() => new THREE.Vector3(0, 7, 0), []); 

  useFrame((state, delta) => {
    if (!ref.current) return;
    const target = morphState === TreeMorphState.TREE_SHAPE ? treePos : scatterPos;
    // Heavy star moves slower
    currentPos.current.lerp(target, delta * 1.0); 
    ref.current.position.copy(currentPos.current);
    ref.current.rotation.y += delta * 0.5;
  });

  return (
    <group position={[0, 4.2, 0]} ref={ref}>
      <mesh>
        <octahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial 
          color="#FFFAEE" 
          emissive="#FFD700" 
          emissiveIntensity={2} 
          toneMapped={false} 
        />
      </mesh>
      <pointLight distance={5} intensity={5} color="#FFD700" decay={2} />
    </group>
  );
};

// The core interactive system
const MorphingTree = ({ config }: { config: TreeConfig }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const foliageMatRef = useRef<any>(null);
  const ornamentRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  const progress = useRef(1); // 0 = Scattered, 1 = Tree
  
  // --- Data Generation ---
  
  const { pointsGeometry, ornamentData, giftData } = useMemo(() => {
    // 1. FOLIAGE (POINTS)
    const foliageCount = 8000;
    const geometry = new THREE.BufferGeometry();
    const positions = []; // Scatter pos (attribute: position)
    const targetPos = []; // Tree pos (attribute: aTargetPos)
    const randoms = [];
    const sizes = [];

    // Layers for Tree Shape
    const layers = [
      { y: -1.0, r: 2.3, h: 1.5 },
      { y: 0.2, r: 1.9, h: 1.5 },
      { y: 1.4, r: 1.5, h: 1.5 },
      { y: 2.5, r: 1.1, h: 1.2 },
      { y: 3.4, r: 0.7, h: 1.0 },
    ];

    for (let i = 0; i < foliageCount; i++) {
      // SCATTER: Cloud around center
      const sPos = randomInSphere(8, 2);
      positions.push(sPos.x, sPos.y, sPos.z);

      // TREE: Points on cone surface + slight volume
      const layer = layers[Math.floor(Math.random() * layers.length)];
      const hRatio = Math.random(); 
      const yOffset = (hRatio - 0.5) * layer.h;
      // Volume bias: mostly surface, some internal
      const rBias = Math.random() > 0.8 ? Math.random() : 0.9 + Math.random() * 0.1;
      const currentRadius = layer.r * (1 - hRatio) * rBias;
      
      const theta = Math.random() * Math.PI * 2;
      targetPos.push(
        Math.cos(theta) * currentRadius,
        layer.y + yOffset,
        Math.sin(theta) * currentRadius
      );

      randoms.push(Math.random());
      sizes.push(Math.random() * 0.5 + 0.5);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aTargetPos', new THREE.Float32BufferAttribute(targetPos, 3));
    geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));

    // 2. ORNAMENTS (SPHERES - LIGHT)
    const sphereCount = 120;
    const oScatter = new Float32Array(sphereCount * 3);
    const oTree = new Float32Array(sphereCount * 3);

    let oIdx = 0;
    for (let i = 0; i < 5; i++) {
       const yBase = -1.5 + i * 1.1;
       const radiusBase = 2.0 - (i * 0.4);
       const count = 10 + i * 4; 
       for (let j = 0; j < count; j++) {
           if (oIdx >= sphereCount) break;
           const sPos = randomInSphere(7, 1);
           oScatter[oIdx*3] = sPos.x; oScatter[oIdx*3+1] = sPos.y; oScatter[oIdx*3+2] = sPos.z;

           const angle = (j / count) * Math.PI * 2 + (i * 0.5);
           oTree[oIdx*3] = Math.cos(angle) * (radiusBase * 0.95);
           oTree[oIdx*3+1] = yBase - 0.1 + (Math.random() * 0.3);
           oTree[oIdx*3+2] = Math.sin(angle) * (radiusBase * 0.95);
           oIdx++;
       }
    }

    // 3. GIFTS (BOXES - HEAVY)
    const giftCount = 25;
    const gScatter = new Float32Array(giftCount * 3);
    const gTree = new Float32Array(giftCount * 3);
    const gRotation = new Float32Array(giftCount * 3);

    for (let i = 0; i < giftCount; i++) {
      // Scatter lower to ground (heavy)
      const sPos = randomInSphere(5, -1); 
      gScatter[i*3] = sPos.x; gScatter[i*3+1] = sPos.y; gScatter[i*3+2] = sPos.z;

      // Spiral placement but sparse
      const theta = (i / giftCount) * Math.PI * 10;
      const y = -1.5 + (i / giftCount) * 4.5;
      const r = 2.4 * (1 - (i/giftCount) * 0.8);
      
      gTree[i*3] = Math.cos(theta) * r;
      gTree[i*3+1] = y;
      gTree[i*3+2] = Math.sin(theta) * r;

      gRotation[i*3] = Math.random() * Math.PI;
      gRotation[i*3+1] = Math.random() * Math.PI;
      gRotation[i*3+2] = Math.random() * Math.PI;
    }

    return { 
      pointsGeometry: geometry,
      ornamentData: { scatter: oScatter, tree: oTree, count: oIdx },
      giftData: { scatter: gScatter, tree: gTree, rot: gRotation, count: giftCount }
    };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const vec3Scatter = useMemo(() => new THREE.Vector3(), []);
  const vec3Tree = useMemo(() => new THREE.Vector3(), []);
  const currentVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    // Rotation
    if (groupRef.current) {
      const speedMult = config.morphState === TreeMorphState.SCATTERED ? 0.2 : 1.0;
      groupRef.current.rotation.y += delta * config.rotationSpeed * speedMult;
    }

    // Progress Logic
    const targetProgress = config.morphState === TreeMorphState.TREE_SHAPE ? 1 : 0;
    progress.current = THREE.MathUtils.lerp(progress.current, targetProgress, delta * 2.0);
    const t = progress.current;

    // Easing for CPU animations
    const smoothT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // 1. UPDATE FOLIAGE SHADER
    if (foliageMatRef.current) {
      foliageMatRef.current.uTime = state.clock.elapsedTime;
      foliageMatRef.current.uProgress = t; // Shader handles its own easing
    }

    // 2. UPDATE SPHERES (Light Physics)
    if (ornamentRef.current) {
      for (let i = 0; i < ornamentData.count; i++) {
        vec3Scatter.set(ornamentData.scatter[i*3], ornamentData.scatter[i*3+1], ornamentData.scatter[i*3+2]);
        vec3Tree.set(ornamentData.tree[i*3], ornamentData.tree[i*3+1], ornamentData.tree[i*3+2]);
        
        currentVec.lerpVectors(vec3Scatter, vec3Tree, smoothT);
        
        // Float effect (Fast)
        if (t < 0.99) {
          currentVec.y += Math.sin(state.clock.elapsedTime * 2.0 + i) * 0.1 * (1-smoothT);
        }

        dummy.position.copy(currentVec);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        ornamentRef.current.setMatrixAt(i, dummy.matrix);
      }
      ornamentRef.current.instanceMatrix.needsUpdate = true;
    }

    // 3. UPDATE GIFTS (Heavy Physics)
    if (giftsRef.current) {
      for (let i = 0; i < giftData.count; i++) {
        vec3Scatter.set(giftData.scatter[i*3], giftData.scatter[i*3+1], giftData.scatter[i*3+2]);
        vec3Tree.set(giftData.tree[i*3], giftData.tree[i*3+1], giftData.tree[i*3+2]);
        
        // Heavy objects lag behind slightly in transition
        const heavyT = Math.max(0, smoothT - 0.1); 
        // Renormalize to 0-1 range roughly
        const effectiveT = THREE.MathUtils.clamp(heavyT * 1.1, 0, 1);

        currentVec.lerpVectors(vec3Scatter, vec3Tree, effectiveT);

        // Float effect (Slow/Heavy)
        if (t < 0.99) {
           currentVec.y += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.05 * (1-effectiveT);
           // Slow rotation while floating
           dummy.rotation.set(
             giftData.rot[i*3] + state.clock.elapsedTime * 0.1,
             giftData.rot[i*3+1] + state.clock.elapsedTime * 0.1,
             giftData.rot[i*3+2]
           );
        } else {
           dummy.rotation.set(0, 0, 0); // Align perfectly when in tree
        }

        dummy.position.copy(currentVec);
        dummy.scale.setScalar(0.25); // Box size
        dummy.updateMatrix();
        giftsRef.current.setMatrixAt(i, dummy.matrix);
      }
      giftsRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 1. Foliage Cloud */}
      <points geometry={pointsGeometry}>
        {/* @ts-ignore */}
        <foliageMaterial ref={foliageMatRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* 2. Ornaments (Spheres) */}
      <instancedMesh ref={ornamentRef} args={[undefined, undefined, ornamentData.count]} castShadow receiveShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <primitive object={GoldMaterial} />
      </instancedMesh>

      {/* 3. Gifts (Boxes) */}
      <instancedMesh ref={giftsRef} args={[undefined, undefined, giftData.count]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <primitive object={GiftMaterial} />
      </instancedMesh>
      
      <StarTopper morphState={config.morphState} />
    </group>
  );
};


const TreeScene: React.FC<{ config: TreeConfig }> = ({ config }) => {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}>
      <PerspectiveCamera makeDefault position={[0, 2, 9]} fov={45} />
      
      {/* Lighting - Cinematic Setup */}
      <ambientLight intensity={0.1} color="#011a0e" />
      <spotLight 
        position={[10, 10, 10]} 
        angle={0.3} 
        penumbra={1} 
        intensity={2.5} 
        color={config.lightsColor} 
        castShadow 
        shadow-bias={-0.0001}
      />
      <pointLight position={[-5, 5, -5]} intensity={1.5} color="#C5A059" decay={2} />
      <pointLight position={[0, -4, 4]} intensity={2} color="#023E24" decay={2} />

      {/* Environment Reflections */}
      <Environment preset="city" />

      <group position={[0, -2, 0]}>
        
        <MorphingTree config={config} />
        
        {/* Floor Reflections */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[50, 50]} />
          <MeshReflectorMaterial
            mirror={1}
            blur={[300, 100]}
            resolution={1024}
            mixBlur={1}
            mixStrength={50}
            roughness={0.8}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#050505"
            metalness={0.8}
          />
        </mesh>

        <ContactShadows resolution={1024} scale={20} blur={2} opacity={0.5} far={10} color="#000000" />
      </group>

      {/* Atmospheric Particles - Always present for depth */}
      <Sparkles 
        count={300} 
        scale={12} 
        size={2} 
        speed={0.4} 
        opacity={0.5} 
        color="#F4E3B2"
        position={[0, 2, 0]}
      />

      <EffectComposer enableNormalPass={false}>
        <Bloom 
          luminanceThreshold={0.7} // Lowered slightly to catch particles
          mipmapBlur 
          intensity={config.bloomIntensity} 
          radius={0.5}
        />
        <Vignette eskil={false} offset={0.1} darkness={0.6} />
        <Noise opacity={0.03} />
      </EffectComposer>

      <OrbitControls 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 1.8} 
        enablePan={false}
        enableZoom={true}
        minDistance={5}
        maxDistance={14}
        autoRotate={false}
      />
    </Canvas>
  );
};

export default TreeScene;