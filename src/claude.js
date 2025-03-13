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

function takeScreenshot() {
  // Store handle visibility and hide them
  const handlesVisible = movementHandle ? movementHandle.visible : false;
  updateHandlesVisibility(false);

  // Get the original canvas dimensions to maintain aspect ratio
  const originalWidth = renderer.domElement.width;
  const originalHeight = renderer.domElement.height;

  // Create a new scene for capturing
  const captureScene = new THREE.Scene();
  captureScene.background = scene.background.clone();

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
          console.log("Processing path:", pathIndex);

          // Get style from path userData
          const pathStyle = path.userData?.style || {};
          const fillColor = pathStyle.fill;
          const fillOpacity = pathStyle.fillOpacity;
          const strokeColor = pathStyle.stroke;
          const strokeOpacity = pathStyle.strokeOpacity;
          const strokeWidth = parseFloat(pathStyle.strokeWidth) || 1;

          console.log("Path style:", {
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
          });

          // Skip paths with neither fill nor stroke
          if (
            (fillColor === "none" || !fillColor) &&
            (strokeColor === "none" || !strokeColor)
          ) {
            console.log(`Skipping path ${pathIndex} with no fill or stroke`);
            return;
          }

          // Process fill for paths that have fill
          if (fillColor && fillColor !== "none") {
            // Create fill material
            let fillMaterial;
            try {
              const color = new THREE.Color(fillColor);
              fillMaterial = new THREE.MeshPhongMaterial({
                color: color,
                side: THREE.DoubleSide,
                flatShading: true,
                transparent: fillOpacity !== undefined && fillOpacity < 1,
                opacity:
                  fillOpacity !== undefined ? parseFloat(fillOpacity) : 1,
              });
            } catch (e) {
              console.warn(
                `Couldn't parse fill color ${fillColor}, using default`
              );
              fillMaterial = new THREE.MeshPhongMaterial({
                color: 0x00ff00,
                side: THREE.DoubleSide,
                flatShading: true,
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
                strokeMaterial = new THREE.MeshPhongMaterial({
                  color: color,
                  side: THREE.DoubleSide,
                  flatShading: true,
                  transparent: strokeOpacity !== undefined && strokeOpacity < 1,
                  opacity:
                    strokeOpacity !== undefined ? parseFloat(strokeOpacity) : 1,
                });
              } catch (e) {
                console.warn(
                  `Couldn't parse stroke color ${strokeColor}, using default`
                );
                strokeMaterial = new THREE.MeshPhongMaterial({
                  color: 0x444444,
                  side: THREE.DoubleSide,
                  flatShading: true,
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

//       // Track if we successfully added any valid objects
//       let addedValidObject = false;

//       let counter = 0;

//       // Process all paths from the SVG
//       data.paths.forEach((path, pathIndex) => {
//         try {
//           counter++;
//           console.log("path :>> ", path);
//           // Get fill style from path
//           const fillColor = path.userData?.style?.fill;
//           const fillOpacity = path.userData?.style?.fillOpacity;

//           // Skip paths with 'none' fill or with fillOpacity = 0
//           if (fillColor === "none" || fillOpacity === "0") {
//             console.log(`Skipping path ${pathIndex} with no fill`);
//             return;
//           }

//           // Create material based on fill color
//           let pathMaterial;
//           if (fillColor) {
//             console.log("fillColor :>> ", fillColor);
//             // Try to parse the color from the SVG
//             try {
//               const color = new THREE.Color(fillColor);
//               pathMaterial = new THREE.MeshPhongMaterial({
//                 color: color,
//                 side: THREE.DoubleSide,
//                 flatShading: true,
//                 transparent: fillOpacity !== undefined && fillOpacity < 1,
//                 opacity:
//                   fillOpacity !== undefined ? parseFloat(fillOpacity) : 1,
//               });
//             } catch (e) {
//               // If color parsing fails, use default green
//               console.warn(
//                 `Couldn't parse color ${fillColor}, using default green`
//               );
//               pathMaterial = new THREE.MeshPhongMaterial({
//                 color: 0x00ff00,
//                 side: THREE.DoubleSide,
//                 flatShading: true,
//               });
//             }
//           } else {
//             // Default material if no fill specified
//             pathMaterial = new THREE.MeshPhongMaterial({
//               color: 0x00ff00,
//               side: THREE.DoubleSide,
//               flatShading: true,
//             });
//           }

//           // Convert path to shapes without detecting holes
//           const shapes = path.toShapes(false);

//           console.log("shapes :>> ", shapes);

//           if (!shapes || shapes.length === 0) {
//             return;
//           }

//           // Process each shape
//           shapes.forEach((shape, shapeIndex) => {
//             try {
//               if (!shape || !shape.curves || shape.curves.length === 0) {
//                 return;
//               }

//               // Extrusion settings
//               const extrudeSettings = {
//                 depth: window.customExtrusionDepth || 10,
//                 bevelEnabled: false,
//               };

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

//       console.log("counter :>> ", counter);

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

// Add a helper function to debug SVG paths
function debugSVG(url) {
  loader.load(
    url,
    function (data) {
      console.log("SVG Paths:", data.paths);

      // Log each path's style information
      data.paths.forEach((path, index) => {
        console.log(`Path ${index}:`, {
          fill: path.userData?.style?.fill,
          fillOpacity: path.userData?.style?.fillOpacity,
          stroke: path.userData?.style?.stroke,
          strokeWidth: path.userData?.style?.strokeWidth,
        });
      });
    },
    null,
    function (error) {
      console.error("Error loading SVG for debug:", error);
    }
  );
}

// Enhanced UI controls
function createUIControls(svgGroup) {
  // Remove any existing UI
  const existingUI = document.getElementById("svg-controls");
  if (existingUI) {
    existingUI.remove();
  }

  // Create container
  const container = document.createElement("div");
  container.id = "svg-controls";
  container.style.position = "absolute";
  container.style.top = "10px";
  container.style.left = "10px";
  container.style.background = "rgba(0,0,0,0.7)";
  container.style.padding = "15px";
  container.style.borderRadius = "5px";
  container.style.color = "white";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.zIndex = "1000";
  container.style.minWidth = "200px";
  document.body.appendChild(container);

  // Add color control
  const colorSection = document.createElement("div");
  colorSection.style.marginBottom = "15px";
  colorSection.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-weight:bold">Path Color:</label>
    <div style="display:flex; gap:5px; flex-wrap:wrap">
      <button class="color-btn" data-color="0x00FF00" style="background:#00FF00; width:30px; height:30px; border:1px solid #444"></button>
      <button class="color-btn" data-color="0xFF0000" style="background:#FF0000; width:30px; height:30px; border:1px solid #444"></button>
      <button class="color-btn" data-color="0x0000FF" style="background:#0000FF; width:30px; height:30px; border:1px solid #444"></button>
      <button class="color-btn" data-color="0xFFFF00" style="background:#FFFF00; width:30px; height:30px; border:1px solid #444"></button>
      <button class="color-btn" data-color="0xFF00FF" style="background:#FF00FF; width:30px; height:30px; border:1px solid #444"></button>
      <button class="color-btn" data-color="0x00FFFF" style="background:#00FFFF; width:30px; height:30px; border:1px solid #444"></button>
      <button class="color-btn" data-color="0xFFD700" style="background:#FFD700; width:30px; height:30px; border:1px solid #444"></button>
    </div>
  `;
  container.appendChild(colorSection);

  // Add extrusion depth control
  const extrusionSection = document.createElement("div");
  extrusionSection.style.marginBottom = "15px";
  extrusionSection.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-weight:bold">Extrusion Depth:</label>
    <div style="display:flex; flex-direction:column; gap:5px">
      <div style="display:flex; align-items:center; gap:10px">
        <input type="range" id="extrusion-depth" min="1" max="30" value="10" style="flex-grow:1">
        <span id="depth-value" style="min-width:25px; text-align:right">10</span>
      </div>
      <button id="apply-depth" style="padding:5px">Apply Depth</button>
    </div>
  `;
  container.appendChild(extrusionSection);

  // Add background color control
  const bgSection = document.createElement("div");
  bgSection.style.marginBottom = "15px";
  bgSection.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-weight:bold">Background:</label>
    <div style="display:flex; gap:5px; flex-wrap:wrap">
      <button class="bg-btn" data-color="0x000000" style="background:#000000; width:30px; height:30px; border:1px solid #444"></button>
      <button class="bg-btn" data-color="0x222222" style="background:#222222; width:30px; height:30px; border:1px solid #444"></button>
      <button class="bg-btn" data-color="0x444444" style="background:#444444; width:30px; height:30px; border:1px solid #444"></button>
      <button class="bg-btn" data-color="0xFFFFFF" style="background:#FFFFFF; width:30px; height:30px; border:1px solid #444"></button>
    </div>
  `;
  container.appendChild(bgSection);

  // Add handles visibility control
  const handlesSection = document.createElement("div");
  handlesSection.style.marginBottom = "15px";
  handlesSection.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-weight:bold">Manipulation:</label>
    <div>
      <button id="toggle-handles" style="width:100%; padding:5px">Toggle Handles</button>
    </div>
  `;
  container.appendChild(handlesSection);

  // Add export controls
  const exportSection = document.createElement("div");
  exportSection.style.marginBottom = "15px";
  exportSection.innerHTML = `
    <label style="display:block; margin-bottom:5px; font-weight:bold">Export:</label>
    <div style="display:flex; gap:5px">
      <button id="export-gltf" style="flex:1; padding:5px">GLTF</button>
      <button id="export-obj" style="flex:1; padding:5px">OBJ</button>
      <button id="export-stl" style="flex:1; padding:5px">STL</button>
    </div>
    <div style="margin-top:5px">
      <button id="take-screenshot" style="width:100%; padding:5px">Screenshot</button>
    </div>
  `;
  container.appendChild(exportSection);

  // Add reload button
  const reloadButton = document.createElement("button");
  reloadButton.id = "reload-svg";
  reloadButton.textContent = "Reload SVG";
  reloadButton.style.width = "100%";
  reloadButton.style.padding = "8px";
  reloadButton.style.marginTop = "5px";
  container.appendChild(reloadButton);

  // Path color buttons with fixed handling
  document.querySelectorAll(".color-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const colorHex = button.dataset.color;
      // Parse the hex color to an integer (e.g., "0xFF0000" -> 16711680)
      const colorInt = parseInt(colorHex);

      // Create a Three.js color object
      const threeColor = new THREE.Color(colorInt);

      // Apply to all mesh materials
      svgGroup.traverse((child) => {
        console.log("child :>> ", child);
        if (child.isMesh && child.material) {
          console.log("child.material :>> ", child.material);
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
              console.log("threeColor :>> ", threeColor);
              child.material.color.copy(threeColor);
              child.material.needsUpdate = true;

              console.log("child.material xxxxxx ", child.material);
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
  // Load the SVG
  loadSVG("../assets/map-test.svg");
  // Start animation loop
  animate();
}

// Initialize the application
init();
