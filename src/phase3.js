// Add a global variable to store handle state if handles aren't created yet
let pendingHandlesState = null;
window.preserveCurrentPosition = false;

let anchorPoint = { x: 0.5, y: 0.5 }; // Default center (normalized 0-1 coordinates)
let anchorMarker; // Visual indicator for anchor point
let useAnchorPointForScaling = true; // Enable/disable anchor-based scaling
let initialGroupPosition = new THREE.Vector3();

let outputWidth = 1000;
let outputHeight = 1000;
let threeColor = null;
let backgroundColor = null;
// Scene setup
const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x111111);

let initialSvgSize = null; // Store the initial unscaled size
let currentScale = 1.0;

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
  if (!rotationGroup || !svgGroup) return;

  // 1. Get world position of anchor BEFORE scaling
  const worldAnchor = getAnchorWorldPosition();

  // 2. Apply scale
  rotationGroup.scale.multiplyScalar(scaleFactor);
  currentScale *= scaleFactor;

  // 3. Get new world position AFTER scaling
  const newWorldAnchor = getAnchorWorldPosition();

  // 4. Calculate adjustment needed
  const adjustment = new THREE.Vector3().subVectors(
    worldAnchor,
    newWorldAnchor
  );

  // 5. Apply adjustment to maintain anchor position
  rotationGroup.position.add(adjustment);

  // 6. Update visual marker
  updateAnchorMarkerPosition();
}

function updateAnchorMarkerPosition() {
  if (!anchorMarker || !svgGroup || !rotationGroup) return;

  // Get the current anchor position in local SVG space
  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const size = bbox.getSize(new THREE.Vector3());

  // Calculate the position
  const position = new THREE.Vector3(
    bbox.min.x + size.x * anchorPoint.x,
    bbox.min.y + size.y * anchorPoint.y,
    0
  );

  // Set the marker position
  anchorMarker.position.copy(position);
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
        if (viewState.rendering.backgroundColor) {
          backgroundColor = viewState.rendering.backgroundColor;
          scene.background = new THREE.Color(
            viewState.rendering.backgroundColor
          );
        }
      }
    } catch (error) {
      console.error("Error parsing saved state:", error);
      viewState = null;
    }
  }

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
                viewState &&
                viewState.rendering &&
                viewState.rendering.modelColor
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
                metalness: 0.8,
                roughness: 0.2,
              });
            } catch (e) {
              console.warn(
                `Couldn't parse fill color ${fillColor}, using default`
              );
              fillMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ff00,
                side: THREE.DoubleSide,
                flatShading: false,
                metalness: 0.8,
                roughness: 0.2,
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
                    depth: 10,
                    bevelEnabled: true,
                    bevelThickness: 0.3,
                    bevelSize: 0.3,
                    bevelOffset: 0,
                    bevelSegments: 5,
                    curveSegments: 24,
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
                  viewState &&
                  viewState.rendering &&
                  viewState.rendering.modelColor
                    ? threeColor
                    : new THREE.Color(strokeColor);

                strokeMaterial = new THREE.MeshStandardMaterial({
                  color: color,
                  side: THREE.DoubleSide,
                  flatShading: false,
                  transparent: strokeOpacity !== undefined && strokeOpacity < 1,
                  opacity:
                    strokeOpacity !== undefined ? parseFloat(strokeOpacity) : 1,
                  metalness: 0.8,
                  roughness: 0.2,
                });
              } catch (e) {
                console.warn(
                  `Couldn't parse stroke color ${strokeColor}, using default`
                );
                strokeMaterial = new THREE.MeshStandardMaterial({
                  color: 0x444444,
                  side: THREE.DoubleSide,
                  flatShading: false,
                  metalness: 0.8,
                  roughness: 0.2,
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
                      depth: 10,
                      bevelEnabled: true,
                      bevelThickness: 0.3,
                      bevelSize: 0.3,
                      bevelOffset: 0,
                      bevelSegments: 5,
                      curveSegments: 24,
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
            if (!viewState) {
              // Center the SVG at local origin only if there's no saved state
              const center = box.getCenter(new THREE.Vector3());
              svgGroup.position.sub(center);
            }
          }
        } catch (error) {
          console.error("Error processing SVG group:", error);
        }

        if (!initialSvgSize && svgGroup) {
          const initialBbox = new THREE.Box3().setFromObject(svgGroup);
          initialSvgSize = initialBbox.getSize(new THREE.Vector3());
          console.log("Initial SVG size stored:", initialSvgSize);
        }

        // Now that SVG is processed, setup the handles
        setupHandles(viewState);

        if (viewState?.handles?.anchorWorldPosition) {
          // Capture the anchor position before any other transformations
          const currentAnchorPos = getAnchorWorldPosition();
          const desiredAnchorPos = new THREE.Vector3(
            viewState.handles.anchorWorldPosition.x,
            viewState.handles.anchorWorldPosition.y,
            viewState.handles.anchorWorldPosition.z
          );

          // Calculate offset needed to position correctly
          const offset = new THREE.Vector3().subVectors(
            desiredAnchorPos,
            currentAnchorPos
          );

          // Apply the offset to the rotation group
          rotationGroup.position.add(offset);
        }

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

            if (viewState.model.scale) {
              rotationGroup.scale.set(
                viewState.model.scale.x,
                viewState.model.scale.y,
                viewState.model.scale.z
              );
            }
          }

          console.log(
            "rotationGroup.position 1 ----- ",
            rotationGroup.position
          );
          console.log(
            "rotationGroup.rotation 1 ----- ",
            rotationGroup.rotation
          );
          console.log("rotationGroup.scale 1 ----- ", rotationGroup.scale);

          // Apply handle state
          if (viewState.handles) {
            applyHandlesState(viewState.handles);
          }
        }

        // Reset the preserve flag after use
        window.preserveCurrentPosition = false;

        if (viewState?.handles?.anchorWorldPosition) {
          // Final adjustment to ensure the anchor position is correct
          const finalCurrentAnchorPos = getAnchorWorldPosition();
          const finalDesiredAnchorPos = new THREE.Vector3(
            viewState.handles.anchorWorldPosition.x,
            viewState.handles.anchorWorldPosition.y,
            viewState.handles.anchorWorldPosition.z
          );

          const finalOffset = new THREE.Vector3().subVectors(
            finalDesiredAnchorPos,
            finalCurrentAnchorPos
          );

          rotationGroup.position.add(finalOffset);
          console.log("Final anchor position adjustment:", finalOffset);
        }

        console.log("SVG processing complete and state restored");
      } else {
        console.error("No valid objects found in SVG");
      }

      // Create UI Controls and update to match saved state
      createUIControls(svgGroup);

      // Release the loading lock
      isLoadingSVG = false;

      console.log("rotationGroup.position 2 ----- ", rotationGroup.position);
      console.log("rotationGroup.rotation 2 ----- ", rotationGroup.rotation);
      console.log("rotationGroup.scale 2 ----- ", rotationGroup.scale);
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

function setupHandles(viewState) {
  // Delete existing handles if they exist
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

  // Calculate bounding box of SVG
  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const svgSize = bbox.getSize(new THREE.Vector3());
  const svgWidth = svgSize.x;
  const svgHeight = svgSize.y;

  if (!pendingHandlesState && !viewState) {
    // Get center position in world coordinates
    const svgCenter = bbox.getCenter(new THREE.Vector3());
    svgGroup.position.sub(svgCenter);

    // Position the rotation group at the center of the viewport
    rotationGroup.position.set(0, 0, 0);
  } else {
    // If we have a saved state, still center the SVG within itself
    // but don't reset the rotation group position
    const svgCenter = bbox.getCenter(new THREE.Vector3());
    svgGroup.position.sub(svgCenter);
  }

  // Create movement handle and add to scene (not to rotation group)
  movementHandle = createMovementHandle();
  scene.add(movementHandle);

  // Initial position at the same position as rotation group center
  movementHandle.position.copy(rotationGroup.position);
  movementHandle.position.z = 5; // Slightly in front

  // Create rotation handle - add it directly to the scene
  rotationHandle = createRotationHandle();
  scene.add(rotationHandle);

  // Position rotation handle at the edge of the SVG
  const handleOffset = {
    x: svgWidth / 2 + 20,
    y: svgHeight / 2 + 20,
  };

  // Calculate rotation handle position in world space
  const rotHandlePos = new THREE.Vector3(handleOffset.x, handleOffset.y, 5);
  // Apply rotation group's transform to get world position
  rotHandlePos.applyMatrix4(rotationGroup.matrixWorld);
  rotationHandle.position.copy(rotHandlePos);

  // Create and add anchor marker
  if (!anchorMarker) {
    anchorMarker = createAnchorMarker();
  }

  // Remove from scene if it exists
  if (anchorMarker.parent) {
    anchorMarker.parent.remove(anchorMarker);
  }

  // Add to rotation group
  rotationGroup.add(anchorMarker);

  // Update position
  updateAnchorMarkerPosition();

  // Restore from saved state if available
  if (pendingHandlesState && pendingHandlesState.anchorPoint) {
    setAnchorPoint(
      pendingHandlesState.anchorPoint.x,
      pendingHandlesState.anchorPoint.y
    );
  }

  // Setup drag controls for movement handle
  const movementControls = new THREE.DragControls(
    [movementHandle],
    camera,
    renderer.domElement
  );

  movementControls.addEventListener("dragstart", (event) => {
    controls.enabled = false;
  });

  movementControls.addEventListener("drag", (event) => {
    // Simply make the rotation group follow the movement handle
    rotationGroup.position.x = event.object.position.x;
    rotationGroup.position.y = event.object.position.y;
  });

  movementControls.addEventListener("dragend", () => {
    controls.enabled = true;
  });

  const rotationControls = setupRotationControls(rotationHandle);

  if (pendingHandlesState) {
    applyHandlesState(pendingHandlesState);
    pendingHandlesState = null;
  }
}

function setupRotationControls(rotationHandle) {
  const rotationControls = new THREE.DragControls(
    [rotationHandle],
    camera,
    renderer.domElement
  );

  // Keep track of initial positions and angles
  let initialAngle = 0;
  let initialHandlePos = new THREE.Vector3();
  let worldAnchorPoint = new THREE.Vector3();

  // Add this global variable
  let fixedAnchorWorldPosition = null;

  // In your rotation controls setup
  rotationControls.addEventListener("dragstart", function (event) {
    controls.enabled = false;
    initialAngle = currentRotation;
    initialHandlePos.copy(event.object.position);

    // CRITICAL: Store world anchor position ONCE at start of rotation
    fixedAnchorWorldPosition = getAnchorWorldPosition();
    console.log("Rotation start - fixed anchor:", fixedAnchorWorldPosition);
  });

  rotationControls.addEventListener("drag", function (event) {
    // Use the STORED anchor position - don't recalculate it
    const worldAnchorPoint = fixedAnchorWorldPosition;

    // Calculate vectors from anchor to handles
    const initialVec = new THREE.Vector2(
      initialHandlePos.x - worldAnchorPoint.x,
      initialHandlePos.y - worldAnchorPoint.y
    );

    const currentVec = new THREE.Vector2(
      event.object.position.x - worldAnchorPoint.x,
      event.object.position.y - worldAnchorPoint.y
    );

    // Calculate angle change
    const dot = initialVec.dot(currentVec);
    const det = initialVec.x * currentVec.y - initialVec.y * currentVec.x;
    const angleChange = Math.atan2(det, dot);
    const newRotation = initialAngle + angleChange;

    // Apply rotation
    rotationGroup.rotation.z = newRotation;
    currentRotation = newRotation;

    // Get current anchor world position after rotation
    const newAnchorWorldPos = getAnchorWorldPosition();

    // Calculate and apply adjustment to maintain fixed anchor position
    const adjustment = new THREE.Vector3().subVectors(
      worldAnchorPoint,
      newAnchorWorldPos
    );

    rotationGroup.position.add(adjustment);

    // Update marker
    updateAnchorMarkerPosition();
  });

  rotationControls.addEventListener("dragend", function () {
    controls.enabled = true;
    fixedAnchorWorldPosition = null; // Clear fixed position
  });

  return rotationControls;
}

function getAnchorWorldPosition() {
  if (!svgGroup || !rotationGroup) return new THREE.Vector3();

  // Get current bbox
  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const size = bbox.getSize(new THREE.Vector3());

  // Create point in local space
  const localPos = new THREE.Vector3(
    bbox.min.x + size.x * anchorPoint.x,
    bbox.min.y + size.y * anchorPoint.y,
    0
  );

  // Convert to world space directly
  const worldPos = localPos.clone();
  svgGroup.localToWorld(worldPos);

  return worldPos;
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

  renderer.render(scene, camera);
}

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

    // Add scale information
    modelState.scale = {
      x: rotationGroup.scale.x,
      y: rotationGroup.scale.y,
      z: rotationGroup.scale.z,
    };
  }

  const anchorWorldPos = getAnchorWorldPosition(); // already exists in your code

  console.log("anchorWorldPos :>> ", anchorWorldPos);

  let anchorWorldPosition = {
    x: anchorWorldPos.x,
    y: anchorWorldPos.y,
    z: anchorWorldPos.z,
  };

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
    anchorPoint: anchorPoint,
    anchorWorldPosition: anchorWorldPosition,
  };

  // Save material and rendering properties
  const renderingState = {
    // Color
    modelColor: threeColor ? threeColor.getHex() : 0x00ff00,

    // Background
    backgroundColor: scene.background ? scene.background.getHex() : null,

    // Extrusion settings
    extrusionDepth: 10,
    bevelEnabled: true,
    curveSegments: 24,

    // Material properties
    metalness: 0.8,
    roughness: 0.2,
  };

  // Create complete view state
  const viewState = {
    camera: cameraState,
    controls: controlsState,
    model: modelState,
    handles: handlesState,
    rendering: renderingState,
  };

  // Save to localStorage
  localStorage.setItem("svgViewState", JSON.stringify(viewState));
  console.log("Complete state saved:", viewState);
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

function setupClickToSetAnchorPoint() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  renderer.domElement.addEventListener("click", function (event) {
    // Skip if no SVG exists
    if (!svgGroup || !svgGroup.children || svgGroup.children.length === 0)
      return;

    // Calculate normalized mouse position (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Cast ray
    raycaster.setFromCamera(mouse, camera);

    // Get all meshes from the SVG group
    const meshes = [];
    svgGroup.traverse((object) => {
      if (object.isMesh) meshes.push(object);
    });

    // Check for intersections with any mesh in the SVG
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point.clone();

      // Convert world intersection to svgGroup local space
      const localPoint = intersectionPoint.clone();
      svgGroup.worldToLocal(localPoint);

      // Get SVG bounds
      const bbox = new THREE.Box3().setFromObject(svgGroup);
      const size = bbox.getSize(new THREE.Vector3());

      // Calculate normalized coordinates (0-1)
      const normalizedX = (localPoint.x - bbox.min.x) / size.x;
      const normalizedY = (localPoint.y - bbox.min.y) / size.y;

      // Set the anchor point
      setAnchorPoint(normalizedX, normalizedY);
    }
  });
}

function getAnchorWorldPosition() {
  if (!svgGroup || !rotationGroup) return new THREE.Vector3();

  // Create temporary Vector3 at the normalized position in SVG local space
  const bbox = new THREE.Box3().setFromObject(svgGroup);
  const size = bbox.getSize(new THREE.Vector3());

  const localAnchor = new THREE.Vector3(
    bbox.min.x + size.x * anchorPoint.x,
    bbox.min.y + size.y * anchorPoint.y,
    0
  );

  // Clone the point and convert to world coordinates
  const worldPos = localAnchor.clone();
  svgGroup.localToWorld(worldPos);

  return worldPos;
}

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

  // Start animation loop
  animate();
}

init();
