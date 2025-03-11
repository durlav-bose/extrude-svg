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
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
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

// Screenshot function
function takeScreenshot() {
  // Render the scene
  renderer.render(scene, camera);

  // Get the canvas data URL
  const dataURL = renderer.domElement.toDataURL("image/png");

  // Create a link and trigger download
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "extruded-svg-screenshot.png";
  link.click();
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

    // Create UI Controls Container
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

    // Add toggle button for lines
    const linesToggleButton = document.createElement("button");
    linesToggleButton.textContent = "Toggle Lines";
    linesToggleButton.style.padding = "10px";
    linesToggleButton.addEventListener("click", () => {
      lineGroup.visible = !lineGroup.visible;
    });
    controlsContainer.appendChild(linesToggleButton);

    // Add thickness control
    const thicknessControl = document.createElement("div");
    thicknessControl.style.padding = "10px";
    thicknessControl.style.background = "rgba(0,0,0,0.5)";
    thicknessControl.style.color = "white";
    thicknessControl.innerHTML = `
      <label for="thickness">Line Thickness: </label>
      <input type="range" id="thickness" min="0.5" max="5" step="0.5" value="${lineThickness}">
      <span id="thickness-value">${lineThickness}</span>
    `;
    controlsContainer.appendChild(thicknessControl);

    document.getElementById("thickness").addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      document.getElementById("thickness-value").textContent = value;
    });

    // Create export buttons
    const exportContainer = document.createElement("div");
    exportContainer.style.padding = "10px";
    exportContainer.style.background = "rgba(0,0,0,0.5)";
    exportContainer.style.color = "white";

    // Create export buttons for 3D models
    const formats = [
      { name: "GLTF/GLB", fn: () => exportToGLTF(svgGroup) },
      { name: "OBJ", fn: () => exportToOBJ(svgGroup) },
      { name: "STL", fn: () => exportToSTL(svgGroup) },
    ];

    exportContainer.innerHTML =
      "<div style='margin-bottom:8px'>Export 3D Model:</div>";

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

    // Add screenshot button
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
    const colorButtons = bgColorContainer.querySelectorAll("button");
    colorButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const colorValue = parseInt(button.dataset.color);
        scene.background = new THREE.Color(colorValue);
      });
    });

    // Add line color control
    const lineColorContainer = document.createElement("div");
    lineColorContainer.style.padding = "10px";
    lineColorContainer.style.background = "rgba(0,0,0,0.5)";
    lineColorContainer.style.color = "white";
    lineColorContainer.innerHTML = `
      <div style='margin-bottom:8px'>Line Color:</div>
      <div style="display: flex; gap: 5px; flex-wrap: wrap;">
        <button data-color="0xffd700" style="background-color: #ffd700; width: 30px; height: 30px; border: 1px solid gray;"></button>
        <button data-color="0xFFFFFF" style="background-color: #FFFFFF; width: 30px; height: 30px; border: 1px solid gray;"></button>
        <button data-color="0xFF0000" style="background-color: #FF0000; width: 30px; height: 30px; border: 1px solid white;"></button>
        <button data-color="0x00FF00" style="background-color: #00FF00; width: 30px; height: 30px; border: 1px solid white;"></button>
        <button data-color="0x0000FF" style="background-color: #0000FF; width: 30px; height: 30px; border: 1px solid white;"></button>
        <button data-color="0xFF00FF" style="background-color: #FF00FF; width: 30px; height: 30px; border: 1px solid white;"></button>
      </div>
    `;

    controlsContainer.appendChild(lineColorContainer);

    // Add event listeners to line color buttons
    const lineColorButtons = lineColorContainer.querySelectorAll("button");
    lineColorButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const colorValue = parseInt(button.dataset.color);
        lineGroup.traverse((child) => {
          if (child.isMesh) {
            child.material.color.set(colorValue);
          }
        });
      });
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
