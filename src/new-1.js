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

// Re-enabling this function as it's needed by loadSVG
// Re-enabling this function as it's needed by loadSVG
function createThickLineFromPoints(points, thickness = 5.0) {
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

    if (distance < 0.5) continue; // Skip very short segments

    try {
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
      segmentShape.moveTo(
        pointA.x + perpendicular.x,
        pointA.y + perpendicular.y
      );
      segmentShape.lineTo(
        pointB.x + perpendicular.x,
        pointB.y + perpendicular.y
      );
      segmentShape.lineTo(
        pointB.x - perpendicular.x,
        pointB.y - perpendicular.y
      );
      segmentShape.lineTo(
        pointA.x - perpendicular.x,
        pointA.y - perpendicular.y
      );
      segmentShape.closePath();

      lineShapes.push(segmentShape);
    } catch (error) {
      // Skip this segment if there's an error
      console.warn("Error creating thick line segment:", error);
    }
  }

  return lineShapes;
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
  loadSVG("../assets/map-2.svg");

  // Start animation loop
  animate();
}

// Initialize the application
init();

// Helper function to calculate shape area
function calculateShapeArea(shape) {
  if (!shape || !shape.getPoints) return 0;

  let area = 0;
  const points = shape.getPoints(100);

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    area += points[j].x * points[i].y;
    area -= points[i].x * points[j].y;
  }

  return Math.abs(area) / 2;
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

// This function processes the SVG to create an extruded 3D model
function loadSVG(url) {
  console.log("Loading SVG from:", url);

  // Create a new rotation group to hold the SVG
  rotationGroup = new THREE.Group();
  scene.add(rotationGroup);

  loader.load(
    url,
    function (data) {
      console.log("SVG loaded successfully");

      // Create SVG group to hold all meshes
      svgGroup = new THREE.Group();

      // Red material for what was originally transparent in the SVG
      const redMaterial = new THREE.MeshPhongMaterial({
        color: 0xff0000, // Red color
        side: THREE.DoubleSide,
        shininess: 30,
        flatShading: false,
      });

      // Material for "cutout" areas - fully transparent
      const cutoutMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
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

      // Simplified extrusion settings for cutouts (no bevel)
      const cutoutExtrudeSettings = {
        depth: extrudeSettings.depth + 1, // Slightly deeper to avoid z-fighting
        bevelEnabled: false,
      };

      // Track if we successfully added any valid objects
      let addedValidObject = false;

      // Step 1: First, we need to create the SVG directly from the content we have
      console.log("Processing SVG paths, count:", data.paths.length);

      // Step 1: Find the outer boundary (the circle)
      let outerShape = null;
      let maxArea = 0;

      for (let pathIndex = 0; pathIndex < data.paths.length; pathIndex++) {
        const path = data.paths[pathIndex];

        try {
          // Skip paths with no width or height
          if (!path.getBoundingBox) {
            console.log("Path has no getBoundingBox method, skipping");
            continue;
          }

          const bbox = path.getBoundingBox();
          if (bbox.max.x - bbox.min.x < 1 || bbox.max.y - bbox.min.y < 1) {
            console.log("Path too small, skipping");
            continue;
          }

          const pathShapes = path.toShapes(true);
          console.log(
            `Path ${pathIndex} has ${pathShapes ? pathShapes.length : 0} shapes`
          );

          if (pathShapes && pathShapes.length > 0) {
            // Process each shape in this path
            for (
              let shapeIndex = 0;
              shapeIndex < pathShapes.length;
              shapeIndex++
            ) {
              const shape = pathShapes[shapeIndex];

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

              console.log(`Shape ${pathIndex}-${shapeIndex} area: ${area}`);

              if (area > maxArea) {
                maxArea = area;
                outerShape = shape;
                console.log("New max area shape found:", maxArea);
              }
            }
          }
        } catch (error) {
          console.warn(
            `Error processing path ${pathIndex} for outer shape:`,
            error
          );
        }
      }

      // If we found the outer shape, start with it as a solid red circle
      if (outerShape) {
        console.log("Creating base shape with area:", maxArea);

        // Create a base red circle
        const baseGeometry = new THREE.ExtrudeGeometry(
          outerShape,
          extrudeSettings
        );
        const baseMesh = new THREE.Mesh(baseGeometry, redMaterial);
        baseMesh.scale.y = -1; // Flip to match SVG orientation
        svgGroup.add(baseMesh);
        addedValidObject = true;

        // Step 2: Process all interior shapes and paths
        // We'll use a completely different approach - instead of trying to identify shapes,
        // we'll create a collection of all the filled and stroked areas in the SVG

        // First, prepare a custom data structure to track shapes already processed
        const processedAreas = new Set();

        // Process filled shapes first (these are the main cutout areas)
        for (let pathIndex = 0; pathIndex < data.paths.length; pathIndex++) {
          const path = data.paths[pathIndex];

          // Skip the outer boundary we already processed
          if (path === data.paths[0] && pathIndex === 0) continue;

          try {
            // For each path, create shapes
            const pathShapes = path.toShapes(true);
            if (pathShapes && pathShapes.length > 0) {
              for (
                let shapeIndex = 0;
                shapeIndex < pathShapes.length;
                shapeIndex++
              ) {
                const shape = pathShapes[shapeIndex];

                // Skip tiny shapes that might be artifacts
                const area = calculateShapeArea(shape);
                if (area < 1) {
                  console.log(
                    `Shape ${pathIndex}-${shapeIndex} too small, area: ${area}`
                  );
                  continue;
                }

                // Skip shapes too similar to the outer boundary
                if (area > maxArea * 0.9) {
                  console.log(
                    `Shape ${pathIndex}-${shapeIndex} too similar to outer, area: ${area}`
                  );
                  continue;
                }

                // Create a unique identifier for this shape
                const shapeId = `${pathIndex}-${shapeIndex}`;
                if (processedAreas.has(shapeId)) {
                  console.log(`Shape ${shapeId} already processed, skipping`);
                  continue;
                }
                processedAreas.add(shapeId);

                console.log(
                  `Processing interior shape ${shapeId}, area: ${area}`
                );

                // Create cutout for this shape
                try {
                  const shapeGeometry = new THREE.ExtrudeGeometry(
                    shape,
                    cutoutExtrudeSettings
                  );
                  const shapeMesh = new THREE.Mesh(
                    shapeGeometry,
                    cutoutMaterial
                  );
                  shapeMesh.scale.y = -1; // Flip to match SVG orientation
                  shapeMesh.position.z = 0.1; // Move slightly forward
                  svgGroup.add(shapeMesh);
                } catch (error) {
                  console.warn(`Error creating shape mesh ${shapeId}:`, error);
                }
              }
            }
          } catch (error) {
            console.warn(
              `Error processing filled shapes for path ${pathIndex}:`,
              error
            );
          }
        }

        // Step 3: Process all stroked paths to ensure thin lines are captured
        // Extract all stroked paths even if they weren't captured as shapes
        for (let pathIndex = 0; pathIndex < data.paths.length; pathIndex++) {
          const path = data.paths[pathIndex];

          try {
            // Extract all subpaths (the drawing commands)
            const subpaths = path.subPaths;
            if (!subpaths || subpaths.length === 0) {
              console.log(`Path ${pathIndex} has no subpaths`);
              continue;
            }

            console.log(`Path ${pathIndex} has ${subpaths.length} subpaths`);

            for (
              let subpathIndex = 0;
              subpathIndex < subpaths.length;
              subpathIndex++
            ) {
              const subpath = subpaths[subpathIndex];

              if (!subpath.curves || subpath.curves.length === 0) {
                console.log(
                  `Subpath ${pathIndex}-${subpathIndex} has no curves`
                );
                continue;
              }

              // Create a unique identifier for this subpath
              const subpathId = `stroke-${pathIndex}-${subpathIndex}`;
              if (processedAreas.has(subpathId)) {
                console.log(`Subpath ${subpathId} already processed, skipping`);
                continue;
              }
              processedAreas.add(subpathId);

              console.log(
                `Processing subpath ${subpathId} with ${subpath.curves.length} curves`
              );

              // Extract points from this subpath
              let points = [];

              // Start with the first point
              const startPoint = subpath.currentPoint;
              if (startPoint && !isNaN(startPoint.x) && !isNaN(startPoint.y)) {
                points.push(new THREE.Vector2(startPoint.x, startPoint.y));

                // Add points from all curves
                for (
                  let curveIndex = 0;
                  curveIndex < subpath.curves.length;
                  curveIndex++
                ) {
                  const curve = subpath.curves[curveIndex];
                  if (!curve) continue;

                  if (curve.type === "LineCurve") {
                    // For line curves, just add the end point
                    const endPoint = curve.v2;
                    if (endPoint && !isNaN(endPoint.x) && !isNaN(endPoint.y)) {
                      points.push(new THREE.Vector2(endPoint.x, endPoint.y));
                    }
                  } else {
                    // For other curve types (like bezier), sample points along the curve
                    const divisions = 10; // More divisions for smoother curves
                    for (let i = 1; i <= divisions; i++) {
                      const t = i / divisions;
                      try {
                        const pt = curve.getPoint(t);
                        if (pt && !isNaN(pt.x) && !isNaN(pt.y)) {
                          points.push(new THREE.Vector2(pt.x, pt.y));
                        }
                      } catch (error) {
                        // Skip invalid points
                        console.warn(
                          `Error getting point at t=${t} for curve ${curveIndex}:`,
                          error
                        );
                      }
                    }
                  }
                }

                // Create thick lines from the extracted points if we have enough points
                if (points.length > 1) {
                  console.log(
                    `Creating thick lines for ${points.length} points`
                  );
                  const thickLines = createThickLineFromPoints(points, 5.0); // Extra thick to ensure coverage

                  if (thickLines && thickLines.length > 0) {
                    console.log(
                      `Created ${thickLines.length} thick line segments`
                    );

                    for (
                      let lineIndex = 0;
                      lineIndex < thickLines.length;
                      lineIndex++
                    ) {
                      const lineShape = thickLines[lineIndex];

                      try {
                        if (hasValidPoints(lineShape.getPoints())) {
                          const lineGeometry = new THREE.ExtrudeGeometry(
                            lineShape,
                            cutoutExtrudeSettings
                          );

                          const lineMesh = new THREE.Mesh(
                            lineGeometry,
                            cutoutMaterial
                          );
                          lineMesh.scale.y = -1; // Flip to match SVG orientation
                          lineMesh.position.z = 0.2; // Move slightly more forward than shape cutouts
                          svgGroup.add(lineMesh);
                        }
                      } catch (error) {
                        console.warn(
                          `Error creating line mesh ${subpathId}-${lineIndex}:`,
                          error
                        );
                      }
                    }
                  } else {
                    console.log(
                      `Failed to create thick lines for ${points.length} points`
                    );
                  }
                } else {
                  console.log(
                    `Not enough points (${points.length}) to create thick lines`
                  );
                }
              } else {
                console.log(`Invalid start point for subpath ${subpathId}`);
              }
            }
          } catch (error) {
            console.warn(
              `Error processing stroked paths for path ${pathIndex}:`,
              error
            );
          }
        }
      } else {
        console.error("No outer shape found, cannot proceed");
      }

      if (addedValidObject) {
        // Add to rotation group
        console.log("Adding SVG group to rotation group");
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
      // Apply color only to meshes that aren't cutouts (transparent)
      svgGroup.traverse((child) => {
        if (child.isMesh && child.material && !child.material.transparent) {
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

  const depthInput = document.getElementById("depth");
  if (depthInput) {
    depthInput.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("depth-value").textContent = value;

      // Update extrusion depth by scaling in Z
      svgGroup.traverse((child) => {
        if (child.isMesh) {
          child.scale.z = value / 20; // Relative to original 20 depth
        }
      });
    });
  }

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

  const shininessInput = document.getElementById("shininess");
  if (shininessInput) {
    shininessInput.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("shininess-value").textContent = value;

      svgGroup.traverse((child) => {
        if (child.isMesh && child.material && !child.material.transparent) {
          child.material.shininess = value;
        }
      });
    });
  }

  const metalnessInput = document.getElementById("metalness");
  if (metalnessInput) {
    metalnessInput.addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("metalness-value").textContent = value;

      // Switch to Standard material if metalness is used
      if (value > 0) {
        svgGroup.traverse((child) => {
          if (child.isMesh && child.material && !child.material.transparent) {
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
  }

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
