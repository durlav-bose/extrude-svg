import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";

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

// Alternative approach to create thicker lines using extruded geometry
function createThickLineFromPoints(points, thickness = 1.5) {
  if (points.length < 2) return null;

  // Create a shape for the line
  const shape = new THREE.Shape();

  // Start with an empty array of shapes
  const lineShapes = [];

  // Process each segment of the line
  for (let i = 0; i < points.length - 1; i++) {
    const pointA = points[i];
    const pointB = points[i + 1];

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

    // Calculate the four corners of this segment
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

// Global reference to the SVG group
let svgGroup;

// Load the SVG file from the assets folder
loader.load(
  "../assets/vector.svg",
  function (data) {
    // Group to hold all our meshes
    svgGroup = new THREE.Group();

    // Line thickness
    const lineThickness = 1.5; // Adjust this for thicker/thinner lines

    // Materials
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700, // Gold/yellow
      side: THREE.DoubleSide,
    });

    // Transparent material for shapes
    const shapeMaterial = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0, // Completely transparent
      side: THREE.DoubleSide,
    });

    // Extrusion settings for shapes
    const shapeExtrudeSettings = {
      depth: 5, // Less depth for the shapes
      bevelEnabled: false,
    };

    // Extrusion settings for lines
    const lineExtrudeSettings = {
      depth: 20, // More depth for the lines
      bevelEnabled: false,
    };

    // Create groups
    const lineGroup = new THREE.Group();
    const shapesGroup = new THREE.Group();

    // Track if we successfully added any valid objects
    let addedValidObject = false;

    // First pass - create thicker lines
    data.paths.forEach((path, pathIndex) => {
      for (let i = 0; i < path.subPaths.length; i++) {
        const subPath = path.subPaths[i];
        const subPathPoints = subPath.getPoints();

        if (!hasValidPoints(subPathPoints)) {
          continue;
        }

        // Map points to 3D space (and flip y-axis)
        const points = subPathPoints.map(
          (point) => new THREE.Vector2(point.x, -point.y)
        );

        // Create thick line shapes
        const lineShapes = createThickLineFromPoints(points, lineThickness);

        if (lineShapes && lineShapes.length > 0) {
          // Extrude each segment
          lineShapes.forEach((lineShape) => {
            const geometry = new THREE.ExtrudeGeometry(
              lineShape,
              lineExtrudeSettings
            );
            const lineMesh = new THREE.Mesh(geometry, lineMaterial);
            lineGroup.add(lineMesh);
            addedValidObject = true;
          });
        }
      }
    });

    svgGroup.add(lineGroup);

    // Second pass - create transparent shapes
    data.paths.forEach((path, pathIndex) => {
      try {
        const shapes = path.toShapes(true);

        if (!shapes || shapes.length === 0) {
          return;
        }

        // Process each shape
        shapes.forEach((shape, shapeIndex) => {
          try {
            if (!shape || !shape.curves || shape.curves.length === 0) {
              return;
            }

            const geometry = new THREE.ExtrudeGeometry(
              shape,
              shapeExtrudeSettings
            );

            if (hasNaN(geometry)) {
              return;
            }

            const mesh = new THREE.Mesh(geometry, shapeMaterial);
            mesh.scale.y = -1; // Flip to match our line orientation

            shapesGroup.add(mesh);
            addedValidObject = true;
          } catch (error) {
            console.warn(`Error creating shape extrusion:`, error);
          }
        });
      } catch (error) {
        console.warn(`Error converting path to shapes:`, error);
      }
    });

    svgGroup.add(shapesGroup);

    if (addedValidObject) {
      // Add to scene
      scene.add(svgGroup);

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
          const center = box.getCenter(new THREE.Vector3());
          svgGroup.position.sub(center);

          const boxSize = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(boxSize.x, boxSize.y, boxSize.z);
          if (maxDim > 0 && !isNaN(maxDim)) {
            const scale = 100 / maxDim;
            svgGroup.scale.set(scale, scale, scale);
          }
        }
      } catch (error) {
        console.error("Error processing SVG group:", error);
      }
    }

    // Add toggle button for lines
    const linesToggleButton = document.createElement("button");
    linesToggleButton.textContent = "Toggle Lines";
    linesToggleButton.style.position = "absolute";
    linesToggleButton.style.top = "10px";
    linesToggleButton.style.left = "10px";
    linesToggleButton.style.padding = "10px";
    linesToggleButton.style.zIndex = "100";
    document.body.appendChild(linesToggleButton);

    linesToggleButton.addEventListener("click", () => {
      lineGroup.visible = !lineGroup.visible;
    });

    // Add thickness control
    const thicknessControl = document.createElement("div");
    thicknessControl.style.position = "absolute";
    thicknessControl.style.top = "60px";
    thicknessControl.style.left = "10px";
    thicknessControl.style.padding = "10px";
    thicknessControl.style.background = "rgba(0,0,0,0.5)";
    thicknessControl.style.color = "white";
    thicknessControl.style.zIndex = "100";
    thicknessControl.innerHTML = `
      <label for="thickness">Line Thickness: </label>
      <input type="range" id="thickness" min="0.5" max="5" step="0.5" value="${lineThickness}">
      <span id="thickness-value">${lineThickness}</span>
    `;
    document.body.appendChild(thicknessControl);

    document.getElementById("thickness").addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("thickness-value").textContent = value;
    });

    // Create export buttons
    const exportContainer = document.createElement("div");
    exportContainer.style.position = "absolute";
    exportContainer.style.top = "120px";
    exportContainer.style.left = "10px";
    exportContainer.style.padding = "10px";
    exportContainer.style.background = "rgba(0,0,0,0.5)";
    exportContainer.style.color = "white";
    exportContainer.style.zIndex = "100";

    // Create export buttons
    const formats = [
      { name: "GLTF/GLB", fn: () => exportToGLTF(svgGroup) },
      { name: "OBJ", fn: () => exportToOBJ(svgGroup) },
      { name: "STL", fn: () => exportToSTL(svgGroup) },
    ];

    exportContainer.innerHTML =
      "<div style='margin-bottom:8px'>Export as:</div>";

    formats.forEach((format) => {
      const button = document.createElement("button");
      button.textContent = format.name;
      button.style.margin = "5px";
      button.style.padding = "8px 12px";
      button.addEventListener("click", format.fn);
      exportContainer.appendChild(button);
    });

    document.body.appendChild(exportContainer);
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
