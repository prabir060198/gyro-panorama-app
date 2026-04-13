import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");
const pointsContainer = document.getElementById("points");

let capturing = false;
let images = [];
let currentIndex = 0;

// 🌐 sphere points
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
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  video.srcObject = stream;
};

// ================= SENSOR =================
window.requestPermission = function () {
  if (DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission();
  }
};

// ================= CREATE UI POINTS =================
function createPointsUI() {

  pointsContainer.innerHTML = "";

  capturePoints.forEach((p, i) => {

    let div = document.createElement("div");
    div.className = "point";

    // random placement just for UI feel
    div.style.left = (50 + Math.sin(i) * 80) + "%";
    div.style.top = (50 + Math.cos(i) * 80) + "%";

    pointsContainer.appendChild(div);
  });
}

// ================= GYRO =================
window.addEventListener("deviceorientation", (event) => {

  if (!capturing) return;

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
  points[currentIndex].classList.add("active");

  if (Math.abs(diffYaw) < 10 && Math.abs(diffPitch) < 10) {

    statusText.innerText = "📸 Capturing...";

    setTimeout(() => {

      captureImage(yaw, pitch);

      points[currentIndex].classList.add("done");

      currentIndex++;

      if (currentIndex >= capturePoints.length) {
        capturing = false;
        statusText.innerText = "✅ Done!";
      }

    }, 500);
  } else {
    statusText.innerText = "🎯 Align target";
  }
});

// ================= CAPTURE =================
function captureImage(yaw, pitch) {

  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0);

  images.push({ img: canvas, yaw, pitch });
}

// ================= START =================
window.startCapture = function () {
  capturing = true;
  images = [];
  currentIndex = 0;
  createPointsUI();
};

// ================= VIEWER =================
window.createViewer = function () {

  if (images.length === 0) return;

  let w = images[0].img.width;
  let h = images[0].img.height;

  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");

  canvas.width = w * images.length;
  canvas.height = h;

  images.forEach((img, i) => {
    ctx.drawImage(img.img, i * w, 0);
  });

  const texture = new THREE.CanvasTexture(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, 400);

  document.getElementById("viewer").innerHTML = "";
  document.getElementById("viewer").appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture })));

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();
};