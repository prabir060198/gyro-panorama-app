import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

const video = document.getElementById("video");
const info = document.getElementById("info");
const bar = document.getElementById("bar");

let capturing = false;
let images = [];
let index = 0;

// 🌐 FULL SPHERE GRID
const rows = [-60, -30, 0, 30, 60];
const cols = [0, 60, 120, 180, 240, 300];

let smoothYaw = 0;
let smoothPitch = 0;

// ================= CAMERA =================
window.startCamera = async function () {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  video.srcObject = stream;
};

// ================= SENSOR =================
window.enableSensor = function () {
  if (DeviceOrientationEvent.requestPermission) {
    DeviceOrientationEvent.requestPermission();
  }
};

// ================= GYRO =================
window.addEventListener("deviceorientation", (e) => {

  let yaw = e.alpha || 0;
  let pitch = e.beta || 0;

  // smoothing
  smoothYaw = smoothYaw * 0.8 + yaw * 0.2;
  smoothPitch = smoothPitch * 0.8 + pitch * 0.2;

  if (!capturing) return;

  let r = Math.floor(index / cols.length);
  let c = index % cols.length;

  let targetYaw = cols[c];
  let targetPitch = rows[r];

  let dy = targetYaw - smoothYaw;
  if (dy > 180) dy -= 360;
  if (dy < -180) dy += 360;

  let dp = targetPitch - smoothPitch;

  info.innerText =
`Step ${index+1}/${rows.length * cols.length}
Yaw:${Math.round(smoothYaw)} Target:${targetYaw}
Pitch:${Math.round(smoothPitch)} Target:${targetPitch}`;

  if (Math.abs(dy) < 10 && Math.abs(dp) < 10) {
    info.innerText += "\n🎯 Locked";

    autoCapture();
  }
});

// ================= AUTO CAPTURE =================
let locking = false;

function autoCapture() {

  if (locking) return;

  locking = true;

  setTimeout(() => {

    captureFrame();

    index++;
    updateProgress();

    if (index >= rows.length * cols.length) {
      capturing = false;
      info.innerText = "✅ Capture Complete";
    }

    locking = false;

  }, 500);
}

// ================= CAPTURE =================
function captureFrame() {

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
  index = 0;
  updateProgress();
};

// ================= PROGRESS =================
function updateProgress() {
  bar.style.width = (index / (rows.length * cols.length)) * 100 + "%";
}

// ================= CREATE VIEWER =================
window.createViewer = function () {

  if (images.length === 0) return;

  let w = images[0].width;
  let h = images[0].height;

  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");

  canvas.width = cols.length * w;
  canvas.height = rows.length * h;

  images.forEach((img, i) => {

    let r = Math.floor(i / cols.length);
    let c = i % cols.length;

    ctx.drawImage(img, c * w, r * h);
  });

  const texture = new THREE.CanvasTexture(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / 400, 1, 1000);

  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, 400);

  document.getElementById("viewer").innerHTML = "";
  document.getElementById("viewer").appendChild(renderer.domElement);

  const geometry = new THREE.SphereGeometry(500, 60, 40);
  geometry.scale(-1, 1, 1);

  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture })));

  let lon = 0, lat = 0;

  renderer.domElement.addEventListener("touchmove", (e) => {
    lon += e.touches[0].movementX || 1;
    lat -= e.touches[0].movementY || 1;
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

    camera.lookAt(0,0,0);

    renderer.render(scene, camera);
  }

  animate();
};