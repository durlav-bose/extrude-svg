let anchorPoint = { x: 0.5, y: 0.5 }; // Default center (normalized 0-1 coordinates)
let anchorMarker; // Visual indicator for anchor point
let useAnchorPointForScaling = true;

// Scene setup
const scene = new THREE.Scene();

let anchorWorldPosition = new THREE.Vector3(); // Global
let anchorLocalPosition = new THREE.Vector3();

// Camera setup
const cameraHeight = 850;
const halfCameraHeight = cameraHeight / 2;
const halfCameraWidth = halfCameraHeight * 1;
const frustumSize = cameraHeight;

const camera = new THREE.OrthographicCamera(
  -halfCameraWidth,
  halfCameraWidth,
  halfCameraHeight,
  -halfCameraHeight,
  -1000,
  1000
);
camera.position.z = 200; // Move camera back for better view

// Create renderer first (you'll need it for the PMREMGenerator)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  physicallyCorrectLights: true,
  alpha: true,
  canvas: document.querySelector("#canvas"),
});

renderer.setSize(850, 850);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;

window.renderer = renderer;

// Controls for camera
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
setupCustomZoomBehavior();

// Global variables
let svgGroup; // Original SVG meshes
let rotationGroup; // Group to hold svgGroup and allow rotation
let currentRotation = 0;
let movementHandle, rotationHandle;

let isLoadingSVG = false;

document
  .getElementById("save-details")
  .addEventListener("click", saveCurrentState);

// SVG Loader
const loader = new THREE.SVGLoader();

function createMovementHandle() {
  // Create a simple visual marker for the handle
  const geometry = new THREE.CircleGeometry(10, 32);

  // Use a simple colored material if image is not available
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Bright green
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
  });

  // Try to load texture image if available
  try {
    const texture = new THREE.TextureLoader().load(
      "../assets/handles/movement.png",
      // Success callback
      function (texture) {
        material.map = texture;
        material.needsUpdate = true;
      },
      // Progress callback
      undefined,
      // Error callback
      function (err) {
        console.log("Movement handle texture not found, using color instead");
      }
    );
  } catch (error) {
    console.log("Error loading movement handle texture");
  }

  const handle = new THREE.Mesh(geometry, material);
  handle.name = "movementHandle";
  handle.renderOrder = 1000; // Ensure it renders on top
  handle.scale.set(0.5, 0.5, 0.5);

  return handle;
}

function createRotationHandle() {
  // Create a simple visual marker for the handle
  const geometry = new THREE.CircleGeometry(10, 32);

  // Use a simple colored material if image is not available
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Bright red
    side: THREE.DoubleSide,
    depthTest: false,
    transparent: true,
  });

  // Try to load texture image if available
  try {
    const texture = new THREE.TextureLoader().load(
      "../assets/handles/rotation.png",
      // Success callback
      function (texture) {
        material.map = texture;
        material.needsUpdate = true;
      },
      // Progress callback
      undefined,
      // Error callback
      function (err) {
        console.log("Rotation handle texture not found, using color instead");
      }
    );
  } catch (error) {
    console.log("Error loading rotation handle texture");
  }

  const handle = new THREE.Mesh(geometry, material);
  handle.name = "rotationHandle";
  handle.renderOrder = 1000; // Ensure it renders on top
  handle.scale.set(0.5, 0.5, 0.5);

  return handle;
}

// Create anchor marker function (same as before)
function createAnchorMarker() {
  const geometry = new THREE.BoxGeometry(10, 10, 10);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    depthTest: false,
    transparent: true,
    opacity: 0.7,
  });

  const marker = new THREE.Mesh(geometry, material);
  marker.name = "anchorMarker";
  marker.renderOrder = 1001; // Ensure it renders on top

  return marker;
}

function scaleAroundAnchorPoint(scaleFactor) {
  if (!rotationGroup) return;

  const anchorWorldBefore = anchorLocalPosition.clone();
  rotationGroup.localToWorld(anchorWorldBefore);

  rotationGroup.scale.multiplyScalar(scaleFactor);

  const anchorWorldAfter = anchorLocalPosition.clone();
  rotationGroup.localToWorld(anchorWorldAfter);

  const shift = new THREE.Vector3().subVectors(
    anchorWorldBefore,
    anchorWorldAfter
  );
  rotationGroup.position.add(shift);

  updateAnchorMarkerPosition();
}

function updateAnchorMarkerPosition() {
  if (!anchorMarker || !rotationGroup) return;

  anchorMarker.position.copy(anchorLocalPosition);
}

function setupCustomZoomBehavior() {
  // Remove default scroll zoom from OrbitControls
  controls.enableZoom = false;

  // Add our own wheel event listener
  renderer.domElement.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      if (useAnchorPointForScaling && rotationGroup) {
        // Determine scale factor based on scroll direction
        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1; // Adjust these values as needed
        scaleAroundAnchorPoint(scaleFactor);
      } else {
        // Fallback to default orbit controls zoom
        controls.enableZoom = true;
        // Re-trigger the event
        const newEvent = new WheelEvent("wheel", event);
        controls.domElement.dispatchEvent(newEvent);
        // Disable again
        controls.enableZoom = false;
      }
    },
    { passive: false }
  );
}

function loadSVG(url) {
  if (isLoadingSVG) return;
  isLoadingSVG = true;

  // Store whether we should apply saved state
  const applySavedState = !!localStorage.getItem("svgViewState");

  if (rotationGroup) scene.remove(rotationGroup);

  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  loader.load(
    url,
    (data) => {
      console.log("SVG loaded successfully");

      svgGroup = new THREE.Group();
      let addedValidObject = false;

      // [Existing SVG loading code remains unchanged]
      data.paths.forEach((path) => {
        const shapes = path.toShapes(false);

        shapes.forEach((shape) => {
          if (!shape || !shape.curves.length) return;

          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 10,
            bevelEnabled: true,
            bevelThickness: 0.3,
            bevelSize: 0.3,
            bevelSegments: 5,
            curveSegments: 24,
          });

          geometry.computeVertexNormals();

          if (hasNaN(geometry)) return;

          const material = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            side: THREE.DoubleSide,
            flatShading: false,
            metalness: 0.8,
            roughness: 0.2,
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.y = -1; // Flip Y to match SVG

          svgGroup.add(mesh);
          addedValidObject = true;
        });
      });

      if (addedValidObject) {
        const bbox = new THREE.Box3().setFromObject(svgGroup);
        const center = bbox.getCenter(new THREE.Vector3());
        svgGroup.position.sub(center); // Center it inside the group

        const svgSize = bbox.getSize(new THREE.Vector3());
        console.log("svgSize :>> ", svgSize);

        rotationGroup.add(svgGroup);

        // Set up initial handles and anchor
        setupHandles();

        // IMPORTANT: Apply saved state if available
        if (applySavedState) {
          applySavedStateToNewSVG(svgGroup);
        } else {
          // Default initial setup
          anchorLocalPosition.set(0, 0, 0);
          updateAnchorMarkerPosition();
        }
      }

      isLoadingSVG = false;
    },
    undefined,
    (error) => {
      console.error("Error loading SVG", error);
      isLoadingSVG = false;
    }
  );
}

// function applySavedStateToNewSVG(newSvgGroup) {
//   const savedStateJSON = localStorage.getItem("svgViewState");
//   if (!savedStateJSON) {
//     console.warn("No saved state found");
//     return;
//   }

//   try {
//     const savedState = JSON.parse(savedStateJSON);

//     // IMPORTANT: First center the new SVG within its group
//     const newBbox = new THREE.Box3().setFromObject(newSvgGroup);
//     const newCenter = newBbox.getCenter(new THREE.Vector3());
//     newSvgGroup.position.sub(newCenter); // Center it properly

//     // Recalculate the bounding box after centering
//     const centeredBbox = new THREE.Box3().setFromObject(newSvgGroup);
//     const newSize = centeredBbox.getSize(new THREE.Vector3());

//     // Set rotation first (important for correct positioning)
//     rotationGroup.rotation.z = savedState.rotation;
//     currentRotation = savedState.rotation;

//     // Set scale (preserve the saved scale factor)
//     rotationGroup.scale.set(
//       savedState.scale,
//       savedState.scale,
//       savedState.scale
//     );

//     // Calculate the new anchor point position based on normalized coordinates
//     // These are relative to the SVG's bounding box
//     const newAnchorLocalX =
//       (savedState.normalizedAnchorLocal.x - 0.5) * newSize.x;
//     const newAnchorLocalY =
//       (savedState.normalizedAnchorLocal.y - 0.5) * newSize.y;
//     anchorLocalPosition.set(newAnchorLocalX, newAnchorLocalY, 0);

//     // Update anchor marker position
//     updateAnchorMarkerPosition();

//     // Get the target world position for the anchor point (from saved state)
//     const targetWorldAnchor = new THREE.Vector3(
//       savedState.anchorWorldPosition.x,
//       savedState.anchorWorldPosition.y,
//       savedState.anchorWorldPosition.z
//     );

//     // Position the rotationGroup so that the anchor point matches the target world position
//     // First, get what would be the current world position of the anchor
//     const currentAnchorWorld = anchorLocalPosition.clone();
//     rotationGroup.localToWorld(currentAnchorWorld);

//     // Calculate the difference
//     const offset = new THREE.Vector3().subVectors(
//       targetWorldAnchor,
//       currentAnchorWorld
//     );

//     // Apply the offset to position the group correctly
//     rotationGroup.position.add(offset);

//     // Update handles
//     if (movementHandle) {
//       movementHandle.position.x = rotationGroup.position.x;
//       movementHandle.position.y = rotationGroup.position.y;
//     }

//     positionRotationHandle();

//     console.log("Applied saved state to new SVG");
//   } catch (error) {
//     console.error("Error applying saved state:", error);
//   }
// }

function applySavedStateToNewSVG(newSvgGroup) {
  const savedStateJSON = localStorage.getItem("svgViewState");
  if (!savedStateJSON) {
    console.warn("No saved state found");
    return;
  }

  try {
    const savedState = JSON.parse(savedStateJSON);

    const newBbox = new THREE.Box3().setFromObject(newSvgGroup);
    const newSize = newBbox.getSize(new THREE.Vector3());

    // De-normalize anchor from bbox.min (not center!)
    const newAnchorLocalX =
      (savedState.normalizedAnchorLocal.x - 0.5) * newSize.x;
    const newAnchorLocalY =
      (savedState.normalizedAnchorLocal.y - 0.5) * newSize.y;
    anchorLocalPosition.set(newAnchorLocalX, newAnchorLocalY, 0);

    rotationGroup.add(newSvgGroup);

    // Apply saved rotation and scale
    rotationGroup.rotation.z = savedState.rotation;
    currentRotation = savedState.rotation;

    rotationGroup.scale.set(
      savedState.scale,
      savedState.scale,
      savedState.scale
    );

    updateAnchorMarkerPosition();

    // Match anchor world position exactly
    const anchorWorldAfter = anchorLocalPosition.clone();
    rotationGroup.localToWorld(anchorWorldAfter);

    const targetWorldAnchor = new THREE.Vector3(
      savedState.anchorWorldPosition.x,
      savedState.anchorWorldPosition.y,
      savedState.anchorWorldPosition.z
    );

    const shift = new THREE.Vector3().subVectors(
      targetWorldAnchor,
      anchorWorldAfter
    );
    console.log("shift :>> ", shift);
    rotationGroup.position.add(shift);

    // Update handles
    if (movementHandle) {
      movementHandle.position.x = rotationGroup.position.x;
      movementHandle.position.y = rotationGroup.position.y;
    }

    positionRotationHandle();

    console.log("Applied saved state to new SVG");
  } catch (error) {
    console.error("Error applying saved state:", error);
  }
}

function setupHandles() {
  if (movementHandle) {
    scene.remove(movementHandle);
    movementHandle = null;
  }
  if (rotationHandle) {
    if (rotationHandle.parent) {
      rotationHandle.parent.remove(rotationHandle);
    }
    rotationHandle = null;
  }

  // Create movement handle
  movementHandle = createMovementHandle();
  scene.add(movementHandle);
  movementHandle.position.copy(rotationGroup.position);
  movementHandle.position.z = 5;

  // Create rotation handle
  rotationHandle = createRotationHandle();
  scene.add(rotationHandle);
  positionRotationHandle();

  // Create and add anchor marker
  if (!anchorMarker) {
    anchorMarker = createAnchorMarker();
    rotationGroup.add(anchorMarker);
  }

  if (!localStorage.getItem("svgViewState")) {
    anchorLocalPosition.set(0, 0, 0);
    updateAnchorMarkerPosition();
  }

  // Setup drag for movement
  const moveControls = new THREE.DragControls(
    [movementHandle],
    camera,
    renderer.domElement
  );
  moveControls.addEventListener("dragstart", () => (controls.enabled = false));
  moveControls.addEventListener("drag", (event) => {
    rotationGroup.position.x = event.object.position.x;
    rotationGroup.position.y = event.object.position.y;
  });
  moveControls.addEventListener("dragend", () => (controls.enabled = true));

  // Setup drag for rotation
  setupRotationDrag();
}

function positionRotationHandle() {
  if (!rotationHandle || !rotationGroup || !svgGroup) return;

  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const size = bbox.getSize(new THREE.Vector3());
  const topRightLocal = new THREE.Vector3(size.x / 2 + 20, size.y / 2 + 20, 5);

  const rotatedOffset = topRightLocal.applyMatrix4(
    new THREE.Matrix4().makeRotationZ(rotationGroup.rotation.z)
  );

  rotationHandle.position.copy(
    rotationGroup.position.clone().add(rotatedOffset)
  );
}

function setupRotationDrag() {
  const rotationControls = new THREE.DragControls(
    [rotationHandle],
    camera,
    renderer.domElement
  );

  let initialAngle = 0;
  let initialHandlePos = new THREE.Vector3();
  let worldAnchorPoint = new THREE.Vector3();

  rotationControls.addEventListener("dragstart", (event) => {
    controls.enabled = false;
    initialAngle = currentRotation;
    initialHandlePos.copy(event.object.position);

    worldAnchorPoint = anchorLocalPosition.clone();
    rotationGroup.localToWorld(worldAnchorPoint);
  });

  rotationControls.addEventListener("drag", (event) => {
    const initialVec = new THREE.Vector2(
      initialHandlePos.x - worldAnchorPoint.x,
      initialHandlePos.y - worldAnchorPoint.y
    );
    const currentVec = new THREE.Vector2(
      event.object.position.x - worldAnchorPoint.x,
      event.object.position.y - worldAnchorPoint.y
    );

    const dot = initialVec.dot(currentVec);
    const det = initialVec.x * currentVec.y - initialVec.y * currentVec.x;
    const angleChange = Math.atan2(det, dot);

    const newRotation = initialAngle + angleChange;

    const anchorWorldBefore = anchorLocalPosition.clone();
    rotationGroup.localToWorld(anchorWorldBefore);

    rotationGroup.rotation.z = newRotation;
    currentRotation = newRotation;

    const anchorWorldAfter = anchorLocalPosition.clone();
    rotationGroup.localToWorld(anchorWorldAfter);

    const shift = new THREE.Vector3().subVectors(
      anchorWorldBefore,
      anchorWorldAfter
    );
    rotationGroup.position.add(shift);

    updateAnchorMarkerPosition();
  });

  rotationControls.addEventListener("dragend", () => (controls.enabled = true));
}

function saveCurrentState() {
  if (!rotationGroup || !svgGroup) {
    console.warn("Nothing to save - SVG not loaded");
    return;
  }

  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const svgSize = bbox.getSize(new THREE.Vector3());

  // Update anchor world position before saving
  updateAnchorWorldPosition();

  const normalizedAnchorLocal = {
    x: anchorLocalPosition.x / svgSize.x + 0.5,
    y: anchorLocalPosition.y / svgSize.y + 0.5,
  };

  console.log("svgSize :>> ", svgSize);

  const stateToSave = {
    position: {
      x: rotationGroup.position.x,
      y: rotationGroup.position.y,
      z: rotationGroup.position.z,
    },
    rotation: currentRotation,
    scale: rotationGroup.scale.x, // assuming uniform scaling
    normalizedAnchorLocal,
    originalDimensions: {
      width: svgSize.x,
      height: svgSize.y,
    },
    anchorWorldPosition: {
      x: anchorWorldPosition.x,
      y: anchorWorldPosition.y,
      z: anchorWorldPosition.z,
    },
  };

  localStorage.setItem("svgViewState", JSON.stringify(stateToSave));
}

function hasNaN(geometry) {
  const position = geometry.getAttribute("position");
  if (!position) return true;
  const array = position.array;
  for (let i = 0; i < array.length; i++) {
    if (isNaN(array[i])) return true;
  }
  return false;
}

window.addEventListener("resize", () => {
  const width = 850;
  const height = 850;
  renderer.setSize(width, height);
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
  controls.update();
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Update both handles if they exist
  if (rotationGroup) {
    // Update movement handle to follow rotation group center
    if (movementHandle) {
      const z = movementHandle.position.z;
      movementHandle.position.x = rotationGroup.position.x;
      movementHandle.position.y = rotationGroup.position.y;
      movementHandle.position.z = z;
    }

    // Update rotation handle to follow rotation group edge
    if (rotationHandle && svgGroup) {
      // Calculate bounding box of SVG
      const bbox = new THREE.Box3().setFromObject(svgGroup);
      const svgSize = bbox.getSize(new THREE.Vector3());

      // Calculate offset from center
      const offsetX = svgSize.x / 2 + 20;
      const offsetY = svgSize.y / 2 + 20;

      // Create a vector for the rotation handle in local space
      const localPos = new THREE.Vector3(
        offsetX,
        offsetY,
        rotationHandle.position.z
      );

      // Apply the current rotation to the local position
      const rotMatrix = new THREE.Matrix4().makeRotationZ(
        rotationGroup.rotation.z
      );
      localPos.applyMatrix4(rotMatrix);

      // Calculate the final world position
      rotationHandle.position.x = rotationGroup.position.x + localPos.x;
      rotationHandle.position.y = rotationGroup.position.y + localPos.y;
    }
  }

  positionRotationHandle();
  updateAnchorWorldPosition();

  renderer.render(scene, camera);
}

function updateAnchorWorldPosition() {
  getAnchorWorldPosition();
}

function getAnchorWorldPosition() {
  if (!svgGroup || !rotationGroup) return new THREE.Vector3();

  // Calculate the world position of the current anchor point
  const worldPos = anchorLocalPosition.clone();
  rotationGroup.localToWorld(worldPos);

  // Store this for saving state
  anchorWorldPosition = worldPos.clone();

  return worldPos;
}

function setupClickToSetAnchorPoint() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("click", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (!svgGroup || !svgGroup.children.length) return;

    const intersects = raycaster.intersectObjects(svgGroup.children, true);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const worldPoint = intersect.point.clone();

      const localPoint = rotationGroup.worldToLocal(worldPoint.clone());

      anchorLocalPosition.copy(localPoint);

      updateAnchorMarkerPosition();
    }
  });
}

// Update the init function to remove the timeout
function init() {
  // Check if we have a saved state
  const savedState = localStorage.getItem("svgViewState");

  // Load SVG - either the one from saved state or default
  if (savedState) {
    loadSVG("../assets/x-02-long.svg");
  } else {
    loadSVG("../assets/x-02-long.svg");
  }

  // Set up click-to-set-anchor-point functionality
  setupClickToSetAnchorPoint();

  // Start animation loop
  animate();
}

init();
