// Three.js Transform Anchor Points Implementation - Function-based approach
// Similar to Photoshop's reference point behavior

// Initialize scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x282c34);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add grid helper for reference
const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.rotation.x = Math.PI / 2;
scene.add(gridHelper);

// OrbitControls for camera navigation
const orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;

// Create a transformable object with custom anchor point
function createTransformableObject(width, height, color = 0x44aa88) {
  // Create a group to hold all elements
  const group = new THREE.Group();

  // Create main object (rectangular mesh)
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  const mainMesh = new THREE.Mesh(geometry, material);
  group.add(mainMesh);

  // Create bounding box helper
  const boundingBox = new THREE.Box3().setFromObject(mainMesh);
  const boundingBoxHelper = createBoundingBoxHelper(width, height);
  group.add(boundingBoxHelper);

  // Store dimensions and initialize anchor point at center (0.5, 0.5)
  group.userData = {
    width: width,
    height: height,
    anchorPoint: { x: 0.5, y: 0.5 },
  };

  // Create visual anchor point marker
  const anchorMarker = createAnchorMarker();
  updateAnchorMarkerPosition(anchorMarker, group.userData);
  group.add(anchorMarker);
  group.userData.anchorMarker = anchorMarker;

  // Create corner handles for selecting anchor points
  const cornerHandles = createCornerHandles(width, height);
  cornerHandles.forEach((handle) => group.add(handle));
  group.userData.cornerHandles = cornerHandles;

  return group;
}

// Create visual representation of bounding box
function createBoundingBoxHelper(width, height) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -width / 2,
    -height / 2,
    0,
    width / 2,
    -height / 2,
    0,
    width / 2,
    -height / 2,
    0,
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    0,
    -width / 2,
    height / 2,
    0,
    -width / 2,
    height / 2,
    0,
    -width / 2,
    -height / 2,
    0,
  ]);

  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

  const material = new THREE.LineBasicMaterial({ color: 0x0088ff });
  return new THREE.LineSegments(geometry, material);
}

// Create visual anchor point marker
function createAnchorMarker() {
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  return new THREE.Mesh(geometry, material);
}

// Update the position of the anchor marker based on current anchor point
function updateAnchorMarkerPosition(anchorMarker, userData) {
  const width = userData.width;
  const height = userData.height;

  anchorMarker.position.x = (userData.anchorPoint.x - 0.5) * width;
  anchorMarker.position.y = (userData.anchorPoint.y - 0.5) * height;
}

// Create corner handles for selecting anchor points
function createCornerHandles(width, height) {
  const handles = [];

  // Create 9 handles (corners, edges, and center)
  const positions = [
    { x: -0.5, y: -0.5 },
    { x: 0, y: -0.5 },
    { x: 0.5, y: -0.5 },
    { x: -0.5, y: 0 },
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: -0.5, y: 0.5 },
    { x: 0, y: 0.5 },
    { x: 0.5, y: 0.5 },
  ];

  positions.forEach((pos, index) => {
    const geometry = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const material = new THREE.MeshBasicMaterial({ color: 0x0088ff });
    const handle = new THREE.Mesh(geometry, material);

    handle.position.x = pos.x * width;
    handle.position.y = pos.y * height;

    handle.position.z = 0.1; // Slightly above the main mesh

    // Store anchor point values in userData for easy access
    handle.userData = {
      anchorPoint: { x: pos.x + 0.5, y: pos.y + 0.5, z: 0 },
    };

    handles.push(handle);
  });

  return handles;
}

// Set anchor point for transformable object
function setAnchorPoint(transformableObject, x, y) {
  transformableObject.userData.anchorPoint = { x, y };
  updateAnchorMarkerPosition(
    transformableObject.userData.anchorMarker,
    transformableObject.userData
  );
}

// Apply rotation around current anchor point
function rotateWithAnchor(transformableObject, angleInRadians) {
  const userData = transformableObject.userData;

  // Calculate anchor point in world coordinates
  const anchorX = (userData.anchorPoint.x - 0.5) * userData.width;
  const anchorY = (userData.anchorPoint.y - 0.5) * userData.height;

  // 1. Move object so anchor point is at origin
  transformableObject.position.x -= anchorX;
  transformableObject.position.y -= anchorY;

  // 2. Apply rotation
  transformableObject.rotation.z += angleInRadians;

  // 3. Move back so anchor remains in same position
  // We need to account for the rotation that was just applied
  const cos = Math.cos(transformableObject.rotation.z);
  const sin = Math.sin(transformableObject.rotation.z);

  transformableObject.position.x += anchorX * cos - anchorY * sin;
  transformableObject.position.y += anchorX * sin + anchorY * cos;
}

// Apply scaling with respect to current anchor point
function scaleWithAnchor(transformableObject, scaleX, scaleY) {
  const userData = transformableObject.userData;
  const mainMesh = transformableObject.children[0]; // The main mesh is the first child

  // Calculate anchor point in world coordinates
  const anchorX = (userData.anchorPoint.x - 0.5) * userData.width;
  const anchorY = (userData.anchorPoint.y - 0.5) * userData.height;

  // 1. Adjust width and height
  const oldWidth = userData.width;
  const oldHeight = userData.height;

  userData.width *= scaleX;
  userData.height *= scaleY;

  // Scale the main mesh
  mainMesh.scale.x *= scaleX;
  mainMesh.scale.y *= scaleY;

  // 2. Update position to maintain anchor point
  const deltaX = anchorX - anchorX * scaleX;
  const deltaY = anchorY - anchorY * scaleY;

  transformableObject.position.x += deltaX;
  transformableObject.position.y += deltaY;

  // 3. Update visual elements

  // Update bounding box helper
  transformableObject.remove(transformableObject.children[1]); // Remove old bounding box
  const newBoundingBoxHelper = createBoundingBoxHelper(
    userData.width,
    userData.height
  );
  transformableObject.add(newBoundingBoxHelper);

  // Update anchor marker position
  updateAnchorMarkerPosition(userData.anchorMarker, userData);

  // Update corner handles
  userData.cornerHandles.forEach((handle) => {
    transformableObject.remove(handle);
  });

  const newCornerHandles = createCornerHandles(userData.width, userData.height);
  newCornerHandles.forEach((handle) => transformableObject.add(handle));
  userData.cornerHandles = newCornerHandles;
}

// Create a transformable object and add it to the scene
const transformableObject = createTransformableObject(4, 3);
scene.add(transformableObject);

// Add UI controls
const uiPanel = document.createElement("div");
uiPanel.style.position = "absolute";
uiPanel.style.top = "10px";
uiPanel.style.right = "10px";
uiPanel.style.width = "200px";
uiPanel.style.padding = "10px";
uiPanel.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
uiPanel.style.color = "white";
uiPanel.style.fontFamily = "Arial, sans-serif";
uiPanel.style.borderRadius = "5px";
uiPanel.innerHTML = `
  <h3>Transform Controls</h3>
  
  <div style="margin-bottom: 15px;">
    <div style="margin-bottom: 5px;">Anchor Presets:</div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;">
      <button id="anchor-tl" style="padding: 5px;">◤</button>
      <button id="anchor-tc" style="padding: 5px;">▲</button>
      <button id="anchor-tr" style="padding: 5px;">◥</button>
      <button id="anchor-ml" style="padding: 5px;">◀</button>
      <button id="anchor-mc" style="padding: 5px;">⦿</button>
      <button id="anchor-mr" style="padding: 5px;">▶</button>
      <button id="anchor-bl" style="padding: 5px;">◣</button>
      <button id="anchor-bc" style="padding: 5px;">▼</button>
      <button id="anchor-br" style="padding: 5px;">◢</button>
    </div>
  </div>
  
  <div style="margin-bottom: 15px;">
    <div style="margin-bottom: 5px;">Rotation:</div>
    <button id="rotate-ccw" style="padding: 5px;">↺ Rotate -15°</button>
    <button id="rotate-cw" style="padding: 5px; margin-left: 5px;">↻ Rotate +15°</button>
  </div>
  
  <div style="margin-bottom: 15px;">
    <div style="margin-bottom: 5px;">Scale:</div>
    <button id="scale-up" style="padding: 5px;">⤢ Scale 1.2x</button>
    <button id="scale-down" style="padding: 5px; margin-left: 5px;">⤡ Scale 0.8x</button>
  </div>
  
  <div>Click on the blue boxes to set anchor points</div>
`;
document.body.appendChild(uiPanel);

// Setup UI event handlers
document
  .getElementById("anchor-tl")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 0, 1));
document
  .getElementById("anchor-tc")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 0.5, 1));
document
  .getElementById("anchor-tr")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 1, 1));
document
  .getElementById("anchor-ml")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 0, 0.5));
document
  .getElementById("anchor-mc")
  .addEventListener("click", () =>
    setAnchorPoint(transformableObject, 0.5, 0.5)
  );
document
  .getElementById("anchor-mr")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 1, 0.5));
document
  .getElementById("anchor-bl")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 0, 0));
document
  .getElementById("anchor-bc")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 0.5, 0));
document
  .getElementById("anchor-br")
  .addEventListener("click", () => setAnchorPoint(transformableObject, 1, 0));

// Rotation buttons
document
  .getElementById("rotate-ccw")
  .addEventListener("click", () =>
    rotateWithAnchor(transformableObject, -Math.PI / 12)
  ); // -15 degrees
document
  .getElementById("rotate-cw")
  .addEventListener("click", () =>
    rotateWithAnchor(transformableObject, Math.PI / 12)
  ); // +15 degrees

// Scale buttons
document
  .getElementById("scale-up")
  .addEventListener("click", () =>
    scaleWithAnchor(transformableObject, 1.2, 1.2)
  );
document
  .getElementById("scale-down")
  .addEventListener("click", () =>
    scaleWithAnchor(transformableObject, 0.8, 0.8)
  );

// Setup raycaster for mouse interaction with anchor points
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Collect all corner handles for intersection testing
function getAllCornerHandles() {
  return transformableObject.userData.cornerHandles;
}

// Handle clicks on corner handles to set anchor point
window.addEventListener("click", (event) => {
  // Convert mouse position to normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Set up raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check for intersections with corner handles
  const cornerHandles = getAllCornerHandles();
  console.log("cornerHandles :>> ", cornerHandles);
  const intersects = raycaster.intersectObjects(cornerHandles);
  console.log("intersects :>> ", intersects);

  if (intersects.length > 0) {
    const handle = intersects[0].object;
    console.log("handle :>> ", handle);
    const anchorPoint = handle.userData.anchorPoint;
    console.log("anchorPoint :>> ", anchorPoint);
    setAnchorPoint(transformableObject, anchorPoint.x, anchorPoint.y);
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  renderer.render(scene, camera);
}

animate();
