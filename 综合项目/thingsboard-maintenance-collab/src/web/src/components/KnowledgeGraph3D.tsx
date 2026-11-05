import { RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { GraphEdge, GraphNode } from "../types";

type KnowledgeGraph3DProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: string;
  onSelectNode: (nodeId: string) => void;
};

const COLORS = {
  background: 0x071923,
  core: 0x7ed7ca,
  domain: 0xd6974f,
  category: 0x70a9ad,
  document: 0x58788f,
  edge: 0x547984,
};

const nodePositions = new Map<string, THREE.Vector3>();

function distribute(
  nodes: GraphNode[],
  radius: number,
  verticalScale: number,
  offset: number,
): THREE.Vector3[] {
  return nodes.map((_, index) => {
    const fraction = (index + 0.5) / Math.max(nodes.length, 1);
    const y = (1 - 2 * fraction) * verticalScale;
    const ringRadius = Math.sqrt(Math.max(0, 1 - (y / verticalScale) ** 2));
    const angle = index * 2.399963 + offset;
    return new THREE.Vector3(
      Math.cos(angle) * radius * ringRadius,
      y,
      Math.sin(angle) * radius * ringRadius,
    );
  });
}

function cylinderBetween(start: THREE.Vector3, end: THREE.Vector3): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(0.011, 0.011, length, 6);
  const material = new THREE.MeshBasicMaterial({
    color: COLORS.edge,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return mesh;
}

export function KnowledgeGraph3D({
  nodes,
  edges,
  selectedNode,
  onSelectNode,
}: KnowledgeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const nodeObjects = useRef(new Map<string, THREE.Mesh>());
  const edgeObjects = useRef<Array<{ mesh: THREE.Mesh; source: string; target: string }>>([]);
  const labelObjects = useRef(new Map<string, HTMLDivElement>());
  const flightRef = useRef<{
    startedAt: number;
    duration: number;
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    scene.fog = new THREE.FogExp2(COLORS.background, 0.027);

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
    camera.position.set(11.5, 8.6, 14.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "graph3d-canvas";
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "graph3d-labels";
    container.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 25;
    controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotateSpeed = 0.18;
    controls.target.set(0, 0, 0);
    const autoRotateEnabled = controls.autoRotate;
    resetRef.current = () => {
      flightRef.current = null;
      controls.autoRotate = autoRotateEnabled;
      camera.position.set(11.5, 8.6, 14.5);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    scene.add(new THREE.HemisphereLight(0xc9e8e8, 0x07131b, 1.45));
    const keyLight = new THREE.DirectionalLight(0xdcecef, 2.4);
    keyLight.position.set(7, 12, 9);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x5f8f9f, 1.1);
    fillLight.position.set(-10, -3, -7);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(24, 24, 0x35616b, 0x1d3a44);
    grid.position.y = -4.7;
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    scene.add(grid);

    const floorRing = new THREE.Mesh(
      new THREE.RingGeometry(4.2, 4.22, 128),
      new THREE.MeshBasicMaterial({
        color: 0x42717c,
        transparent: true,
        opacity: 0.23,
        side: THREE.DoubleSide,
      }),
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = -4.68;
    scene.add(floorRing);

    const core = nodes.find((node) => node.type === "core");
    const domains = nodes.filter((node) => node.type === "domain");
    const categories = nodes.filter((node) => node.type === "category");
    const documents = nodes.filter((node) => node.type === "document");
    nodePositions.clear();
    nodeObjects.current.clear();
    edgeObjects.current = [];
    labelObjects.current.clear();

    if (core) {
      nodePositions.set(core.id, new THREE.Vector3(0, 0, 0));
    }
    const domainPositions = distribute(domains, 3.25, 1.8, 0.2);
    domains.forEach((node, index) => nodePositions.set(node.id, domainPositions[index]));
    const categoryPositions = distribute(categories, 6.1, 2.35, 0.8);
    categories.forEach((node, index) => nodePositions.set(node.id, categoryPositions[index]));
    const documentPositions = distribute(documents, 9.2, 3.1, 1.45);
    documents.forEach((node, index) => nodePositions.set(node.id, documentPositions[index]));

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x245c63,
      emissive: 0x12383c,
      emissiveIntensity: 0.65,
      metalness: 0.35,
      roughness: 0.38,
    });
    const categoryMaterial = new THREE.MeshStandardMaterial({
      color: 0x477d81,
      emissive: 0x10292d,
      emissiveIntensity: 0.3,
      metalness: 0.25,
      roughness: 0.48,
    });
    const domainMaterial = new THREE.MeshStandardMaterial({
      color: 0x87643c,
      emissive: 0x2d1e0d,
      emissiveIntensity: 0.3,
      metalness: 0.22,
      roughness: 0.52,
    });
    const documentMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.document,
      metalness: 0.12,
      roughness: 0.62,
    });

    for (const node of nodes) {
      const position = nodePositions.get(node.id);
      if (!position) continue;
      let geometry: THREE.BufferGeometry;
      let material: THREE.Material;
      if (node.type === "core") {
        geometry = new THREE.SphereGeometry(0.64, 32, 24);
        material = coreMaterial;
      } else if (node.type === "domain") {
        geometry = new THREE.CylinderGeometry(0.24, 0.34, 0.22, 28);
        material = domainMaterial;
      } else if (node.type === "category") {
        geometry = new THREE.SphereGeometry(0.19, 22, 16);
        material = categoryMaterial;
      } else {
        geometry = new THREE.SphereGeometry(0.065, 12, 8);
        material = documentMaterial;
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      if (node.type === "domain") {
        mesh.rotation.z = Math.PI / 2.8;
        mesh.rotation.y = position.x * 0.12;
      }
      mesh.userData.nodeId = node.id;
      scene.add(mesh);
      nodeObjects.current.set(node.id, mesh);

      if (node.type !== "document") {
        const element = document.createElement("div");
        element.className = `graph3d-label graph3d-label-${node.type}`;
        element.textContent = node.type === "core" ? "维护知识中枢" : node.label;
        labelObjects.current.set(node.id, element);
        const label = new CSS2DObject(element);
        label.position.set(0, node.type === "core" ? 0.95 : 0.48, 0);
        mesh.add(label);
      }
    }

    const coreRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x7ed7ca,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
    });
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.018, 8, 96), coreRingMaterial);
    coreRing.rotation.x = Math.PI / 2.55;
    scene.add(coreRing);
    const coreRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.011, 8, 96),
      coreRingMaterial.clone(),
    );
    coreRingOuter.rotation.x = Math.PI / 1.8;
    coreRingOuter.rotation.z = Math.PI / 5;
    scene.add(coreRingOuter);

    for (const edge of edges) {
      const sourcePosition = nodePositions.get(edge.source);
      const targetPosition = nodePositions.get(edge.target);
      if (!sourcePosition || !targetPosition) continue;
      const mesh = cylinderBetween(sourcePosition, targetPosition);
      scene.add(mesh);
      edgeObjects.current.push({
        mesh,
        source: edge.source,
        target: edge.target,
      });
    }

    // Apply the initial selection after the scene is built. This also covers
    // React StrictMode's development-only effect remount.
    for (const [nodeId, mesh] of nodeObjects.current) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (nodeId === selectedNode) {
        material.emissive.setHex(0x4c9990);
        material.emissiveIntensity = 1.2;
        labelObjects.current.get(nodeId)?.classList.add("selected");
      }
    }
    for (const edge of edgeObjects.current) {
      if (edge.source === selectedNode || edge.target === selectedNode) {
        const material = edge.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = 0.82;
        material.color.setHex(0x8cc9c1);
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDown = { x: 0, y: 0 };
    const flyToNode = (nodeId: string) => {
      const position = nodePositions.get(nodeId);
      if (!position) return;
      // Keep the current camera-to-target offset so focus changes without
      // zooming or changing the apparent scale of the graph.
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 0.01) offset.set(8.5, 6.2, 9.5);
      flightRef.current = {
        startedAt: performance.now(),
        duration: 720,
        fromPosition: camera.position.clone(),
        toPosition: position.clone().add(offset),
        fromTarget: controls.target.clone(),
        toTarget: position.clone(),
      };
      controls.autoRotate = false;
    };

    const pickNode = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const meshes = [...nodeObjects.current.values()];
      return raycaster.intersectObjects(meshes, false)[0]?.object as THREE.Mesh | undefined;
    };

    const handlePointerDown = (event: PointerEvent) => {
      flightRef.current = null;
      controls.autoRotate = autoRotateEnabled;
      pointerDown = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return;
      const mesh = pickNode(event);
      if (mesh?.userData.nodeId) {
        const nodeId = String(mesh.userData.nodeId);
        flyToNode(nodeId);
        onSelectNode(nodeId);
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      const mesh = pickNode(event);
      renderer.domElement.style.cursor = mesh ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height, false);
      labelRenderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const flight = flightRef.current;
      if (flight) {
        const progress = Math.min(1, (performance.now() - flight.startedAt) / flight.duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
        if (progress >= 1) {
          flightRef.current = null;
          controls.autoRotate = autoRotateEnabled;
        }
      }
      controls.update();
      coreRing.rotation.z += 0.0012;
      coreRingOuter.rotation.y += 0.0008;
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      controls.dispose();
      flightRef.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
      resetRef.current = null;
    };
  }, [edges, nodes, onSelectNode]);

  useEffect(() => {
    for (const [nodeId, mesh] of nodeObjects.current) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = nodeId === selectedNode ? 1.2 : nodeId.startsWith("DOMAIN") ? 0.32 : 0.28;
      if (nodeId === selectedNode) {
        material.emissive.setHex(0x4c9990);
      } else {
        material.emissive.setHex(mesh.userData.nodeId?.startsWith("DOMAIN") ? 0x2d1e0d : 0x10292d);
      }
      labelObjects.current.get(nodeId)?.classList.toggle("selected", nodeId === selectedNode);
    }
    for (const edge of edgeObjects.current) {
      const material = edge.mesh.material as THREE.MeshBasicMaterial;
      const active = edge.source === selectedNode || edge.target === selectedNode;
      material.opacity = active ? 0.82 : 0.22;
      material.color.setHex(active ? 0x8cc9c1 : COLORS.edge);
    }
  }, [selectedNode]);

  return (
    <div className="graph3d-shell">
      <div ref={containerRef} className="graph3d-container" />
      <button
        className="graph3d-reset"
        onClick={() => resetRef.current?.()}
        title="恢复三维视图"
        aria-label="恢复三维视图"
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}
