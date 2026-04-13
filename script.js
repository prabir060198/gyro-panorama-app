import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const statusText = document.getElementById("status");

let scene, camera, renderer;
let points = [];

let yaw = 0, pitch = 0;
let capturing = false;
let currentIndex = 0;
let images = [];

// 🌐 sphere capture points
const capturePoints = [];

for (let y = -45; y <= 45; y += 45) {
  for (let x = 0; x < 360; x += 60) {
    capturePoints.push({ yaw: x, pitch: y });
  }
}

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

// ================= INIT 3D =================
function init3D() {

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, 400);

  document.getElementById("viewer").appendChild(renderer.domElement);

  // create points
  capturePoints.forEach((p, i) => {

    let geometry = new THREE.SphereGeometry(5, 8, 8);
    let material = new THREE.MeshBasicMaterial({ color: 0x888888 });

    let mesh = new THREE.Mesh(geometry, material);

    let phi = THREE.MathUtils.degToRad(90 - p.pitch);
    let theta = THREE.MathUtils.degToRad(p.yaw);

    mesh.position.set(
      200 * Math.sin(phi) * Math.cos(theta),
      200 * Math.cos(phi),
      200 * Math.sin(phi) * Math.sin(theta)
    );

    scene.add(mesh);
    points.push(mesh);
  });
}

// ================= GYRO =================
window.addEventListener("deviceorientation", (event) => {

  yaw = event.alpha || 0;
  pitch = event.beta || 0;

  if (!capturing) return;

  let target = capturePoints[currentIndex];

  let diffYaw = target.yaw - yaw;
  if (diffYaw > 180) diffYaw -= 360;
  if (diffYaw < -180) diffYaw += 360;

  let diffPitch = target.pitch - pitch;

  // highlight active point
  points.forEach(p => p.material.color.set(0x888888));
  points[currentIndex].material.color.set(0xff0000);

  if (Math.abs(diffYaw) < 10 && Math.abs(diffPitch) < 10) {

    statusText.innerText = "📸 Capturing...";

    setTimeout(() => {

      captureImage();

      points[currentIndex].material.color.set(0x00ff00);

      currentIndex++;

      if (currentIndex >= capturePoints.length) {
        capturing = false;
        statusText.innerText = "✅ DONE!";
      }

    }, 500);
  }
});

// ================= CAPTURE =================
function captureImage() {

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
  currentIndex = 0;
  images = [];

  init3D();
};

// ================= RENDER =================
function animate() {
  requestAnimationFrame(animate);

  let phi = THREE.MathUtils.degToRad(90 - pitch);
  let theta = THREE.MathUtils.degToRad(yaw);

  camera.position.set(
    200 * Math.sin(phi) * Math.cos(theta),
    200 * Math.cos(phi),
    200 * Math.sin(phi) * Math.sin(theta)
  );

  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

animate();