// Add a global variable to store handle state if handles aren't created yet
let pendingHandlesState = null;
window.preserveCurrentPosition = false;

let anchorPoint = { x: 0.5, y: 0.5 }; // Default center (normalized 0-1 coordinates)
let anchorMarker; // Visual indicator for anchor point
let useAnchorPointForScaling = true; // Enable/disable anchor-based scaling
let initialGroupPosition = new THREE.Vector3();
let centeredGroup = null;

let outputWidth = 1000;
let outputHeight = 1000;
let threeColor = null;
let backgroundColor = null;
// Scene setup
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x111111);

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
  .getElementById("anchor-tl")
  .addEventListener("click", () => setAnchorPoint(0, 1));
document
  .getElementById("anchor-tc")
  .addEventListener("click", () => setAnchorPoint(0.5, 1));
document
  .getElementById("anchor-tr")
  .addEventListener("click", () => setAnchorPoint(1, 1));
document
  .getElementById("anchor-ml")
  .addEventListener("click", () => setAnchorPoint(0, 0.5));
document
  .getElementById("anchor-mc")
  .addEventListener("click", () => setAnchorPoint(0.5, 0.5));
document
  .getElementById("anchor-mr")
  .addEventListener("click", () => setAnchorPoint(1, 0.5));
document
  .getElementById("anchor-bl")
  .addEventListener("click", () => setAnchorPoint(0, 0));
document
  .getElementById("anchor-bc")
  .addEventListener("click", () => setAnchorPoint(0.5, 0));
document
  .getElementById("anchor-br")
  .addEventListener("click", () => setAnchorPoint(1, 0));

// Toggle anchor-based scaling
document
  .getElementById("use-anchor-scaling")
  .addEventListener("change", (event) => {
    useAnchorPointForScaling = event.target.checked;
  });

document.getElementById("scale-up").addEventListener("click", () => {
  scaleAroundAnchorPoint(1.1); // Scale up by 10%
});

document.getElementById("scale-down").addEventListener("click", () => {
  scaleAroundAnchorPoint(0.9); // Scale down by 10%
});

// SVG Loader
const loader = new THREE.SVGLoader();

// Helper Functions
function hasValidPoints(points) {
  if (!points || points.length === 0) return false;
  for (let i = 0; i < points.length; i++) {
    if (isNaN(points[i].x) || isNaN(points[i].y)) {
      return false;
    }
  }
  return true;
}

function createThickLineFromPoints(points, thickness = 1.5) {
  if (points.length < 2) return null;

  const lineShapes = [];

  for (let i = 0; i < points.length - 1; i++) {
    const pointA = points[i];
    const pointB = points[i + 1];

    const direction = new THREE.Vector2(
      pointB.x - pointA.x,
      pointB.y - pointA.y
    ).normalize();

    const perpendicular = new THREE.Vector2(
      -direction.y,
      direction.x
    ).multiplyScalar(thickness / 2);

    const segmentShape = new THREE.Shape();
    segmentShape.moveTo(pointA.x + perpendicular.x, pointA.y + perpendicular.y);
    segmentShape.lineTo(pointB.x + perpendicular.x, pointB.y + perpendicular.y);
    segmentShape.lineTo(pointB.x - perpendicular.x, pointB.y - perpendicular.y);
    segmentShape.lineTo(pointA.x - perpendicular.x, pointA.y - perpendicular.y);
    segmentShape.closePath();

    lineShapes.push(segmentShape);
  }

  return lineShapes;
}

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

function setAnchorPoint(x, y) {
  anchorPoint.x = x;
  anchorPoint.y = y;
  updateAnchorMarkerPosition();
}

function updateHandlesVisibility(visible) {
  if (movementHandle) movementHandle.visible = visible;
  if (rotationHandle) rotationHandle.visible = visible;
  if (anchorMarker) anchorMarker.visible = visible;
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

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

function captureCurrentViewState() {
  if (!camera || !controls || !rotationGroup) return null;

  return {
    camera: {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      rotation: {
        x: camera.rotation.x,
        y: camera.rotation.y,
        z: camera.rotation.z,
        order: camera.rotation.order,
      },
      zoom: camera.zoom,
    },
    controls: {
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      },
    },
    model: {
      rotation: {
        x: rotationGroup.rotation.x,
        y: rotationGroup.rotation.y,
        z: rotationGroup.rotation.z,
      },
      position: {
        x: rotationGroup.position.x,
        y: rotationGroup.position.y,
        z: rotationGroup.position.z,
      },
    },
    handles:
      movementHandle && rotationHandle
        ? {
            currentRotation: currentRotation,
            movementHandle: {
              position: {
                x: movementHandle.position.x,
                y: movementHandle.position.y,
                z: movementHandle.position.z,
              },
              visible: movementHandle.visible,
            },
            rotationHandle: {
              position: {
                x: rotationHandle.position.x,
                y: rotationHandle.position.y,
                z: rotationHandle.position.z,
              },
              visible: rotationHandle.visible,
            },
          }
        : null,
  };
}

function loadSVG(url) {
  if (isLoadingSVG) return;
  isLoadingSVG = true;

  if (rotationGroup) scene.remove(rotationGroup);

  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  loader.load(
    url,
    (data) => {
      console.log("SVG loaded successfully");

      svgGroup = new THREE.Group();
      let addedValidObject = false;

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
        const svgWidth = bbox.getSize(new THREE.Vector3()).x;
        const svgHeight = bbox.getSize(new THREE.Vector3()).y;

        // Save SVG size and other properties the first time SVG is loaded
        const svgState = {
          svg: {
            width: svgWidth,
            height: svgHeight,
          },
          handles: {
            anchorCanvasPosition: canvasToWorld(anchorLocalPosition), // Assuming anchorLocalPosition is the saved position
          },
        };

        // Save the initial settings into localStorage
        localStorage.setItem("svgViewState", JSON.stringify(svgState));

        // Now, apply the saved settings if they exist
        const savedState = JSON.parse(localStorage.getItem("svgViewState"));
        if (savedState) {
          const savedWidth = savedState.svg.width;
          const savedHeight = savedState.svg.height;

          // Calculate scaling ratio based on the saved size
          const scaleX = savedWidth / svgWidth;
          const scaleY = savedHeight / svgHeight;

          svgGroup.scale.set(scaleX, scaleY, 1);

          // Restore anchor position and apply it
          const canvasPos = savedState.handles.anchorCanvasPosition;
          const worldPosition = canvasToWorld(canvasPos); // Convert back to world position
          svgGroup.position.copy(worldPosition);

          rotationGroup.add(svgGroup);

          setupHandles();

          anchorLocalPosition.set(0, 0, 0);
          updateAnchorMarkerPosition();
        }
      }

      createUIControls(svgGroup);

      isLoadingSVG = false;
    },
    undefined,
    (error) => {
      console.error("Error loading SVG", error);
      isLoadingSVG = false;
    }
  );
}

function restoreAnchorPosition() {
  const savedState = JSON.parse(localStorage.getItem("svgViewState"));

  if (!savedState || !savedState.anchorCanvasPosition) return;

  // Get the saved anchor position from canvas
  const canvasPosition = savedState.anchorCanvasPosition;

  // Ensure anchorMarker is created before attempting to modify its position
  if (!anchorMarker) {
    // Create anchor marker if it doesn't exist
    anchorMarker = createAnchorMarker();
    rotationGroup.add(anchorMarker); // Add to rotationGroup
  }

  // Convert canvas position to world position and update anchor
  const worldPosition = canvasToWorld(canvasPosition);
  console.log("anchorMarker :>> ", anchorMarker); // Should show the anchorMarker now
  anchorMarker.position.copy(worldPosition);
  anchorLocalPosition.copy(rotationGroup.worldToLocal(worldPosition));

  updateAnchorMarkerPosition();
}

function canvasToWorld(canvasPosition) {
  const x = (canvasPosition.x / renderer.domElement.width) * 2 - 1;
  const y = -(canvasPosition.y / renderer.domElement.height) * 2 + 1;

  const vector = new THREE.Vector3(x, y, 0.5); // Assuming the z-depth to be 0.5
  vector.unproject(camera);

  const dir = vector.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z;
  const worldPosition = camera.position
    .clone()
    .add(dir.multiplyScalar(distance));

  return worldPosition;
}

function applyAspectRatio() {
  const savedState = JSON.parse(localStorage.getItem("svgViewState"));

  if (!savedState) return;

  const svgWidth = savedState.svgWidth;
  const svgHeight = savedState.svgHeight;

  // Get new SVG size and calculate scale to maintain aspect ratio
  const newBBox = new THREE.Box3().setFromObject(svgGroup);
  const newWidth = newBBox.max.x - newBBox.min.x;
  const newHeight = newBBox.max.y - newBBox.min.y;

  const scaleX = svgWidth / newWidth;
  const scaleY = svgHeight / newHeight;

  const scale = Math.min(scaleX, scaleY); // Scale uniformly to preserve aspect ratio

  // Apply scale to the new SVG
  svgGroup.scale.set(scale, scale, scale);
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
  anchorLocalPosition.set(0, 0, 0);
  updateAnchorMarkerPosition();

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

function createUIControls(svgGroup) {
  // Path color buttons with fixed handling
  document.querySelectorAll(".color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      // Parse the hex color to an integer (e.g., "0xFF0000" -> 16711680)
      const colorInt = parseInt(colorHex);

      // Create a Three.js color object
      threeColor = new THREE.Color(colorInt);

      // Apply to all mesh materials
      svgGroup.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            // Handle multi-material
            child.material.forEach((mat) => {
              if (mat.color) {
                mat.color.copy(threeColor);
                mat.needsUpdate = true;
              }
            });
          } else {
            // Single material
            if (child.material.color) {
              child.material.color.copy(threeColor);
              child.material.needsUpdate = true;
            }
          }
        }
      });

      // Log the color change for debugging
      console.log(
        "Changed color to:",
        colorHex,
        "RGB:",
        threeColor.r.toFixed(2),
        threeColor.g.toFixed(2),
        threeColor.b.toFixed(2)
      );
    });
  });

  // Background color buttons
  document.querySelectorAll(".bg-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const color = parseInt(button.dataset.color);
      backgroundColor = color;
      scene.background = new THREE.Color(color);
    });
  });

  document
    .getElementById("save-details")
    .addEventListener("click", saveCurrentState);
}

function updateSavedState(updateFn) {
  const savedState = localStorage.getItem("svgViewState");
  let state = {};

  if (savedState) {
    try {
      state = JSON.parse(savedState);
    } catch (e) {
      console.error("Error parsing saved state:", e);
    }
  }

  // Apply the update function to modify the state
  state = updateFn(state);

  // Save the updated state back to localStorage
  localStorage.setItem("svgViewState", JSON.stringify(state));
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
  // For fixed size renderer, we don't need to adjust width/height
  // But we do need to adjust the camera frustum
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = (frustumSize * newAspect) / -2;
  camera.right = (frustumSize * newAspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = frustumSize / -2;
  camera.updateProjectionMatrix();
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

  renderer.render(scene, camera);
}

function saveCurrentState() {
  console.log("Saving current state...");

  const cameraState = {
    position: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    rotation: {
      x: camera.rotation.x,
      y: camera.rotation.y,
      z: camera.rotation.z,
      order: camera.rotation.order,
    },
    zoom: camera.zoom,
    left: camera.left,
    right: camera.right,
    top: camera.top,
    bottom: camera.bottom,
    near: camera.near,
    far: camera.far,
  };

  const controlsState = {
    target: {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z,
    },
  };

  const modelState = {};
  if (rotationGroup) {
    modelState.rotation = {
      x: rotationGroup.rotation.x,
      y: rotationGroup.rotation.y,
      z: rotationGroup.rotation.z,
    };
    modelState.position = {
      x: rotationGroup.position.x,
      y: rotationGroup.position.y,
      z: rotationGroup.position.z,
    };
    modelState.scale = {
      x: rotationGroup.scale.x,
      y: rotationGroup.scale.y,
      z: rotationGroup.scale.z,
    };
  }

  // Calculate the SVG's bounding box
  const bbox = new THREE.Box3().setFromObject(rotationGroup);
  const svgWidth = bbox.getSize(new THREE.Vector3()).x;
  const svgHeight = bbox.getSize(new THREE.Vector3()).y;

  const anchorWorldPos = getAnchorWorldPosition(); // Assuming this function is defined

  // Save the canvas position of the anchor (if needed)
  const canvasPosition = worldToCanvas(anchorWorldPos); // This function would convert world coordinates to canvas space

  // Save the necessary data
  const handlesState = {
    currentRotation: currentRotation,
    anchorPoint: anchorPoint,
    anchorWorldPosition: anchorWorldPos,
    anchorCanvasPosition: canvasPosition, // Save anchor position on canvas
  };

  const renderingState = {
    modelColor: threeColor ? threeColor.getHex() : 0x00ff00,
    backgroundColor: scene.background ? scene.background.getHex() : null,
    extrusionDepth: 10,
    bevelEnabled: true,
    curveSegments: 24,
    metalness: 0.8,
    roughness: 0.2,
  };

  // Save SVG dimensions and other settings
  const viewState = {
    camera: cameraState,
    controls: controlsState,
    model: modelState,
    handles: handlesState,
    rendering: renderingState,
    svg: { width: svgWidth, height: svgHeight }, // Save SVG size
  };

  // Store settings in localStorage
  localStorage.setItem("svgViewState", JSON.stringify(viewState));
  console.log("State saved:", viewState);
}

// Helper function to apply handle state
function applyHandlesState(handlesState) {
  // Apply current rotation value
  if (handlesState.currentRotation !== undefined) {
    currentRotation = handlesState.currentRotation;

    // If rotationGroup exists, ensure rotation is applied
    if (rotationGroup && rotationGroup.rotation) {
      rotationGroup.rotation.z = currentRotation;
    }
  }

  if (handlesState.anchorPoint) {
    anchorPoint.x = handlesState.anchorPoint.x;
    anchorPoint.y = handlesState.anchorPoint.y;
    updateAnchorMarkerPosition();
  }

  // Apply movement handle state
  if (handlesState.movementHandle && movementHandle) {
    if (handlesState.movementHandle.position) {
      movementHandle.position.set(
        handlesState.movementHandle.position.x,
        handlesState.movementHandle.position.y,
        handlesState.movementHandle.position.z
      );
    }

    if (handlesState.movementHandle.visible !== undefined) {
      movementHandle.visible = handlesState.movementHandle.visible;
    }
  }

  // Apply rotation handle state
  if (handlesState.rotationHandle && rotationHandle) {
    if (handlesState.rotationHandle.position) {
      rotationHandle.position.set(
        handlesState.rotationHandle.position.x,
        handlesState.rotationHandle.position.y,
        handlesState.rotationHandle.position.z
      );
    }

    if (handlesState.rotationHandle.visible !== undefined) {
      rotationHandle.visible = handlesState.rotationHandle.visible;
    }
  }
}

function getAnchorCanvasPosition() {
  if (!anchorMarker || !rotationGroup) return new THREE.Vector2();

  // Get world position of anchor marker
  const worldPosition = anchorMarker.getWorldPosition(new THREE.Vector3());

  // Convert the world position to canvas (screen space) coordinates
  const canvasPosition = worldToCanvas(worldPosition);

  return canvasPosition;
}

// Helper function to convert world coordinates to canvas (screen space) coordinates
function worldToCanvas(worldPosition) {
  const vector = worldPosition.project(camera);

  const canvasWidth = renderer.domElement.width;
  const canvasHeight = renderer.domElement.height;

  const x = ((vector.x + 1) / 2) * canvasWidth;
  const y = ((-vector.y + 1) / 2) * canvasHeight;

  return new THREE.Vector2(x, y);
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

function getAnchorWorldPosition() {
  if (!svgGroup || !rotationGroup) return new THREE.Vector3();

  // Calculate bounding box of SVG
  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const svgSize = bbox.getSize(new THREE.Vector3());

  // Get the anchor position in local coordinates
  const anchorX = (anchorPoint.x - 0.5) * svgSize.x;
  const anchorY = (anchorPoint.y - 0.5) * svgSize.y;

  // Create a vector
  const worldAnchor = new THREE.Vector3(anchorX, anchorY, 0);

  // Apply rotation
  const rotMatrix = new THREE.Matrix4().makeRotationZ(rotationGroup.rotation.z);
  worldAnchor.applyMatrix4(rotMatrix);

  // Apply translation
  worldAnchor.add(rotationGroup.position);

  return worldAnchor;
}

// Update the init function to remove the timeout
function init() {
  // Check if we have a saved state
  const savedState = localStorage.getItem("svgViewState");

  // Load SVG - either the one from saved state or default
  if (savedState) {
    loadSVG("../assets/x-02.svg");
  } else {
    loadSVG("../assets/x-02-long.svg");
  }

  // Set up click-to-set-anchor-point functionality
  setupClickToSetAnchorPoint();

  createUIControls(svgGroup);

  // Start animation loop
  animate();
}

init();
