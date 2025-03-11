import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";

let scene, camera, renderer, controls;

init();
loadSVG();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.z = 400;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  window.addEventListener("resize", onWindowResize);
}

function getValidColor(color) {
  // Handle 'none' or undefined color values
  if (!color || color === "none") {
    return "#eb3446"; // Default to black
  }
  return color;
}

function loadSVG() {
  const loader = new SVGLoader();
  const url =
    "https://devcdn.renderengine.io/products/render-mockups-design/map-vector-hGlZROfJecRwaGb3.svg";

  console.log("Starting SVG load...");

  loader.load(
    url,
    function (data) {
      console.log("SVG loaded successfully");

      const paths = data.paths;
      const group = new THREE.Group();

      paths.forEach((path, i) => {
        const style = path.userData.style;

        // Get valid colors, defaulting to black if none or undefined
        // const fillColor = getValidColor(style.fill);
        // const strokeColor = getValidColor(style.stroke);
        const fillColor = getValidColor();
        const strokeColor = getValidColor();

        // Only create fill if it's not 'none'
        if (style.fill && style.fill !== "none") {
          const shapes = path.toShapes(true);

          shapes.forEach((shape) => {
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({
              color: fillColor,
              side: THREE.DoubleSide,
              depthWrite: true,
              transparent: true,
              opacity: style.fillOpacity !== undefined ? style.fillOpacity : 1,
            });

            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
          });
        }

        // Only create stroke if it's not 'none'
        if (style.stroke && style.stroke !== "none") {
          const strokeWidth =
            style.strokeWidth !== undefined ? style.strokeWidth : 1;

          path.subPaths.forEach((subPath) => {
            const points = subPath.getPoints();
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
              color: strokeColor,
              linewidth: strokeWidth,
              transparent: true,
              opacity:
                style.strokeOpacity !== undefined ? style.strokeOpacity : 1,
            });

            const line = new THREE.Line(geometry, material);
            group.add(line);
          });
        }
      });

      // Center and scale the SVG
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Scale to fit in view
      const maxSize = Math.max(size.x, size.y);
      const scale = 800 / maxSize;
      group.scale.multiplyScalar(scale);

      // Center the group
      group.position.sub(center.multiplyScalar(scale));

      scene.add(group);

      // Adjust camera to view entire SVG
      const distance = Math.max(size.x, size.y) * 1.2;
      camera.position.set(0, 0, distance);
      camera.lookAt(0, 0, 0);

      console.log("SVG processing complete");
    },
    function (xhr) {
      console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    },
    function (error) {
      console.error("Error loading SVG:", error);
    }
  );
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
