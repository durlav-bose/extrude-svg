import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 200;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Controls for camera
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Get SVG markup
const svgMarkup = document.querySelector("svg").outerHTML;

// Parse SVG
const loader = new SVGLoader();
const svgData = loader.parse(svgMarkup);

// Group to hold all our extruded meshes
const svgGroup = new THREE.Group();

// Materials
const materials = [
  new THREE.MeshPhongMaterial({ color: 0x080001, flatShading: true }), // front
  new THREE.MeshPhongMaterial({ color: 0x34a853 }), // sides
];

// Extrusion settings
const extrudeSettings = {
  steps: 1,
  depth: 10,
  bevelEnabled: true,
  bevelThickness: 2,
  bevelSize: 1,
  bevelOffset: 0,
  bevelSegments: 3,
};

// Process the paths from SVG
svgData.paths.forEach((path) => {
  const shapes = path.toShapes(true);

  // Process each shape
  shapes.forEach((shape) => {
    // Create geometry with extrusion
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Create mesh with geometry and materials
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.scale.y = -1;

    // Add mesh to group
    svgGroup.add(mesh);
  });
});

// Center the group
const box = new THREE.Box3().setFromObject(svgGroup);
const center = box.getCenter(new THREE.Vector3());
svgGroup.position.sub(center);

// Add to scene
scene.add(svgGroup);

// Scale to fit viewport better
const boxSize = box.getSize(new THREE.Vector3());
const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
const scale = 100 / maxDim;
svgGroup.scale.set(scale, scale, scale);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
