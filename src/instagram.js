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

// function createThickLineFromPoints(points, thickness = 1.5) {
//   if (points.length < 2) return null;

//   const lineShapes = [];

//   for (let i = 0; i < points.length - 1; i++) {
//     const pointA = points[i];
//     const pointB = points[i + 1];

//     const direction = new THREE.Vector2(
//       pointB.x - pointA.x,
//       pointB.y - pointA.y
//     ).normalize();

//     const perpendicular = new THREE.Vector2(
//       -direction.y,
//       direction.x
//     ).multiplyScalar(thickness / 2);

//     const segmentShape = new THREE.Shape();
//     segmentShape.moveTo(pointA.x + perpendicular.x, pointA.y + perpendicular.y);
//     segmentShape.lineTo(pointB.x + perpendicular.x, pointB.y + perpendicular.y);
//     segmentShape.lineTo(pointB.x - perpendicular.x, pointB.y - perpendicular.y);
//     segmentShape.lineTo(pointA.x - perpendicular.x, pointA.y - perpendicular.y);
//     segmentShape.closePath();

//     lineShapes.push(segmentShape);
//   }

//   return lineShapes;
// }

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
//   // Create a new rotation group to hold the SVG
//   rotationGroup = new THREE.Group();
//   scene.add(rotationGroup);

//   loader.load(
//     url,
//     function (data) {
//       // Create SVG group to hold all meshes
//       svgGroup = new THREE.Group();

//       // Red material for the background (formerly black in the SVG)
//       const redMaterial = new THREE.MeshPhongMaterial({
//         color: 0xff0000, // Red color
//         side: THREE.DoubleSide,
//         shininess: 30,
//         flatShading: false,
//       });

//       // Extrusion settings for the main shape
//       const extrudeSettings = {
//         depth: 1,
//         bevelEnabled: true,
//         bevelThickness: 2,
//         bevelSize: 1,
//         bevelOffset: 0,
//         bevelSegments: 3,
//       };

//       // Track if we successfully added any valid objects
//       let addedValidObject = false;

//       // Find and store all shapes
//       const allShapes = [];
//       const allHoles = [];

//       data.paths.forEach((path) => {
//         try {
//           const pathShapes = path.toShapes(true);
//           if (pathShapes && pathShapes.length > 0) {
//             pathShapes.forEach((shape) => {
//               // Calculate area to determine if it's a main shape or a hole
//               let area = 0;
//               const points = shape.getPoints(100);

//               for (
//                 let i = 0, j = points.length - 1;
//                 i < points.length;
//                 j = i++
//               ) {
//                 area += points[j].x * points[i].y;
//                 area -= points[i].x * points[j].y;
//               }
//               area = Math.abs(area) / 2;

//               console.log("Shape area:", area);

//               // For Instagram logo:
//               // Large area = outer rounded square
//               // Medium area = camera lens circle
//               // Small area = camera lens decoration
//               if (area > 10000) {
//                 allShapes.push(shape);
//               } else {
//                 allHoles.push(shape);
//               }
//             });
//           }
//         } catch (error) {
//           console.warn(`Error converting path to shapes:`, error);
//         }
//       });

//       console.log("Main shapes:", allShapes.length);
//       console.log("Holes:", allHoles.length);

//       // Create main shape (outer rounded square)
//       if (allShapes.length > 0) {
//         // Use the largest shape (should be the rounded square)
//         const mainShape = allShapes[0];

//         // Add all smaller shapes as holes in the main shape
//         allHoles.forEach((hole) => {
//           mainShape.holes.push(hole);
//         });

//         // Create the extruded geometry with holes
//         const geometry = new THREE.ExtrudeGeometry(mainShape, extrudeSettings);

//         // Create the mesh with red material
//         const mesh = new THREE.Mesh(geometry, redMaterial);
//         mesh.scale.y = -1; // Flip to match SVG orientation

//         svgGroup.add(mesh);
//         addedValidObject = true;
//       }

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

//             // Calculate scale to make it cover one-third of the screen
//             // Get the current viewport dimensions
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
//               // Calculate scale to make SVG cover one-third of screen
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
//       }

//       // Create UI Controls Container
//       createUIControls(svgGroup);
//     },
//     // onProgress callback
//     function (xhr) {
//       console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
//     },
//     // onError callback
//     function (error) {
//       console.error("An error happened loading the SVG:", error);
//     }
//   );
// }

// This function replaces the original loadSVG function to invert the fill areas
// function loadSVG(url) {
//   // Create a new rotation group to hold the SVG
//   rotationGroup = new THREE.Group();
//   scene.add(rotationGroup);

//   loader.load(
//     url,
//     function (data) {
//       // Create SVG group to hold all meshes
//       svgGroup = new THREE.Group();

//       // Red material for what was originally transparent in the SVG
//       const redMaterial = new THREE.MeshPhongMaterial({
//         color: 0xff0000, // Red color
//         side: THREE.DoubleSide,
//         shininess: 30,
//         flatShading: false,
//       });

//       // Transparent material for what was originally filled in the SVG
//       const transparentMaterial = new THREE.MeshPhongMaterial({
//         color: 0xffffff,
//         side: THREE.DoubleSide,
//         shininess: 30,
//         transparent: true,
//         opacity: 0,
//       });

//       // Extrusion settings for the main shape
//       const extrudeSettings = {
//         depth: 20, // Increased depth for better visibility
//         bevelEnabled: true,
//         bevelThickness: 2,
//         bevelSize: 1,
//         bevelOffset: 0,
//         bevelSegments: 3,
//       };

//       // Track if we successfully added any valid objects
//       let addedValidObject = false;

//       // We'll need to track the outer shape and inner shapes separately
//       let outerShape = null;
//       const innerShapes = [];

//       // Step 1: Find the outer boundary and inner details
//       data.paths.forEach((path) => {
//         try {
//           const pathShapes = path.toShapes(true);
//           if (pathShapes && pathShapes.length > 0) {
//             pathShapes.forEach((shape) => {
//               // Calculate area to determine if it's a main shape or inner detail
//               let area = 0;
//               const points = shape.getPoints(100);

//               for (
//                 let i = 0, j = points.length - 1;
//                 i < points.length;
//                 j = i++
//               ) {
//                 area += points[j].x * points[i].y;
//                 area -= points[i].x * points[j].y;
//               }
//               area = Math.abs(area) / 2;

//               console.log("Shape area:", area);

//               // We're looking for the outer circular boundary
//               if (area > 10000) {
//                 // Large area is likely the outer boundary
//                 if (!outerShape || area > calculateShapeArea(outerShape)) {
//                   outerShape = shape;
//                 }
//               } else {
//                 // These are the details inside the map
//                 innerShapes.push(shape);
//               }
//             });
//           }
//         } catch (error) {
//           console.warn(`Error converting path to shapes:`, error);
//         }
//       });

//       // Step 2: Create the outer shape as a red background
//       if (outerShape) {
//         // Create the extruded geometry for the background
//         const backgroundGeometry = new THREE.ExtrudeGeometry(
//           outerShape,
//           extrudeSettings
//         );
//         const backgroundMesh = new THREE.Mesh(backgroundGeometry, redMaterial);
//         backgroundMesh.scale.y = -1; // Flip to match SVG orientation
//         backgroundMesh.userData.isBackground = true;
//         svgGroup.add(backgroundMesh);
//         addedValidObject = true;
//       }

//       // Step 3: Create each inner shape as a "hole" (using transparent material)
//       innerShapes.forEach((shape, index) => {
//         if (hasValidPoints(shape.getPoints())) {
//           const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
//           if (!hasNaN(geometry)) {
//             const mesh = new THREE.Mesh(geometry, transparentMaterial);
//             mesh.scale.y = -1; // Flip to match SVG orientation
//             // Position it slightly forward to avoid z-fighting
//             mesh.position.z = 0.1;
//             mesh.userData.isDetail = true;
//             svgGroup.add(mesh);
//           }
//         }
//       });

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

//             // Calculate scale to make it cover one-third of the screen
//             const viewportWidth = camera.right - camera.left;
//             const viewportHeight = camera.top - camera.bottom;
//             const smallestViewportDim = Math.min(viewportWidth, viewportHeight);
//             const targetSize = smallestViewportDim / 3;

//             const boxSize = box.getSize(new THREE.Vector3());
//             const maxSvgDim = Math.max(boxSize.x, boxSize.y, boxSize.z);

//             if (maxSvgDim > 0 && !isNaN(maxSvgDim)) {
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
//       }

//       // Create UI Controls Container
//       createUIControls(svgGroup);
//     },
//     // onProgress callback
//     function (xhr) {
//       console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
//     },
//     // onError callback
//     function (error) {
//       console.error("An error happened loading the SVG:", error);
//     }
//   );
// }

// This function replaces the original loadSVG function to invert the fill areas
function loadSVG(url) {
  // Create a new rotation group to hold the SVG
  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  loader.load(
    url,
    function (data) {
      // Create SVG group to hold all meshes
      svgGroup = new THREE.Group();

      // Red material for what was originally transparent in the SVG
      const redMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000, // Red color
        side: THREE.DoubleSide,
        shininess: 30,
        flatShading: false,
      });

      // Extrusion settings for the main shape
      const extrudeSettings = {
        depth: 20, // Increased depth for better visibility
        bevelEnabled: true,
        bevelThickness: 2,
        bevelSize: 1,
        bevelOffset: 0,
        bevelSegments: 3,
      };

      // Track if we successfully added any valid objects
      let addedValidObject = false;

      // Find the outer boundary (the circle)
      let outerShape = null;
      let maxArea = 0;

      // First pass: find the outer boundary (largest shape by area)
      data.paths.forEach((path) => {
        try {
          const pathShapes = path.toShapes(true);
          if (pathShapes && pathShapes.length > 0) {
            pathShapes.forEach((shape) => {
              // Calculate area
              let area = 0;
              const points = shape.getPoints(100);

              for (
                let i = 0, j = points.length - 1;
                i < points.length;
                j = i++
              ) {
                area += points[j].x * points[i].y;
                area -= points[i].x * points[j].y;
              }
              area = Math.abs(area) / 2;

              if (area > maxArea) {
                maxArea = area;
                outerShape = shape;
              }
            });
          }
        } catch (error) {
          console.warn(`Error processing path for outer shape:`, error);
        }
      });

      // If we found the outer shape, start with it as a solid red circle
      if (outerShape) {
        // Create a base red circle
        const baseGeometry = new THREE.ExtrudeGeometry(
          outerShape,
          extrudeSettings
        );
        const baseMesh = new THREE.Mesh(baseGeometry, redMaterial);
        baseMesh.scale.y = -1; // Flip to match SVG orientation
        svgGroup.add(baseMesh);
        addedValidObject = true;

        // Now we need to create boolean cutouts for all the paths
        // For that, we'll create a CSG union of all paths
        // But since we don't have CSG available directly, we'll use a different approach:
        // We'll create a customized transparent material for each "cutout" shape

        // Create a clear material that allows the red background to show through the gaps
        const clearMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000, // Black
          opacity: 0, // Fully transparent
          transparent: true,
          side: THREE.DoubleSide,
        });

        // Extract all line paths to create a grid overlay
        // We'll use a slightly thicker line to ensure coverage of all thin lines
        const lineShapes = [];

        // Second pass: Process all paths as lines
        data.paths.forEach((path) => {
          try {
            // Extract path subpaths which are the actual drawing commands
            const subpaths = path.subPaths;
            if (subpaths && subpaths.length > 0) {
              subpaths.forEach((subpath) => {
                if (subpath.curves && subpath.curves.length > 0) {
                  // For each curve in the subpath, extract points to create thick lines
                  let points = [];

                  // Start with the first point
                  points.push(
                    new THREE.Vector2(
                      subpath.currentPoint.x,
                      subpath.currentPoint.y
                    )
                  );

                  // Add points from all curves
                  subpath.curves.forEach((curve) => {
                    if (curve.type === "LineCurve") {
                      // For line curves, just add the end point
                      points.push(new THREE.Vector2(curve.v2.x, curve.v2.y));
                    } else {
                      // For other curve types (like bezier), sample points along the curve
                      for (let t = 0.1; t <= 1.0; t += 0.1) {
                        const pt = curve.getPoint(t);
                        points.push(new THREE.Vector2(pt.x, pt.y));
                      }
                    }
                  });

                  // Create thick lines from the extracted points
                  if (points.length > 1) {
                    const thickLines = createThickLineFromPoints(points, 3.0); // Increased thickness
                    if (thickLines && thickLines.length > 0) {
                      lineShapes.push(...thickLines);
                    }
                  }
                }
              });
            }
          } catch (error) {
            console.warn(`Error extracting line paths:`, error);
          }
        });

        // Create the extruded geometry for all line shapes
        lineShapes.forEach((lineShape, index) => {
          try {
            if (hasValidPoints(lineShape.getPoints())) {
              const lineGeometry = new THREE.ExtrudeGeometry(lineShape, {
                depth: extrudeSettings.depth + 1, // Slightly deeper to avoid z-fighting
                bevelEnabled: false,
              });

              const lineMesh = new THREE.Mesh(lineGeometry, clearMaterial);
              lineMesh.scale.y = -1; // Flip to match SVG orientation
              lineMesh.position.z = 0.1; // Move slightly forward
              svgGroup.add(lineMesh);
            }
          } catch (error) {
            console.warn(`Error creating line mesh ${index}:`, error);
          }
        });
      }

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
            // Center the SVG at local origin
            const center = box.getCenter(new THREE.Vector3());
            svgGroup.position.sub(center);

            // Calculate scale to make it cover one-third of the screen
            const viewportWidth = camera.right - camera.left;
            const viewportHeight = camera.top - camera.bottom;
            const smallestViewportDim = Math.min(viewportWidth, viewportHeight);
            const targetSize = smallestViewportDim / 3;

            const boxSize = box.getSize(new THREE.Vector3());
            const maxSvgDim = Math.max(boxSize.x, boxSize.y, boxSize.z);

            if (maxSvgDim > 0 && !isNaN(maxSvgDim)) {
              const scale = targetSize / maxSvgDim;
              svgGroup.scale.set(scale, scale, scale);
            }
          }

          // Position the rotation group at the center of the scene
          rotationGroup.position.set(0, 0, 0);
        } catch (error) {
          console.error("Error processing SVG group:", error);
        }

        // Now that SVG is processed, setup the handles
        setupHandles();

        // Save initial state for undo if implemented
        if (typeof saveTransformState === "function") {
          saveTransformState();
        }
      }

      // Create UI Controls Container
      createUIControls(svgGroup);
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

// Improved thick line function with options to better handle SVG paths
function createThickLineFromPoints(points, thickness = 3.0) {
  if (!points || points.length < 2) return null;

  const lineShapes = [];

  for (let i = 0; i < points.length - 1; i++) {
    const pointA = points[i];
    const pointB = points[i + 1];

    // Skip invalid points or points that are too close
    if (
      !pointA ||
      !pointB ||
      isNaN(pointA.x) ||
      isNaN(pointA.y) ||
      isNaN(pointB.x) ||
      isNaN(pointB.y)
    ) {
      continue;
    }

    // Check if points are very close (would create tiny segments)
    const distance = Math.sqrt(
      Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)
    );

    if (distance < 0.1) continue; // Skip very short segments

    // Calculate direction vector
    const direction = new THREE.Vector2(
      pointB.x - pointA.x,
      pointB.y - pointA.y
    ).normalize();

    // Calculate perpendicular vector
    const perpendicular = new THREE.Vector2(
      -direction.y,
      direction.x
    ).multiplyScalar(thickness / 2);

    // Create shape for this line segment
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

// Helper function to calculate shape area
function calculateShapeArea(shape) {
  let area = 0;
  const points = shape.getPoints(100);

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j].x * points[i].y;
    area -= points[i].x * points[j].y;
  }

  return Math.abs(area) / 2;
}

// Extended UI Controls
function createUIControls(svgGroup) {
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

  // Add color control
  const colorContainer = document.createElement("div");
  colorContainer.style.padding = "10px";
  colorContainer.style.background = "rgba(0,0,0,0.5)";
  colorContainer.style.color = "white";
  colorContainer.innerHTML = `
    <div style='margin-bottom:8px'>Color:</div>
    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
      <button data-color="0xFF0000" style="background-color: #FF0000; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x00FF00" style="background-color: #00FF00; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x0000FF" style="background-color: #0000FF; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0xFFFF00" style="background-color: #FFFF00; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0xFF00FF" style="background-color: #FF00FF; width: 30px; height: 30px; border: 1px solid white;"></button>
      <button data-color="0x00FFFF" style="background-color: #00FFFF; width: 30px; height: 30px; border: 1px solid white;"></button>
    </div>
  `;

  controlsContainer.appendChild(colorContainer);

  // Add event listeners to color buttons
  const colorButtons = colorContainer.querySelectorAll("button");
  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const colorValue = parseInt(button.dataset.color);
      svgGroup.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.set(colorValue);
        }
      });
    });
  });

  // Add extrusion depth control
  const depthControl = document.createElement("div");
  depthControl.style.padding = "10px";
  depthControl.style.background = "rgba(0,0,0,0.5)";
  depthControl.style.color = "white";
  depthControl.innerHTML = `
    <label for="depth">Extrusion Depth: </label>
    <input type="range" id="depth" min="5" max="50" step="1" value="20">
    <span id="depth-value">20</span>
  `;

  controlsContainer.appendChild(depthControl);

  document.getElementById("depth").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("depth-value").textContent = value;

    // Update extrusion depth by scaling in Z
    svgGroup.traverse((child) => {
      if (child.isMesh) {
        child.scale.z = value / 20; // Relative to original 20 depth
      }
    });
  });

  // Add material controls
  const materialControl = document.createElement("div");
  materialControl.style.padding = "10px";
  materialControl.style.background = "rgba(0,0,0,0.5)";
  materialControl.style.color = "white";
  materialControl.innerHTML = `
    <div style='margin-bottom:8px'>Material Properties:</div>
    <div style="margin-bottom:5px">
      <label for="shininess">Shininess: </label>
      <input type="range" id="shininess" min="0" max="100" step="1" value="30">
      <span id="shininess-value">30</span>
    </div>
    <div>
      <label for="metalness">Metalness: </label>
      <input type="range" id="metalness" min="0" max="1" step="0.1" value="0">
      <span id="metalness-value">0</span>
    </div>
  `;

  controlsContainer.appendChild(materialControl);

  document.getElementById("shininess").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("shininess-value").textContent = value;

    svgGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.shininess = value;
      }
    });
  });

  document.getElementById("metalness").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("metalness-value").textContent = value;

    // Switch to Standard material if metalness is used
    if (value > 0) {
      svgGroup.traverse((child) => {
        if (child.isMesh && child.material) {
          // Save current color
          const currentColor = child.material.color.clone();

          // Replace with standard material
          child.material = new THREE.MeshStandardMaterial({
            color: currentColor,
            metalness: value,
            roughness: 0.5,
            side: THREE.DoubleSide,
          });
        }
      });
    }
  });

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
  const bgColorButtons = bgColorContainer.querySelectorAll("button");
  bgColorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const colorValue = parseInt(button.dataset.color);
      scene.background = new THREE.Color(colorValue);
    });
  });

  // Add export buttons if functions exist
  if (typeof exportToGLTF === "function") {
    const exportContainer = document.createElement("div");
    exportContainer.style.padding = "10px";
    exportContainer.style.background = "rgba(0,0,0,0.5)";
    exportContainer.style.color = "white";
    exportContainer.innerHTML =
      "<div style='margin-bottom:8px'>Export 3D Model:</div>";

    const formats = [
      { name: "GLTF/GLB", fn: () => exportToGLTF(svgGroup) },
      { name: "OBJ", fn: () => exportToOBJ(svgGroup) },
      { name: "STL", fn: () => exportToSTL(svgGroup) },
    ];

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
  }

  // Add screenshot button if function exists
  if (typeof takeScreenshot === "function") {
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
  }

  // Add toggle for handles visibility if function exists
  if (
    typeof updateHandlesVisibility === "function" &&
    typeof movementHandle !== "undefined"
  ) {
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
  }
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
  loadSVG("../assets/abcd.svg");

  // Start animation loop
  animate();
}

// Initialize the application
init();
