// ================= STATE =================
let currentYaw = 0;
let currentPitch = 0;
let yawOffset = null;

let capturing = false;
let ringIndex = 0;
let targetIndex = 0;

let stableFrames = 0;
let holding = false;
let holdStart = 0;

let capturedImages = [];
let captureData = [];

// ================= RINGS =================
const rings = [
  { pitch: 80,  yaws: [0,120,240] },
  { pitch: 45,  yaws: [0,45,90,135,180,225,270,315] },
  { pitch: 0,   yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },
  { pitch: -45, yaws: [0,45,90,135,180,225,270,315] },
  { pitch: -80, yaws: [60,180,300] }
];

// ================= 3D =================
let engine, scene, camera3D, guidePoints = [];

function init3D() {
  const canvas = document.getElementById("renderCanvas");

  engine = new BABYLON.Engine(canvas, true);
  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  const sphere = BABYLON.MeshBuilder.CreateSphere("s", {diameter:4}, scene);
  const mat = new BABYLON.StandardMaterial("m", scene);
  mat.wireframe = true;
  mat.alpha = 0.2;
  sphere.material = mat;

  engine.runRenderLoop(() => scene.render());
}

// ===== correct spherical =====
function sphericalToCartesian(yaw, pitch) {
  const y = BABYLON.Tools.ToRadians(yaw);
  const p = BABYLON.Tools.ToRadians(pitch);

  return new BABYLON.Vector3(
    Math.cos(p) * Math.sin(y),
    -Math.sin(p),
    Math.cos(p) * Math.cos(y)
  ).scale(2);
}

function createPoints() {
  rings.forEach((r, ri) => {
    r.yaws.forEach((y, yi) => {

      const mesh = BABYLON.MeshBuilder.CreateSphere("p", {diameter:0.08}, scene);
      mesh.position = sphericalToCartesian(y, r.pitch);

      mesh.lookAt(BABYLON.Vector3.Zero());

      const mat = new BABYLON.StandardMaterial("pm", scene);
      mat.emissiveColor = new BABYLON.Color3(1,1,1);
      mesh.material = mat;

      guidePoints.push({mesh, ri, yi});
    });
  });
}

// ================= START =================
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
  createPoints();

  startScreen.classList.add("hidden");
  cameraScreen.classList.remove("hidden");
};

// ================= ORIENTATION =================
window.addEventListener("deviceorientation", e => {

  if (!capturing) return;

  let yaw = (e.alpha + 360) % 360;

  // 🔥 FIXED pitch (inverted)
  let pitch = -(e.beta - 90);
  pitch = Math.max(-90, Math.min(90, pitch));

  if (yawOffset === null) yawOffset = yaw;
  yaw = (yaw - yawOffset + 360) % 360;

  // smooth
  currentYaw = currentYaw * 0.85 + yaw * 0.15;
  currentPitch = currentPitch * 0.85 + pitch * 0.15;

  update3D();
  processCapture();
});

function update3D() {
  camera3D.rotation.y = BABYLON.Tools.ToRadians(currentYaw);
  camera3D.rotation.x = BABYLON.Tools.ToRadians(-currentPitch);
}

// ================= CAPTURE =================
function normalize(a) {
  return ((a + 540) % 360) - 180;
}

function processCapture() {

  const tYaw = rings[ringIndex].yaws[targetIndex];
  const tPitch = rings[ringIndex].pitch;

  let yDiff = normalize(currentYaw - tYaw);
  let pDiff = currentPitch - tPitch;

  if (Math.abs(tPitch) > 70) yDiff = 0;

  const ok = Math.abs(yDiff) < 6 && Math.abs(pDiff) < 8;

  if (ok) stableFrames++;
  else stableFrames = 0;

  if (stableFrames < 4) return;

  if (!holding) {
    holding = true;
    holdStart = Date.now();
  }

  let progress = Math.min((Date.now() - holdStart)/700,1);

  progressEl.style.background =
    `conic-gradient(#00c853 ${progress*360}deg, transparent 0deg)`;

  if (progress >= 1) {

    captureFrame();

    guidePoints.forEach(g=>{
      if(g.ri===ringIndex && g.yi===targetIndex){
        g.mesh.material.emissiveColor = new BABYLON.Color3(0,1,0);
      }
    });

    targetIndex++;
    if (targetIndex >= rings[ringIndex].yaws.length) {
      ringIndex++;
      targetIndex = 0;

      if (ringIndex >= rings.length) finish();
    }

    holding = false;
    stableFrames = 0;
  }

  guidePoints.forEach(g=>{
    if(g.ri===ringIndex && g.yi===targetIndex){
      g.mesh.material.emissiveColor = new BABYLON.Color3(1,0.5,0);
    }
  });
}

// ================= CAPTURE FRAME =================
function captureFrame() {

  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video,0,0);

  const img = canvas.toDataURL("image/png");

  capturedImages.push(img);

  captureData.push({
    name:`img_${capturedImages.length}.png`,
    yaw: currentYaw,
    pitch: currentPitch
  });
}

// ================= FINISH =================
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

// ================= START CAPTURE =================
captureBtn.onclick = () => {
  capturing = true;
  yawOffset = null;
  stableFrames = 0;
  holding = false;
};