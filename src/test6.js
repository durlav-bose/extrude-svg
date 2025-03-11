import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 200;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
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

// SVG Loader
const loader = new SVGLoader();

// Helper function to check if points array has valid values
function hasValidPoints(points) {
  if (!points || points.length === 0) return false;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (isNaN(point.x) || isNaN(point.y)) {
      return false;
    }
  }
  return true;
}

// Helper function to check if a geometry has NaN values
function hasNaN(geometry) {
  const position = geometry.getAttribute("position");
  if (!position) return true;

  const array = position.array;
  for (let i = 0; i < array.length; i++) {
    if (isNaN(array[i])) {
      return true;
    }
  }
  return false;
}

// Load the SVG file from the assets folder
loader.load(
  "../assets/map-test-2.svg",
  function (data) {
    // Group to hold all our meshes
    const svgGroup = new THREE.Group();

    // Materials - INVERTED as requested
    // Transparent material for the shapes
    const extrudeMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });

    // Yellow material for the lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffd700, // Gold/yellow color
      linewidth: 2,
    });

    // Extrusion settings
    const extrudeSettings = {
      steps: 1,
      depth: 10,
      bevelEnabled: true,
      bevelThickness: 2,
      bevelSize: 1,
      bevelOffset: 0,
      bevelSegments: 3,
    };

    // Create a group for the lines
    const lineGroup = new THREE.Group();
    const shapesGroup = new THREE.Group(); // Separate group for shapes

    // Track if we successfully added any valid objects
    let addedValidObject = false;

    // Process all paths first as lines (more reliable)
    data.paths.forEach((path, pathIndex) => {
      // Extract points from the path
      for (let i = 0; i < path.subPaths.length; i++) {
        const subPath = path.subPaths[i];
        const subPathPoints = subPath.getPoints();

        if (!hasValidPoints(subPathPoints)) {
          console.warn(`Skipping invalid subpath ${i} in path ${pathIndex}`);
          continue;
        }

        const points = [];
        for (let j = 0; j < subPathPoints.length; j++) {
          const point = subPathPoints[j];
          points.push(new THREE.Vector3(point.x, -point.y, 0));
        }

        // Create a line from the points (yellow lines)
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        lineGroup.add(line);
        addedValidObject = true;
      }
    });

    svgGroup.add(lineGroup);

    // Now try to create extruded geometries from closed paths (transparent)
    data.paths.forEach((path, pathIndex) => {
      try {
        // Try to convert the path to shapes
        const shapes = path.toShapes(true);

        if (!shapes || shapes.length === 0) {
          console.warn(`No valid shapes in path ${pathIndex}`);
          return;
        }

        // Process each shape
        shapes.forEach((shape, shapeIndex) => {
          try {
            // Check if shape has valid points
            if (!shape || !shape.curves || shape.curves.length === 0) {
              console.warn(
                `Shape ${shapeIndex} in path ${pathIndex} has no valid curves`
              );
              return;
            }

            // Create geometry with extrusion
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

            // Check if the geometry has NaN values
            if (hasNaN(geometry)) {
              console.warn(
                `Skipping shape ${shapeIndex} in path ${pathIndex} due to NaN values`
              );
              return;
            }

            // Create mesh with geometry and transparent material
            const mesh = new THREE.Mesh(geometry, extrudeMaterial);

            // Flip the mesh to correct the SVG orientation
            mesh.scale.y = -1;

            // Add mesh to the shapes group
            shapesGroup.add(mesh);
            addedValidObject = true;
          } catch (error) {
            console.warn(
              `Error creating extrusion for shape ${shapeIndex} in path ${pathIndex}:`,
              error
            );
          }
        });
      } catch (error) {
        console.warn(`Error converting path ${pathIndex} to shapes:`, error);
      }
    });

    // Add shapes group to main group
    svgGroup.add(shapesGroup);

    // Only try to add and center the group if we have at least one valid object
    if (addedValidObject) {
      try {
        // Add to scene first
        scene.add(svgGroup);

        // Try to compute the bounding box
        const box = new THREE.Box3();

        // Use a safer method to compute the bounding box
        svgGroup.traverse(function (child) {
          if (child.isMesh || child.isLine) {
            child.geometry.computeBoundingBox();
            const childBox = child.geometry.boundingBox;

            // Only use this child's bounding box if it's valid
            if (
              childBox &&
              !isNaN(childBox.min.x) &&
              !isNaN(childBox.min.y) &&
              !isNaN(childBox.min.z) &&
              !isNaN(childBox.max.x) &&
              !isNaN(childBox.max.y) &&
              !isNaN(childBox.max.z)
            ) {
              // Transform the bounding box by the child's world matrix
              childBox.applyMatrix4(child.matrixWorld);
              box.union(childBox);
            }
          }
        });

        // Center the group if we have a valid bounding box
        if (box.min.x !== Infinity) {
          const center = box.getCenter(new THREE.Vector3());
          svgGroup.position.sub(center);

          // Scale to fit viewport better
          const boxSize = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
          if (maxDim > 0 && !isNaN(maxDim)) {
            const scale = 100 / maxDim;
            svgGroup.scale.set(scale, scale, scale);
          }
        } else {
          console.warn(
            "Could not compute a valid bounding box for the SVG group"
          );
        }
      } catch (error) {
        console.error("Error processing SVG group:", error);
      }
    } else {
      console.warn("No valid objects were created from the SVG");
    }

    // Add toggle buttons for both lines and shapes
    const linesToggleButton = document.createElement("button");
    linesToggleButton.textContent = "Toggle Lines";
    linesToggleButton.style.position = "absolute";
    linesToggleButton.style.top = "10px";
    linesToggleButton.style.left = "10px";
    linesToggleButton.style.padding = "10px";
    linesToggleButton.style.zIndex = "100";
    document.body.appendChild(linesToggleButton);

    const shapesToggleButton = document.createElement("button");
    shapesToggleButton.textContent = "Toggle Shapes";
    shapesToggleButton.style.position = "absolute";
    shapesToggleButton.style.top = "10px";
    shapesToggleButton.style.left = "120px";
    shapesToggleButton.style.padding = "10px";
    shapesToggleButton.style.zIndex = "100";
    document.body.appendChild(shapesToggleButton);

    linesToggleButton.addEventListener("click", () => {
      lineGroup.visible = !lineGroup.visible;
    });

    shapesToggleButton.addEventListener("click", () => {
      shapesGroup.visible = !shapesGroup.visible;
    });
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

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

// Handle window resizing
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
