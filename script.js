// ===== STATE =====
let currentYaw = 0;
let currentPitch = 0;
let yawOffset = null;

let capturing = false;
let holding = false;
let holdStart = 0;

let capturedImages = [];

const rings = [
  { pitch: 60, yaws: [0,90,180,270] },
  { pitch: 0,  yaws: [0,60,120,180,240,300] },
  { pitch: -60, yaws: [0,90,180,270] }
];

let ringIndex = 0;
let targetIndex = 0;

// ===== 3D =====
let engine, scene, camera;

function init3D() {
  const canvas = document.getElementById("renderCanvas");

  engine = new BABYLON.Engine(canvas, true);
  scene = new BABYLON.Scene(engine);

  camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  const sphere = BABYLON.MeshBuilder.CreateSphere("s", {diameter:4}, scene);

  const mat = new BABYLON.StandardMaterial("m", scene);
  mat.wireframe = true;
  mat.alpha = 0.3;
  sphere.material = mat;

  engine.runRenderLoop(() => scene.render());
}

// ===== START =====
startBtn.onclick = async () => {

  if (DeviceOrientationEvent.requestPermission) {
    await DeviceOrientationEvent.requestPermission();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });

  video.srcObject = stream;
  await video.play();

  init3D();

  startScreen.classList.add("hidden");
  cameraScreen.classList.remove("hidden");
};

// ===== ORIENTATION =====
window.addEventListener("deviceorientation", e => {

  if (!capturing || e.alpha == null) return;

  let yaw = (e.alpha + 360) % 360;

  // 🔥 FIXED UNIVERSAL PITCH
  let pitch = e.beta - 90;
  pitch = -pitch;

  pitch = Math.max(-90, Math.min(90, pitch));

  if (yawOffset === null) yawOffset = yaw;
  yaw = (yaw - yawOffset + 360) % 360;

  // smoothing
  currentYaw = currentYaw * 0.85 + yaw * 0.15;
  currentPitch = currentPitch * 0.85 + pitch * 0.15;

  // apply to 3D
  camera.rotation.y = BABYLON.Tools.ToRadians(currentYaw);
  camera.rotation.x = BABYLON.Tools.ToRadians(currentPitch);

  processCapture();
});

// ===== CAPTURE =====
function normalize(a) {
  return ((a + 540) % 360) - 180;
}

function processCapture() {

  const tYaw = rings[ringIndex].yaws[targetIndex];
  const tPitch = rings[ringIndex].pitch;

  let yDiff = normalize(currentYaw - tYaw);
  let pDiff = currentPitch - tPitch;

  if (Math.abs(pDiff) < 6 && Math.abs(yDiff) < 6) {

    if (!holding) {
      holding = true;
      holdStart = Date.now();
    }

    let progress = (Date.now() - holdStart) / 600;

    progressEl.style.background =
      `conic-gradient(#00c853 ${progress*360}deg, transparent 0deg)`;

    if (progress >= 1) {

      captureFrame();

      targetIndex++;
      if (targetIndex >= rings[ringIndex].yaws.length) {
        ringIndex++;
        targetIndex = 0;

        if (ringIndex >= rings.length) finish();
      }

      holding = false;
    }

  } else {
    holding = false;
  }
}

// ===== CAPTURE FRAME =====
function captureFrame() {

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video,0,0);

  const img = canvas.toDataURL("image/png");

  capturedImages.push(img);
}

// ===== FINISH =====
function finish() {

  capturing = false;

  cameraScreen.classList.add("hidden");
  resultScreen.classList.remove("hidden");

  capturedImages.forEach(img=>{
    const el=document.createElement("img");
    el.src=img;
    gallery.appendChild(el);
  });
}

// ===== START CAPTURE =====
captureBtn.onclick = () => {
  capturing = true;
  yawOffset = null;
};