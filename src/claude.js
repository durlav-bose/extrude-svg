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

// function loadSVG(url) {
//   // Store the URL for reloading
//   window.lastLoadedSvgUrl = url;

//   // Clear existing rotation group
//   if (rotationGroup) {
//     scene.remove(rotationGroup);
//   }

//   // Create a new rotation group
//   rotationGroup = new THREE.Group();
//   scene.add(rotationGroup);

//   // Load the SVG with SVGLoader
//   loader.load(
//     url,
//     function (data) {
//       console.log("SVG loaded successfully");

//       // Create SVG group to hold all meshes
//       svgGroup = new THREE.Group();

//       // Create materials for SVG paths
//       const pathMaterial = new THREE.MeshPhongMaterial({
//         color: 0x00ff00, // Green color by default
//         side: THREE.DoubleSide,
//         flatShading: true,
//       });

//       // Extrusion settings
//       const extrudeSettings = {
//         depth: 10,
//         bevelEnabled: false,
//       };

//       // Track if we successfully added any valid objects
//       let addedValidObject = false;

//       // Process all paths from the SVG
//       data.paths.forEach((path, pathIndex) => {
//         try {
//           // Convert path to shapes without detecting holes
//           const shapes = path.toShapes(false);

//           if (!shapes || shapes.length === 0) {
//             return;
//           }

//           // Process each shape
//           shapes.forEach((shape, shapeIndex) => {
//             try {
//               if (!shape || !shape.curves || shape.curves.length === 0) {
//                 return;
//               }

//               // Create geometry with extrusion
//               const geometry = new THREE.ExtrudeGeometry(
//                 shape,
//                 extrudeSettings
//               );

//               // Check for invalid geometry
//               if (hasNaN(geometry)) {
//                 console.warn(
//                   `Invalid geometry in path ${pathIndex}, shape ${shapeIndex}`
//                 );
//                 return;
//               }

//               // Create mesh
//               const mesh = new THREE.Mesh(geometry, pathMaterial.clone());

//               // Flip Y axis to match SVG coordinate system
//               mesh.scale.y = -1;

//               // Add to SVG group
//               svgGroup.add(mesh);
//               addedValidObject = true;

//               console.log(`Added shape ${shapeIndex} from path ${pathIndex}`);
//             } catch (error) {
//               console.warn(
//                 `Error creating shape ${shapeIndex} from path ${pathIndex}:`,
//                 error
//               );
//             }
//           });
//         } catch (error) {
//           console.warn(`Error processing path ${pathIndex}:`, error);
//         }
//       });

//       // If we successfully added objects, add SVG group to rotation group
//       if (addedValidObject) {
//         // Add to rotation group
//         rotationGroup.add(svgGroup);

//         // Center and scale the group
//         try {
//           const box = new THREE.Box3();

//           svgGroup.traverse(function (child) {
//             if (child.isMesh) {
//               child.geometry.computeBoundingBox();
//               const childBox = child.geometry.boundingBox;

//               if (
//                 childBox &&
//                 !isNaN(childBox.min.x) &&
//                 !isNaN(childBox.min.y) &&
//                 !isNaN(childBox.min.z) &&
//                 !isNaN(childBox.max.x) &&
//                 !isNaN(childBox.max.y) &&
//                 !isNaN(childBox.max.z)
//               ) {
//                 childBox.applyMatrix4(child.matrixWorld);
//                 box.union(childBox);
//               } else {
//                 console.warn("Invalid bounding box:", child);
//               }
//             }
//           });

//           if (box.min.x !== Infinity) {
//             // Center the SVG at local origin
//             const center = box.getCenter(new THREE.Vector3());
//             svgGroup.position.sub(center);

//             // Calculate scale to make it fit nicely in the viewport
//             const viewportWidth = camera.right - camera.left;
//             const viewportHeight = camera.top - camera.bottom;

//             // Calculate the smallest dimension (width or height)
//             const smallestViewportDim = Math.min(viewportWidth, viewportHeight);

//             // Calculate target size (one-third of the smallest viewport dimension)
//             const targetSize = smallestViewportDim / 3;

//             // Calculate SVG original size
//             const boxSize = box.getSize(new THREE.Vector3());
//             const maxSvgDim = Math.max(boxSize.x, boxSize.y, boxSize.z);

//             if (maxSvgDim > 0 && !isNaN(maxSvgDim)) {
//               // Calculate scale to make SVG fit properly
//               const scale = targetSize / maxSvgDim;
//               svgGroup.scale.set(scale, scale, scale);
//             }
//           }

//           // Position the rotation group at the center of the scene
//           rotationGroup.position.set(0, 0, 0);
//         } catch (error) {
//           console.error("Error processing SVG group:", error);
//         }

//         // Now that SVG is processed, setup the handles
//         setupHandles();

//         // Save initial state for undo if implemented
//         if (typeof saveTransformState === "function") {
//           saveTransformState();
//         }

//         console.log("SVG processing complete");
//       } else {
//         console.error("No valid objects found in SVG");
//       }

//       // Create UI Controls
//       createUIControls(svgGroup);
//     },
//     // Progress callback
//     function (xhr) {
//       console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
//     },
//     // Error callback
//     function (error) {
//       console.error("Error loading SVG:", error);
//     }
//   );
// }

// // Enhanced UI controls
// function createUIControls(svgGroup) {
//   // Remove any existing UI
//   const existingUI = document.getElementById("svg-controls");
//   if (existingUI) {
//     existingUI.remove();
//   }

//   // Create container
//   const container = document.createElement("div");
//   container.id = "svg-controls";
//   container.style.position = "absolute";
//   container.style.top = "10px";
//   container.style.left = "10px";
//   container.style.background = "rgba(0,0,0,0.7)";
//   container.style.padding = "15px";
//   container.style.borderRadius = "5px";
//   container.style.color = "white";
//   container.style.fontFamily = "Arial, sans-serif";
//   container.style.zIndex = "1000";
//   container.style.minWidth = "200px";
//   document.body.appendChild(container);

//   // Add color control
//   const colorSection = document.createElement("div");
//   colorSection.style.marginBottom = "15px";
//   colorSection.innerHTML = `
//     <label style="display:block; margin-bottom:5px; font-weight:bold">Path Color:</label>
//     <div style="display:flex; gap:5px; flex-wrap:wrap">
//       <button class="color-btn" data-color="0x00FF00" style="background:#00FF00; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="color-btn" data-color="0xFF0000" style="background:#FF0000; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="color-btn" data-color="0x0000FF" style="background:#0000FF; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="color-btn" data-color="0xFFFF00" style="background:#FFFF00; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="color-btn" data-color="0xFF00FF" style="background:#FF00FF; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="color-btn" data-color="0x00FFFF" style="background:#00FFFF; width:30px; height:30px; border:1px solid #444"></button>
//     </div>
//   `;
//   container.appendChild(colorSection);

//   // Add extrusion depth control
//   const extrusionSection = document.createElement("div");
//   extrusionSection.style.marginBottom = "15px";
//   extrusionSection.innerHTML = `
//     <label style="display:block; margin-bottom:5px; font-weight:bold">Extrusion Depth:</label>
//     <div style="display:flex; flex-direction:column; gap:5px">
//       <div style="display:flex; align-items:center; gap:10px">
//         <input type="range" id="extrusion-depth" min="1" max="30" value="10" style="flex-grow:1">
//         <span id="depth-value" style="min-width:25px; text-align:right">10</span>
//       </div>
//       <button id="apply-depth" style="padding:5px">Apply Depth</button>
//     </div>
//   `;
//   container.appendChild(extrusionSection);

//   // Add background color control
//   const bgSection = document.createElement("div");
//   bgSection.style.marginBottom = "15px";
//   bgSection.innerHTML = `
//     <label style="display:block; margin-bottom:5px; font-weight:bold">Background:</label>
//     <div style="display:flex; gap:5px; flex-wrap:wrap">
//       <button class="bg-btn" data-color="0x000000" style="background:#000000; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="bg-btn" data-color="0x222222" style="background:#222222; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="bg-btn" data-color="0x444444" style="background:#444444; width:30px; height:30px; border:1px solid #444"></button>
//       <button class="bg-btn" data-color="0xFFFFFF" style="background:#FFFFFF; width:30px; height:30px; border:1px solid #444"></button>
//     </div>
//   `;
//   container.appendChild(bgSection);

//   // Add handles visibility control
//   const handlesSection = document.createElement("div");
//   handlesSection.style.marginBottom = "15px";
//   handlesSection.innerHTML = `
//     <label style="display:block; margin-bottom:5px; font-weight:bold">Manipulation:</label>
//     <div>
//       <button id="toggle-handles" style="width:100%; padding:5px">Toggle Handles</button>
//     </div>
//   `;
//   container.appendChild(handlesSection);

//   // Add export controls
//   const exportSection = document.createElement("div");
//   exportSection.style.marginBottom = "15px";
//   exportSection.innerHTML = `
//     <label style="display:block; margin-bottom:5px; font-weight:bold">Export:</label>
//     <div style="display:flex; gap:5px">
//       <button id="export-gltf" style="flex:1; padding:5px">GLTF</button>
//       <button id="export-obj" style="flex:1; padding:5px">OBJ</button>
//       <button id="export-stl" style="flex:1; padding:5px">STL</button>
//     </div>
//     <div style="margin-top:5px">
//       <button id="take-screenshot" style="width:100%; padding:5px">Screenshot</button>
//     </div>
//   `;
//   container.appendChild(exportSection);

//   // Add reload button
//   const reloadButton = document.createElement("button");
//   reloadButton.id = "reload-svg";
//   reloadButton.textContent = "Reload SVG";
//   reloadButton.style.width = "100%";
//   reloadButton.style.padding = "8px";
//   reloadButton.style.marginTop = "5px";
//   container.appendChild(reloadButton);

//   // Add event listeners

//   // Path color buttons
//   document.querySelectorAll(".color-btn").forEach((button) => {
//     button.addEventListener("click", () => {
//       const color = parseInt(button.dataset.color);
//       svgGroup.traverse((child) => {
//         if (child.isMesh) {
//           child.material.color.set(color);
//         }
//       });
//     });
//   });

//   // Extrusion depth control
//   document.getElementById("extrusion-depth").addEventListener("input", (e) => {
//     document.getElementById("depth-value").textContent = e.target.value;
//   });

//   document.getElementById("apply-depth").addEventListener("click", () => {
//     const depth = parseInt(document.getElementById("extrusion-depth").value);
//     window.customExtrusionDepth = depth;

//     if (window.lastLoadedSvgUrl) {
//       loadSVG(window.lastLoadedSvgUrl);
//     } else {
//       alert("No SVG has been loaded yet.");
//     }
//   });

//   // Background color buttons
//   document.querySelectorAll(".bg-btn").forEach((button) => {
//     button.addEventListener("click", () => {
//       const color = parseInt(button.dataset.color);
//       scene.background = new THREE.Color(color);
//     });
//   });

//   // Handle visibility toggle
//   document.getElementById("toggle-handles").addEventListener("click", () => {
//     if (movementHandle && rotationHandle) {
//       const currentVisibility = movementHandle.visible;
//       updateHandlesVisibility(!currentVisibility);
//     }
//   });

//   // Export buttons
//   document.getElementById("export-gltf").addEventListener("click", () => {
//     exportToGLTF(svgGroup);
//   });

//   document.getElementById("export-obj").addEventListener("click", () => {
//     exportToOBJ(svgGroup);
//   });

//   document.getElementById("export-stl").addEventListener("click", () => {
//     exportToSTL(svgGroup);
//   });

//   // Screenshot button
//   document.getElementById("take-screenshot").addEventListener("click", () => {
//     takeScreenshot();
//   });

//   // Reload button
//   document.getElementById("reload-svg").addEventListener("click", () => {
//     if (window.lastLoadedSvgUrl) {
//       loadSVG(window.lastLoadedSvgUrl);
//     } else {
//       alert("No SVG has been loaded yet.");
//     }
//   });
// }

// function hasNaN(geometry) {
//   const position = geometry.getAttribute("position");
//   if (!position) return true;
//   const array = position.array;
//   for (let i = 0; i < array.length; i++) {
//     if (isNaN(array[i])) return true;
//   }
//   return false;
// }

function loadSVG(url) {
  // Store the URL for reloading
  window.lastLoadedSvgUrl = url;

  // Clear existing rotation group
  if (rotationGroup) {
    scene.remove(rotationGroup);
  }

  // Create a new rotation group
  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  // Load the SVG with SVGLoader
  loader.load(
    url,
    function (data) {
      console.log("SVG loaded successfully");

      // Create SVG group to hold all meshes
      svgGroup = new THREE.Group();

      // Define materials
      const filledMaterial = new THREE.MeshPhongMaterial({
        color: 0x000000, // Black color for filled areas
        side: THREE.DoubleSide,
        flatShading: true,
      });

      // Create transparent material for non-filled paths
      const transparentMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
        flatShading: true,
      });

      // Extrusion settings
      const extrudeSettings = {
        depth: window.customExtrusionDepth || 10,
        bevelEnabled: false,
      };

      // Track if we successfully added any valid objects
      let addedValidObject = false;

      // Look for SVG with style definitions
      let hasFillNoneStyle = false;
      if (data.xml) {
        const styleElements = data.xml.getElementsByTagName("style");
        if (styleElements.length > 0) {
          const styleContent = styleElements[0].textContent;
          if (
            styleContent.includes("fill: none") ||
            styleContent.includes("fill:none")
          ) {
            hasFillNoneStyle = true;
            console.log(
              "Found style with fill:none. Using special processing."
            );
          }
        }
      }

      // For SVGs with class-based styling
      if (hasFillNoneStyle) {
        processStyledSVG(
          data,
          svgGroup,
          filledMaterial,
          transparentMaterial,
          extrudeSettings
        );
      } else {
        // For regular SVGs
        processRegularSVG(
          data,
          svgGroup,
          filledMaterial,
          transparentMaterial,
          extrudeSettings
        );
      }

      // Check if we added any valid objects
      svgGroup.traverse((child) => {
        if (child.isMesh) {
          addedValidObject = true;
        }
      });

      // If we successfully added objects, set up the scene
      if (addedValidObject) {
        // Add to rotation group
        rotationGroup.add(svgGroup);

        // Center and scale the group
        try {
          const box = new THREE.Box3().setFromObject(svgGroup);
          const center = box.getCenter(new THREE.Vector3());
          svgGroup.position.sub(center);

          // Scale to fit viewport
          const boxSize = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(boxSize.x, boxSize.y);

          if (maxDim > 0) {
            const viewportWidth = camera.right - camera.left;
            const viewportHeight = camera.top - camera.bottom;
            const targetSize = Math.min(viewportWidth, viewportHeight) / 3;
            const scale = targetSize / maxDim;

            svgGroup.scale.set(scale, scale, scale);
          }

          // Position at center of scene
          rotationGroup.position.set(0, 0, 0);
        } catch (error) {
          console.error("Error scaling/positioning SVG:", error);
        }

        // Set up handles safely
        try {
          if (typeof setupHandles === "function") {
            setupHandles();
          }
        } catch (error) {
          console.warn("Error setting up handles:", error);
        }

        console.log("SVG processing complete");
      } else {
        console.error("Failed to generate any valid geometry from the SVG");

        // Try fallback approach
        processFallbackSVG(data, svgGroup, filledMaterial, extrudeSettings);

        // Add to rotation group
        rotationGroup.add(svgGroup);
        centerAndScaleSVG(svgGroup);
      }

      // Create UI controls
      createUIControls(svgGroup);
    },
    // Progress callback
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // Error callback
    function (error) {
      console.error("Error loading SVG:", error);
    }
  );
}

// Process a regular SVG (simple fill attributes)
function processRegularSVG(
  data,
  svgGroup,
  filledMaterial,
  transparentMaterial,
  extrudeSettings
) {
  console.log("Processing as a regular SVG");

  // Process all paths
  data.paths.forEach((path, pathIndex) => {
    try {
      // Create shapes from path
      const shapes = path.toShapes(true); // true = detect holes

      if (!shapes || shapes.length === 0) {
        return;
      }

      // Check if this path has a fill
      const isFilled = !(
        path.userData &&
        path.userData.style &&
        path.userData.style.fill === "none"
      );

      // Choose material based on fill status
      const material = isFilled
        ? filledMaterial.clone()
        : transparentMaterial.clone();

      // If this path has a fill color defined, use it
      if (
        path.userData &&
        path.userData.style &&
        path.userData.style.fill &&
        path.userData.style.fill !== "none"
      ) {
        material.color = new THREE.Color(path.userData.style.fill);
      }

      // Process each shape
      shapes.forEach((shape, shapeIndex) => {
        try {
          if (!shape || !shape.curves || shape.curves.length === 0) {
            return;
          }

          // Create geometry
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

          // Check for invalid geometry
          if (hasNaN(geometry)) {
            console.warn(
              `Invalid geometry in path ${pathIndex}, shape ${shapeIndex}`
            );
            return;
          }

          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);

          // Flip Y axis to match SVG coordinate system
          mesh.scale.y = -1;

          // Add to SVG group
          svgGroup.add(mesh);

          console.log(`Added shape ${shapeIndex} from path ${pathIndex}`);
        } catch (error) {
          console.warn(`Error creating shape:`, error);
        }
      });
    } catch (error) {
      console.warn(`Error processing path ${pathIndex}:`, error);
    }
  });
}

// Process SVG with style classes
function processStyledSVG(
  data,
  svgGroup,
  filledMaterial,
  transparentMaterial,
  extrudeSettings
) {
  console.log("Processing as a style-based SVG");

  // Extract style class definitions if available
  const styleClasses = {};
  if (data.xml) {
    const styleElements = data.xml.getElementsByTagName("style");
    if (styleElements.length > 0) {
      const styleContent = styleElements[0].textContent;

      // Simple style parser - extract class definitions
      const classMatches = styleContent.match(/\.[^\{]+\{[^\}]+\}/g);
      if (classMatches) {
        classMatches.forEach((classMatch) => {
          const className = classMatch.match(/\.([^\s\{]+)/)[1];
          const fillMatch = classMatch.match(/fill:\s*([^;\}]+)/);
          const strokeMatch = classMatch.match(/stroke:\s*([^;\}]+)/);

          styleClasses[className] = {
            fill: fillMatch ? fillMatch[1].trim() : null,
            stroke: strokeMatch ? strokeMatch[1].trim() : null,
          };
        });
      }

      console.log("Extracted style classes:", styleClasses);
    }
  }

  // Process polygon and path elements directly if possible
  if (data.xml) {
    // Get all polygon elements
    const polygons = data.xml.getElementsByTagName("polygon");
    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i];
      const classValue = polygon.getAttribute("class");

      // Determine if this should be filled
      let isFilled = true;
      if (classValue && styleClasses[classValue]) {
        isFilled = styleClasses[classValue].fill !== "none";
      }

      // Process this polygon
      if (isFilled) {
        const points = polygon
          .getAttribute("points")
          .trim()
          .split(/\s+|,/)
          .map(Number);

        if (points.length >= 6) {
          // Need at least 3 points (x,y pairs)
          const shape = new THREE.Shape();

          // Start at first point
          shape.moveTo(points[0], -points[1]);

          // Add remaining points
          for (let j = 2; j < points.length; j += 2) {
            shape.lineTo(points[j], -points[j + 1]);
          }

          // Create geometry
          try {
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            const mesh = new THREE.Mesh(geometry, filledMaterial.clone());
            svgGroup.add(mesh);

            console.log(`Added polygon from XML`);
          } catch (error) {
            console.warn("Error creating polygon geometry:", error);
          }
        }
      }
    }
  }

  // Process all paths
  data.paths.forEach((path, pathIndex) => {
    try {
      // If path has class information, check its style
      let isFilled = true;
      let className = null;

      if (path.userData && path.userData.node) {
        className = path.userData.node.getAttribute("class");
        if (className && styleClasses[className]) {
          isFilled = styleClasses[className].fill !== "none";
        }
      }

      // Direct style overrides class
      if (
        path.userData &&
        path.userData.style &&
        path.userData.style.fill === "none"
      ) {
        isFilled = false;
      }

      // Create shapes from path
      const shapes = path.toShapes(true); // true = detect holes

      if (!shapes || shapes.length === 0) {
        return;
      }

      // Choose material based on fill status
      const material = isFilled
        ? filledMaterial.clone()
        : transparentMaterial.clone();

      // Process each shape
      shapes.forEach((shape, shapeIndex) => {
        try {
          if (!shape || !shape.curves || shape.curves.length === 0) {
            return;
          }

          // Create geometry
          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

          // Check for invalid geometry
          if (hasNaN(geometry)) {
            return;
          }

          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);

          // Flip Y axis
          mesh.scale.y = -1;

          // Add to SVG group
          svgGroup.add(mesh);

          console.log(`Added shape from class ${className}`);
        } catch (error) {
          console.warn(`Error creating shape:`, error);
        }
      });
    } catch (error) {
      console.warn(`Error processing path ${pathIndex}:`, error);
    }
  });
}

// Fallback processing
function processFallbackSVG(data, svgGroup, filledMaterial, extrudeSettings) {
  console.log("Using fallback processing");

  // Process all paths, assuming they should be filled
  data.paths.forEach((path, pathIndex) => {
    const shapes = path.toShapes(false); // false = don't detect holes

    shapes.forEach((shape, shapeIndex) => {
      try {
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        const mesh = new THREE.Mesh(geometry, filledMaterial.clone());
        mesh.scale.y = -1;

        svgGroup.add(mesh);

        console.log(`Added fallback shape from path ${pathIndex}`);
      } catch (error) {
        console.warn(`Error in fallback processing:`, error);
      }
    });
  });
}

// Center and scale SVG
function centerAndScaleSVG(svgGroup) {
  try {
    const box = new THREE.Box3().setFromObject(svgGroup);
    const center = box.getCenter(new THREE.Vector3());
    svgGroup.position.sub(center);

    const boxSize = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(boxSize.x, boxSize.y);

    if (maxDim > 0) {
      const viewportWidth = camera.right - camera.left;
      const viewportHeight = camera.top - camera.bottom;
      const targetSize = Math.min(viewportWidth, viewportHeight) / 3;
      const scale = targetSize / maxDim;

      svgGroup.scale.set(scale, scale, scale);
    }

    rotationGroup.position.set(0, 0, 0);
  } catch (error) {
    console.error("Error in centerAndScaleSVG:", error);
  }
}

// Create UI controls
function createUIControls(svgGroup) {
  // Remove existing controls
  const existingControls = document.getElementById("svg-controls");
  if (existingControls) existingControls.remove();

  // Create container
  const container = document.createElement("div");
  container.id = "svg-controls";
  container.style.position = "absolute";
  container.style.top = "10px";
  container.style.left = "10px";
  container.style.background = "rgba(0,0,0,0.7)";
  container.style.padding = "10px";
  container.style.borderRadius = "5px";
  container.style.color = "white";
  container.style.zIndex = "1000";
  document.body.appendChild(container);

  // Add color control
  container.innerHTML = `
    <div style="margin-bottom:10px;">
      <label style="display:block; margin-bottom:5px;">Fill Color:</label>
      <div style="display:flex; gap:5px; flex-wrap:wrap;">
        <button data-color="0x000000" style="background:#000000; width:30px; height:30px; border: 1px solid #FFF;"></button>
        <button data-color="0xFF0000" style="background:#FF0000; width:30px; height:30px;"></button>
        <button data-color="0x0000FF" style="background:#0000FF; width:30px; height:30px;"></button>
        <button data-color="0xFFFFFF" style="background:#FFFFFF; width:30px; height:30px;"></button>
      </div>
    </div>
    <div style="margin-bottom:10px;">
      <label style="display:block; margin-bottom:5px;">Extrusion Depth:</label>
      <div style="display:flex; align-items:center; gap:10px;">
        <input type="range" id="extrusion-depth" min="1" max="30" value="10" style="flex-grow:1;">
        <span id="depth-value">10</span>
      </div>
    </div>
    <div style="margin-bottom:10px;">
      <label style="display:block; margin-bottom:5px;">Background:</label>
      <div style="display:flex; gap:5px; flex-wrap:wrap;">
        <button data-bg="0x000000" style="background:#000000; width:30px; height:30px;"></button>
        <button data-bg="0x222222" style="background:#222222; width:30px; height:30px;"></button>
        <button data-bg="0xFFFFFF" style="background:#FFFFFF; width:30px; height:30px; border: 1px solid #444;"></button>
      </div>
    </div>
    <button id="toggle-handles" style="width:100%; margin-bottom:10px; padding:5px;">Toggle Handles</button>
    <button id="apply-settings" style="width:100%; margin-bottom:10px; padding:5px;">Apply Settings</button>
    <button id="reload-svg" style="width:100%; padding:5px;">Reload SVG</button>
  `;

  // Add event listeners
  document.querySelectorAll("[data-color]").forEach((button) => {
    button.addEventListener("click", () => {
      const color = parseInt(button.dataset.color);
      svgGroup.traverse((child) => {
        if (child.isMesh && !child.material.transparent) {
          child.material.color.set(color);
        }
      });
    });
  });

  document.querySelectorAll("[data-bg]").forEach((button) => {
    button.addEventListener("click", () => {
      const color = parseInt(button.dataset.bg);
      scene.background = new THREE.Color(color);
    });
  });

  document.getElementById("extrusion-depth").addEventListener("input", (e) => {
    document.getElementById("depth-value").textContent = e.target.value;
  });

  document.getElementById("toggle-handles").addEventListener("click", () => {
    if (
      typeof updateHandlesVisibility === "function" &&
      typeof movementHandle !== "undefined"
    ) {
      const currentVisibility = movementHandle.visible;
      updateHandlesVisibility(!currentVisibility);
    }
  });

  document.getElementById("apply-settings").addEventListener("click", () => {
    window.customExtrusionDepth = parseInt(
      document.getElementById("extrusion-depth").value
    );

    if (window.lastLoadedSvgUrl) {
      loadSVG(window.lastLoadedSvgUrl);
    }
  });

  document.getElementById("reload-svg").addEventListener("click", () => {
    if (window.lastLoadedSvgUrl) {
      loadSVG(window.lastLoadedSvgUrl);
    } else {
      alert("No SVG loaded yet");
    }
  });
}

// Utility function to check for NaN in geometry
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Start the application
function init() {
  // Load the SVG
  loadSVG("../assets/vector2.svg");

  // Start animation loop
  animate();
}

// Initialize the application
init();
