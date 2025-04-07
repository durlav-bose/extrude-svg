import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";

// Add a global variable to store handle state if handles aren't created yet
let pendingHandlesState = null;
window.preserveCurrentPosition = false;

let outputWidth = 1000;
let outputHeight = 1000;
let threeColor = new THREE.Color(0x00ff00);
// Scene setup
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x111111);

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

if (typeof RectAreaLightUniformsLib !== "undefined") {
  RectAreaLightUniformsLib.init();
}

// 1. Ambient Light - general illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// 2. Directional Light (sun-like, parallel rays)
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -200;
directionalLight.shadow.camera.right = 200;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;
scene.add(directionalLight);

// Create helper for directional light (optional)
const directionalHelper = new THREE.DirectionalLightHelper(
  directionalLight,
  50
);
directionalHelper.visible = false; // Set to true if you want to see the helper
scene.add(directionalHelper);

// 3. Point Light (omni-directional, like a light bulb)
const pointLight = new THREE.PointLight(0xffffff, 50, 200, 1);
pointLight.position.set(0, 0, 70);
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 1024;
pointLight.shadow.mapSize.height = 1024;
scene.add(pointLight);

// Create helper for point light (optional)
const pointHelper = new THREE.PointLightHelper(pointLight, 10);
pointHelper.visible = false; // Set to true if you want to see the helper
scene.add(pointHelper);

// 4. Spot Light (cone of light)
const spotLight = new THREE.SpotLight(0xffffff, 60, 300, Math.PI / 6, 0.5, 1);
spotLight.position.set(100, 100, 100);
spotLight.target.position.set(0, 0, 0);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
scene.add(spotLight);
scene.add(spotLight.target);

// Create helper for spot light (optional)
const spotHelper = new THREE.SpotLightHelper(spotLight);
spotHelper.visible = false; // Set to true if you want to see the helper
scene.add(spotHelper);

// 5. Hemisphere Light (gradient light from sky to ground)
const hemisphereLight = new THREE.HemisphereLight(0x0088ff, 0xff8800, 0.3);
hemisphereLight.position.set(0, 1, 0);
scene.add(hemisphereLight);

// Create helper for hemisphere light
const hemisphereHelper = new THREE.HemisphereLightHelper(hemisphereLight, 50);
hemisphereHelper.visible = false; // Set to true if you want to see the helper
scene.add(hemisphereHelper);

// 6. Rect Area Light (area light like a softbox)
let rectAreaLight;
let rectAreaHelper;
try {
  // Make sure to import the required modules for RectAreaLight
  rectAreaLight = new THREE.RectAreaLight(0xffffff, 3, 100, 100);
  rectAreaLight.position.set(-100, 0, 100);
  rectAreaLight.lookAt(0, 0, 0);
  scene.add(rectAreaLight);

  // Try to create RectAreaLightHelper if available
  try {
    if (typeof RectAreaLightHelper !== "undefined") {
      rectAreaHelper = new RectAreaLightHelper(rectAreaLight);
      rectAreaHelper.visible = false;
      scene.add(rectAreaHelper);
    } else if (typeof THREE.RectAreaLightHelper !== "undefined") {
      // In case it's directly available in THREE
      rectAreaHelper = new THREE.RectAreaLightHelper(rectAreaLight);
      rectAreaHelper.visible = false;
      scene.add(rectAreaHelper);
    }
  } catch (helperError) {
    console.warn("RectAreaLightHelper could not be created:", helperError);
  }
} catch (error) {
  console.warn(
    "RectAreaLight could not be created. This might be due to missing dependencies:",
    error
  );
}

// Store lights in a map for easy access
window.lights = {
  ambient: ambientLight,
  directional: directionalLight,
  point: pointLight,
  spot: spotLight,
  hemisphere: hemisphereLight,
  rectArea: rectAreaLight,
};

// Store helpers in window for global access
window.lightHelpers = {
  directionalHelper: directionalHelper,
  pointHelper: pointHelper,
  spotHelper: spotHelper,
  hemisphereHelper: hemisphereHelper,
  rectAreaHelper: rectAreaHelper,
};

// Helper function to toggle all light helpers
window.toggleLightHelpers = function (visible) {
  // Access through the window.lightHelpers object
  const helpers = window.lightHelpers;

  if (helpers.directionalHelper) helpers.directionalHelper.visible = visible;
  if (helpers.pointHelper) helpers.pointHelper.visible = visible;
  if (helpers.spotHelper) helpers.spotHelper.visible = visible;
  if (helpers.hemisphereHelper) helpers.hemisphereHelper.visible = visible;
  if (helpers.rectAreaHelper) helpers.rectAreaHelper.visible = visible;

  // Return true if at least one helper was toggled
  return !!(
    helpers.directionalHelper ||
    helpers.pointHelper ||
    helpers.spotHelper ||
    helpers.hemisphereHelper ||
    helpers.rectAreaHelper
  );
};

// Add this to your animation loop:
function updateLightHelpers() {
  const helpers = window.lightHelpers;

  // Spot light helper needs manual update in animation loop
  if (helpers.spotHelper && helpers.spotHelper.visible) {
    helpers.spotHelper.update();
  }

  // RectAreaLightHelper might also need updates
  if (helpers.rectAreaHelper && helpers.rectAreaHelper.visible) {
    if (typeof helpers.rectAreaHelper.update === "function") {
      helpers.rectAreaHelper.update();
    }
  }
}

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
  // Calculate bounding box of SVG
  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const svgSize = bbox.getSize(new THREE.Vector3());
  const svgWidth = svgSize.x;
  const svgHeight = svgSize.y;

  // Get center position in world coordinates
  const svgCenter = bbox.getCenter(new THREE.Vector3());
  svgGroup.position.sub(svgCenter);

  // Position the rotation group at the center of the viewport
  // Only set initial position if we're not restoring a state
  if (!pendingHandlesState) {
    rotationGroup.position.set(0, 0, 0);
  }

  // Create and position the handles
  movementHandle = createMovementHandle();
  scene.add(movementHandle);

  // Only set initial position if we're not restoring a state
  if (!pendingHandlesState || !pendingHandlesState.movementHandle) {
    movementHandle.position.set(0, 0, 5); // Center of viewport
  }

  // Create rotation handle
  rotationHandle = createRotationHandle();
  rotationGroup.add(rotationHandle);

  // Position rotation handle at the edge
  // Only set initial position if we're not restoring a state
  if (!pendingHandlesState || !pendingHandlesState.rotationHandle) {
    const handleOffset = {
      x: svgWidth / 2 + 20,
      y: svgHeight / 2 + 20,
    };
    rotationHandle.position.set(handleOffset.x, handleOffset.y, 5);
  }

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

  // Apply any pending handle state at the end of setupHandles
  if (pendingHandlesState) {
    applyHandlesState(pendingHandlesState);
    pendingHandlesState = null;
  }
}

// function setupHandles() {
//   // Calculate bounding box of SVG
//   const bbox = new THREE.Box3().setFromObject(svgGroup);
//   const svgSize = bbox.getSize(new THREE.Vector3());
//   const svgWidth = svgSize.x;
//   const svgHeight = svgSize.y;

//   // Get center position in world coordinates
//   const svgCenter = bbox.getCenter(new THREE.Vector3());
//   svgGroup.position.sub(svgCenter);

//   // Position the rotation group at the center of the viewport
//   rotationGroup.position.set(0, 0, 0);

//   // Create and position the handles
//   movementHandle = createMovementHandle();
//   scene.add(movementHandle);
//   movementHandle.position.set(0, 0, 5); // Center of viewport

//   // Create rotation handle
//   rotationHandle = createRotationHandle();
//   rotationGroup.add(rotationHandle);

//   // Position rotation handle at the edge
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
//   let initialRotationHandlePos = new THREE.Vector3();
//   let rotationSensitivity = 0.3; // Adjust this value to control rotation speed

//   rotationControls.addEventListener("dragstart", (event) => {
//     controls.enabled = false;
//     initialAngle = currentRotation;

//     // Store the initial position of the rotation handle
//     initialRotationHandlePos.copy(event.object.position);
//   });

//   rotationControls.addEventListener("drag", (event) => {
//     // Get the rotation group's center in world coordinates
//     const centerWorld = new THREE.Vector3();
//     rotationGroup.getWorldPosition(centerWorld);

//     // Get initial vector from center to initial handle position (local space)
//     const initialVector = new THREE.Vector2(
//       initialRotationHandlePos.x,
//       initialRotationHandlePos.y
//     );

//     // Get current vector from center to current handle position (local space)
//     const currentVector = new THREE.Vector2(
//       event.object.position.x,
//       event.object.position.y
//     );

//     // Calculate the angle between these vectors
//     const dot = initialVector.dot(currentVector);
//     const det =
//       initialVector.x * currentVector.y - initialVector.y * currentVector.x;
//     const angleChange = Math.atan2(det, dot);

//     // Apply sensitivity adjustment
//     const adjustedAngle = angleChange * rotationSensitivity;

//     // Apply rotation
//     rotationGroup.rotation.z = initialAngle + adjustedAngle;
//     currentRotation = initialAngle + adjustedAngle;
//   });

//   rotationControls.addEventListener("dragend", () => {
//     controls.enabled = true;
//   });
// }

function updateHandlesVisibility(visible) {
  if (movementHandle) movementHandle.visible = visible;
  if (rotationHandle) rotationHandle.visible = visible;
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Apply debounce to the takeScreenshot function (300ms delay)
const takeScreenshotDebounced = debounce(takeScreenshot, 300);

function takeScreenshot() {
  // Store handle visibility and hide them
  const handlesVisible = movementHandle ? movementHandle.visible : false;
  updateHandlesVisibility(false);

  console.log("outputWidth :>> ", outputWidth);
  console.log("outputHeight :>> ", outputHeight);

  // Get the original canvas dimensions to maintain aspect ratio
  const originalWidth = outputWidth || renderer.domElement.width;
  const originalHeight = outputHeight || renderer.domElement.height;

  // Create a new scene for capturing
  const captureScene = new THREE.Scene();
  // captureScene.background = scene.background.clone();

  // Copy all lights from the original scene
  scene.traverse((obj) => {
    if (obj.isLight) {
      const lightClone = obj.clone();
      captureScene.add(lightClone);
    }
  });

  // Create a new rotation group with the same transformation
  const captureRotationGroup = new THREE.Group();
  captureRotationGroup.position.copy(rotationGroup.position);
  captureRotationGroup.rotation.copy(rotationGroup.rotation);
  captureRotationGroup.scale.copy(rotationGroup.scale);
  captureScene.add(captureRotationGroup);

  // Create a new SVG group with the same transformation
  const captureSvgGroup = new THREE.Group();
  captureSvgGroup.position.copy(svgGroup.position);
  captureSvgGroup.rotation.copy(svgGroup.rotation);
  captureSvgGroup.scale.copy(svgGroup.scale);
  captureRotationGroup.add(captureSvgGroup);

  // Use the same traversal pattern as your color change code
  svgGroup.traverse((child) => {
    if (child.isMesh) {
      // Clone geometry
      const newGeometry = child.geometry.clone();

      // Handle materials
      let newMaterial;

      if (Array.isArray(child.material)) {
        // Handle multi-material
        newMaterial = child.material.map((mat) => {
          // Create a completely new material of the same type
          let clonedMat;

          if (mat.type === "MeshPhongMaterial") {
            // For PhongMaterial, create a new one with explicit color
            clonedMat = new THREE.MeshPhongMaterial({
              color: mat.color ? mat.color.clone() : 0x00ff00,
              emissive: mat.emissive ? mat.emissive.clone() : 0x000000,
              specular: mat.specular ? mat.specular.clone() : 0x111111,
              shininess: mat.shininess || 30,
              flatShading: mat.flatShading || false,
              side: mat.side || THREE.DoubleSide,
              transparent: mat.transparent || false,
              opacity: mat.opacity !== undefined ? mat.opacity : 1,
            });
          } else {
            // For other material types, basic clone
            clonedMat = mat.clone();
            if (mat.color) clonedMat.color.copy(mat.color);
          }

          // Force material update
          clonedMat.needsUpdate = true;
          return clonedMat;
        });
      } else {
        // Single material
        if (child.material.type === "MeshPhongMaterial") {
          // For PhongMaterial, create a new one with explicit color
          newMaterial = new THREE.MeshPhongMaterial({
            color: child.material.color
              ? child.material.color.clone()
              : 0x00ff00,
            emissive: child.material.emissive
              ? child.material.emissive.clone()
              : 0x000000,
            specular: child.material.specular
              ? child.material.specular.clone()
              : 0x111111,
            shininess: child.material.shininess || 30,
            flatShading: child.material.flatShading || false,
            side: child.material.side || THREE.DoubleSide,
            transparent: child.material.transparent || false,
            opacity:
              child.material.opacity !== undefined ? child.material.opacity : 1,
          });
        } else {
          // For other material types, basic clone
          newMaterial = child.material.clone();
          if (child.material.color)
            newMaterial.color.copy(child.material.color);
        }

        // Force material update
        newMaterial.needsUpdate = true;
      }

      // Create new mesh
      const newMesh = new THREE.Mesh(newGeometry, newMaterial);

      // Copy matrix transformation for exact positioning
      newMesh.matrix.copy(child.matrix);
      newMesh.matrixWorld.copy(child.matrixWorld);
      newMesh.matrixAutoUpdate = false;

      // Add to the capture SVG group
      captureSvgGroup.add(newMesh);
    }
  });

  // Create a camera that precisely matches the current view
  const captureCamera = camera.clone();
  captureCamera.position.copy(camera.position);
  captureCamera.rotation.copy(camera.rotation);
  captureCamera.zoom = camera.zoom;
  captureCamera.updateProjectionMatrix();

  // Setup dedicated renderer for the capture
  const captureRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: true,
  });
  captureRenderer.setSize(originalWidth, originalHeight);
  captureRenderer.setPixelRatio(window.devicePixelRatio);

  captureRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
  captureRenderer.shadowMap.type = renderer.shadowMap.type;
  captureRenderer.physicallyCorrectLights = true;

  // Render the scene with the same background color
  captureRenderer.setClearColor(scene.background, 0);
  captureRenderer.render(captureScene, captureCamera);

  // Log the colors in the cloned scene for debugging
  console.log("CLONED MATERIALS:");
  captureSvgGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      const mat = child.material;
      console.log("Cloned Mesh:", child.uuid.substring(0, 8));
      if (mat.color) {
        console.log("  - Color: #" + mat.color.getHexString());
        console.log("  - Type:", mat.type);
      }
    }
  });

  // Get image data and trigger download
  const dataURL = captureRenderer.domElement.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "extruded-svg-screenshot.png";
  link.click();

  // Clean up resources
  captureRenderer.dispose();
  captureScene.remove(captureRotationGroup);

  // Restore handle visibility
  updateHandlesVisibility(handlesVisible);
}

let isLoadingSVG = false;
// function loadSVG(url) {
//   // Get the saved state before loading if it exists
//   const savedState = localStorage.getItem("svgViewState");
//   let viewState = null;

//   if (savedState) {
//     try {
//       viewState = JSON.parse(savedState);
//       console.log(
//         "Loaded saved state for restoring during SVG load:",
//         viewState
//       );

//       // Apply rendering settings right away
//       if (viewState.rendering) {
//         // Model color will be applied after SVG loads

//         // Background color
//         if (viewState.rendering.backgroundColor !== null) {
//           scene.background = new THREE.Color(
//             viewState.rendering.backgroundColor
//           );
//         }

//         // Save extrusion settings to window
//         window.customExtrusionDepth =
//           window.customExtrusionDepth ?? viewState.rendering.extrusionDepth;
//         window.customBevelEnabled =
//           window.customBevelEnabled ?? viewState.rendering.bevelEnabled;
//         window.customCurveSegments =
//           window.customCurveSegments ?? viewState.rendering.curveSegments;
//         window.customMetalness =
//           window.customMetalness ?? viewState.rendering.metalness;
//         window.customRoughness =
//           window.customRoughness ?? viewState.rendering.roughness;
//       }

//       // Apply lighting settings
//       if (viewState.lighting && window.lights) {
//         Object.keys(viewState.lighting).forEach((lightType) => {
//           const savedLight = viewState.lighting[lightType];
//           const light = window.lights[lightType];

//           if (light && savedLight) {
//             if (savedLight.visible !== undefined)
//               light.visible = savedLight.visible;
//             if (savedLight.intensity !== undefined)
//               light.intensity = savedLight.intensity;
//             if (savedLight.color !== undefined)
//               light.color.setHex(savedLight.color);

//             if (savedLight.position && light.position) {
//               light.position.set(
//                 savedLight.position.x,
//                 savedLight.position.y,
//                 savedLight.position.z
//               );
//             }

//             // Apply type-specific properties
//             if (lightType === "spot") {
//               if (savedLight.angle !== undefined)
//                 light.angle = savedLight.angle;
//               if (savedLight.distance !== undefined)
//                 light.distance = savedLight.distance;
//               if (savedLight.decay !== undefined)
//                 light.decay = savedLight.decay;
//               if (savedLight.target && light.target) {
//                 light.target.position.set(
//                   savedLight.target.x,
//                   savedLight.target.y,
//                   savedLight.target.z
//                 );
//               }
//             } else if (lightType === "point") {
//               if (savedLight.distance !== undefined)
//                 light.distance = savedLight.distance;
//               if (savedLight.decay !== undefined)
//                 light.decay = savedLight.decay;
//             } else if (lightType === "hemisphere" && savedLight.groundColor) {
//               light.groundColor.setHex(savedLight.groundColor);
//             } else if (lightType === "rectArea") {
//               if (savedLight.width !== undefined)
//                 light.width = savedLight.width;
//               if (savedLight.height !== undefined)
//                 light.height = savedLight.height;
//               // Update lookAt after position/dimension changes
//               light.lookAt(0, 0, 0);
//             }
//           }
//         });

//         // Update light helpers
//         updateLightHelpers();
//       }
//     } catch (error) {
//       console.error("Error parsing saved state:", error);
//       viewState = null;
//     }
//   }

//   // Store current position/transformation state before reloading
//   let currentPositionState = null;
//   console.log(
//     "window.preserveCurrentPosition :>> ",
//     window.preserveCurrentPosition
//   );
//   console.log("camera :>> ", camera);
//   console.log("controls :>> ", controls);
//   console.log("rotationGroup :>> ", rotationGroup);
//   if (window.preserveCurrentPosition && camera && controls && rotationGroup) {
//     currentPositionState = {
//       camera: {
//         position: {
//           x: camera.position.x,
//           y: camera.position.y,
//           z: camera.position.z,
//         },
//         rotation: {
//           x: camera.rotation.x,
//           y: camera.rotation.y,
//           z: camera.rotation.z,
//           order: camera.rotation.order,
//         },
//         zoom: camera.zoom,
//       },
//       controls: {
//         target: {
//           x: controls.target.x,
//           y: controls.target.y,
//           z: controls.target.z,
//         },
//       },
//       model: rotationGroup
//         ? {
//             rotation: {
//               x: rotationGroup.rotation.x,
//               y: rotationGroup.rotation.y,
//               z: rotationGroup.rotation.z,
//             },
//             position: {
//               x: rotationGroup.position.x,
//               y: rotationGroup.position.y,
//               z: rotationGroup.position.z,
//             },
//           }
//         : null,
//     };

//     // Also capture handle positions if they exist
//     if (movementHandle && rotationHandle) {
//       currentPositionState.handles = {
//         currentRotation: currentRotation,
//         movementHandle: {
//           position: {
//             x: movementHandle.position.x,
//             y: movementHandle.position.y,
//             z: movementHandle.position.z,
//           },
//           visible: movementHandle.visible,
//         },
//         rotationHandle: {
//           position: {
//             x: rotationHandle.position.x,
//             y: rotationHandle.position.y,
//             z: rotationHandle.position.z,
//           },
//           visible: rotationHandle.visible,
//         },
//       };
//     }
//   }

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

//       // Track if we successfully added any valid objects
//       let addedValidObject = false;

//       let counter = 0;

//       // Set model color from saved state if available
//       if (viewState && viewState.rendering && viewState.rendering.modelColor) {
//         threeColor = new THREE.Color(viewState.rendering.modelColor);
//       }

//       // Process all paths from the SVG
//       data.paths.forEach((path, pathIndex) => {
//         try {
//           counter++;

//           // Get style from path userData
//           const pathStyle = path.userData?.style || {};
//           const fillColor = pathStyle.fill;
//           const fillOpacity = pathStyle.fillOpacity;
//           const strokeColor = pathStyle.stroke;
//           const strokeOpacity = pathStyle.strokeOpacity;
//           const strokeWidth = parseFloat(pathStyle.strokeWidth) || 1;

//           // Skip paths with neither fill nor stroke
//           if (
//             (fillColor === "none" || !fillColor) &&
//             (strokeColor === "none" || !strokeColor)
//           ) {
//             return;
//           }

//           // Process fill for paths that have fill
//           if (fillColor && fillColor !== "none") {
//             // Create fill material
//             let fillMaterial;
//             try {
//               // Use saved color if available, otherwise use the path's color
//               const color =
//                 viewState && viewState.rendering
//                   ? threeColor
//                   : new THREE.Color(fillColor);

//               if (!viewState || !viewState.rendering) {
//                 threeColor = color; // Only update threeColor if not from saved state
//               }

//               fillMaterial = new THREE.MeshStandardMaterial({
//                 color: color,
//                 side: THREE.DoubleSide,
//                 flatShading: false,
//                 transparent: fillOpacity !== undefined && fillOpacity < 1,
//                 opacity:
//                   fillOpacity !== undefined ? parseFloat(fillOpacity) : 1,
//                 metalness: window.customMetalness || 0.8,
//                 roughness: window.customRoughness || 0.2,
//               });
//             } catch (e) {
//               console.warn(
//                 `Couldn't parse fill color ${fillColor}, using default`
//               );
//               fillMaterial = new THREE.MeshStandardMaterial({
//                 color: 0x00ff00,
//                 side: THREE.DoubleSide,
//                 flatShading: false,
//                 metalness: window.customMetalness || 0.8,
//                 roughness: window.customRoughness || 0.2,
//               });
//             }

//             // Convert path to shapes without detecting holes
//             const shapes = path.toShapes(false);

//             if (shapes && shapes.length > 0) {
//               // Process each shape for fill
//               shapes.forEach((shape, shapeIndex) => {
//                 try {
//                   if (!shape || !shape.curves || shape.curves.length === 0) {
//                     return;
//                   }

//                   // Extrusion settings with smoothing options
//                   const extrudeSettings = {
//                     depth: window.customExtrusionDepth || 10,
//                     bevelEnabled:
//                       window.customBevelEnabled !== undefined
//                         ? window.customBevelEnabled
//                         : true,
//                     bevelThickness: 0.3,
//                     bevelSize: 0.3,
//                     bevelOffset: 0,
//                     bevelSegments: 5,
//                     curveSegments:
//                       window.customCurveSegments !== undefined
//                         ? window.customCurveSegments
//                         : 24,
//                   };

//                   // Create geometry with extrusion
//                   const geometry = new THREE.ExtrudeGeometry(
//                     shape,
//                     extrudeSettings
//                   );

//                   // Compute vertex normals for smooth shading
//                   geometry.computeVertexNormals();

//                   // Check for invalid geometry
//                   if (hasNaN(geometry)) {
//                     console.warn(
//                       `Invalid geometry in path ${pathIndex}, shape ${shapeIndex}`
//                     );
//                     return;
//                   }

//                   // Create mesh
//                   const mesh = new THREE.Mesh(geometry, fillMaterial.clone());

//                   mesh.receiveShadow = true;
//                   mesh.castShadow = true;

//                   // Flip Y axis to match SVG coordinate system
//                   mesh.scale.y = -1;

//                   // Add to SVG group
//                   svgGroup.add(mesh);
//                   addedValidObject = true;

//                   console.log(
//                     `Added filled shape ${shapeIndex} from path ${pathIndex}`
//                   );
//                 } catch (error) {
//                   console.warn(
//                     `Error creating filled shape ${shapeIndex} from path ${pathIndex}:`,
//                     error
//                   );
//                 }
//               });
//             }
//           }

//           // Process stroke for paths that have stroke
//           if (strokeColor && strokeColor !== "none") {
//             try {
//               // Create stroke material
//               let strokeMaterial;
//               try {
//                 // Use saved color if available, otherwise use the original stroke color
//                 const color =
//                   viewState && viewState.rendering
//                     ? threeColor
//                     : new THREE.Color(strokeColor);

//                 strokeMaterial = new THREE.MeshStandardMaterial({
//                   color: color,
//                   side: THREE.DoubleSide,
//                   flatShading: false,
//                   transparent: strokeOpacity !== undefined && strokeOpacity < 1,
//                   opacity:
//                     strokeOpacity !== undefined ? parseFloat(strokeOpacity) : 1,
//                   metalness: window.customMetalness || 0.8,
//                   roughness: window.customRoughness || 0.2,
//                 });
//               } catch (e) {
//                 console.warn(
//                   `Couldn't parse stroke color ${strokeColor}, using default`
//                 );
//                 strokeMaterial = new THREE.MeshStandardMaterial({
//                   color: 0x444444,
//                   side: THREE.DoubleSide,
//                   flatShading: false,
//                   metalness: window.customMetalness || 0.8,
//                   roughness: window.customRoughness || 0.2,
//                 });
//               }

//               // Get points from path subpaths
//               path.subPaths.forEach((subPath, subPathIndex) => {
//                 const points = subPath.getPoints();

//                 if (points.length < 2) {
//                   return; // Need at least 2 points for a line
//                 }

//                 console.log(
//                   `Processing stroke for subpath ${subPathIndex} with ${points.length} points`
//                 );

//                 // Check if points are valid
//                 if (!hasValidPoints(points)) {
//                   console.warn(`Invalid points in subpath ${subPathIndex}`);
//                   return;
//                 }

//                 // Create thick line shapes from points
//                 const lineShapes = createThickLineFromPoints(
//                   points,
//                   strokeWidth || 1
//                 );

//                 if (!lineShapes || lineShapes.length === 0) {
//                   console.warn(
//                     `Failed to create line shapes for subpath ${subPathIndex}`
//                   );
//                   return;
//                 }

//                 // Process line shapes for strokes
//                 lineShapes.forEach((lineShape, lineShapeIndex) => {
//                   try {
//                     // Extrusion settings for stroke with smoothing options
//                     const extrudeSettings = {
//                       depth: window.customExtrusionDepth || 10,
//                       bevelEnabled:
//                         window.customBevelEnabled !== undefined
//                           ? window.customBevelEnabled
//                           : true,
//                       bevelThickness: 0.3,
//                       bevelSize: 0.3,
//                       bevelOffset: 0,
//                       bevelSegments: 5,
//                       curveSegments:
//                         window.customCurveSegments !== undefined
//                           ? window.customCurveSegments
//                           : 24,
//                     };

//                     // Create geometry with extrusion
//                     const geometry = new THREE.ExtrudeGeometry(
//                       lineShape,
//                       extrudeSettings
//                     );

//                     // Compute vertex normals for smooth shading
//                     geometry.computeVertexNormals();

//                     // Check for invalid geometry
//                     if (hasNaN(geometry)) {
//                       console.warn(
//                         `Invalid geometry in stroke ${subPathIndex}, shape ${lineShapeIndex}`
//                       );
//                       return;
//                     }

//                     // Create mesh
//                     const mesh = new THREE.Mesh(
//                       geometry,
//                       strokeMaterial.clone()
//                     );

//                     // Flip Y axis to match SVG coordinate system
//                     mesh.scale.y = -1;

//                     // Add to SVG group
//                     svgGroup.add(mesh);
//                     addedValidObject = true;

//                     console.log(
//                       `Added stroke shape from subpath ${subPathIndex}`
//                     );
//                   } catch (error) {
//                     console.warn(
//                       `Error creating stroke shape from subpath ${subPathIndex}:`,
//                       error
//                     );
//                   }
//                 });
//               });
//             } catch (error) {
//               console.warn(
//                 `Error processing stroke for path ${pathIndex}:`,
//                 error
//               );
//             }
//           }
//         } catch (error) {
//           console.warn(`Error processing path ${pathIndex}:`, error);
//         }
//       });

//       console.log("Processed paths:", counter);

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
//         } catch (error) {
//           console.error("Error processing SVG group:", error);
//         }

//         // Now that SVG is processed, setup the handles
//         setupHandles();

//         // Determine whether to use stored position or saved state
//         if (window.preserveCurrentPosition && currentPositionState) {
//           console.log("Preserving current position state");

//           // Apply camera position
//           if (currentPositionState.camera) {
//             if (currentPositionState.camera.position) {
//               camera.position.set(
//                 currentPositionState.camera.position.x,
//                 currentPositionState.camera.position.y,
//                 currentPositionState.camera.position.z
//               );
//             }

//             if (currentPositionState.camera.rotation) {
//               if (currentPositionState.camera.rotation.order) {
//                 camera.rotation.order =
//                   currentPositionState.camera.rotation.order;
//               }

//               camera.rotation.set(
//                 currentPositionState.camera.rotation.x,
//                 currentPositionState.camera.rotation.y,
//                 currentPositionState.camera.rotation.z
//               );
//             }

//             if (currentPositionState.camera.zoom !== undefined) {
//               camera.zoom = currentPositionState.camera.zoom;
//             }

//             camera.updateProjectionMatrix();
//           }

//           // Apply controls
//           if (currentPositionState.controls && controls) {
//             if (currentPositionState.controls.target) {
//               controls.target.set(
//                 currentPositionState.controls.target.x,
//                 currentPositionState.controls.target.y,
//                 currentPositionState.controls.target.z
//               );
//             }

//             controls.update();
//           }

//           // Apply model position/rotation
//           if (currentPositionState.model && rotationGroup) {
//             if (currentPositionState.model.rotation) {
//               rotationGroup.rotation.set(
//                 currentPositionState.model.rotation.x,
//                 currentPositionState.model.rotation.y,
//                 currentPositionState.model.rotation.z
//               );
//             }

//             if (currentPositionState.model.position) {
//               rotationGroup.position.set(
//                 currentPositionState.model.position.x,
//                 currentPositionState.model.position.y,
//                 currentPositionState.model.position.z
//               );
//             }
//           }

//           // Apply handle state
//           if (currentPositionState.handles) {
//             if (currentPositionState.handles.currentRotation !== undefined) {
//               currentRotation = currentPositionState.handles.currentRotation;
//             }

//             if (currentPositionState.handles.movementHandle && movementHandle) {
//               if (currentPositionState.handles.movementHandle.position) {
//                 movementHandle.position.set(
//                   currentPositionState.handles.movementHandle.position.x,
//                   currentPositionState.handles.movementHandle.position.y,
//                   currentPositionState.handles.movementHandle.position.z
//                 );
//               }

//               if (
//                 currentPositionState.handles.movementHandle.visible !==
//                 undefined
//               ) {
//                 movementHandle.visible =
//                   currentPositionState.handles.movementHandle.visible;
//               }
//             }

//             if (currentPositionState.handles.rotationHandle && rotationHandle) {
//               if (currentPositionState.handles.rotationHandle.position) {
//                 rotationHandle.position.set(
//                   currentPositionState.handles.rotationHandle.position.x,
//                   currentPositionState.handles.rotationHandle.position.y,
//                   currentPositionState.handles.rotationHandle.position.z
//                 );
//               }

//               if (
//                 currentPositionState.handles.rotationHandle.visible !==
//                 undefined
//               ) {
//                 rotationHandle.visible =
//                   currentPositionState.handles.rotationHandle.visible;
//               }
//             }
//           }
//         }
//         // Apply saved state if not preserving current position
//         else if (viewState) {
//           console.log("Applying saved state position/rotation");

//           // Apply camera and controls
//           if (viewState.camera) {
//             if (viewState.camera.position) {
//               camera.position.set(
//                 viewState.camera.position.x,
//                 viewState.camera.position.y,
//                 viewState.camera.position.z
//               );
//             }

//             if (viewState.camera.rotation) {
//               if (viewState.camera.rotation.order) {
//                 camera.rotation.order = viewState.camera.rotation.order;
//               }

//               camera.rotation.set(
//                 viewState.camera.rotation.x,
//                 viewState.camera.rotation.y,
//                 viewState.camera.rotation.z
//               );
//             }

//             if (viewState.camera.zoom !== undefined) {
//               camera.zoom = viewState.camera.zoom;
//             }

//             // Apply orthographic camera properties
//             if (camera.isOrthographicCamera) {
//               if (viewState.camera.left !== undefined)
//                 camera.left = viewState.camera.left;
//               if (viewState.camera.right !== undefined)
//                 camera.right = viewState.camera.right;
//               if (viewState.camera.top !== undefined)
//                 camera.top = viewState.camera.top;
//               if (viewState.camera.bottom !== undefined)
//                 camera.bottom = viewState.camera.bottom;
//               if (viewState.camera.near !== undefined)
//                 camera.near = viewState.camera.near;
//               if (viewState.camera.far !== undefined)
//                 camera.far = viewState.camera.far;
//             }

//             camera.updateProjectionMatrix();
//           }

//           // Apply controls state
//           if (viewState.controls && controls) {
//             if (viewState.controls.target) {
//               controls.target.set(
//                 viewState.controls.target.x,
//                 viewState.controls.target.y,
//                 viewState.controls.target.z
//               );
//             }

//             controls.update();
//           }

//           // Apply model transformations
//           if (viewState.model) {
//             if (viewState.model.rotation) {
//               rotationGroup.rotation.set(
//                 viewState.model.rotation.x,
//                 viewState.model.rotation.y,
//                 viewState.model.rotation.z
//               );
//             }

//             if (viewState.model.position) {
//               rotationGroup.position.set(
//                 viewState.model.position.x,
//                 viewState.model.position.y,
//                 viewState.model.position.z
//               );
//             }
//           }

//           // Apply handle state
//           if (viewState.handles) {
//             applyHandlesState(viewState.handles);
//           }
//         }

//         // Reset the preserve flag after use
//         window.preserveCurrentPosition = false;

//         console.log("SVG processing complete and state restored");
//       } else {
//         console.error("No valid objects found in SVG");
//       }

//       // Create UI Controls and update to match saved state
//       createUIControls(svgGroup);
//       if (viewState && viewState.rendering) {
//         updateUIFromSettings(viewState.rendering);
//       }

//       // Update lighting UI if needed
//       if (viewState && viewState.lighting) {
//         updateLightingControlsUI(viewState.lighting);
//       }
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
  // Prevent multiple simultaneous loads
  if (isLoadingSVG) {
    console.log("Already loading SVG, ignoring duplicate call");
    return;
  }

  isLoadingSVG = true;

  // Get the saved state before loading if it exists
  const savedState = localStorage.getItem("svgViewState");
  let viewState = null;

  if (savedState) {
    try {
      viewState = JSON.parse(savedState);
      console.log(
        "Loaded saved state for restoring during SVG load:",
        viewState
      );

      // Apply rendering settings right away
      if (viewState.rendering) {
        // Model color will be applied after SVG loads

        // Background color
        if (viewState.rendering.backgroundColor !== null) {
          scene.background = new THREE.Color(
            viewState.rendering.backgroundColor
          );
        }

        // Save extrusion settings to window
        window.customExtrusionDepth =
          window.customExtrusionDepth ?? viewState.rendering.extrusionDepth;
        window.customBevelEnabled =
          window.customBevelEnabled ?? viewState.rendering.bevelEnabled;
        window.customCurveSegments =
          window.customCurveSegments ?? viewState.rendering.curveSegments;
        window.customMetalness =
          window.customMetalness ?? viewState.rendering.metalness;
        window.customRoughness =
          window.customRoughness ?? viewState.rendering.roughness;
      }

      // Apply lighting settings
      if (viewState.lighting && window.lights) {
        Object.keys(viewState.lighting).forEach((lightType) => {
          const savedLight = viewState.lighting[lightType];
          const light = window.lights[lightType];

          if (light && savedLight) {
            if (savedLight.visible !== undefined)
              light.visible = savedLight.visible;
            if (savedLight.intensity !== undefined)
              light.intensity = savedLight.intensity;
            if (savedLight.color !== undefined)
              light.color.setHex(savedLight.color);

            if (savedLight.position && light.position) {
              light.position.set(
                savedLight.position.x,
                savedLight.position.y,
                savedLight.position.z
              );
            }

            // Apply type-specific properties
            if (lightType === "spot") {
              if (savedLight.angle !== undefined)
                light.angle = savedLight.angle;
              if (savedLight.distance !== undefined)
                light.distance = savedLight.distance;
              if (savedLight.decay !== undefined)
                light.decay = savedLight.decay;
              if (savedLight.target && light.target) {
                light.target.position.set(
                  savedLight.target.x,
                  savedLight.target.y,
                  savedLight.target.z
                );
              }
            } else if (lightType === "point") {
              if (savedLight.distance !== undefined)
                light.distance = savedLight.distance;
              if (savedLight.decay !== undefined)
                light.decay = savedLight.decay;
            } else if (lightType === "hemisphere" && savedLight.groundColor) {
              light.groundColor.setHex(savedLight.groundColor);
            } else if (lightType === "rectArea") {
              if (savedLight.width !== undefined)
                light.width = savedLight.width;
              if (savedLight.height !== undefined)
                light.height = savedLight.height;
              // Update lookAt after position/dimension changes
              light.lookAt(0, 0, 0);
            }
          }
        });

        // Update light helpers
        updateLightHelpers();
      }
    } catch (error) {
      console.error("Error parsing saved state:", error);
      viewState = null;
    }
  }

  // Store current position/transformation state before reloading
  let currentPositionState = null;

  // Use the snapshot if we have it, otherwise try to capture current state
  if (window.preserveCurrentPosition) {
    if (window.currentPositionSnapshot) {
      currentPositionState = window.currentPositionSnapshot;
      console.log("Using position state snapshot");
      // Clear the snapshot after using it
      window.currentPositionSnapshot = null;
    } else if (camera && controls && rotationGroup) {
      console.log("Capturing current position state");
      currentPositionState = captureCurrentViewState();
    }
  }

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

      // Track if we successfully added any valid objects
      let addedValidObject = false;

      let counter = 0;

      // Set model color from saved state if available
      if (viewState && viewState.rendering && viewState.rendering.modelColor) {
        threeColor = new THREE.Color(viewState.rendering.modelColor);
      }

      // Process all paths from the SVG
      data.paths.forEach((path, pathIndex) => {
        try {
          counter++;

          // Get style from path userData
          const pathStyle = path.userData?.style || {};
          const fillColor = pathStyle.fill;
          const fillOpacity = pathStyle.fillOpacity;
          const strokeColor = pathStyle.stroke;
          const strokeOpacity = pathStyle.strokeOpacity;
          const strokeWidth = parseFloat(pathStyle.strokeWidth) || 1;

          // Skip paths with neither fill nor stroke
          if (
            (fillColor === "none" || !fillColor) &&
            (strokeColor === "none" || !strokeColor)
          ) {
            return;
          }

          // Process fill for paths that have fill
          if (fillColor && fillColor !== "none") {
            // Create fill material
            let fillMaterial;
            try {
              // Use saved color if available, otherwise use the path's color
              const color =
                viewState && viewState.rendering
                  ? threeColor
                  : new THREE.Color(fillColor);

              if (!viewState || !viewState.rendering) {
                threeColor = color; // Only update threeColor if not from saved state
              }

              fillMaterial = new THREE.MeshStandardMaterial({
                color: color,
                side: THREE.DoubleSide,
                flatShading: false,
                transparent: fillOpacity !== undefined && fillOpacity < 1,
                opacity:
                  fillOpacity !== undefined ? parseFloat(fillOpacity) : 1,
                metalness: window.customMetalness || 0.8,
                roughness: window.customRoughness || 0.2,
              });
            } catch (e) {
              console.warn(
                `Couldn't parse fill color ${fillColor}, using default`
              );
              fillMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                side: THREE.DoubleSide,
                flatShading: false,
                metalness: window.customMetalness || 0.8,
                roughness: window.customRoughness || 0.2,
              });
            }

            // Convert path to shapes without detecting holes
            const shapes = path.toShapes(false);

            if (shapes && shapes.length > 0) {
              // Process each shape for fill
              shapes.forEach((shape, shapeIndex) => {
                try {
                  if (!shape || !shape.curves || shape.curves.length === 0) {
                    return;
                  }

                  // Extrusion settings with smoothing options
                  const extrudeSettings = {
                    depth: window.customExtrusionDepth || 10,
                    bevelEnabled:
                      window.customBevelEnabled !== undefined
                        ? window.customBevelEnabled
                        : true,
                    bevelThickness: 0.3,
                    bevelSize: 0.3,
                    bevelOffset: 0,
                    bevelSegments: 5,
                    curveSegments:
                      window.customCurveSegments !== undefined
                        ? window.customCurveSegments
                        : 24,
                  };

                  // Create geometry with extrusion
                  const geometry = new THREE.ExtrudeGeometry(
                    shape,
                    extrudeSettings
                  );

                  // Compute vertex normals for smooth shading
                  geometry.computeVertexNormals();

                  // Check for invalid geometry
                  if (hasNaN(geometry)) {
                    console.warn(
                      `Invalid geometry in path ${pathIndex}, shape ${shapeIndex}`
                    );
                    return;
                  }

                  // Create mesh
                  const mesh = new THREE.Mesh(geometry, fillMaterial.clone());

                  mesh.receiveShadow = true;
                  mesh.castShadow = true;

                  // Flip Y axis to match SVG coordinate system
                  mesh.scale.y = -1;

                  // Add to SVG group
                  svgGroup.add(mesh);
                  addedValidObject = true;

                  console.log(
                    `Added filled shape ${shapeIndex} from path ${pathIndex}`
                  );
                } catch (error) {
                  console.warn(
                    `Error creating filled shape ${shapeIndex} from path ${pathIndex}:`,
                    error
                  );
                }
              });
            }
          }

          // Process stroke for paths that have stroke
          if (strokeColor && strokeColor !== "none") {
            try {
              // Create stroke material
              let strokeMaterial;
              try {
                // Use saved color if available, otherwise use the original stroke color
                const color =
                  viewState && viewState.rendering
                    ? threeColor
                    : new THREE.Color(strokeColor);

                strokeMaterial = new THREE.MeshStandardMaterial({
                  color: color,
                  side: THREE.DoubleSide,
                  flatShading: false,
                  transparent: strokeOpacity !== undefined && strokeOpacity < 1,
                  opacity:
                    strokeOpacity !== undefined ? parseFloat(strokeOpacity) : 1,
                  metalness: window.customMetalness || 0.8,
                  roughness: window.customRoughness || 0.2,
                });
              } catch (e) {
                console.warn(
                  `Couldn't parse stroke color ${strokeColor}, using default`
                );
                strokeMaterial = new THREE.MeshStandardMaterial({
                  color: 0x444444,
                  side: THREE.DoubleSide,
                  flatShading: false,
                  metalness: window.customMetalness || 0.8,
                  roughness: window.customRoughness || 0.2,
                });
              }

              // Get points from path subpaths
              path.subPaths.forEach((subPath, subPathIndex) => {
                const points = subPath.getPoints();

                if (points.length < 2) {
                  return; // Need at least 2 points for a line
                }

                console.log(
                  `Processing stroke for subpath ${subPathIndex} with ${points.length} points`
                );

                // Check if points are valid
                if (!hasValidPoints(points)) {
                  console.warn(`Invalid points in subpath ${subPathIndex}`);
                  return;
                }

                // Create thick line shapes from points
                const lineShapes = createThickLineFromPoints(
                  points,
                  strokeWidth || 1
                );

                if (!lineShapes || lineShapes.length === 0) {
                  console.warn(
                    `Failed to create line shapes for subpath ${subPathIndex}`
                  );
                  return;
                }

                // Process line shapes for strokes
                lineShapes.forEach((lineShape, lineShapeIndex) => {
                  try {
                    // Extrusion settings for stroke with smoothing options
                    const extrudeSettings = {
                      depth: window.customExtrusionDepth || 10,
                      bevelEnabled:
                        window.customBevelEnabled !== undefined
                          ? window.customBevelEnabled
                          : true,
                      bevelThickness: 0.3,
                      bevelSize: 0.3,
                      bevelOffset: 0,
                      bevelSegments: 5,
                      curveSegments:
                        window.customCurveSegments !== undefined
                          ? window.customCurveSegments
                          : 24,
                    };

                    // Create geometry with extrusion
                    const geometry = new THREE.ExtrudeGeometry(
                      lineShape,
                      extrudeSettings
                    );

                    // Compute vertex normals for smooth shading
                    geometry.computeVertexNormals();

                    // Check for invalid geometry
                    if (hasNaN(geometry)) {
                      console.warn(
                        `Invalid geometry in stroke ${subPathIndex}, shape ${lineShapeIndex}`
                      );
                      return;
                    }

                    // Create mesh
                    const mesh = new THREE.Mesh(
                      geometry,
                      strokeMaterial.clone()
                    );

                    // Flip Y axis to match SVG coordinate system
                    mesh.scale.y = -1;

                    // Add to SVG group
                    svgGroup.add(mesh);
                    addedValidObject = true;

                    console.log(
                      `Added stroke shape from subpath ${subPathIndex}`
                    );
                  } catch (error) {
                    console.warn(
                      `Error creating stroke shape from subpath ${subPathIndex}:`,
                      error
                    );
                  }
                });
              });
            } catch (error) {
              console.warn(
                `Error processing stroke for path ${pathIndex}:`,
                error
              );
            }
          }
        } catch (error) {
          console.warn(`Error processing path ${pathIndex}:`, error);
        }
      });

      console.log("Processed paths:", counter);

      // If we successfully added objects, add SVG group to rotation group
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

            // Calculate scale to make it fit nicely in the viewport
            const viewportWidth = camera.right - camera.left;
            const viewportHeight = camera.top - camera.bottom;

            // Calculate the smallest dimension (width or height)
            const smallestViewportDim = Math.min(viewportWidth, viewportHeight);

            // Calculate target size (one-third of the smallest viewport dimension)
            const targetSize = smallestViewportDim / 3;

            // Calculate SVG original size
            const boxSize = box.getSize(new THREE.Vector3());
            const maxSvgDim = Math.max(boxSize.x, boxSize.y, boxSize.z);

            if (maxSvgDim > 0 && !isNaN(maxSvgDim)) {
              // Calculate scale to make SVG fit properly
              const scale = targetSize / maxSvgDim;
              svgGroup.scale.set(scale, scale, scale);
            }
          }
        } catch (error) {
          console.error("Error processing SVG group:", error);
        }

        // Now that SVG is processed, setup the handles
        setupHandles();

        // Determine whether to use stored position or saved state
        if (window.preserveCurrentPosition && currentPositionState) {
          console.log("Preserving current position state");

          // Apply camera position
          if (currentPositionState.camera) {
            if (currentPositionState.camera.position) {
              camera.position.set(
                currentPositionState.camera.position.x,
                currentPositionState.camera.position.y,
                currentPositionState.camera.position.z
              );
            }

            if (currentPositionState.camera.rotation) {
              if (currentPositionState.camera.rotation.order) {
                camera.rotation.order =
                  currentPositionState.camera.rotation.order;
              }

              camera.rotation.set(
                currentPositionState.camera.rotation.x,
                currentPositionState.camera.rotation.y,
                currentPositionState.camera.rotation.z
              );
            }

            if (currentPositionState.camera.zoom !== undefined) {
              camera.zoom = currentPositionState.camera.zoom;
            }

            camera.updateProjectionMatrix();
          }

          // Apply controls
          if (currentPositionState.controls && controls) {
            if (currentPositionState.controls.target) {
              controls.target.set(
                currentPositionState.controls.target.x,
                currentPositionState.controls.target.y,
                currentPositionState.controls.target.z
              );
            }

            controls.update();
          }

          // Apply model position/rotation
          if (currentPositionState.model && rotationGroup) {
            if (currentPositionState.model.rotation) {
              rotationGroup.rotation.set(
                currentPositionState.model.rotation.x,
                currentPositionState.model.rotation.y,
                currentPositionState.model.rotation.z
              );
            }

            if (currentPositionState.model.position) {
              rotationGroup.position.set(
                currentPositionState.model.position.x,
                currentPositionState.model.position.y,
                currentPositionState.model.position.z
              );
            }
          }

          // Apply handle state
          if (currentPositionState.handles) {
            if (currentPositionState.handles.currentRotation !== undefined) {
              currentRotation = currentPositionState.handles.currentRotation;
            }

            if (currentPositionState.handles.movementHandle && movementHandle) {
              if (currentPositionState.handles.movementHandle.position) {
                movementHandle.position.set(
                  currentPositionState.handles.movementHandle.position.x,
                  currentPositionState.handles.movementHandle.position.y,
                  currentPositionState.handles.movementHandle.position.z
                );
              }

              if (
                currentPositionState.handles.movementHandle.visible !==
                undefined
              ) {
                movementHandle.visible =
                  currentPositionState.handles.movementHandle.visible;
              }
            }

            if (currentPositionState.handles.rotationHandle && rotationHandle) {
              if (currentPositionState.handles.rotationHandle.position) {
                rotationHandle.position.set(
                  currentPositionState.handles.rotationHandle.position.x,
                  currentPositionState.handles.rotationHandle.position.y,
                  currentPositionState.handles.rotationHandle.position.z
                );
              }

              if (
                currentPositionState.handles.rotationHandle.visible !==
                undefined
              ) {
                rotationHandle.visible =
                  currentPositionState.handles.rotationHandle.visible;
              }
            }
          }
        }
        // Apply saved state if not preserving current position
        else if (viewState) {
          console.log("Applying saved state position/rotation");

          // Apply camera and controls
          if (viewState.camera) {
            if (viewState.camera.position) {
              camera.position.set(
                viewState.camera.position.x,
                viewState.camera.position.y,
                viewState.camera.position.z
              );
            }

            if (viewState.camera.rotation) {
              if (viewState.camera.rotation.order) {
                camera.rotation.order = viewState.camera.rotation.order;
              }

              camera.rotation.set(
                viewState.camera.rotation.x,
                viewState.camera.rotation.y,
                viewState.camera.rotation.z
              );
            }

            if (viewState.camera.zoom !== undefined) {
              camera.zoom = viewState.camera.zoom;
            }

            // Apply orthographic camera properties
            if (camera.isOrthographicCamera) {
              if (viewState.camera.left !== undefined)
                camera.left = viewState.camera.left;
              if (viewState.camera.right !== undefined)
                camera.right = viewState.camera.right;
              if (viewState.camera.top !== undefined)
                camera.top = viewState.camera.top;
              if (viewState.camera.bottom !== undefined)
                camera.bottom = viewState.camera.bottom;
              if (viewState.camera.near !== undefined)
                camera.near = viewState.camera.near;
              if (viewState.camera.far !== undefined)
                camera.far = viewState.camera.far;
            }

            camera.updateProjectionMatrix();
          }

          // Apply controls state
          if (viewState.controls && controls) {
            if (viewState.controls.target) {
              controls.target.set(
                viewState.controls.target.x,
                viewState.controls.target.y,
                viewState.controls.target.z
              );
            }

            controls.update();
          }

          // Apply model transformations
          if (viewState.model) {
            if (viewState.model.rotation) {
              rotationGroup.rotation.set(
                viewState.model.rotation.x,
                viewState.model.rotation.y,
                viewState.model.rotation.z
              );
            }

            if (viewState.model.position) {
              rotationGroup.position.set(
                viewState.model.position.x,
                viewState.model.position.y,
                viewState.model.position.z
              );
            }
          }

          // Apply handle state
          if (viewState.handles) {
            applyHandlesState(viewState.handles);
          }
        }

        // Reset the preserve flag after use
        window.preserveCurrentPosition = false;

        console.log("SVG processing complete and state restored");
      } else {
        console.error("No valid objects found in SVG");
      }

      // Create UI Controls and update to match saved state
      createUIControls(svgGroup);
      if (viewState && viewState.rendering) {
        updateUIFromSettings(viewState.rendering);
      }

      // Update lighting UI if needed
      if (viewState && viewState.lighting) {
        updateLightingControlsUI(viewState.lighting);
      }

      // Release the loading lock
      isLoadingSVG = false;
    },
    // Progress callback
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // Error callback
    function (error) {
      console.error("Error loading SVG:", error);
      // Release the loading lock on error
      isLoadingSVG = false;
    }
  );
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

  // Extrusion depth control
  document.getElementById("extrusion-depth").addEventListener("input", (e) => {
    document.getElementById("depth-value").textContent = e.target.value;
  });

  // document.getElementById("apply-depth").addEventListener("click", () => {
  //   const depth = parseInt(document.getElementById("extrusion-depth").value);
  //   window.customExtrusionDepth = depth;

  //   if (window.lastLoadedSvgUrl) {
  //     loadSVG(window.lastLoadedSvgUrl);
  //   } else {
  //     alert("No SVG has been loaded yet.");
  //   }
  // });

  document.getElementById("apply-depth").addEventListener("click", () => {
    const depth = parseInt(document.getElementById("extrusion-depth").value);
    window.customExtrusionDepth = depth;
    window.preserveCurrentPosition = true;

    // Update the saved state with the new depth value
    updateSavedState((state) => {
      if (!state.rendering) state.rendering = {};
      state.rendering.extrusionDepth = depth;
      return state;
    });

    if (window.lastLoadedSvgUrl) {
      loadSVG(window.lastLoadedSvgUrl);
    } else {
      alert("No SVG has been loaded yet.");
    }
  });

  // Background color buttons
  document.querySelectorAll(".bg-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const color = parseInt(button.dataset.color);
      scene.background = new THREE.Color(color);
    });
  });

  // Handle visibility toggle
  document.getElementById("toggle-handles").addEventListener("click", () => {
    if (movementHandle && rotationHandle) {
      const currentVisibility = movementHandle.visible;
      updateHandlesVisibility(!currentVisibility);
    }
  });

  // Export buttons
  document.getElementById("export-gltf").addEventListener("click", () => {
    exportToGLTF(svgGroup);
  });

  document.getElementById("export-obj").addEventListener("click", () => {
    exportToOBJ(svgGroup);
  });

  document.getElementById("export-stl").addEventListener("click", () => {
    exportToSTL(svgGroup);
  });

  const outputWidthElement = document.getElementById("output-width");
  const outputHeightElement = document.getElementById("output-height");

  outputWidthElement.addEventListener("input", (e) => {
    const value = parseInt(e.target.value);
    console.log("value :>> ", value);
    outputWidth = value;
  });

  outputHeightElement.addEventListener("input", (e) => {
    const value = parseInt(e.target.value);
    console.log("value :>> ", value);
    outputHeight = value;
  });

  // Screenshot button
  document.getElementById("take-screenshot").addEventListener("click", () => {
    // takeScreenshot();
    takeScreenshotDebounced();
  });

  // Reload button
  document.getElementById("reload-svg").addEventListener("click", () => {
    window.preserveCurrentPosition = false;
    if (window.lastLoadedSvgUrl) {
      loadSVG(window.lastLoadedSvgUrl);
    } else {
      alert("No SVG has been loaded yet.");
    }
  });

  document
    .getElementById("save-details")
    .addEventListener("click", saveCurrentState);

  // Add event listeners for material properties
  document.getElementById("metalness-slider").addEventListener("input", (e) => {
    document.getElementById("metalness-value").textContent = e.target.value;
    window.customMetalness = parseFloat(e.target.value);

    // Apply immediately to all materials
    applyMaterialProperties();
  });

  document.getElementById("roughness-slider").addEventListener("input", (e) => {
    document.getElementById("roughness-value").textContent = e.target.value;
    window.customRoughness = parseFloat(e.target.value);

    // Apply immediately to all materials
    applyMaterialProperties();
  });

  document
    .getElementById("apply-material-type")
    .addEventListener("click", () => {
      const materialType = document.getElementById("material-select").value;
      applyMaterialType(materialType, svgGroup);
    });

  document.getElementById("curve-segments").addEventListener("input", (e) => {
    const value = parseInt(e.target.value);
    document.getElementById("curve-segments-value").textContent = value;
  });

  // document.getElementById("apply-smoothing").addEventListener("click", () => {
  //   window.customBevelEnabled =
  //     document.getElementById("edge-bevel-enabled").checked;
  //   window.customCurveSegments = parseInt(
  //     document.getElementById("curve-segments").value
  //   );

  //   if (window.lastLoadedSvgUrl) {
  //     loadSVG(window.lastLoadedSvgUrl);
  //   }
  // });

  document.getElementById("apply-smoothing").addEventListener("click", () => {
    window.customBevelEnabled =
      document.getElementById("edge-bevel-enabled").checked;
    window.customCurveSegments = parseInt(
      document.getElementById("curve-segments").value
    );

    window.preserveCurrentPosition = true;

    // Update the saved state with the new smoothing values
    updateSavedState((state) => {
      if (!state.rendering) state.rendering = {};
      state.rendering.bevelEnabled = window.customBevelEnabled;
      state.rendering.curveSegments = window.customCurveSegments;
      return state;
    });

    if (window.lastLoadedSvgUrl) {
      loadSVG(window.lastLoadedSvgUrl);
    }
  });

  createLightingControls();
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

function applyMaterialType(type, group) {
  if (!group) return;

  let material;

  switch (type) {
    case "metal":
      material = new THREE.MeshStandardMaterial({
        color: threeColor || 0x156289,
        metalness: 0.9,
        roughness: 0.2,
      });
      break;
    case "plastic":
      material = new THREE.MeshStandardMaterial({
        color: threeColor || 0x156289,
        metalness: 0.0,
        roughness: 0.4,
      });
      break;
    case "glass":
      material = new THREE.MeshPhysicalMaterial({
        color: threeColor || 0x156289,
        metalness: 0.0,
        roughness: 0.1,
        transparent: true,
        opacity: 0.6,
        transmission: 0.9,
      });
      break;
    case "wood":
      // You'd need to load the texture first
      material = new THREE.MeshStandardMaterial({
        color: threeColor || 0x156289,
        metalness: 0.0,
        roughness: 0.8,
      });
      break;
    case "chrome":
      material = new THREE.MeshStandardMaterial({
        color: threeColor || 0x156289,
        metalness: 1.0,
        roughness: 0.0,
      });
      break;
    case "matte":
      material = new THREE.MeshStandardMaterial({
        color: threeColor || 0x156289,
        metalness: 0.0,
        roughness: 0.9,
      });
      break;
  }

  // Apply the material to all meshes
  group.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
      child.material.needsUpdate = true;
    }
  });
}

function createLightingControls() {
  // Ambient Light
  document
    .getElementById("ambient-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.ambient.visible = e.target.checked;
    });

  document
    .getElementById("ambient-intensity")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("ambient-value").textContent = value.toFixed(1);
      window.lights.ambient.intensity = value;
    });

  document.querySelectorAll(".ambient-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.ambient.color.copy(threeColor);
    });
  });

  // Directional Light (previously main light)
  document
    .getElementById("directional-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.directional.visible = e.target.checked;
    });

  document
    .getElementById("directional-intensity")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("directional-value").textContent =
        value.toFixed(1);
      window.lights.directional.intensity = value;
    });

  document
    .getElementById("directional-x-pos")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("directional-x-value").textContent =
        value.toFixed(1);
      window.lights.directional.position.x = value;
      if (window.directionalHelper) window.directionalHelper.update();
    });

  document
    .getElementById("directional-y-pos")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("directional-y-value").textContent =
        value.toFixed(1);
      window.lights.directional.position.y = value;
      if (window.directionalHelper) window.directionalHelper.update();
    });

  document
    .getElementById("directional-z-pos")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("directional-z-value").textContent =
        value.toFixed(1);
      window.lights.directional.position.z = value;
      if (window.directionalHelper) window.directionalHelper.update();
    });

  document
    .getElementById("directional-cast-shadow")
    .addEventListener("change", (e) => {
      window.lights.directional.castShadow = e.target.checked;
    });

  document.querySelectorAll(".directional-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.directional.color.copy(threeColor);
      if (window.directionalHelper) window.directionalHelper.update();
    });
  });

  // Point Light
  document
    .getElementById("point-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.point.visible = e.target.checked;
    });

  document.getElementById("point-intensity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-value").textContent = value.toFixed(1);
    window.lights.point.intensity = value;
  });

  document.getElementById("point-x-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-x-value").textContent = value;
    window.lights.point.position.x = value;
    if (window.pointHelper) window.pointHelper.update();
  });

  document.getElementById("point-y-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-y-value").textContent = value;
    window.lights.point.position.y = value;
    if (window.pointHelper) window.pointHelper.update();
  });

  document.getElementById("point-z-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-z-value").textContent = value;
    window.lights.point.position.z = value;
    if (window.pointHelper) window.pointHelper.update();
  });

  document.getElementById("point-distance").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-distance-value").textContent = value;
    window.lights.point.distance = value;
  });

  document.getElementById("point-decay").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-decay-value").textContent = value;
    window.lights.point.decay = value;
  });

  document
    .getElementById("point-cast-shadow")
    .addEventListener("change", (e) => {
      window.lights.point.castShadow = e.target.checked;
    });

  document.querySelectorAll(".point-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.point.color.copy(threeColor);
      if (window.pointHelper) window.pointHelper.update();
    });
  });

  // Spot Light
  document
    .getElementById("spot-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.spot.visible = e.target.checked;
    });

  document.getElementById("spot-intensity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("spot-value").textContent = value.toFixed(1);
    window.lights.spot.intensity = value;
  });

  document.getElementById("spot-x-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("spot-x-value").textContent = value;
    window.lights.spot.position.x = value;
    if (window.spotHelper) window.spotHelper.update();
  });

  document.getElementById("spot-y-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("spot-y-value").textContent = value;
    window.lights.spot.position.y = value;
    if (window.spotHelper) window.spotHelper.update();
  });

  document.getElementById("spot-z-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("spot-z-value").textContent = value;
    window.lights.spot.position.z = value;
    if (window.spotHelper) window.spotHelper.update();
  });

  // Spot Light Target
  document
    .getElementById("spot-target-x-pos")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("spot-target-x-value").textContent = value;
      window.lights.spot.target.position.x = value;
      if (window.spotHelper) window.spotHelper.update();
    });

  document
    .getElementById("spot-target-y-pos")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("spot-target-y-value").textContent = value;
      window.lights.spot.target.position.y = value;
      if (window.spotHelper) window.spotHelper.update();
    });

  document
    .getElementById("spot-target-z-pos")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("spot-target-z-value").textContent = value;
      window.lights.spot.target.position.z = value;
      if (window.spotHelper) window.spotHelper.update();
    });

  document.getElementById("spot-distance").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("spot-distance-value").textContent = value;
    window.lights.spot.distance = value;
  });

  document.getElementById("spot-angle").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("spot-angle-value").textContent = value + "°";
    // Convert degrees to radians
    window.lights.spot.angle = (value * Math.PI) / 180;
    if (window.spotHelper) window.spotHelper.update();
  });

  document
    .getElementById("spot-cast-shadow")
    .addEventListener("change", (e) => {
      window.lights.spot.castShadow = e.target.checked;
    });

  document.querySelectorAll(".spot-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.spot.color.copy(threeColor);
      if (window.spotHelper) window.spotHelper.update();
    });
  });

  // Hemisphere Light
  document
    .getElementById("hemisphere-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.hemisphere.visible = e.target.checked;
    });

  document
    .getElementById("hemisphere-intensity")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("hemisphere-value").textContent =
        value.toFixed(1);
      window.lights.hemisphere.intensity = value;
    });

  document.querySelectorAll(".hemisphere-sky-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.hemisphere.skyColor = threeColor;
      window.lights.hemisphere.color.copy(threeColor);
      if (window.hemisphereHelper) window.hemisphereHelper.update();
    });
  });

  document.querySelectorAll(".hemisphere-ground-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.hemisphere.groundColor.copy(threeColor);
      if (window.hemisphereHelper) window.hemisphereHelper.update();
    });
  });

  // Rect Area Light
  document
    .getElementById("rectArea-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.rectArea.visible = e.target.checked;
    });

  document
    .getElementById("rectArea-intensity")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("rectArea-value").textContent = value.toFixed(1);
      window.lights.rectArea.intensity = value;
    });

  document.getElementById("rectArea-x-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("rectArea-x-value").textContent = value;
    window.lights.rectArea.position.x = value;
    // Need to update lookAt after position change
    window.lights.rectArea.lookAt(0, 0, 0);
    if (window.rectAreaHelper) window.rectAreaHelper.update();
  });

  document.getElementById("rectArea-y-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("rectArea-y-value").textContent = value;
    window.lights.rectArea.position.y = value;
    // Need to update lookAt after position change
    window.lights.rectArea.lookAt(0, 0, 0);
    if (window.rectAreaHelper) window.rectAreaHelper.update();
  });

  document.getElementById("rectArea-z-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("rectArea-z-value").textContent = value;
    window.lights.rectArea.position.z = value;
    // Need to update lookAt after position change
    window.lights.rectArea.lookAt(0, 0, 0);
    if (window.rectAreaHelper) window.rectAreaHelper.update();
  });

  document.getElementById("rectArea-width").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("rectArea-width-value").textContent = value;
    window.lights.rectArea.width = value;
    if (window.rectAreaHelper) window.rectAreaHelper.update();
  });

  document.getElementById("rectArea-height").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("rectArea-height-value").textContent = value;
    window.lights.rectArea.height = value;
    if (window.rectAreaHelper) window.rectAreaHelper.update();
  });

  document.querySelectorAll(".rectArea-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.rectArea.color.copy(threeColor);
      if (window.rectAreaHelper) window.rectAreaHelper.update();
    });
  });

  // Light Helpers toggle
  document
    .getElementById("show-light-helpers")
    .addEventListener("change", (e) => {
      if (window.toggleLightHelpers) {
        window.toggleLightHelpers(e.target.checked);
      }
    });

  // Global shadow toggle
  document.getElementById("global-shadow").addEventListener("change", (e) => {
    if (window.renderer) {
      window.renderer.shadowMap.enabled = e.target.checked;
    }
  });

  // Reset lights button
  document.getElementById("reset-lights").addEventListener("click", () => {
    // Reset ambient light
    if (window.lights.ambient) {
      window.lights.ambient.intensity = 0.2;
      window.lights.ambient.color.set(0xffffff);
      window.lights.ambient.visible = true;
      document.getElementById("ambient-intensity").value = 0.2;
      document.getElementById("ambient-value").textContent = "0.2";
      document.getElementById("ambient-light-enabled").checked = true;
    }

    // Reset directional light
    if (window.lights.directional) {
      window.lights.directional.intensity = 0.8;
      window.lights.directional.color.set(0xffffff);
      window.lights.directional.position.set(1, 1, 1);
      window.lights.directional.castShadow = true;
      window.lights.directional.visible = true;
      document.getElementById("directional-intensity").value = 0.8;
      document.getElementById("directional-value").textContent = "0.8";
      document.getElementById("directional-x-pos").value = 1;
      document.getElementById("directional-x-value").textContent = "1.0";
      document.getElementById("directional-y-pos").value = 1;
      document.getElementById("directional-y-value").textContent = "1.0";
      document.getElementById("directional-z-pos").value = 1;
      document.getElementById("directional-z-value").textContent = "1.0";
      document.getElementById("directional-cast-shadow").checked = true;
      document.getElementById("directional-light-enabled").checked = true;
      if (window.directionalHelper) window.directionalHelper.update();
    }

    // Reset point light
    if (window.lights.point) {
      window.lights.point.intensity = 50;
      window.lights.point.color.set(0xffffff);
      window.lights.point.position.set(0, 0, 70);
      window.lights.point.distance = 200;
      window.lights.point.decay = 1;
      window.lights.point.castShadow = true;
      window.lights.point.visible = true;
      document.getElementById("point-intensity").value = 50;
      document.getElementById("point-value").textContent = "50.0";
      document.getElementById("point-x-pos").value = 0;
      document.getElementById("point-x-value").textContent = "0";
      document.getElementById("point-y-pos").value = 0;
      document.getElementById("point-y-value").textContent = "0";
      document.getElementById("point-z-pos").value = 70;
      document.getElementById("point-z-value").textContent = "70";
      document.getElementById("point-distance").value = 200;
      document.getElementById("point-distance-value").textContent = "200";
      document.getElementById("point-decay").value = 1;
      document.getElementById("point-decay-value").textContent = "1.0";
      document.getElementById("point-cast-shadow").checked = true;
      document.getElementById("point-light-enabled").checked = true;
      if (window.pointHelper) window.pointHelper.update();
    }

    // Reset spot light
    if (window.lights.spot) {
      window.lights.spot.intensity = 60;
      window.lights.spot.color.set(0xffffff);
      window.lights.spot.position.set(100, 100, 100);
      window.lights.spot.target.position.set(0, 0, 0);
      window.lights.spot.distance = 300;
      window.lights.spot.angle = Math.PI / 6;
      window.lights.spot.castShadow = true;
      window.lights.spot.visible = true;
      document.getElementById("spot-intensity").value = 60;
      document.getElementById("spot-value").textContent = "60.0";
      document.getElementById("spot-x-pos").value = 100;
      document.getElementById("spot-x-value").textContent = "100";
      document.getElementById("spot-y-pos").value = 100;
      document.getElementById("spot-y-value").textContent = "100";
      document.getElementById("spot-z-pos").value = 100;
      document.getElementById("spot-z-value").textContent = "100";
      document.getElementById("spot-target-x-pos").value = 0;
      document.getElementById("spot-target-x-value").textContent = "0";
      document.getElementById("spot-target-y-pos").value = 0;
      document.getElementById("spot-target-y-value").textContent = "0";
      document.getElementById("spot-target-z-pos").value = 0;
      document.getElementById("spot-target-z-value").textContent = "0";
      document.getElementById("spot-distance").value = 300;
      document.getElementById("spot-distance-value").textContent = "300";
      document.getElementById("spot-angle").value = 30;
      document.getElementById("spot-angle-value").textContent = "30°";
      document.getElementById("spot-cast-shadow").checked = true;
      document.getElementById("spot-light-enabled").checked = true;
      if (window.spotHelper) window.spotHelper.update();
    }

    // Reset hemisphere light
    if (window.lights.hemisphere) {
      window.lights.hemisphere.intensity = 0.3;
      window.lights.hemisphere.color.set(0x0088ff); // Sky color
      window.lights.hemisphere.groundColor.set(0xff8800); // Ground color
      window.lights.hemisphere.visible = true;
      document.getElementById("hemisphere-intensity").value = 0.3;
      document.getElementById("hemisphere-value").textContent = "0.3";
      document.getElementById("hemisphere-light-enabled").checked = true;
      if (window.hemisphereHelper) window.hemisphereHelper.update();
    }

    // Reset rect area light
    if (window.lights.rectArea) {
      window.lights.rectArea.intensity = 3;
      window.lights.rectArea.color.set(0xffffff);
      window.lights.rectArea.position.set(-100, 0, 100);
      window.lights.rectArea.width = 100;
      window.lights.rectArea.height = 100;
      window.lights.rectArea.lookAt(0, 0, 0);
      window.lights.rectArea.visible = true;
      document.getElementById("rectArea-intensity").value = 3;
      document.getElementById("rectArea-value").textContent = "3.0";
      document.getElementById("rectArea-x-pos").value = -100;
      document.getElementById("rectArea-x-value").textContent = "-100";
      document.getElementById("rectArea-y-pos").value = 0;
      document.getElementById("rectArea-y-value").textContent = "0";
      document.getElementById("rectArea-z-pos").value = 100;
      document.getElementById("rectArea-z-value").textContent = "100";
      document.getElementById("rectArea-width").value = 100;
      document.getElementById("rectArea-width-value").textContent = "100";
      document.getElementById("rectArea-height").value = 100;
      document.getElementById("rectArea-height-value").textContent = "100";
      document.getElementById("rectArea-light-enabled").checked = true;
      if (window.rectAreaHelper) window.rectAreaHelper.update();
    }

    // Reset helpers and global settings
    if (window.toggleLightHelpers) {
      window.toggleLightHelpers(false);
      document.getElementById("show-light-helpers").checked = false;
    }

    if (window.renderer) {
      window.renderer.shadowMap.enabled = true;
      document.getElementById("global-shadow").checked = true;
    }
  });
}

function applyMaterialProperties() {
  if (!svgGroup) return;

  svgGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        // Handle multi-material
        child.material.forEach((mat) => {
          if (mat.type === "MeshStandardMaterial") {
            mat.metalness = window.customMetalness;
            mat.roughness = window.customRoughness;
            mat.receiveShadow = true;
            mat.castShadow = true;
            mat.needsUpdate = true;
          } else if (mat.type === "MeshPhongMaterial") {
            // Create a replacement StandardMaterial with the same properties
            const newMat = new THREE.MeshStandardMaterial({
              color: mat.color ? mat.color.clone() : 0x00ff00,
              side: mat.side || THREE.DoubleSide,
              flatShading: mat.flatShading || true,
              transparent: mat.transparent || false,
              opacity: mat.opacity !== undefined ? mat.opacity : 1,
              metalness: window.customMetalness || 0.5,
              roughness: window.customRoughness || 0.5,

              receiveShadow: true,
              castShadow: true,
            });
            // Replace the material
            const index = child.material.indexOf(mat);
            child.material[index] = newMat;
          }
        });
      } else {
        // Single material
        if (child.material.type === "MeshStandardMaterial") {
          child.material.metalness = window.customMetalness;
          child.material.roughness = window.customRoughness;
          child.material.receiveShadow = true;
          child.material.castShadow = true;
          child.material.needsUpdate = true;
        } else if (child.material.type === "MeshPhongMaterial") {
          // Create a replacement StandardMaterial with the same properties
          const newMaterial = new THREE.MeshStandardMaterial({
            color: child.material.color
              ? child.material.color.clone()
              : 0x00ff00,
            side: child.material.side || THREE.DoubleSide,
            flatShading: child.material.flatShading || true,
            transparent: child.material.transparent || false,
            opacity:
              child.material.opacity !== undefined ? child.material.opacity : 1,
            metalness: window.customMetalness || 0.5,
            roughness: window.customRoughness || 0.5,
            receiveShadow: true,
            castShadow: true,
          });
          // Replace the material
          child.material = newMaterial;
        }
      }
    }
  });
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateLightHelpers();
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  // Ensure the camera's frustum is recalculated properly
  camera.left = -halfCameraWidth;
  camera.right = halfCameraWidth;
  camera.top = halfCameraHeight;
  camera.bottom = -halfCameraHeight;
  camera.updateProjectionMatrix();
});

function restoreViewState() {
  const savedState = localStorage.getItem("svgViewState");
  if (!savedState) {
    console.log("No saved view state found");
    return false;
  }

  try {
    const viewState = JSON.parse(savedState);
    console.log("Restoring view state:", viewState);

    // Restore camera position and rotation
    if (viewState.camera) {
      if (viewState.camera.position) {
        camera.position.set(
          viewState.camera.position.x,
          viewState.camera.position.y,
          viewState.camera.position.z
        );
      }

      if (viewState.camera.rotation) {
        // Set rotation order first if available
        if (viewState.camera.rotation.order) {
          camera.rotation.order = viewState.camera.rotation.order;
        }

        camera.rotation.set(
          viewState.camera.rotation.x,
          viewState.camera.rotation.y,
          viewState.camera.rotation.z
        );
      }

      if (viewState.camera.zoom !== undefined) {
        camera.zoom = viewState.camera.zoom;
      }

      // Restore orthographic camera properties if needed
      if (camera.isOrthographicCamera) {
        if (viewState.camera.left !== undefined)
          camera.left = viewState.camera.left;
        if (viewState.camera.right !== undefined)
          camera.right = viewState.camera.right;
        if (viewState.camera.top !== undefined)
          camera.top = viewState.camera.top;
        if (viewState.camera.bottom !== undefined)
          camera.bottom = viewState.camera.bottom;
        if (viewState.camera.near !== undefined)
          camera.near = viewState.camera.near;
        if (viewState.camera.far !== undefined)
          camera.far = viewState.camera.far;
      }

      camera.updateProjectionMatrix();
    }

    // Restore controls state
    if (viewState.controls && controls) {
      if (viewState.controls.target) {
        controls.target.set(
          viewState.controls.target.x,
          viewState.controls.target.y,
          viewState.controls.target.z
        );
      }

      controls.update();
    }

    // Restore model state if needed
    if (viewState.model && rotationGroup) {
      if (viewState.model.rotation) {
        rotationGroup.rotation.set(
          viewState.model.rotation.x,
          viewState.model.rotation.y,
          viewState.model.rotation.z
        );
      }

      if (viewState.model.position) {
        rotationGroup.position.set(
          viewState.model.position.x,
          viewState.model.position.y,
          viewState.model.position.z
        );
      }
    }

    // Store handle state for applying after handles are created if they don't exist yet
    if (viewState.handles) {
      if (!movementHandle || !rotationHandle) {
        // Save handle state for later application
        pendingHandlesState = viewState.handles;
      } else {
        // Apply handle state immediately if handles exist
        applyHandlesState(viewState.handles);
      }
    }

    // Restore last loaded SVG URL if needed
    if (viewState.lastLoadedSvgUrl && !window.lastLoadedSvgUrl) {
      window.lastLoadedSvgUrl = viewState.lastLoadedSvgUrl;
    }

    console.log("View state restored");
    return true;
  } catch (error) {
    console.error("Error restoring view state:", error);
    return false;
  }
}

// Helper function to apply handle state
// function applyHandlesState(handlesState) {
//   // Apply current rotation value
//   if (handlesState.currentRotation !== undefined) {
//     currentRotation = handlesState.currentRotation;

//     // If rotationGroup exists, ensure rotation is applied
//     if (rotationGroup && rotationGroup.rotation) {
//       rotationGroup.rotation.z = currentRotation;
//     }
//   }

//   // Apply movement handle state
//   if (handlesState.movementHandle && movementHandle) {
//     if (handlesState.movementHandle.position) {
//       movementHandle.position.set(
//         handlesState.movementHandle.position.x,
//         handlesState.movementHandle.position.y,
//         handlesState.movementHandle.position.z
//       );
//     }

//     if (handlesState.movementHandle.visible !== undefined) {
//       movementHandle.visible = handlesState.movementHandle.visible;
//     }
//   }

//   // Apply rotation handle state
//   if (handlesState.rotationHandle && rotationHandle) {
//     if (handlesState.rotationHandle.position) {
//       rotationHandle.position.set(
//         handlesState.rotationHandle.position.x,
//         handlesState.rotationHandle.position.y,
//         handlesState.rotationHandle.position.z
//       );
//     }

//     if (handlesState.rotationHandle.visible !== undefined) {
//       rotationHandle.visible = handlesState.rotationHandle.visible;
//     }
//   }
// }

// function saveCurrentState() {
//   const cameraState = {
//     position: {
//       x: camera.position.x,
//       y: camera.position.y,
//       z: camera.position.z,
//     },
//     rotation: {
//       x: camera.rotation.x,
//       y: camera.rotation.y,
//       z: camera.rotation.z,
//       order: camera.rotation.order,
//     },
//     zoom: camera.zoom,
//     left: camera.left,
//     right: camera.right,
//     top: camera.top,
//     bottom: camera.bottom,
//     near: camera.near,
//     far: camera.far,
//   };

//   const controlsState = {
//     target: {
//       x: controls.target.x,
//       y: controls.target.y,
//       z: controls.target.z,
//     },
//   };

//   // Add model-specific transformations
//   const modelState = {};

//   if (rotationGroup) {
//     modelState.rotation = {
//       x: rotationGroup.rotation.x,
//       y: rotationGroup.rotation.y,
//       z: rotationGroup.rotation.z,
//     };

//     modelState.position = {
//       x: rotationGroup.position.x,
//       y: rotationGroup.position.y,
//       z: rotationGroup.position.z,
//     };
//   }

//   // Save handle positions and current rotation
//   const handlesState = {
//     currentRotation: currentRotation,
//     movementHandle: movementHandle
//       ? {
//           position: {
//             x: movementHandle.position.x,
//             y: movementHandle.position.y,
//             z: movementHandle.position.z,
//           },
//           visible: movementHandle.visible,
//         }
//       : null,

//     rotationHandle: rotationHandle
//       ? {
//           position: {
//             x: rotationHandle.position.x,
//             y: rotationHandle.position.y,
//             z: rotationHandle.position.z,
//           },
//           visible: rotationHandle.visible,
//         }
//       : null,
//   };

//   const viewState = {
//     camera: cameraState,
//     controls: controlsState,
//     model: modelState,
//     handles: handlesState,
//     lastLoadedSvgUrl: window.lastLoadedSvgUrl,
//   };

//   // Save to localStorage
//   localStorage.setItem("svgViewState", JSON.stringify(viewState));
//   console.log("View state saved:", viewState);
// }

function saveCurrentState() {
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

  // Add model-specific transformations
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
  }

  // Save handle positions and current rotation
  const handlesState = {
    currentRotation: currentRotation,
    movementHandle: movementHandle
      ? {
          position: {
            x: movementHandle.position.x,
            y: movementHandle.position.y,
            z: movementHandle.position.z,
          },
          visible: movementHandle.visible,
        }
      : null,

    rotationHandle: rotationHandle
      ? {
          position: {
            x: rotationHandle.position.x,
            y: rotationHandle.position.y,
            z: rotationHandle.position.z,
          },
          visible: rotationHandle.visible,
        }
      : null,
  };

  // Save material and rendering properties
  const renderingState = {
    // Color
    modelColor: threeColor ? threeColor.getHex() : 0x00ff00,

    // Background
    backgroundColor: scene.background ? scene.background.getHex() : null,

    // Extrusion settings
    extrusionDepth: window.customExtrusionDepth || 10,
    bevelEnabled:
      window.customBevelEnabled !== undefined
        ? window.customBevelEnabled
        : true,
    curveSegments: window.customCurveSegments || 24,

    // Material properties
    metalness: window.customMetalness || 0.5,
    roughness: window.customRoughness || 0.5,
  };

  // Save light states
  const lightingState = {};

  if (window.lights) {
    Object.keys(window.lights).forEach((lightType) => {
      const light = window.lights[lightType];
      if (light) {
        lightingState[lightType] = {
          visible: light.visible,
          intensity: light.intensity,
          color: light.color ? light.color.getHex() : undefined,
          position: light.position
            ? {
                x: light.position.x,
                y: light.position.y,
                z: light.position.z,
              }
            : undefined,
        };

        // Add type-specific properties
        if (lightType === "spot") {
          lightingState[lightType].angle = light.angle;
          lightingState[lightType].distance = light.distance;
          lightingState[lightType].decay = light.decay;
          if (light.target && light.target.position) {
            lightingState[lightType].target = {
              x: light.target.position.x,
              y: light.target.position.y,
              z: light.target.position.z,
            };
          }
        } else if (lightType === "point") {
          lightingState[lightType].distance = light.distance;
          lightingState[lightType].decay = light.decay;
        } else if (lightType === "hemisphere") {
          lightingState[lightType].groundColor = light.groundColor
            ? light.groundColor.getHex()
            : undefined;
        } else if (lightType === "rectArea") {
          lightingState[lightType].width = light.width;
          lightingState[lightType].height = light.height;
        }
      }
    });
  }

  // Create complete view state
  const viewState = {
    camera: cameraState,
    controls: controlsState,
    model: modelState,
    handles: handlesState,
    rendering: renderingState,
    lighting: lightingState,
    lastLoadedSvgUrl: window.lastLoadedSvgUrl,
  };

  // Save to localStorage
  localStorage.setItem("svgViewState", JSON.stringify(viewState));
  console.log("Complete state saved:", viewState);
}

function updateUIFromSettings(settings) {
  // Extrusion depth
  if (settings.extrusionDepth !== undefined) {
    const depthInput = document.getElementById("extrusion-depth");
    if (depthInput) {
      depthInput.value = settings.extrusionDepth;
      document.getElementById("depth-value").textContent =
        settings.extrusionDepth;
    }
  }

  // Bevel
  if (settings.bevelEnabled !== undefined) {
    const bevelInput = document.getElementById("edge-bevel-enabled");
    if (bevelInput) bevelInput.checked = settings.bevelEnabled;
  }

  // Curve segments
  if (settings.curveSegments !== undefined) {
    const segmentsInput = document.getElementById("curve-segments");
    if (segmentsInput) {
      segmentsInput.value = settings.curveSegments;
      document.getElementById("curve-segments-value").textContent =
        settings.curveSegments;
    }
  }

  // Material properties
  if (settings.metalness !== undefined) {
    const metalnessInput = document.getElementById("metalness-slider");
    if (metalnessInput) {
      metalnessInput.value = settings.metalness;
      document.getElementById("metalness-value").textContent =
        settings.metalness;
    }
  }

  if (settings.roughness !== undefined) {
    const roughnessInput = document.getElementById("roughness-slider");
    if (roughnessInput) {
      roughnessInput.value = settings.roughness;
      document.getElementById("roughness-value").textContent =
        settings.roughness;
    }
  }
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

// Update the UI for light settings
function updateLightingControlsUI(lightingState) {
  // Update UI for all lights
  Object.keys(lightingState).forEach((lightType) => {
    const lightState = lightingState[lightType];

    // Skip if state or light doesn't exist
    if (!lightState || !window.lights[lightType]) return;

    // Update visibility checkbox
    const visibilityCheckbox = document.getElementById(
      `${lightType}-light-enabled`
    );
    if (visibilityCheckbox && lightState.visible !== undefined) {
      visibilityCheckbox.checked = lightState.visible;
    }

    // Update intensity slider
    const intensitySlider = document.getElementById(`${lightType}-intensity`);
    const intensityValue = document.getElementById(`${lightType}-value`);
    if (
      intensitySlider &&
      intensityValue &&
      lightState.intensity !== undefined
    ) {
      intensitySlider.value = lightState.intensity;
      intensityValue.textContent = lightState.intensity.toFixed(1);
    }

    // Update position sliders (common to most lights)
    if (lightState.position) {
      ["x", "y", "z"].forEach((axis) => {
        const posSlider = document.getElementById(`${lightType}-${axis}-pos`);
        const posValue = document.getElementById(`${lightType}-${axis}-value`);
        if (posSlider && posValue && lightState.position[axis] !== undefined) {
          posSlider.value = lightState.position[axis];
          posValue.textContent =
            typeof lightState.position[axis] === "number"
              ? lightState.position[axis].toFixed(1)
              : lightState.position[axis];
        }
      });
    }

    // Light-specific properties
    if (lightType === "spot") {
      // Target position
      if (lightState.target) {
        ["x", "y", "z"].forEach((axis) => {
          const targetSlider = document.getElementById(
            `${lightType}-target-${axis}-pos`
          );
          const targetValue = document.getElementById(
            `${lightType}-target-${axis}-value`
          );
          if (
            targetSlider &&
            targetValue &&
            lightState.target[axis] !== undefined
          ) {
            targetSlider.value = lightState.target[axis];
            targetValue.textContent = lightState.target[axis];
          }
        });
      }

      // Angle
      const angleSlider = document.getElementById(`${lightType}-angle`);
      const angleValue = document.getElementById(`${lightType}-angle-value`);
      if (angleSlider && angleValue && lightState.angle !== undefined) {
        // Convert from radians to degrees for UI
        const angleDegrees = (lightState.angle * 180) / Math.PI;
        angleSlider.value = angleDegrees;
        angleValue.textContent = `${angleDegrees}°`;
      }

      // Distance
      const distanceSlider = document.getElementById(`${lightType}-distance`);
      const distanceValue = document.getElementById(
        `${lightType}-distance-value`
      );
      if (
        distanceSlider &&
        distanceValue &&
        lightState.distance !== undefined
      ) {
        distanceSlider.value = lightState.distance;
        distanceValue.textContent = lightState.distance;
      }

      // Cast shadow
      const castShadowCheckbox = document.getElementById(
        `${lightType}-cast-shadow`
      );
      if (castShadowCheckbox && window.lights[lightType]) {
        castShadowCheckbox.checked = window.lights[lightType].castShadow;
      }
    } else if (lightType === "point") {
      // Distance
      const distanceSlider = document.getElementById(`${lightType}-distance`);
      const distanceValue = document.getElementById(
        `${lightType}-distance-value`
      );
      if (
        distanceSlider &&
        distanceValue &&
        lightState.distance !== undefined
      ) {
        distanceSlider.value = lightState.distance;
        distanceValue.textContent = lightState.distance;
      }

      // Decay
      const decaySlider = document.getElementById(`${lightType}-decay`);
      const decayValue = document.getElementById(`${lightType}-decay-value`);
      if (decaySlider && decayValue && lightState.decay !== undefined) {
        decaySlider.value = lightState.decay;
        decayValue.textContent = lightState.decay;
      }

      // Cast shadow
      const castShadowCheckbox = document.getElementById(
        `${lightType}-cast-shadow`
      );
      if (castShadowCheckbox && window.lights[lightType]) {
        castShadowCheckbox.checked = window.lights[lightType].castShadow;
      }
    } else if (lightType === "rectArea") {
      // Width
      const widthSlider = document.getElementById(`${lightType}-width`);
      const widthValue = document.getElementById(`${lightType}-width-value`);
      if (widthSlider && widthValue && lightState.width !== undefined) {
        widthSlider.value = lightState.width;
        widthValue.textContent = lightState.width;
      }

      // Height
      const heightSlider = document.getElementById(`${lightType}-height`);
      const heightValue = document.getElementById(`${lightType}-height-value`);
      if (heightSlider && heightValue && lightState.height !== undefined) {
        heightSlider.value = lightState.height;
        heightValue.textContent = lightState.height;
      }
    }
  });

  // Update global shadow checkbox
  const globalShadowCheckbox = document.getElementById("global-shadow");
  if (globalShadowCheckbox && window.renderer) {
    globalShadowCheckbox.checked = window.renderer.shadowMap.enabled;
  }

  // Update light helpers checkbox
  const helpersCheckbox = document.getElementById("show-light-helpers");
  if (helpersCheckbox) {
    // Check if any helpers are visible
    const helpersVisible = Object.values(window.lightHelpers).some(
      (helper) => helper && helper.visible
    );
    helpersCheckbox.checked = helpersVisible;
  }
}

// Update the init function to remove the timeout
function init() {
  // window.customMetalness = 0.5;
  // window.customRoughness = 0.5;

  // Check if we have a saved state
  const savedState = localStorage.getItem("svgViewState");

  // Load SVG - either the one from saved state or default
  if (savedState) {
    try {
      const viewState = JSON.parse(savedState);
      if (viewState.lastLoadedSvgUrl) {
        loadSVG(viewState.lastLoadedSvgUrl);
      } else {
        loadSVG("../assets/vector.svg");
      }
    } catch (e) {
      console.error("Error parsing saved state:", e);
      loadSVG("../assets/vector.svg");
    }
  } else {
    loadSVG("../assets/vector.svg");
  }

  // Start animation loop
  animate();
}

init();
