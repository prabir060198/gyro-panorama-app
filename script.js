window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");
const progress = document.getElementById("progress");
const debug = document.getElementById("debug");
const capCanvas = document.getElementById("capCanvas");

let engine, scene, camera3D;

let yawOffset = null;
let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

// ===== YOUR RINGS (CORRECT) =====
const rings = [
  { pitch: 75,  yaws: [0, 180] },
  { pitch: 45,  yaws: [0,45,90,135,180,225,270,315] },
  { pitch: 0,   yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },
  { pitch: -45, yaws: [0,45,90,135,180,225,270,315] },
  { pitch: -75, yaws: [90, 270] }
];

let guidePoints = [];

// ===== INIT =====
function init3D(){

  engine = new BABYLON.Engine(canvas,true);
  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  createGuidePoints();

  engine.runRenderLoop(()=>scene.render());
}

// ===== CREATE 3D POINTS =====
function createGuidePoints(){

  rings.forEach(r => {
    r.yaws.forEach(yaw => {

      const y = BABYLON.Tools.ToRadians(yaw);
      const p = BABYLON.Tools.ToRadians(r.pitch);

      const pos = new BABYLON.Vector3(
        Math.sin(y)*Math.cos(p),
        Math.sin(p),
        Math.cos(y)*Math.cos(p)
      ).scale(3);

      const mesh = BABYLON.MeshBuilder.CreateSphere("pt",{diameter:0.12},scene);
      mesh.position = pos;

      const mat = new BABYLON.StandardMaterial("m",scene);
      mat.emissiveColor = new BABYLON.Color3(1,1,1);
      mesh.material = mat;

      guidePoints.push({
        mesh,
        yaw,
        pitch: r.pitch,
        done:false
      });
    });
  });
}

// ===== CAPTURE =====
function captureFrame(){
  const ctx = capCanvas.getContext("2d");
  capCanvas.width = video.videoWidth;
  capCanvas.height = video.videoHeight;
  ctx.drawImage(video,0,0);
  return capCanvas.toDataURL();
}

// ===== PLACE IMAGE =====
function placeImage(img, pos){

  const plane = BABYLON.MeshBuilder.CreatePlane("img",{size:1},scene);
  plane.position = pos.clone();
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const tex = new BABYLON.DynamicTexture("dt",{width:512,height:512},scene);
  const ctx = tex.getContext();

  const image = new Image();
  image.onload = ()=>{
    ctx.drawImage(image,0,0,512,512);
    tex.update();
  };
  image.src = img;

  const mat = new BABYLON.StandardMaterial("mat",scene);
  mat.diffuseTexture = tex;

  plane.material = mat;
}

// ===== START =====
startBtn.onclick = async ()=>{

  if(DeviceOrientationEvent.requestPermission){
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

  if(!camera3D || !capturing || e.alpha == null) return;

  // ===== RAW SENSOR =====
  let rawYaw = e.alpha;
  let rawPitch = e.beta - 90; // 🔥 FIXED (no inversion)

  if(yawOffset === null) yawOffset = rawYaw;

  let yaw = rawYaw - yawOffset;
  let pitch = rawPitch;

  // ===== SMOOTH =====
  smoothYaw = smoothYaw * 0.85 + yaw * 0.15;
  smoothPitch = smoothPitch * 0.85 + pitch * 0.15;

  // ===== CAMERA ROTATION =====
  camera3D.rotation.y = BABYLON.Tools.ToRadians(-smoothYaw);
  camera3D.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

  // ===== ACTIVE TARGET =====
  const active = guidePoints.find(p => !p.done);
  if(!active) return;

  let yawDiff = ((smoothYaw - active.yaw + 540) % 360) - 180;
  let pitchDiff = smoothPitch - active.pitch;

  // ===== DOT =====
  const maxOffset = 70;

  const x = (yawDiff / 30) * maxOffset;
  const y = (pitchDiff / 30) * maxOffset;

  dot.style.transform =
    `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

  // ===== ARROW (FIXED) =====
  if(Math.abs(yawDiff) > Math.abs(pitchDiff)){
    arrow.innerText = yawDiff > 0 ? "➡" : "⬅";
  } else {
    arrow.innerText = pitchDiff > 0 ? "⬆" : "⬇";
  }

  // ===== ALIGN =====
  const aligned =
    Math.abs(yawDiff) < 8 &&
    Math.abs(pitchDiff) < 8;

  if(aligned){

    if(!holding){
      holding = true;
      holdStart = Date.now();
    }

    let p = (Date.now() - holdStart) / 700;

    progress.style.background =
      `conic-gradient(lime ${p*360}deg, transparent 0deg)`;

    if(p >= 1){

      const img = captureFrame();
      placeImage(img, active.mesh.position);

      active.done = true;
      active.mesh.material.emissiveColor = new BABYLON.Color3(0,1,0);

      holding = false;
      progress.style.background = "none";
    }

  } else {
    holding = false;
    progress.style.background = "none";
  }

  // ===== DEBUG =====
  debug.innerHTML = `
Yaw: ${smoothYaw.toFixed(1)}<br>
Pitch: ${smoothPitch.toFixed(1)}<br>
TargetYaw: ${active.yaw}<br>
TargetPitch: ${active.pitch}
`;

});

});