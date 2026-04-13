const video = document.getElementById("video");
const statusText = document.getElementById("status");
const angleUI = document.getElementById("angleUI");
const progressFill = document.getElementById("progressFill");

let capturing = false;
let images = [];
let index = 0;

// 🔥 SIMPLE targets (ONLY horizontal first)
const targets = [0, 60, 120, 180, 240, 300];

let smoothYaw = 0;

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

// ================= GYRO (SMOOTHED) =================
window.addEventListener("deviceorientation", (event) => {

  if (!capturing) return;

  let yaw = event.alpha || 0;

  // 🔥 smoothing
  smoothYaw = smoothYaw * 0.8 + yaw * 0.2;

  let target = targets[index];

  let diff = target - smoothYaw;

  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  angleUI.innerText =
    `Yaw: ${Math.round(smoothYaw)}
Target: ${target}
Step: ${index+1}/${targets.length}`;

  // 🎯 lock system
  if (Math.abs(diff) < 10) {
    statusText.innerText = "🎯 Locked! Tap Capture";
  } else {
    statusText.innerText = "➡ Rotate slowly";
  }
});

// ================= MANUAL CAPTURE =================
window.manualCapture = function () {

  if (!capturing) return;

  captureImage();

  index++;

  updateProgress();

  if (index >= targets.length) {
    capturing = false;
    statusText.innerText = "✅ Done!";
  }
};

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
  images = [];
  index = 0;
  updateProgress();
};

// ================= PROGRESS =================
function updateProgress() {
  let percent = (index / targets.length) * 100;
  progressFill.style.width = percent + "%";
}