// =============================
// CAMERA CONFIG (AUTO CALIB)
// =============================
const CAMERA_CONFIG = {
  IMG_W: 0,
  IMG_H: 0,
  FOV_H_DEG: 60 // default fallback
};

// Estimate FOV based on aspect ratio (simple heuristic)
function estimateFOV(width, height) {
  const aspect = width / height;

  // Typical phone rear camera ranges
  if (aspect > 1.7) return 65;   // wide
  if (aspect > 1.4) return 60;   // normal
  return 55;                     // narrow
}

// =============================
// ELEMENTS
// =============================
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const startScreen = document.getElementById("startScreen");
const cameraScreen = document.getElementById("cameraScreen");
const resultScreen = document.getElementById("resultScreen");

const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");
const progressEl = document.getElementById("progress");

const gallery = document.getElementById("gallery");
const statusText = document.getElementById("statusText");

const previewPopup = document.getElementById("previewPopup");
const previewImg = document.getElementById("previewImg");

// =============================
// STATE
// =============================
let capturedImages = [];
let captureData = [];

let currentYaw = 0;
let currentPitch = 0;

let yawOffset = null;

let capturing = false;
let ringIndex = 0;
let targetIndex = 0;

let holding = false;
let holdStart = 0;

// =============================
// 🔥 IMPROVED RINGS
// =============================
const rings = [
  { pitch: 80,  yaws: [0, 120, 240] },

  { pitch: 45,  yaws: [0,45,90,135,180,225,270,315] },

  { pitch: 0,   yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },

  { pitch: -45, yaws: [0,45,90,135,180,225,270,315] },

  { pitch: -80, yaws: [60, 180, 300] }
];

const totalShots = rings.reduce((s, r) => s + r.yaws.length, 0);

// =============================
// iPHONE PERMISSION
// =============================
async function requestPermission() {
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    const res = await DeviceOrientationEvent.requestPermission();
    if (res !== "granted") {
      alert("Permission required");
      return false;
    }
  }
  return true;
}

// =============================
// START CAMERA
// =============================
document.getElementById("startBtn").onclick = async () => {

  const ok = await requestPermission();
  if (!ok) return;

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });

  video.srcObject = stream;
  await video.play();

  // 🔥 AUTO CALIBRATION
  CAMERA_CONFIG.IMG_W = video.videoWidth;
  CAMERA_CONFIG.IMG_H = video.videoHeight;
  CAMERA_CONFIG.FOV_H_DEG = estimateFOV(video.videoWidth, video.videoHeight);

  console.log("Camera:", CAMERA_CONFIG);

  startScreen.classList.add("hidden");
  cameraScreen.classList.remove("hidden");
};

// =============================
// HELPERS
// =============================
function normalizeAngle(a) {
  return ((a + 540) % 360) - 180;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smooth(prev, current, f = 0.15) {
  return prev * (1 - f) + current * f;
}

// =============================
// ORIENTATION
// =============================
window.addEventListener("deviceorientation", (e) => {

  if (!capturing || e.alpha == null) return;

  let yaw = e.alpha;
  let pitch = e.beta;

  yaw = (yaw + 360) % 360;
  pitch = clamp(pitch - 90, -90, 90);

  // 🔥 YAW OFFSET FIX (important for iPhone)
  if (yawOffset === null) yawOffset = yaw;
  yaw = (yaw - yawOffset + 360) % 360;

  // 🔥 SMOOTHING
  currentYaw = smooth(currentYaw, yaw);
  currentPitch = smooth(currentPitch, pitch);

  processCapture();
});

// =============================
// CAPTURE LOGIC
// =============================
function processCapture() {

  const targetYaw = rings[ringIndex].yaws[targetIndex];
  const targetPitch = rings[ringIndex].pitch;

  let yawDiff = normalizeAngle(currentYaw - targetYaw);
  let pitchDiff = currentPitch - targetPitch;

  // 🔥 RELAX FOR POLES
  let yawTol = Math.abs(targetPitch) > 60 ? 6 : 4;
  let pitchTol = Math.abs(targetPitch) > 60 ? 8 : 5;

  // UI dot
  const maxOffset = 80;
  const x = clamp((yawDiff / 30) * maxOffset, -maxOffset, maxOffset);
  const y = clamp((pitchDiff / 30) * maxOffset, -maxOffset, maxOffset);

  dot.style.transform =
    `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

  arrow.innerText =
    Math.abs(yawDiff) > yawTol ? (yawDiff > 0 ? "➡" : "⬅") :
    Math.abs(pitchDiff) > pitchTol ? (pitchDiff > 0 ? "⬇" : "⬆") : "●";

  // HOLD
  if (Math.abs(yawDiff) < yawTol && Math.abs(pitchDiff) < pitchTol) {

    if (!holding) {
      holding = true;
      holdStart = Date.now();
    }

    let holdTime = Math.abs(targetPitch) > 60 ? 900 : 700;
    let progress = Math.min((Date.now() - holdStart) / holdTime, 1);

    progressEl.style.background =
      `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

    if (progress >= 1) {

      capture(currentYaw, currentPitch);

      holding = false;
      progressEl.style.background =
        `conic-gradient(#888 0deg, transparent 0deg)`;

      targetIndex++;

      if (targetIndex >= rings[ringIndex].yaws.length) {
        ringIndex++;
        targetIndex = 0;

        if (ringIndex >= rings.length) {
          finish();
          return;
        }
      }
    }

  } else {
    holding = false;
    progressEl.style.background =
      `conic-gradient(#888 0deg, transparent 0deg)`;
  }

  statusText.innerText =
    Math.abs(targetPitch) > 70
      ? "Tilt fully up/down"
      : `${capturedImages.length}/${totalShots}`;
}

// =============================
// CAPTURE FRAME
// =============================
function capture(yaw, pitch) {

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0);

  const img = canvas.toDataURL("image/png");

  capturedImages.push(img);

  captureData.push({
    name: `img_${capturedImages.length}.png`,
    yaw: yaw,
    pitch: pitch,

    // 🔥 INCLUDE CAMERA DATA
    width: CAMERA_CONFIG.IMG_W,
    height: CAMERA_CONFIG.IMG_H,
    fov: CAMERA_CONFIG.FOV_H_DEG
  });
}

// =============================
// FINISH
// =============================
function finish() {

  capturing = false;

  cameraScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  capturedImages.forEach(img => {
    const el = document.createElement("img");
    el.src = img;
    el.onclick = () => {
      previewImg.src = img;
      previewPopup.classList.remove("hidden");
    };
    gallery.appendChild(el);
  });
}

// =============================
// START CAPTURE
// =============================
document.getElementById("captureBtn").onclick = () => {
  capturing = true;
};

// =============================
// DOWNLOAD
// =============================
document.getElementById("downloadBtn").onclick = async () => {

  const zip = new JSZip();

  capturedImages.forEach((img, i) => {
    zip.file(`img_${i+1}.png`, img.split(",")[1], { base64: true });
  });

  zip.file("metadata.json", JSON.stringify({
    camera: CAMERA_CONFIG,
    images: captureData
  }, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "photosphere.zip";
  a.click();
};

// =============================
// PREVIEW
// =============================
previewPopup.onclick = () => previewPopup.classList.add("hidden");