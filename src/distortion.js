import * as THREE from "three";
import { DragControls } from "three/examples/jsm/controls/DragControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

/************************************************************
 * Distortion / FFD Setup in Plain JavaScript + Three.js
 ************************************************************/
let scene, camera, renderer;
let orbitControls, dragControls;

// Main group holding the mesh + control points
let rotationGroup = null;

// Distortion mesh, geometry, and material
let shaderMesh = null;

// Control points data (contains position vectors)
let controlPoints = [];
// Meshes that represent the draggable control points
const controlPointMeshes = [];
// Lines that connect the control points
let debugLines = [];

// For rotation/move handles
let rotationHandle = null;
let movementHandle = null;

// Basic transform states
let currentScale = 1;
let currentRotation = 0;
let currentXPosition = 0;
let currentYPosition = 0;

// For storing the corner handle offset
let cornerLocalX = 0;
let cornerLocalY = 0;

// For referencing center & corner in local space
let cornerLocal = new THREE.Vector3(0, 0, 0);
let centerLocal = new THREE.Vector3(0, 0, 0);

// Basic config
let backgroundImageUrl = "";
let maskImageUrl = "";
let designImageUrl = "";

// Grid settings
let numRows = 2;
let numCols = 2;

// Dimensions
let imageWidth = 800;
let imageHeight = 800;
// A ratio used by the final “camera framing.” E.g. 1 => 700x700
let finalRendererAspectRatio = 1;

const config = {
  backgroundImage:
    "https://devcdn.renderengine.io/products/render-mockups/10-Marigold-October-Standerd-silver-black-Ll9zAFkIzRpo2R6b.png",
  maskImage:
    "https://devcdn.renderengine.io/products/render-mockups/10-Marigold-October-Standerd-shape-5dU0bvAYe6vdq7U9.png",
  designImage: "../assets/extruded-svg.gltf", // or .svg
  aspectRatio: 1, // for final renderer, if needed
  // Starting grid
  numRows: 2,
  numCols: 2,
  // Starting transform
  scale: 1,
  rotation: 0,
  positionX: 0,
  positionY: 0,
};

window.addEventListener("DOMContentLoaded", () => {
  initDistortion("canvas-container", config);
});

// Shaders
const vertexShader = `
  varying vec2 vUv;
  void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  uniform sampler2D u_texture;
  uniform float u_opacity;
  void main() {
      vec4 textureColor = texture2D(u_texture, vUv);
      gl_FragColor = vec4(textureColor.rgb, textureColor.a * u_opacity);
  }
`;

/**
 * Initializes the distortion example.
 * @param {string} containerId - ID of the DOM element for our canvas.
 * @param {Object} config - Configuration object with images, scale, etc.
 */
function initDistortion(containerId, config) {
  // Extract user config
  backgroundImageUrl = config.backgroundImage || "";
  maskImageUrl = config.maskImage || "";
  designImageUrl = config.designImage || "";
  finalRendererAspectRatio = config.aspectRatio || 1;

  numRows = config.numRows || 2;
  numCols = config.numCols || 2;

  currentScale = config.scale || 1;
  currentRotation = config.rotation || 0;
  currentXPosition = config.positionX || 0;
  currentYPosition = config.positionY || 0;

  // Prepare the container
  const container = document.getElementById(containerId);
  if (!container) {
    console.error("Could not find container element:", containerId);
    return;
  }

  // Create the scene
  scene = new THREE.Scene();

  // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // Size the renderer according to desired aspect ratio (arbitrary example)
  renderer.setSize(700, 700 / finalRendererAspectRatio);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.border = "1px dashed #000";
  renderer.domElement.style.boxSizing = "border-box";
  container.appendChild(renderer.domElement);

  // Create an Orthographic camera
  const cameraHeight = 700;
  const halfCameraHeight = cameraHeight / 2;
  const halfCameraWidth = halfCameraHeight * finalRendererAspectRatio;

  camera = new THREE.OrthographicCamera(
    -halfCameraWidth,
    halfCameraWidth,
    halfCameraHeight,
    -halfCameraHeight,
    -1000,
    1000
  );
  camera.position.z = 5;

  // Add a group for rotation + control points
  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  // Initialize base images (background, mask) asynchronously
  loadBackgroundImage();
  loadMaskImage();

  // Setup design mesh + control points
  setupScene(false /* dataLoaded */)
    .then(() => {
      // Setup user interactions
      setupOrbitControls();
      initializeDragControls();
      animate();
    })
    .catch((err) => {
      console.error("Error setting up scene:", err);
    });
}

/* ----------------------------------------------------------
   Scene / Image Loading
---------------------------------------------------------- */

function loadBackgroundImage() {
  if (!backgroundImageUrl) return;
  const loader = new THREE.TextureLoader();
  loader.load(backgroundImageUrl, (texture) => {
    // Remove existing background
    const oldBg = scene.getObjectByName("background");
    if (oldBg) scene.remove(oldBg);

    // We match the camera’s visible area
    const width = camera.right - camera.left || 1000;
    const height = camera.top - camera.bottom || 1000;

    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, 0, 0);
    mesh.name = "background";
    scene.add(mesh);
  });
}

function loadMaskImage() {
  if (!maskImageUrl) return;
  const loader = new THREE.TextureLoader();
  loader.load(maskImageUrl, (texture) => {
    // Remove old mask if present
    const oldMask = scene.getObjectByName("mask");
    if (oldMask) scene.remove(oldMask);

    const width = camera.right - camera.left || 1000;
    const height = camera.top - camera.bottom || 1000;

    const geom = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(0, 0, 0.1);
    mesh.name = "mask";
    scene.add(mesh);
  });
}

/**
 * Creates the design image (mesh) and control points.
 * If `dataLoaded` is false, it initializes controlPoints from scratch.
 */
function setupScene(dataLoaded = false) {
  return new Promise((resolve, reject) => {
    if (!designImageUrl) {
      reject("No design image url provided.");
      return;
    }

    // Check the file type
    const fileExtension = designImageUrl.split(".").pop().toLowerCase();

    // Handle different file types
    if (fileExtension === "gltf" || fileExtension === "glb") {
      // GLTF/GLB model
      setupGltfModel(designImageUrl, dataLoaded, resolve, reject);
    } else if (fileExtension === "svg") {
      // SVG handling
      const loader = new SVGLoader();
      loader
        .loadAsync(designImageUrl)
        .then((svgData) => {
          // Attempt to read width/height or fallback to viewBox
          const svgElement = svgData.xml;
          let originalWidth = parseFloat(svgElement.getAttribute("width")) || 0;
          let originalHeight =
            parseFloat(svgElement.getAttribute("height")) || 0;

          const viewBox = svgElement.getAttribute("viewBox");
          if ((!originalWidth || !originalHeight) && viewBox) {
            const parts = viewBox.split(" ").map(Number);
            if (parts.length === 4) {
              originalWidth = parts[2];
              originalHeight = parts[3];
            }
          }

          // Default to 500 if nothing found
          if (!originalWidth || !originalHeight) {
            console.warn(
              "No valid SVG dimensions found. Defaulting to 500x500."
            );
            originalWidth = 500;
            originalHeight = 500;
          }

          // We normalize to 500px wide and maintain aspect ratio
          const NORMALIZED_WIDTH = 500;
          const aspectRatio = originalWidth / originalHeight;
          const normalizedHeight = NORMALIZED_WIDTH / aspectRatio;

          // Convert SVG into a Canvas-based texture
          const canvas = document.createElement("canvas");
          canvas.width = NORMALIZED_WIDTH;
          canvas.height = normalizedHeight;
          const ctx = canvas.getContext("2d");

          // Convert loaded SVG to a blob and then an <img> we can draw
          const serializer = new XMLSerializer();
          const svgString = serializer.serializeToString(svgElement);
          const blob = new Blob([svgString], { type: "image/svg+xml" });
          const url = URL.createObjectURL(blob);

          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, NORMALIZED_WIDTH, normalizedHeight);
            URL.revokeObjectURL(url);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            setupSceneWithTexture(
              texture,
              dataLoaded,
              resolve,
              NORMALIZED_WIDTH,
              normalizedHeight
            );
          };
          img.onerror = (err) => {
            reject("Error loading SVG image onto Canvas: " + err);
          };
          img.src = url;
        })
        .catch((err) => {
          reject("Error loading SVG: " + err);
        });
    } else {
      // Standard image
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        designImageUrl,
        (texture) => {
          const aspectRatio = texture.image.width / texture.image.height;
          const normalizedHeight = 500 / aspectRatio;
          setupSceneWithTexture(
            texture,
            dataLoaded,
            resolve,
            500,
            normalizedHeight
          );
        },
        undefined,
        (err) => {
          reject("Error loading texture: " + err);
        }
      );
    }
  });
}

/**
 * Loads and sets up a GLTF model with control points for deformation
 */
function setupGltfModel(modelUrl, dataLoaded, resolve, reject) {
  // Import GLTFLoader if needed
  const loader = new GLTFLoader();

  loader.load(
    modelUrl,
    (gltf) => {
      // Get the model
      const model = gltf.scene;

      // Calculate bounding box to get dimensions
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Normalize the model size
      const NORMALIZED_WIDTH = 500;
      const scale = NORMALIZED_WIDTH / Math.max(size.x, size.y, size.z);
      model.scale.set(scale, scale, scale);

      // Recalculate the bounding box after scaling
      box.setFromObject(model);
      center.copy(box.getCenter(new THREE.Vector3()));

      // Center the model (move to origin)
      model.position.sub(center);

      // Update normalized dimensions
      imageWidth = size.x * scale;
      imageHeight = size.y * scale;
      const modelDepth = size.z * scale;

      // Clear existing model if any
      rotationGroup.children.forEach((child) => {
        if (child.name === "gltfModel") {
          rotationGroup.remove(child);
        }
      });

      // Add model to rotation group
      model.name = "gltfModel";
      rotationGroup.add(model);

      // Store original vertices for deformation
      storeOriginalVertices(model);

      // Set up control points
      setupControlPoints(dataLoaded);

      // Create rotation and movement handles
      if (!rotationHandle) createRotationHandle();
      if (!movementHandle) createMovementHandle();

      // Apply transformations
      rotationGroup.rotation.z = currentRotation;
      rotationGroup.position.set(currentXPosition, currentYPosition, 0);

      // Update handle positions
      updateHandlePositions();

      resolve();
    },
    // Progress callback
    (xhr) => {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    // Error callback
    (error) => {
      console.error("Error loading GLTF model:", error);
      reject(error);
    }
  );
}

/**
 * Store original vertex positions of the model for deformation
 */
let originalVertices = [];
function storeOriginalVertices(model) {
  originalVertices = [];

  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      const positions = child.geometry.attributes.position;

      // For each vertex in the mesh
      for (let i = 0; i < positions.count; i++) {
        // Get current position
        const vertex = new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        );

        // Convert to world coordinates for easier calculation
        vertex.applyMatrix4(child.matrixWorld);

        // Store original position along with reference to mesh and index
        originalVertices.push({
          meshReference: child,
          index: i,
          originalPosition: vertex.clone(),
        });
      }
    }
  });
}

/**
 * Update geometry for GLTF model (called when control points are moved)
 */
function updateGltfGeometry() {
  const model = rotationGroup.getObjectByName("gltfModel");
  if (!model || originalVertices.length === 0) return;

  // Calculate bounding box of control points
  const cpPoints = controlPoints.map((cp) => cp.position);
  const cpBox = new THREE.Box3().setFromPoints(cpPoints);
  const cpSize = cpBox.getSize(new THREE.Vector3());
  const cpMin = cpBox.min;

  // For each original vertex, calculate its new position
  originalVertices.forEach((vertex) => {
    const mesh = vertex.meshReference;
    const positions = mesh.geometry.attributes.position;

    // Calculate parametric coordinates (u,v) of this vertex in the control point grid
    const origPos = vertex.originalPosition;

    // Normalize coordinates to the 0-1 range
    const u = (origPos.x - cpMin.x) / cpSize.x;
    const v = (origPos.y - cpMin.y) / cpSize.y;

    // Calculate the deformed position using the FFD grid
    const deformedPos = calculateFFDPoint(u, v);

    // Convert back to local coordinates for the mesh
    const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const localPos = deformedPos.clone().applyMatrix4(worldToLocal);

    // Update the position
    positions.setXYZ(vertex.index, localPos.x, localPos.y, localPos.z);
    positions.needsUpdate = true;
  });

  // Update normals for proper lighting
  model.traverse((child) => {
    if (child.isMesh && child.geometry) {
      child.geometry.computeVertexNormals();
    }
  });
}

/**
 * Sets up control points for deformation
 */
function setupControlPoints(dataLoaded) {
  // Remove old control point meshes
  controlPointMeshes.forEach((mesh) => rotationGroup.remove(mesh));
  controlPointMeshes.length = 0;

  // Create or reuse control points
  if (!dataLoaded) {
    controlPoints = [];
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        const x = (j / (numCols - 1) - 0.5) * imageWidth * currentScale;
        const y = (0.5 - i / (numRows - 1)) * imageHeight * currentScale;
        // For 3D models, z can be set to 0 or we can spread points in 3D space
        const z = 0;
        const cp = { position: new THREE.Vector3(x, y, z) };
        controlPoints.push(cp);
      }
    }
  }

  // Create meshes for control points
  controlPoints.forEach((cp, index) => {
    const mesh = createControlPointMesh(cp.position);
    mesh.name = "controlPoint_" + index;
    controlPointMeshes.push(mesh);
    rotationGroup.add(mesh);
  });

  // Update debug lines
  updateDebugLines();
}

/**
 * Helper to actually build the mesh and control points with the given texture.
 */
function setupSceneWithTexture(texture, dataLoaded, resolve, width, height) {
  // Save these "normalized" or target dimensions
  imageWidth = width;
  imageHeight = height;

  // Create or reuse control points
  if (!dataLoaded) {
    controlPoints = [];
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        const x = (j / (numCols - 1) - 0.5) * imageWidth * currentScale;
        const y = (0.5 - i / (numRows - 1)) * imageHeight * currentScale;
        const cp = { position: new THREE.Vector3(x, y, 1) };
        controlPoints.push(cp);
      }
    }
  }

  // Remove old control point meshes from scene
  controlPointMeshes.forEach((m) => rotationGroup.remove(m));
  controlPointMeshes.length = 0;

  // Create new meshes for the control points
  controlPoints.forEach((cp, index) => {
    const mesh = createControlPointMesh(cp.position);
    // Just store row/col in name for debugging
    mesh.name = "controlPoint_" + index;
    controlPointMeshes.push(mesh);
    rotationGroup.add(mesh);
  });

  // Create a shader material for the FFD geometry
  const material = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: texture },
      u_opacity: { value: 1.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  });

  // If there’s an old mesh, remove it
  if (shaderMesh) {
    rotationGroup.remove(shaderMesh);
    shaderMesh.geometry.dispose();
    shaderMesh.material.dispose();
  }

  // Create the new FFD geometry
  const geometry = createFFDGeometry(imageWidth, imageHeight);
  shaderMesh = new THREE.Mesh(geometry, material);
  shaderMesh.name = "shaderMesh";
  shaderMesh.position.set(0, 0, 0.5);
  rotationGroup.add(shaderMesh);

  // Reset old debug lines
  debugLines.forEach((line) => rotationGroup.remove(line));
  debugLines.length = 0;

  // Draw connecting lines
  updateDebugLines();

  // Create rotation and movement handles if they don't exist
  if (!rotationHandle) createRotationHandle();
  if (!movementHandle) createMovementHandle();

  // Apply group transformations from stored values
  rotationGroup.rotation.z = currentRotation;
  rotationGroup.position.set(currentXPosition, currentYPosition, 0);

  // Position the handles
  updateHandlePositions();

  resolve();
}

/* ----------------------------------------------------------
   Geometry and FFD Calculation
---------------------------------------------------------- */

/**
 * Given a local uv in [0,1], calculates the FFD point
 * by interpolating across the controlPoints in both directions.
 */
function calculateFFDPoint(u, v) {
  const curveX = [];

  // Row-based interpolation
  for (let i = 0; i < numRows; i++) {
    const rowPoints = [];
    for (let j = 0; j < numCols; j++) {
      rowPoints.push(controlPoints[i * numCols + j].position.clone());
    }

    let interpolatedPoint;
    if (numCols === 2) {
      // Linear
      const start = rowPoints[0];
      const end = rowPoints[1];
      interpolatedPoint = new THREE.Vector3(
        start.x + (end.x - start.x) * u,
        start.y + (end.y - start.y) * u,
        0
      );
    } else {
      // Catmull-Rom curve
      const horizontalCurve = new THREE.CatmullRomCurve3(rowPoints);
      interpolatedPoint = horizontalCurve.getPoint(u);
    }
    curveX.push(interpolatedPoint);
  }

  // Now vertical interpolation across curveX
  if (numRows === 2) {
    const start = curveX[0];
    const end = curveX[1];
    return new THREE.Vector3(
      start.x + (end.x - start.x) * v,
      start.y + (end.y - start.y) * v,
      0
    );
  } else {
    const verticalCurve = new THREE.CatmullRomCurve3(curveX);
    return verticalCurve.getPoint(v);
  }
}

/**
 * Creates a BufferGeometry using the control points for the FFD mesh.
 */
function createFFDGeometry(width, height) {
  const resolution = 50; // how finely to subdivide
  const vertices = [];
  const uvs = [];
  const indices = [];

  // Generate vertices
  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const u = j / resolution;
      const v = i / resolution;
      const point = calculateFFDPoint(u, v);
      vertices.push(point.x, point.y, 0);
      // We want uv so that texture is not flipped vertically
      uvs.push(u, 1 - v);
    }
  }

  // Generate indices for the two triangles per cell
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const a = i * (resolution + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (resolution + 1) + j + 1;
      const d = (i + 1) * (resolution + 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}

/* ----------------------------------------------------------
   Control Points and Lines
---------------------------------------------------------- */

function createControlPointMesh(position) {
  const geom = new THREE.CircleGeometry(5, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x4d80ff,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(position);
  mesh.renderOrder = 9999; // draw on top
  return mesh;
}

function updateDebugLines() {
  // Clear old lines
  debugLines.forEach((line) => rotationGroup.remove(line));
  debugLines.length = 0;

  const material = new THREE.LineBasicMaterial({ color: 0x4d80ff });

  // Horizontal curves
  for (let i = 0; i < numRows; i++) {
    const points = [];
    for (let j = 0; j < numCols; j++) {
      points.push(controlPoints[i * numCols + j].position);
    }
    if (points.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
    const line = new THREE.Line(geo, material);
    line.position.z = 1;
    line.name = "connected-line";
    rotationGroup.add(line);
    debugLines.push(line);
  }

  // Vertical curves
  for (let j = 0; j < numCols; j++) {
    const points = [];
    for (let i = 0; i < numRows; i++) {
      points.push(controlPoints[i * numCols + j].position);
    }
    if (points.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50));
    const line = new THREE.Line(geo, material);
    line.position.z = 1;
    line.name = "connected-line";
    rotationGroup.add(line);
    debugLines.push(line);
  }
}

// /**
//  * Rebuild geometry after user drags control points around.
//  */
// function updateGeometry() {
//   if (!shaderMesh) return;
//   const oldGeom = shaderMesh.geometry;
//   shaderMesh.geometry = createFFDGeometry(imageWidth, imageHeight);
//   oldGeom.dispose();
//   updateDebugLines();
//   updateHandlePositions();
// }

/**
 * Override the updateGeometry function to handle both 2D and 3D deformations
 */
function updateGeometry() {
  const model = rotationGroup.getObjectByName("gltfModel");

  if (model) {
    // 3D GLTF model
    updateGltfGeometry();
  } else if (shaderMesh) {
    // 2D texture
    const oldGeometry = shaderMesh.geometry;
    shaderMesh.geometry = createFFDGeometry(imageWidth, imageHeight);
    oldGeometry.dispose();
  }

  updateDebugLines();
  updateHandlePositions();
}

/* ----------------------------------------------------------
   Rotation / Movement Handles
---------------------------------------------------------- */

function createRotationHandle() {
  const geometry = new THREE.CircleGeometry(10, 16);
  const loader = new THREE.TextureLoader();
  loader.load(
    "rotate.png", // Provide your own icon
    (texture) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x3366cc,
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

      rotationHandle = new THREE.Mesh(geometry, material);
      rotationHandle.name = "rotationHandle";
      rotationHandle.renderOrder = 9999;
      scene.add(rotationHandle);

      let initialRotation = 0;
      let initialMousePos = new THREE.Vector2();

      const handleDrag = new DragControls(
        [rotationHandle],
        camera,
        renderer.domElement
      );

      handleDrag.addEventListener("dragstart", (event) => {
        const obj = event.object;
        initialRotation = currentRotation;
        initialMousePos.set(obj.position.x, obj.position.y);
      });

      handleDrag.addEventListener("drag", (event) => {
        const obj = event.object;
        const currPos = new THREE.Vector2(obj.position.x, obj.position.y);
        const angleDelta =
          Math.atan2(currPos.y, currPos.x) -
          Math.atan2(initialMousePos.y, initialMousePos.x);
        updateRotation(initialRotation + angleDelta);
      });

      handleDrag.addEventListener("dragend", () => {
        updateHandlePositions();
      });
    },
    undefined,
    (err) => console.error("Error loading rotation handle texture", err)
  );
}

function createMovementHandle() {
  const geometry = new THREE.CircleGeometry(20, 64);
  const loader = new THREE.TextureLoader();
  loader.load(
    "move.png", // Provide your own icon
    (texture) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0x3366cc,
        map: texture,
        transparent: true,
      });
      movementHandle = new THREE.Mesh(geometry, material);
      movementHandle.name = "movementHandle";
      movementHandle.renderOrder = 9999;

      // Place it somewhere “below center”
      let xPos = currentXPosition || 0;
      let yPos = currentYPosition || -imageHeight * 0.1 * currentScale;
      movementHandle.position.set(xPos, yPos, 2);
      scene.add(movementHandle);

      let initialHandlePos = new THREE.Vector3();
      let initialImagePos = new THREE.Vector3();

      const dragCtrl = new DragControls(
        [movementHandle],
        camera,
        renderer.domElement
      );

      dragCtrl.addEventListener("dragstart", (event) => {
        initialHandlePos.copy(event.object.position);
        initialImagePos.copy(rotationGroup.position);
      });

      dragCtrl.addEventListener("drag", (event) => {
        const delta = event.object.position.clone().sub(initialHandlePos);
        rotationGroup.position.copy(initialImagePos.clone().add(delta));
        currentXPosition = rotationGroup.position.x;
        currentYPosition = rotationGroup.position.y;
        updateHandlePositions();
      });

      dragCtrl.addEventListener("dragend", () => {
        updateHandlePositions();
      });
    },
    undefined,
    (err) => console.error("Error loading movement handle texture", err)
  );
}

function updateRotation(newRotation) {
  rotationGroup.rotation.z = newRotation;
  currentRotation = newRotation;
  updateHandlePositions();
}

function updateHandlePositions() {
  if (!shaderMesh || !rotationHandle || !movementHandle) return;

  const halfW = (imageWidth * currentScale) / 2;
  const halfH = (imageHeight * currentScale) / 2;

  // For “top-right corner” handle
  // If we have a top-right control point, use that
  const topRightPoint = controlPointMeshes.find((m) =>
    m.name.includes(`controlPoint_0_${numCols - 1}`)
  );
  if (topRightPoint) {
    cornerLocalX = topRightPoint.position.x + 20;
    cornerLocalY = topRightPoint.position.y + 20;
  } else {
    cornerLocalX = halfW + 20;
    cornerLocalY = halfH + 20;
  }

  cornerLocal.set(cornerLocalX, cornerLocalY, 0);
  // apply group rotation
  cornerLocal.applyAxisAngle(new THREE.Vector3(0, 0, 1), currentRotation);
  // shift by group’s position
  cornerLocal.add(rotationGroup.position);
  rotationHandle.position.copy(cornerLocal);

  // Move handle near bottom center
  centerLocal.set(0, -imageHeight * 0.1 * currentScale, 0);
  centerLocal.applyAxisAngle(new THREE.Vector3(0, 0, 1), currentRotation);
  centerLocal.add(rotationGroup.position);
  movementHandle.position.copy(centerLocal);
  movementHandle.position.z = 2;
  currentXPosition = centerLocal.x;
  currentYPosition = centerLocal.y;
}

/* ----------------------------------------------------------
   Controls Setup (Orbit + Drag)
---------------------------------------------------------- */

function setupOrbitControls() {
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = false;
  orbitControls.enableRotate = false;
  orbitControls.enableZoom = true;
  orbitControls.enablePan = true;
  orbitControls.screenSpacePanning = true;
  orbitControls.panSpeed = 2.0;
  orbitControls.minZoom = 0.5;
  orbitControls.maxZoom = 2.0;
  orbitControls.enabled = false;

  // We'll enable orbit controls while Alt is pressed
  const onKeyDown = (e) => {
    if (e.key === "Alt") {
      orbitControls.enabled = true;
      if (dragControls) dragControls.enabled = false;
      renderer.domElement.style.cursor = "grab";
    }
  };
  const onKeyUp = (e) => {
    if (e.key === "Alt") {
      orbitControls.enabled = false;
      if (dragControls) dragControls.enabled = true;
      renderer.domElement.style.cursor = "auto";
    }
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Keep references to remove them if needed
  orbitControls._keyHandlers = { down: onKeyDown, up: onKeyUp };

  renderer.domElement.addEventListener("mousedown", () => {
    if (orbitControls.enabled) {
      renderer.domElement.style.cursor = "grabbing";
    }
  });
  renderer.domElement.addEventListener("mouseup", () => {
    if (orbitControls.enabled) {
      renderer.domElement.style.cursor = "grab";
    }
  });
}

function initializeDragControls() {
  dragControls = new DragControls(
    controlPointMeshes,
    camera,
    renderer.domElement
  );
  dragControls.enabled = true;

  dragControls.addEventListener("dragstart", () => {
    if (orbitControls) orbitControls.enabled = false;
  });

  dragControls.addEventListener("drag", (event) => {
    const idx = controlPointMeshes.indexOf(event.object);
    controlPoints[idx].position.copy(event.object.position);
    updateGeometry();
  });

  dragControls.addEventListener("dragend", () => {
    if (orbitControls) orbitControls.enabled = false;
  });
}

/* ----------------------------------------------------------
   Rendering / Animate
---------------------------------------------------------- */

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);

  if (orbitControls) {
    orbitControls.update();
  }
}

/* ----------------------------------------------------------
   Utility
---------------------------------------------------------- */

/**
 * Example function to produce a final image (data URL)
 * from the current distortion. This code does a special
 * render pass. Adjust as needed.
 */
function downloadImage() {
  if (!shaderMesh) return;

  // Force 100% opacity
  shaderMesh.material.uniforms.u_opacity.value = 1;

  // Create a new scene for capturing
  const captureScene = new THREE.Scene();
  const captureMesh = shaderMesh.clone();
  captureMesh.rotation.copy(rotationGroup.rotation);
  captureMesh.position.copy(rotationGroup.position);
  captureScene.add(captureMesh);

  // Rebuild a camera that matches our current camera’s position/zoom
  const captureCamera = camera.clone();
  // Or, if you want a fresh camera:
  // const cameraHeight = 700;
  // const halfCameraHeight = cameraHeight / 2;
  // const halfCameraWidth = halfCameraHeight * finalRendererAspectRatio;
  // const captureCamera = new THREE.OrthographicCamera(
  //   -halfCameraWidth,
  //   halfCameraWidth,
  //   halfCameraHeight,
  //   -halfCameraHeight,
  //   -1000,
  //   1000
  // );
  // captureCamera.position.set(0, 0, 5);

  // Create separate renderer for capture
  const captureRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: true,
  });
  captureRenderer.setSize(800, 800 / finalRendererAspectRatio);

  // Render
  captureRenderer.render(captureScene, captureCamera);

  // Obtain dataURL
  const dataURL = captureRenderer.domElement.toDataURL("image/png");

  // Cleanup
  captureMesh.geometry.dispose();
  captureMesh.material.dispose();
  captureScene.remove(captureMesh);
  captureRenderer.dispose();

  // Return or do something with dataURL
  console.log("Final image data URL length:", dataURL.length);
  return dataURL;
}

/**
 * Example teardown logic if you want to remove everything.
 */
function disposeAll() {
  // remove event listeners from orbitControls
  if (orbitControls && orbitControls._keyHandlers) {
    window.removeEventListener("keydown", orbitControls._keyHandlers.down);
    window.removeEventListener("keyup", orbitControls._keyHandlers.up);
    orbitControls.dispose();
  }

  // Dispose geometries/materials
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (obj.material.map) obj.material.map.dispose();
      obj.material.dispose();
    }
  });

  renderer.dispose();
  scene.clear();

  console.log("Disposed of Three.js scene and renderer");
}

// Optionally export some functions if you want to call them externally
// e.g. from your HTML:
//   <button onclick="downloadImage()">Download</button>
// window.downloadImage = downloadImage;
// window.disposeAll = disposeAll;
