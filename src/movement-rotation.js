import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { DragControls } from "three/examples/jsm/controls/DragControls";

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Camera setup
const cameraHeight = 700;
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

// Renderer setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(700, 700);
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

// Global variables
let svgGroup; // Original SVG meshes
let rotationGroup; // Group to hold svgGroup and allow rotation
let currentRotation = 0;
let movementHandle, rotationHandle;

// SVG Loader
const loader = new SVGLoader();

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

function hasNaN(geometry) {
  const position = geometry.getAttribute("position");
  if (!position) return true;
  const array = position.array;
  for (let i = 0; i < array.length; i++) {
    if (isNaN(array[i])) return true;
  }
  return false;
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

// Export helper functions
function saveArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function saveString(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// Export functions
function exportToGLTF(input) {
  const gltfExporter = new GLTFExporter();
  const options = {
    trs: false,
    onlyVisible: true,
    truncateDrawRange: true,
    binary: false,
    maxTextureSize: 4096,
  };

  gltfExporter.parse(
    input,
    function (result) {
      if (result instanceof ArrayBuffer) {
        saveArrayBuffer(result, "extruded-svg.glb");
      } else {
        const output = JSON.stringify(result, null, 2);
        saveString(output, "extruded-svg.gltf");
      }
    },
    options
  );
}

function exportToOBJ(input) {
  const objExporter = new OBJExporter();
  const result = objExporter.parse(input);
  saveString(result, "extruded-svg.obj");
}

function exportToSTL(input) {
  const stlExporter = new STLExporter();
  const result = stlExporter.parse(input, { binary: true });
  saveArrayBuffer(result, "extruded-svg.stl");
}

// Handle functions
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
  handle.position.set(0, 0, 50); // Put in front of the model
  handle.renderOrder = 1000; // Ensure it renders on top
  handle.scale.set(0.5, 0.5, 0.5);
  scene.add(handle);

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
  handle.position.set(0, 0, 50); // Put in front of the model
  handle.renderOrder = 1000; // Ensure it renders on top
  handle.scale.set(0.5, 0.5, 0.5);

  return handle;
}

// function setupHandles() {
//   // Create movement handle
//   movementHandle = createMovementHandle();

//   // Create rotation handle and add to rotation group
//   rotationHandle = createRotationHandle();
//   rotationGroup.add(rotationHandle);

//   // Calculate bounding box of SVG for handle placement
//   const bbox = new THREE.Box3().setFromObject(svgGroup);
//   const size = bbox.getSize(new THREE.Vector3());
//   const center = bbox.getCenter(new THREE.Vector3());

//   // Position handles at the edges of the model
//   const handleOffset = {
//     x: size.x / 2 + 20, // Add some margin
//     y: size.y / 2 + 20,
//   };

//   // Position handles
//   rotationHandle.position.set(handleOffset.x, handleOffset.y, 5);
//   movementHandle.position.set(-handleOffset.x, handleOffset.y, 5);

//   // Setup drag controls for movement handle
//   const movementControls = new DragControls(
//     [movementHandle],
//     camera,
//     renderer.domElement
//   );

//   let initialHandlePosition = new THREE.Vector3();
//   let initialGroupPosition = new THREE.Vector3();

//   movementControls.addEventListener("dragstart", (event) => {
//     controls.enabled = false; // Disable orbit controls while dragging
//     initialHandlePosition.copy(event.object.position);
//     initialGroupPosition.copy(rotationGroup.position);
//   });

//   movementControls.addEventListener("drag", (event) => {
//     const delta = new THREE.Vector3()
//       .copy(event.object.position)
//       .sub(initialHandlePosition);

//     // Move the rotation group (which contains the model)
//     rotationGroup.position.copy(initialGroupPosition).add(delta);
//   });

//   movementControls.addEventListener("dragend", () => {
//     controls.enabled = true;
//   });

//   // Setup drag controls for rotation handle
//   const rotationControls = new DragControls(
//     [rotationHandle],
//     camera,
//     renderer.domElement
//   );

//   let initialAngle = 0;
//   let initialMousePosition = new THREE.Vector2();

//   rotationControls.addEventListener("dragstart", (event) => {
//     controls.enabled = false; // Disable orbit controls while dragging
//     initialAngle = currentRotation;

//     const center = new THREE.Vector3();
//     rotationGroup.getWorldPosition(center);

//     initialMousePosition.set(
//       event.object.position.x - center.x,
//       event.object.position.y - center.y
//     );
//   });

//   rotationControls.addEventListener("drag", (event) => {
//     const center = new THREE.Vector3();
//     rotationGroup.getWorldPosition(center);

//     const currentMousePosition = new THREE.Vector2(
//       event.object.position.x - center.x,
//       event.object.position.y - center.y
//     );

//     // Calculate angle change
//     const angle =
//       Math.atan2(currentMousePosition.y, currentMousePosition.x) -
//       Math.atan2(initialMousePosition.y, initialMousePosition.x);

//     rotationGroup.rotation.z = initialAngle + angle;
//     currentRotation = initialAngle + angle;
//   });

//   rotationControls.addEventListener("dragend", () => {
//     controls.enabled = true;
//   });
// }

function setupHandles() {
  // Calculate bounding box of SVG to get its dimensions and center
  const bbox = new THREE.Box3().setFromObject(svgGroup);

  // Get dimensions
  const svgSize = bbox.getSize(new THREE.Vector3());
  const svgWidth = svgSize.x;
  const svgHeight = svgSize.y;

  // Get center position
  const svgCenter = bbox.getCenter(new THREE.Vector3());

  // Center the SVG at origin first
  svgGroup.position.sub(svgCenter);

  // Update the rotation group position to place the SVG at its original location
  rotationGroup.position.add(svgCenter);

  // Create movement handle
  movementHandle = createMovementHandle();
  scene.add(movementHandle);

  // Position movement handle at the center of the SVG in world space
  movementHandle.position.copy(rotationGroup.position);
  movementHandle.position.z = 5;

  // Create rotation handle
  rotationHandle = createRotationHandle();
  rotationGroup.add(rotationHandle);

  // Position rotation handle at the edge using local coordinates
  const handleOffset = {
    x: svgWidth / 2 + 20,
    y: svgHeight / 2 + 20,
  };
  rotationHandle.position.set(handleOffset.x, handleOffset.y, 5);

  // Setup drag controls for movement handle
  const movementControls = new DragControls(
    [movementHandle],
    camera,
    renderer.domElement
  );

  let initialHandlePosition = new THREE.Vector3();
  let initialGroupPosition = new THREE.Vector3();

  movementControls.addEventListener("dragstart", (event) => {
    controls.enabled = false;
    initialHandlePosition.copy(event.object.position);
    initialGroupPosition.copy(rotationGroup.position);
  });

  movementControls.addEventListener("drag", (event) => {
    const delta = new THREE.Vector3()
      .copy(event.object.position)
      .sub(initialHandlePosition);

    rotationGroup.position.copy(initialGroupPosition).add(delta);
  });

  movementControls.addEventListener("dragend", () => {
    controls.enabled = true;
  });

  // Setup drag controls for rotation handle
  const rotationControls = new DragControls(
    [rotationHandle],
    camera,
    renderer.domElement
  );

  let initialAngle = 0;
  let initialRotationHandlePos = new THREE.Vector3();
  let rotationSensitivity = 0.3; // Adjust this value to control rotation speed

  rotationControls.addEventListener("dragstart", (event) => {
    controls.enabled = false;
    initialAngle = currentRotation;

    // Store the initial position of the rotation handle
    initialRotationHandlePos.copy(event.object.position);
  });

  rotationControls.addEventListener("drag", (event) => {
    // Get the rotation group's center in world coordinates
    const centerWorld = new THREE.Vector3();
    rotationGroup.getWorldPosition(centerWorld);

    // Get initial vector from center to initial handle position (local space)
    const initialVector = new THREE.Vector2(
      initialRotationHandlePos.x,
      initialRotationHandlePos.y
    );

    // Get current vector from center to current handle position (local space)
    const currentVector = new THREE.Vector2(
      event.object.position.x,
      event.object.position.y
    );

    // Calculate the angle between these vectors
    const dot = initialVector.dot(currentVector);
    const det =
      initialVector.x * currentVector.y - initialVector.y * currentVector.x;
    const angleChange = Math.atan2(det, dot);

    // Apply sensitivity adjustment
    const adjustedAngle = angleChange * rotationSensitivity;

    // Apply rotation
    rotationGroup.rotation.z = initialAngle + adjustedAngle;
    currentRotation = initialAngle + adjustedAngle;
  });

  rotationControls.addEventListener("dragend", () => {
    controls.enabled = true;
  });
}

// function setupHandles() {
//   // Calculate bounding box of SVG to get its dimensions and center
//   const bbox = new THREE.Box3().setFromObject(svgGroup);

//   // Get dimensions
//   const svgSize = bbox.getSize(new THREE.Vector3());
//   const svgWidth = svgSize.x;
//   const svgHeight = svgSize.y;

//   // Get center position
//   const svgCenter = bbox.getCenter(new THREE.Vector3());

//   // IMPORTANT: Center the SVG at origin first
//   // This ensures rotation happens around the center of the SVG
//   svgGroup.position.sub(svgCenter);

//   // Now update the rotation group position to place the SVG at its original location
//   rotationGroup.position.add(svgCenter);

//   // Create movement handle
//   movementHandle = createMovementHandle();
//   scene.add(movementHandle);

//   // Position movement handle at the center of the SVG in world space
//   movementHandle.position.copy(rotationGroup.position);
//   movementHandle.position.z = 5;

//   // Create rotation handle
//   rotationHandle = createRotationHandle();
//   rotationGroup.add(rotationHandle);

//   // Position rotation handle at the edge using local coordinates
//   const handleOffset = {
//     x: svgWidth / 2 + 20,
//     y: svgHeight / 2 + 20,
//   };
//   rotationHandle.position.set(handleOffset.x, handleOffset.y, 5);

//   // Setup drag controls for movement handle
//   const movementControls = new DragControls(
//     [movementHandle],
//     camera,
//     renderer.domElement
//   );

//   let initialHandlePosition = new THREE.Vector3();
//   let initialGroupPosition = new THREE.Vector3();

//   movementControls.addEventListener("dragstart", (event) => {
//     controls.enabled = false;
//     initialHandlePosition.copy(event.object.position);
//     initialGroupPosition.copy(rotationGroup.position);
//   });

//   movementControls.addEventListener("drag", (event) => {
//     const delta = new THREE.Vector3()
//       .copy(event.object.position)
//       .sub(initialHandlePosition);

//     rotationGroup.position.copy(initialGroupPosition).add(delta);
//   });

//   movementControls.addEventListener("dragend", () => {
//     controls.enabled = true;
//   });

//   // Setup drag controls for rotation handle
//   const rotationControls = new DragControls(
//     [rotationHandle],
//     camera,
//     renderer.domElement
//   );

//   let initialAngle = 0;
//   let initialMousePosition = new THREE.Vector2();

//   rotationControls.addEventListener("dragstart", (event) => {
//     controls.enabled = false;
//     initialAngle = currentRotation;

//     // Get the rotation group's center in world coordinates
//     const centerWorld = new THREE.Vector3();
//     rotationGroup.getWorldPosition(centerWorld);

//     // Get rotation handle position in world coordinates
//     const handleWorld = new THREE.Vector3();
//     event.object.getWorldPosition(handleWorld);

//     // Calculate initial vector from center to handle
//     initialMousePosition.set(
//       handleWorld.x - centerWorld.x,
//       handleWorld.y - centerWorld.y
//     );
//   });

//   rotationControls.addEventListener("drag", (event) => {
//     // Get the rotation group's center in world coordinates
//     const centerWorld = new THREE.Vector3();
//     rotationGroup.getWorldPosition(centerWorld);

//     // Get rotation handle position in world coordinates
//     const handleWorld = new THREE.Vector3();
//     event.object.getWorldPosition(handleWorld);

//     // Calculate current vector from center to handle
//     const currentMousePosition = new THREE.Vector2(
//       handleWorld.x - centerWorld.x,
//       handleWorld.y - centerWorld.y
//     );

//     // Calculate angle change
//     const angle =
//       Math.atan2(currentMousePosition.y, currentMousePosition.x) -
//       Math.atan2(initialMousePosition.y, initialMousePosition.x);

//     // Apply rotation
//     rotationGroup.rotation.z = initialAngle + angle;
//     currentRotation = initialAngle + angle;
//   });

//   rotationControls.addEventListener("dragend", () => {
//     controls.enabled = true;
//   });
// }

function updateHandlesVisibility(visible) {
  if (movementHandle) movementHandle.visible = visible;
  if (rotationHandle) rotationHandle.visible = visible;
}

// Screenshot function
function takeScreenshot() {
  // Store handle visibility and hide them
  const handlesVisible = movementHandle ? movementHandle.visible : false;
  updateHandlesVisibility(false);

  // Create a new scene for capturing
  const captureScene = new THREE.Scene();
  captureScene.background = scene.background.clone();

  // Clone the rotation group with all its children
  const captureGroup = rotationGroup.clone(true);
  captureScene.add(captureGroup);

  // Create a camera that matches the current view
  const captureCamera = new THREE.OrthographicCamera(
    camera.left,
    camera.right,
    camera.top,
    camera.bottom,
    camera.near,
    camera.far
  );
  captureCamera.position.copy(camera.position);
  captureCamera.quaternion.copy(camera.quaternion);
  captureCamera.zoom = camera.zoom;
  captureCamera.updateProjectionMatrix();

  // Setup dedicated renderer for the capture
  const captureRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: true,
  });
  captureRenderer.setSize(1000, 1000);
  captureRenderer.setPixelRatio(1);

  // Render the scene
  captureRenderer.render(captureScene, captureCamera);

  // Get image data and trigger download
  const dataURL = captureRenderer.domElement.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "extruded-svg-screenshot.png";
  link.click();

  // Clean up resources
  captureRenderer.dispose();
  captureScene.remove(captureGroup);
  captureGroup.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });

  // Restore handle visibility
  updateHandlesVisibility(handlesVisible);
}

// Load and process SVG
function loadSVG(url) {
  // Create a new rotation group to hold the SVG
  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  loader.load(
    url,
    function (data) {
      // Create SVG group to hold all meshes
      svgGroup = new THREE.Group();

      // Line thickness
      const lineThickness = 1.5;

      // Materials
      const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd700, // Gold/yellow
        side: THREE.DoubleSide,
      });

      // Transparent material for shapes
      const shapeMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0, // Completely transparent
        side: THREE.DoubleSide,
      });

      // Extrusion settings
      const shapeExtrudeSettings = {
        depth: 5,
        bevelEnabled: false,
      };

      const lineExtrudeSettings = {
        depth: 20,
        bevelEnabled: false,
      };

      // Create groups
      const lineGroup = new THREE.Group();
      const shapesGroup = new THREE.Group();

      // Track if we successfully added any valid objects
      let addedValidObject = false;

      // First pass - create thicker lines
      data.paths.forEach((path, pathIndex) => {
        for (let i = 0; i < path.subPaths.length; i++) {
          const subPath = path.subPaths[i];
          const subPathPoints = subPath.getPoints();

          if (!hasValidPoints(subPathPoints)) {
            continue;
          }

          // Map points to 3D space (and flip y-axis)
          const points = subPathPoints.map(
            (point) => new THREE.Vector2(point.x, -point.y)
          );

          // Create thick line shapes
          const lineShapes = createThickLineFromPoints(points, lineThickness);

          if (lineShapes && lineShapes.length > 0) {
            // Extrude each segment
            lineShapes.forEach((lineShape) => {
              const geometry = new THREE.ExtrudeGeometry(
                lineShape,
                lineExtrudeSettings
              );
              const lineMesh = new THREE.Mesh(geometry, lineMaterial);
              lineGroup.add(lineMesh);
              addedValidObject = true;
            });
          }
        }
      });

      svgGroup.add(lineGroup);

      // Second pass - create transparent shapes
      data.paths.forEach((path, pathIndex) => {
        try {
          const shapes = path.toShapes(true);

          if (!shapes || shapes.length === 0) {
            return;
          }

          // Process each shape
          shapes.forEach((shape, shapeIndex) => {
            try {
              if (!shape || !shape.curves || shape.curves.length === 0) {
                return;
              }

              const geometry = new THREE.ExtrudeGeometry(
                shape,
                shapeExtrudeSettings
              );

              if (hasNaN(geometry)) {
                return;
              }

              const mesh = new THREE.Mesh(geometry, shapeMaterial);
              mesh.scale.y = -1; // Flip to match our line orientation

              shapesGroup.add(mesh);
              addedValidObject = true;
            } catch (error) {
              console.warn(`Error creating shape extrusion:`, error);
            }
          });
        } catch (error) {
          console.warn(`Error converting path to shapes:`, error);
        }
      });

      svgGroup.add(shapesGroup);

      if (addedValidObject) {
        // Add to rotation group
        rotationGroup.add(svgGroup);

        // Center and scale the group
        try {
          const box = new THREE.Box3();

          svgGroup.traverse(function (child) {
            if (child.isMesh) {
              child.geometry.computeBoundingBox();
              const childBox = child.geometry.boundingBox;

              if (
                childBox &&
                !isNaN(childBox.min.x) &&
                !isNaN(childBox.min.y) &&
                !isNaN(childBox.min.z) &&
                !isNaN(childBox.max.x) &&
                !isNaN(childBox.max.y) &&
                !isNaN(childBox.max.z)
              ) {
                childBox.applyMatrix4(child.matrixWorld);
                box.union(childBox);
              } else {
                console.warn("Invalid bounding box:", child);
              }
            }
          });

          if (box.min.x !== Infinity) {
            const center = box.getCenter(new THREE.Vector3());
            svgGroup.position.sub(center);

            const boxSize = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
            if (maxDim > 0 && !isNaN(maxDim)) {
              const scale = 100 / maxDim;
              svgGroup.scale.set(scale, scale, scale);
            }
          }
        } catch (error) {
          console.error("Error processing SVG group:", error);
        }

        // Now that SVG is processed, setup the handles
        setupHandles();
      }

      // Create UI Controls Container
      createUIControls(lineGroup, lineThickness);
    },
    // onProgress callback
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // onError callback
    function (error) {
      console.error("An error happened loading the SVG:", error);
    }
  );
}

// Create UI controls
function createUIControls(lineGroup, lineThickness) {
  const controlsContainer = document.createElement("div");
  controlsContainer.style.position = "absolute";
  controlsContainer.style.top = "10px";
  controlsContainer.style.left = "10px";
  controlsContainer.style.display = "flex";
  controlsContainer.style.flexDirection = "column";
  controlsContainer.style.gap = "10px";
  controlsContainer.style.maxWidth = "300px";
  controlsContainer.style.zIndex = "100";
  document.body.appendChild(controlsContainer);

  // Add toggle button for lines
  const linesToggleButton = document.createElement("button");
  linesToggleButton.textContent = "Toggle Lines";
  linesToggleButton.style.padding = "10px";
  linesToggleButton.addEventListener("click", () => {
    lineGroup.visible = !lineGroup.visible;
  });
  controlsContainer.appendChild(linesToggleButton);

  // Add thickness control
  const thicknessControl = document.createElement("div");
  thicknessControl.style.padding = "10px";
  thicknessControl.style.background = "rgba(0,0,0,0.5)";
  thicknessControl.style.color = "white";
  thicknessControl.innerHTML = `
    <label for="thickness">Line Thickness: </label>
    <input type="range" id="thickness" min="0.5" max="5" step="0.5" value="${lineThickness}">
    <span id="thickness-value">${lineThickness}</span>
  `;
  controlsContainer.appendChild(thicknessControl);

  document.getElementById("thickness").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("thickness-value").textContent = value;
  });

  // Create export buttons
  const exportContainer = document.createElement("div");
  exportContainer.style.padding = "10px";
  exportContainer.style.background = "rgba(0,0,0,0.5)";
  exportContainer.style.color = "white";

  // Create export buttons for 3D models
  const formats = [
    { name: "GLTF/GLB", fn: () => exportToGLTF(svgGroup) },
    { name: "OBJ", fn: () => exportToOBJ(svgGroup) },
    { name: "STL", fn: () => exportToSTL(svgGroup) },
  ];

  exportContainer.innerHTML =
    "<div style='margin-bottom:8px'>Export 3D Model:</div>";

  const buttonContainer = document.createElement("div");
  buttonContainer.style.display = "flex";
  buttonContainer.style.flexWrap = "wrap";
  buttonContainer.style.gap = "5px";
  exportContainer.appendChild(buttonContainer);

  formats.forEach((format) => {
    const button = document.createElement("button");
    button.textContent = format.name;
    button.style.padding = "8px 12px";
    button.addEventListener("click", format.fn);
    buttonContainer.appendChild(button);
  });

  controlsContainer.appendChild(exportContainer);

  // Add screenshot button
  const screenshotContainer = document.createElement("div");
  screenshotContainer.style.padding = "10px";
  screenshotContainer.style.background = "rgba(0,0,0,0.5)";
  screenshotContainer.style.color = "white";
  screenshotContainer.innerHTML =
    "<div style='margin-bottom:8px'>Capture Image:</div>";

  const screenshotButton = document.createElement("button");
  screenshotButton.textContent = "Take Screenshot (PNG)";
  screenshotButton.style.padding = "8px 12px";
  screenshotButton.style.width = "100%";
  screenshotButton.addEventListener("click", takeScreenshot);

  screenshotContainer.appendChild(screenshotButton);
  controlsContainer.appendChild(screenshotContainer);

  // Add toggle for handles visibility
  const handlesToggleContainer = document.createElement("div");
  handlesToggleContainer.style.padding = "10px";
  handlesToggleContainer.style.background = "rgba(0,0,0,0.5)";
  handlesToggleContainer.style.color = "white";
  handlesToggleContainer.innerHTML =
    "<div style='margin-bottom:8px'>Manipulation Handles:</div>";

  const handlesToggleButton = document.createElement("button");
  handlesToggleButton.textContent = "Toggle Handles";
  handlesToggleButton.style.padding = "8px 12px";
  handlesToggleButton.style.width = "100%";
  handlesToggleButton.addEventListener("click", () => {
    const currentVisibility = movementHandle.visible;
    updateHandlesVisibility(!currentVisibility);
  });

  handlesToggleContainer.appendChild(handlesToggleButton);
  controlsContainer.appendChild(handlesToggleContainer);

  // Add background color controls
  const bgColorContainer = document.createElement("div");
  bgColorContainer.style.padding = "10px";
  bgColorContainer.style.background = "rgba(0,0,0,0.5)";
  bgColorContainer.style.color = "white";
  bgColorContainer.innerHTML = `
    <div style='margin-bottom:8px'>Background Color:</div>
    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
      <button data-color="0x111111" style="background-color: #111111; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x000000" style="background-color: #000000; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0xFFFFFF" style="background-color: #FFFFFF; width: 30px; height: 30px; border: 1px solid gray;"></button>
      <button data-color="0x0000FF" style="background-color: #0000FF; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x00FF00" style="background-color: #00FF00; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0xFF0000" style="background-color: #FF0000; width: 30px; height: 30px; border: 1px solid white;"></button>
    </div>
  `;

  controlsContainer.appendChild(bgColorContainer);

  // Add event listeners to background color buttons
  const colorButtons = bgColorContainer.querySelectorAll("button");
  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const colorValue = parseInt(button.dataset.color);
      scene.background = new THREE.Color(colorValue);
    });
  });

  // Add line color control
  const lineColorContainer = document.createElement("div");
  lineColorContainer.style.padding = "10px";
  lineColorContainer.style.background = "rgba(0,0,0,0.5)";
  lineColorContainer.style.color = "white";
  lineColorContainer.innerHTML = `
    <div style='margin-bottom:8px'>Line Color:</div>
    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
      <button data-color="0xffd700" style="background-color: #ffd700; width: 30px; height: 30px; border: 1px solid gray;"></button>
      <button data-color="0xFFFFFF" style="background-color: #FFFFFF; width: 30px; height: 30px; border: 1px solid gray;"></button>
      <button data-color="0xFF0000" style="background-color: #FF0000; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x00FF00" style="background-color: #00FF00; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x0000FF" style="background-color: #0000FF; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0xFF00FF" style="background-color: #FF00FF; width: 30px; height: 30px; border: 1px solid white;"></button>
    </div>
  `;

  controlsContainer.appendChild(lineColorContainer);

  // Add event listeners to line color buttons
  const lineColorButtons = lineColorContainer.querySelectorAll("button");
  lineColorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const colorValue = parseInt(button.dataset.color);
      lineGroup.traverse((child) => {
        if (child.isMesh) {
          child.material.color.set(colorValue);
        }
      });
    });
  });
}

// Handle window resizing
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Start the application
function init() {
  // Load the SVG
  loadSVG("../assets/vector.svg");

  // Start animation loop
  animate();
}

// Initialize the application
init();
