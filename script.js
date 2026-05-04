window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const ghost = document.getElementById("ghost");
const progress = document.getElementById("progress");
const capCanvas = document.getElementById("capCanvas");

let engine, scene, camera3D, targetMesh;

let yawOffset = null;
let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

// ===== INIT 3D =====
function init3D(){

  engine = new BABYLON.Engine(canvas, true);
  engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  // guide sphere
  const s = BABYLON.MeshBuilder.CreateSphere("s", {diameter:6}, scene);
  const sm = new BABYLON.StandardMaterial("sm", scene);
  sm.wireframe = true;
  sm.alpha = 0.2;
  s.material = sm;

  // target (straight ahead)
  targetMesh = BABYLON.MeshBuilder.CreateSphere("t", {diameter:0.3}, scene);
  targetMesh.position = new BABYLON.Vector3(0,0,3);

  const tm = new BABYLON.StandardMaterial("tm", scene);
  tm.emissiveColor = new BABYLON.Color3(1,0.5,0);
  targetMesh.material = tm;

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());
}

// ===== PROJECT 3D → SCREEN =====
function project(pos){
  const p = BABYLON.Vector3.Project(
    pos,
    BABYLON.Matrix.Identity(),
    scene.getTransformMatrix(),
    camera3D.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())
  );
  return {x:p.x, y:p.y};
}

// ===== CAPTURE =====
function captureFrame(){
  const ctx = capCanvas.getContext("2d");
  capCanvas.width = video.videoWidth;
  capCanvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return capCanvas.toDataURL("image/png");
}

// ===== SHOW IMAGE IN 3D =====
function placeImage(img){
  const plane = BABYLON.MeshBuilder.CreatePlane("img", {size:1}, scene);
  plane.position = targetMesh.position.clone();
  plane.lookAt(camera3D.position);

  const tex = new BABYLON.DynamicTexture("dt", {width:512,height:512}, scene);
  const ctx = tex.getContext();

  const image = new Image();
  image.onload = ()=>{
    ctx.drawImage(image,0,0,512,512);
    tex.update();
  };
  image.src = img;

  const mat = new BABYLON.StandardMaterial("mat", scene);
  mat.diffuseTexture = tex;
  mat.emissiveColor = new BABYLON.Color3(1,1,1);

  plane.material = mat;
}

// ===== START =====
startBtn.onclick = async ()=>{
  if (DeviceOrientationEvent.requestPermission) {
    await DeviceOrientationEvent.requestPermission();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"environment"}
  });

  video.srcObject = stream;
  await video.play();

  init3D();
};

captureBtn.onclick = ()=>{
  capturing = true;
  yawOffset = null;
};

// ===== SENSOR =====
window.addEventListener("deviceorientation", e => {

  if (!camera3D || !capturing || e.alpha == null) return;

  let rawYaw = e.alpha;
  let rawPitch = -(e.beta - 90);

  if (yawOffset === null) yawOffset = rawYaw;

  let yaw = rawYaw - yawOffset;
  let pitch = rawPitch;

  // smoothing (reduce jitter)
  smoothYaw = smoothYaw * 0.85 + yaw * 0.15;
  smoothPitch = smoothPitch * 0.85 + pitch * 0.15;

  camera3D.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
  camera3D.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

  // ===== ALIGN =====
  const screen = project(targetMesh.position);
  const rect = document.getElementById("cameraBox").getBoundingClientRect();

  let gx = screen.x - rect.left;
  let gy = screen.y - rect.top;

  // clamp inside box (prevents ghost going outside)
  gx = Math.max(0, Math.min(rect.width, gx));
  gy = Math.max(0, Math.min(rect.height, gy));

  ghost.style.left = gx + "px";
  ghost.style.top = gy + "px";

  const dx = gx - rect.width/2;
  const dy = gy - rect.height/2;

  // 🔥 VERY EASY ALIGNMENT
  const aligned = Math.abs(dx) < 120 && Math.abs(dy) < 120;

  // ===== CAPTURE =====
  if (aligned) {

    if (!holding) {
      holding = true;
      holdStart = Date.now();
    }

    let p = (Date.now() - holdStart) / 600;

    progress.style.background =
      `conic-gradient(lime ${p*360}deg, transparent 0deg)`;

    if (p >= 1) {

      console.log("CAPTURE SUCCESS");

      const img = captureFrame();
      placeImage(img);

      holding = false;
      progress.style.background = "none";
      capturing = false;
    }

  } else {
    holding = false;
    progress.style.background = "none";
  }

});

});