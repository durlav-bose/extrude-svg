import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

let threeColor = new THREE.Color(0x00ff00);
// Scene setup
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x111111);

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

// Create renderer first (you'll need it for the PMREMGenerator)
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  physicallyCorrectLights: true,
  alpha: true,
  canvas: document.querySelector("#canvas"),
});

renderer.setSize(700, 700);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputEncoding = THREE.sRGBEncoding;

window.renderer = renderer;

// Load HDR environment map
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Ambient light - general illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Main directional light - primary light source
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 512;
directionalLight.shadow.mapSize.height = 512;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
scene.add(directionalLight);

// Back light - creates separation from background
const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
backLight.position.set(-1, 0.5, -1);
backLight.castShadow = true;
backLight.shadow.mapSize.width = 512;
backLight.shadow.mapSize.height = 512;
scene.add(backLight);

// Fill light - softens shadows from main light
const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
fillLight.position.set(1, 0, -0.5);
fillLight.castShadow = false;
scene.add(fillLight);

// Bottom light - subtle highlights from below
const bottomLight = new THREE.DirectionalLight(0xffffff, 0.2);
bottomLight.position.set(0, -1, 0.5);
bottomLight.castShadow = false;
scene.add(bottomLight);

// Point light - central highlight
const pointLight = new THREE.PointLight(0xffffff, 100, 0.0, 1.0);
pointLight.position.set(0, 0, 70);
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 512;
pointLight.shadow.mapSize.height = 512;
scene.add(pointLight);

// Store lights in a map for easy access
window.lights = {
  ambient: ambientLight,
  main: directionalLight,
  back: backLight,
  fill: fillLight,
  bottom: bottomLight,
  point: pointLight,
};

// 2. Enable renderer shadow mapping

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
  rotationGroup.position.set(0, 0, 0);

  // Create and position the handles
  movementHandle = createMovementHandle();
  scene.add(movementHandle);
  movementHandle.position.set(0, 0, 5); // Center of viewport

  // Create rotation handle
  rotationHandle = createRotationHandle();
  rotationGroup.add(rotationHandle);

  // Position rotation handle at the edge
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

function takeScreenshot() {
  // Store handle visibility and hide them
  const handlesVisible = movementHandle ? movementHandle.visible : false;
  updateHandlesVisibility(false);

  // Get the original canvas dimensions to maintain aspect ratio
  const originalWidth = renderer.domElement.width;
  const originalHeight = renderer.domElement.height;

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
  captureRenderer.setClearColor(scene.background, 1);
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

      // Track if we successfully added any valid objects
      let addedValidObject = false;

      let counter = 0;

      // Process all paths from the SVG
      data.paths.forEach((path, pathIndex) => {
        try {
          counter++;
          // console.log("Processing path:", pathIndex);

          // Get style from path userData
          const pathStyle = path.userData?.style || {};
          const fillColor = pathStyle.fill;
          const fillOpacity = pathStyle.fillOpacity;
          const strokeColor = pathStyle.stroke;
          const strokeOpacity = pathStyle.strokeOpacity;
          const strokeWidth = parseFloat(pathStyle.strokeWidth) || 1;

          // console.log("Path style:", {
          //   fill: fillColor,
          //   stroke: strokeColor,
          //   strokeWidth: strokeWidth,
          // });

          // Skip paths with neither fill nor stroke
          if (
            (fillColor === "none" || !fillColor) &&
            (strokeColor === "none" || !strokeColor)
          ) {
            // console.log(`Skipping path ${pathIndex} with no fill or stroke`);
            return;
          }

          // Process fill for paths that have fill
          if (fillColor && fillColor !== "none") {
            // console.log("window.customMetalness :>> ", window.customMetalness);
            // Create fill material
            let fillMaterial;
            try {
              const color = new THREE.Color(fillColor);
              threeColor = color;
              console.log("threeColor ------------- ", threeColor);

              fillMaterial = new THREE.MeshStandardMaterial({
                color: color,
                side: THREE.DoubleSide,
                flatShading: true,
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
                flatShading: true,
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

                  // Extrusion settings
                  const extrudeSettings = {
                    depth: window.customExtrusionDepth || 10,
                    bevelEnabled: false,
                  };

                  // Create geometry with extrusion
                  const geometry = new THREE.ExtrudeGeometry(
                    shape,
                    extrudeSettings
                  );

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
                const color = new THREE.Color(strokeColor);
                strokeMaterial = new THREE.MeshStandardMaterial({
                  color: color,
                  side: THREE.DoubleSide,
                  flatShading: true,
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
                  flatShading: true,
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
                    // Extrusion settings for stroke
                    const extrudeSettings = {
                      depth: window.customExtrusionDepth || 10,
                      bevelEnabled: false,
                    };

                    // Create geometry with extrusion
                    const geometry = new THREE.ExtrudeGeometry(
                      lineShape,
                      extrudeSettings
                    );

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

        console.log("SVG processing complete");
      } else {
        console.error("No valid objects found in SVG");
      }

      // Create UI Controls
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

// Enhanced UI controls
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

  let exDepth = document.getElementById("extrusion-depth");

  // Extrusion depth control
  document.getElementById("extrusion-depth").addEventListener("input", (e) => {
    document.getElementById("depth-value").textContent = e.target.value;
  });

  document.getElementById("apply-depth").addEventListener("click", () => {
    const depth = parseInt(document.getElementById("extrusion-depth").value);
    window.customExtrusionDepth = depth;

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

  // Screenshot button
  document.getElementById("take-screenshot").addEventListener("click", () => {
    takeScreenshot();
  });

  // Reload button
  document.getElementById("reload-svg").addEventListener("click", () => {
    if (window.lastLoadedSvgUrl) {
      loadSVG(window.lastLoadedSvgUrl);
    } else {
      alert("No SVG has been loaded yet.");
    }
  });

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

  document.getElementById("apply-material").addEventListener("click", () => {
    applyMaterialProperties();
  });

  document
    .getElementById("apply-material-type")
    .addEventListener("click", () => {
      const materialType = document.getElementById("material-select").value;
      applyMaterialType(materialType, svgGroup);
    });

  createLightingControls();
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

  // Main Directional Light
  document
    .getElementById("main-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.main.visible = e.target.checked;
    });

  document.getElementById("main-intensity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("main-value").textContent = value.toFixed(1);
    window.lights.main.intensity = value;
  });

  document.getElementById("main-x-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("main-x-value").textContent = value.toFixed(1);
    window.lights.main.position.x = value;
  });

  document.getElementById("main-y-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("main-y-value").textContent = value.toFixed(1);
    window.lights.main.position.y = value;
  });

  document.getElementById("main-z-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("main-z-value").textContent = value.toFixed(1);
    window.lights.main.position.z = value;
  });

  document
    .getElementById("main-cast-shadow")
    .addEventListener("change", (e) => {
      window.lights.main.castShadow = e.target.checked;
    });

  document.querySelectorAll(".main-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.main.color.copy(threeColor);
    });
  });

  // Back Light
  document
    .getElementById("back-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.back.visible = e.target.checked;
    });

  document.getElementById("back-intensity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("back-value").textContent = value.toFixed(1);
    window.lights.back.intensity = value;
  });

  document.getElementById("back-x-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("back-x-value").textContent = value.toFixed(1);
    window.lights.back.position.x = value;
  });

  document.getElementById("back-y-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("back-y-value").textContent = value.toFixed(1);
    window.lights.back.position.y = value;
  });

  document.getElementById("back-z-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("back-z-value").textContent = value.toFixed(1);
    window.lights.back.position.z = value;
  });

  document
    .getElementById("back-cast-shadow")
    .addEventListener("change", (e) => {
      window.lights.back.castShadow = e.target.checked;
    });

  document.querySelectorAll(".back-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.back.color.copy(threeColor);
    });
  });

  // Fill Light
  document
    .getElementById("fill-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.fill.visible = e.target.checked;
    });

  document.getElementById("fill-intensity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("fill-value").textContent = value.toFixed(1);
    window.lights.fill.intensity = value;
  });

  document.querySelectorAll(".fill-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.fill.color.copy(threeColor);
    });
  });

  // Bottom Light
  document
    .getElementById("bottom-light-enabled")
    .addEventListener("change", (e) => {
      window.lights.bottom.visible = e.target.checked;
    });

  document.getElementById("bottom-intensity").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("bottom-value").textContent = value.toFixed(1);
    window.lights.bottom.intensity = value;
  });

  document.querySelectorAll(".bottom-color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      const colorInt = parseInt(colorHex);
      const threeColor = new THREE.Color(colorInt);
      window.lights.bottom.color.copy(threeColor);
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
  });

  document.getElementById("point-y-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-y-value").textContent = value;
    window.lights.point.position.y = value;
  });

  document.getElementById("point-z-pos").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById("point-z-value").textContent = value;
    window.lights.point.position.z = value;
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
    });
  });

  document.getElementById("global-shadow").addEventListener("change", (e) => {
    if (window.renderer) {
      window.renderer.shadowMap.enabled = e.target.checked;
    }
  });

  document.getElementById("reset-lights").addEventListener("click", () => {
    // Reset all lights with property checks
    Object.values(window.lights).forEach((light) => {
      light.intensity = 1;
      light.color.set(0xffffff);
      light.visible = true;

      // Only modify properties if they exist
      if (light.castShadow !== undefined) light.castShadow = false;
      if (light.position) light.position.set(1, 1, 1);
      if ("distance" in light) light.distance = 0;
      if ("decay" in light) light.decay = 1;
    });
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
  renderer.render(scene, camera);
}

// Start the application
function init() {
  window.customMetalness = 0.5;
  window.customRoughness = 0.5;
  // Load the SVG
  loadSVG("../assets/vector.svg");
  // Start animation loop
  animate();
}

// Initialize the application
init();
