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

// Load the SVG file from the assets folder
// loader.load(
//   "../assets/vector.svg",
//   function (data) {
//     // Group to hold all our meshes
//     const svgGroup = new THREE.Group();

//     // Materials
//     const extrudeMaterial = [
//       new THREE.MeshPhongMaterial({ color: 0xffd700, flatShading: true }), // front
//       new THREE.MeshPhongMaterial({ color: 0xffd700 }), // sides
//     ];

//     const lineMaterial = new THREE.LineBasicMaterial({
//       color: 0xffd700,
//       linewidth: 2,
//     });

//     // Extrusion settings
//     const extrudeSettings = {
//       depth: 10,
//       // bevelEnabled: false,
//     };

//     // For debugging, let's first try to render paths as lines
//     // This will help us see all paths regardless of whether they form closed shapes
//     const lineGroup = new THREE.Group();

//     data.paths.forEach((path) => {
//       const points = [];

//       // Extract points from the path
//       for (let i = 0; i < path.subPaths.length; i++) {
//         const subPath = path.subPaths[i];
//         const points = [];

//         for (let j = 0; j < subPath.getPoints().length; j++) {
//           const point = subPath.getPoints()[j];
//           points.push(new THREE.Vector3(point.x, -point.y, 0));
//         }

//         // Create a line from the points
//         const geometry = new THREE.BufferGeometry().setFromPoints(points);
//         const line = new THREE.Line(geometry, lineMaterial);
//         lineGroup.add(line);
//       }
//     });

//     svgGroup.add(lineGroup);

//     // Attempt extrusion with shapes that are properly closed
//     data.paths.forEach((path) => {
//       try {
//         const shapes = path.toShapes(true);

//         // Process each shape
//         shapes.forEach((shape) => {
//           try {
//             // Create geometry with extrusion
//             const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

//             // Create mesh with geometry and materials
//             const mesh = new THREE.Mesh(geometry, extrudeMaterial);

//             // Flip the mesh to correct the SVG orientation
//             mesh.scale.y = -1;

//             // Add mesh to group
//             svgGroup.add(mesh);
//           } catch (error) {
//             console.warn("Error creating extrusion for a shape:", error);
//           }
//         });
//       } catch (error) {
//         console.warn("Error converting path to shapes:", error);
//       }
//     });

//     // Center the group
//     const box = new THREE.Box3().setFromObject(svgGroup);
//     const center = box.getCenter(new THREE.Vector3());
//     svgGroup.position.sub(center);

//     // Add to scene
//     scene.add(svgGroup);

//     // Scale to fit viewport better
//     const boxSize = box.getSize(new THREE.Vector3());
//     const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
//     const scale = 100 / maxDim;
//     svgGroup.scale.set(scale, scale, scale);

//     // Add a toggle to switch between lines and extrusions
//     const toggleButton = document.createElement("button");
//     toggleButton.textContent = "Toggle View Mode";
//     toggleButton.style.position = "absolute";
//     toggleButton.style.top = "10px";
//     toggleButton.style.left = "10px";
//     document.body.appendChild(toggleButton);

//     let showingLines = true;
//     toggleButton.addEventListener("click", () => {
//       showingLines = !showingLines;
//       lineGroup.visible = showingLines;
//     });
//   },
//   // onProgress callback
//   function (xhr) {
//     console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
//   },
//   // onError callback
//   function (error) {
//     console.error("An error happened loading the SVG:", error);
//   }
// );

loader.load(
  "../assets/vector.svg",
  function (data) {
    // Group to hold all our meshes
    const svgGroup = new THREE.Group();

    // Create groups for fill and lines
    const fillGroup = new THREE.Group();
    const lineGroup = new THREE.Group();

    svgGroup.add(fillGroup);
    svgGroup.add(lineGroup);

    // Line thickness
    const lineThickness = 1.5;

    // Materials for fill
    const fillMaterial = new THREE.MeshPhongMaterial({
      color: 0xffd700, // Gold/yellow fill
      side: THREE.DoubleSide,
      flatShading: true,
      transparent: false,
      opacity: 1.0,
      // Ensure proper z-ordering
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    // Material for lines
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Red outline color
      side: THREE.DoubleSide,
    });

    // Extrusion settings
    const extrudeSettings = {
      depth: 10,
      bevelEnabled: false,
    };

    // IMPROVED APPROACH: First extract all paths and create a single compound shape
    // This ensures all areas are properly filled

    // Create a single big shape for the entire circle outline
    // This will serve as our base shape
    const circleRadius = findLargestCircle(data.paths);
    const baseShape = new THREE.Shape();
    baseShape.absarc(0, 0, circleRadius, 0, Math.PI * 2, false);

    // Keep track of all interior shapes (to be used as holes)
    const allSubShapes = [];

    // Process all paths to extract potential shapes
    data.paths.forEach((path) => {
      try {
        // Try to convert paths to shapes with the standard method
        const shapes = path.toShapes(true);

        if (shapes && shapes.length > 0) {
          shapes.forEach((shape) => {
            if (isCircleShape(shape, circleRadius)) {
              // Skip the outer circle, we already created it
              return;
            }
            allSubShapes.push(shape);
          });
        }
      } catch (error) {
        console.warn("Error converting path to shapes:", error);

        // Fallback: Create shapes from subpaths directly
        for (let i = 0; i < path.subPaths.length; i++) {
          const subPath = path.subPaths[i];
          const subPathPoints = subPath.getPoints();

          if (subPathPoints.length < 3) continue;

          try {
            // Create a shape from points
            const shape = new THREE.Shape();

            // Map points and flip y-axis
            shape.moveTo(subPathPoints[0].x, -subPathPoints[0].y);

            for (let j = 1; j < subPathPoints.length; j++) {
              shape.lineTo(subPathPoints[j].x, -subPathPoints[j].y);
            }

            shape.closePath();

            // Check if this is the outer circle
            if (isCircleShape(shape, circleRadius)) {
              continue;
            }

            allSubShapes.push(shape);
          } catch (error) {
            console.warn("Error creating shape from subpath:", error);
          }
        }
      }
    });

    // Create a single combined shape from base shape and interior shapes
    const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
      depth: extrudeSettings.depth,
      bevelEnabled: false,
    });

    // Create the base fill mesh
    const baseFillMesh = new THREE.Mesh(baseGeometry, fillMaterial);
    fillGroup.add(baseFillMesh);

    // Now create the line outlines for all paths
    data.paths.forEach((path) => {
      for (let i = 0; i < path.subPaths.length; i++) {
        const subPath = path.subPaths[i];
        const subPathPoints = subPath.getPoints();

        if (subPathPoints.length < 2) continue;

        // Map points and flip y-axis
        const points = subPathPoints.map(
          (point) => new THREE.Vector2(point.x, -point.y)
        );

        // Create thick line shapes
        const lineShapes = createThickLineFromPoints(points, lineThickness);

        if (lineShapes && lineShapes.length > 0) {
          // Extrude each line segment
          lineShapes.forEach((lineShape) => {
            try {
              const geometry = new THREE.ExtrudeGeometry(lineShape, {
                depth: extrudeSettings.depth + 0.5, // Slightly thicker to prevent z-fighting
                bevelEnabled: false,
              });

              const lineMesh = new THREE.Mesh(geometry, lineMaterial);
              lineGroup.add(lineMesh);
            } catch (error) {
              console.warn("Error creating line extrusion:", error);
            }
          });
        }
      }
    });

    // Helper function to determine if a shape is the outer circle
    function isCircleShape(shape, radius, tolerance = 5) {
      // Simple check based on area approximation
      const area = calculateShapeArea(shape);
      const expectedArea = Math.PI * radius * radius;

      return Math.abs(area - expectedArea) < expectedArea * (tolerance / 100);
    }

    // Helper function to calculate shape area (approximate)
    function calculateShapeArea(shape) {
      let area = 0;

      if (!shape.curves || shape.curves.length === 0) {
        return 0;
      }

      // Get points approximation
      const points = shape.getPoints(32);

      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
      }

      return Math.abs(area) / 2;
    }

    // Helper function to find the largest circle in the SVG
    function findLargestCircle(paths) {
      let maxRadius = 0;
      let center = { x: 0, y: 0 };

      // Find bounding box of all paths
      let minX = Infinity,
        minY = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity;

      paths.forEach((path) => {
        path.subPaths.forEach((subPath) => {
          const points = subPath.getPoints();

          points.forEach((point) => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          });
        });
      });

      // Estimate center and radius
      center.x = (minX + maxX) / 2;
      center.y = (minY + maxY) / 2;

      // Calculate max distance from center to any point
      paths.forEach((path) => {
        path.subPaths.forEach((subPath) => {
          const points = subPath.getPoints();

          points.forEach((point) => {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            maxRadius = Math.max(maxRadius, distance);
          });
        });
      });

      // Add a small buffer
      return maxRadius * 1.05;
    }

    // Helper function to create thick lines
    function createThickLineFromPoints(points, thickness = 1.5) {
      if (points.length < 2) return null;

      const lineShapes = [];

      for (let i = 0; i < points.length - 1; i++) {
        const pointA = points[i];
        const pointB = points[i + 1];

        // Skip invalid points
        if (
          isNaN(pointA.x) ||
          isNaN(pointA.y) ||
          isNaN(pointB.x) ||
          isNaN(pointB.y)
        ) {
          continue;
        }

        // Calculate direction and perpendicular vector
        const direction = new THREE.Vector2()
          .subVectors(
            new THREE.Vector2(pointB.x, pointB.y),
            new THREE.Vector2(pointA.x, pointA.y)
          )
          .normalize();

        const perpendicular = new THREE.Vector2(
          -direction.y,
          direction.x
        ).multiplyScalar(thickness / 2);

        // Create a rectangle shape for this line segment
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
      }

      return lineShapes;
    }

    // Center the group
    const box = new THREE.Box3().setFromObject(svgGroup);
    const center = box.getCenter(new THREE.Vector3());
    svgGroup.position.sub(center);

    // Scale to fit viewport better
    const boxSize = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
    const scale = 100 / maxDim;
    svgGroup.scale.set(scale, scale, scale);

    // Add to scene
    scene.add(svgGroup);

    // Add UI controls
    const controlsContainer = document.createElement("div");
    controlsContainer.style.position = "absolute";
    controlsContainer.style.top = "10px";
    controlsContainer.style.left = "10px";
    controlsContainer.style.background = "rgba(0,0,0,0.7)";
    controlsContainer.style.padding = "10px";
    controlsContainer.style.borderRadius = "5px";
    controlsContainer.style.color = "white";
    document.body.appendChild(controlsContainer);

    // Toggle visibility buttons
    const fillToggle = document.createElement("button");
    fillToggle.textContent = "Toggle Fill";
    fillToggle.style.marginRight = "10px";
    fillToggle.style.padding = "5px 10px";
    fillToggle.addEventListener("click", () => {
      fillGroup.visible = !fillGroup.visible;
    });

    const lineToggle = document.createElement("button");
    lineToggle.textContent = "Toggle Outline";
    lineToggle.style.padding = "5px 10px";
    lineToggle.addEventListener("click", () => {
      lineGroup.visible = !lineGroup.visible;
    });

    controlsContainer.appendChild(document.createTextNode("Visibility: "));
    controlsContainer.appendChild(fillToggle);
    controlsContainer.appendChild(lineToggle);

    // Color pickers
    controlsContainer.appendChild(document.createElement("br"));
    controlsContainer.appendChild(document.createElement("br"));

    // Fill color options
    controlsContainer.appendChild(document.createTextNode("Fill Color: "));

    const fillColors = [
      { name: "Yellow", hex: "#ffd700", value: 0xffd700 },
      { name: "Red", hex: "#ff0000", value: 0xff0000 },
      { name: "Green", hex: "#00ff00", value: 0x00ff00 },
      { name: "Blue", hex: "#0000ff", value: 0x0000ff },
    ];

    fillColors.forEach((color) => {
      const button = document.createElement("button");
      button.style.backgroundColor = color.hex;
      button.style.width = "24px";
      button.style.height = "24px";
      button.style.margin = "0 5px";
      button.style.border = "1px solid white";
      button.addEventListener("click", () => {
        fillMaterial.color.set(color.value);
      });
      controlsContainer.appendChild(button);
    });

    // Line color options
    controlsContainer.appendChild(document.createElement("br"));
    controlsContainer.appendChild(document.createElement("br"));
    controlsContainer.appendChild(document.createTextNode("Line Color: "));

    const lineColors = [
      { name: "Red", hex: "#ff0000", value: 0xff0000 },
      { name: "Yellow", hex: "#ffd700", value: 0xffd700 },
      { name: "Black", hex: "#000000", value: 0x000000 },
      { name: "White", hex: "#ffffff", value: 0xffffff },
    ];

    lineColors.forEach((color) => {
      const button = document.createElement("button");
      button.style.backgroundColor = color.hex;
      button.style.width = "24px";
      button.style.height = "24px";
      button.style.margin = "0 5px";
      button.style.border = "1px solid white";
      button.addEventListener("click", () => {
        lineMaterial.color.set(color.value);
      });
      controlsContainer.appendChild(button);
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
