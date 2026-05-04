let currentYaw = 0;
let currentPitch = 0;
let yawOffset = null;

let engine, scene, camera;

// ========= 3D =========
function init3D() {

  const canvas = document.getElementById("renderCanvas");

  engine = new BABYLON.Engine(canvas, true);
  scene = new BABYLON.Scene(engine);

  camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  const sphere = BABYLON.MeshBuilder.CreateSphere("s", {diameter:6}, scene);

  const mat = new BABYLON.StandardMaterial("m", scene);
  mat.wireframe = true;
  mat.alpha = 0.3;
  sphere.material = mat;

  engine.runRenderLoop(() => scene.render());
}

// ========= START =========
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
};

// ========= ORIENTATION =========
window.addEventListener("deviceorientation", e => {

  if (e.alpha == null) return;

  let yaw = (e.alpha + 360) % 360;

  // 🔥 FINAL FIX (stable pitch)
  let pitch = -(e.beta - 90);

  pitch = Math.max(-90, Math.min(90, pitch));

  if (yawOffset === null) yawOffset = yaw;
  yaw = (yaw - yawOffset + 360) % 360;

  currentYaw = currentYaw * 0.85 + yaw * 0.15;
  currentPitch = currentPitch * 0.85 + pitch * 0.15;

  camera.rotation.y = BABYLON.Tools.ToRadians(currentYaw);
  camera.rotation.x = BABYLON.Tools.ToRadians(currentPitch);
};