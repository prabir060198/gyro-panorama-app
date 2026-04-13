import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");
const pointsContainer = document.getElementById("points");

let capturing = false;
let images = [];
let currentIndex = 0;
let isCapturing = false;

// 🌐 capture points (yaw + pitch)
const capturePoints = [
  { yaw: 0, pitch: 0 },
  { yaw: 60, pitch: 0 },
  { yaw: 120, pitch: 0 },
  { yaw: 180, pitch: 0 },
  { yaw: 240, pitch: 0 },
  { yaw: 300, pitch: 0 },

  { yaw: 0, pitch: 40 },
  { yaw: 120, pitch: 40 },
  { yaw: 240, pitch: 40 },

  { yaw: 0, pitch: -40 },
  { yaw: 120, pitch: -40 },
  { yaw: 240, pitch: -40 },
];

// ================= CAMERA =================
window.startCamera = async function () {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;
    statusText.innerText = "Camera started ✅";
  } catch (e) {
    alert("Camera error: allow permission + use HTTPS");
  }
};

// ================= SENSOR =================
window.requestPermission = function () {
  if (DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission();
  }
  statusText.innerText = "Sensor enabled ✅";
};

// ================= UI POINTS =================
function createPointsUI() {

  pointsContainer.innerHTML = "";

  capturePoints.forEach((p, i) => {

    let div = document.createElement("div");
    div.className = "point";

    // simple circular layout
    let angle = (i / capturePoints.length) * 2 * Math.PI;
    let r = 120;

    div.style.left = (50 + Math.cos(angle) * r / 4) + "%";
    div.style.top = (50 + Math.sin(angle) * r / 4) + "%";

    pointsContainer.appendChild(div);
  });
}

// ================= GYRO =================
window.addEventListener("deviceorientation", (event) => {

  if (!capturing) return;

  if (event.alpha === null) {
    angleUI.innerText = "Sensor not working ❌";
    return;
  }

  let yaw = Math.round(event.alpha);
  let pitch = Math.round(event.beta);

  let target = capturePoints[currentIndex];

  angleUI.innerText =
`Yaw:${yaw} Pitch:${pitch}
Target:${target.yaw}/${target.pitch}
Step:${currentIndex+1}/${capturePoints.length}`;

  let diffYaw = target.yaw - yaw;
  if (diffYaw > 180) diffYaw -= 360;
  if (diffYaw < -180) diffYaw += 360;

  let diffPitch = target.pitch - pitch;

  let points = document.querySelectorAll(".point");
  points.forEach(p => p.classList.remove("active"));
  if (points[currentIndex]) points[currentIndex].classList.add("active");

  if (Math.abs(diffYaw) < 12 && Math.abs(diffPitch) < 12 && !isCapturing) {

    isCapturing = true;
    statusText.innerText = "📸 Capturing...";

    flash();

    setTimeout(() => {

      captureImage(yaw, pitch);

      if (points[currentIndex]) {
        points[currentIndex].classList.add("done");
      }

      currentIndex++;

      if (currentIndex >= capturePoints.length) {
        capturing = false;
        statusText.innerText = "✅ Capture Done!";
      }

      isCapturing = false;

    }, 600);
  } else {
    statusText.innerText = "🎯 Align with target";
  }
});

// ================= FLASH =================
function flash() {
  document.body.style.background = "white";
  setTimeout(() => document.body.style.background = "#111", 100);
}

// ================= CAPTURE =================
function captureImage(yaw, pitch) {

  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0);

  images.push(canvas);
}

// ================= START =================
window.startCapture = function () {
  capturing = true;
  images = [];
  currentIndex = 0;
  createPointsUI();
  statusText.innerText = "Start moving phone...";
};

// ================= VIEWER =================
window.createViewer = function () {

  if (images.length === 0) {
    alert("No images!");
    return;
  }

  let w = images[0].width;
  let h = images[0].height;

  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");

  canvas.width = w * images.length;
  canvas.height = h;

  images.forEach((img, i) => {
    ctx.drawImage(img, i * w, 0);
  });

  const texture = new THREE.CanvasTexture(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, 400);

  document.getElementById("viewer").innerHTML = "";
  document.getElementById("viewer").appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture })));

  let lon = 0, lat = 0;

  let lastX = 0, lastY = 0;

  renderer.domElement.addEventListener("touchstart", (e) => {
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  });

  renderer.domElement.addEventListener("touchmove", (e) => {

    let dx = e.touches[0].clientX - lastX;
    let dy = e.touches[0].clientY - lastY;

    lon += dx * 0.1;
    lat -= dy * 0.1;

    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  });

  function animate() {
    requestAnimationFrame(animate);

    lat = Math.max(-85, Math.min(85, lat));

    let phi = THREE.MathUtils.degToRad(90 - lat);
    let theta = THREE.MathUtils.degToRad(lon);

    camera.position.set(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );

    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animate();
};