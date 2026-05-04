window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const progress = document.getElementById("progress");
const capCanvas = document.getElementById("capCanvas");

let engine, scene, camera3D;

let yawOffset = null;
let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

// 🎯 TARGET (front)
const targetYaw = 0;
const targetPitch = 0;

// ===== INIT =====
function init3D(){

  engine = new BABYLON.Engine(canvas,true);
  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  const s = BABYLON.MeshBuilder.CreateSphere("s",{diameter:6},scene);
  const sm = new BABYLON.StandardMaterial("sm",scene);
  sm.wireframe = true;
  sm.alpha = 0.2;
  s.material = sm;

  engine.runRenderLoop(()=>scene.render());
}

// ===== CAPTURE =====
function captureFrame(){
  const ctx = capCanvas.getContext("2d");
  capCanvas.width = video.videoWidth;
  capCanvas.height = video.videoHeight;
  ctx.drawImage(video,0,0);
  return capCanvas.toDataURL("image/png");
}

// ===== PLACE IMAGE =====
function placeImage(img){

  const plane = BABYLON.MeshBuilder.CreatePlane("img",{size:1},scene);

  plane.position = new BABYLON.Vector3(0,0,3);
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

  let rawYaw = e.alpha;
  let rawPitch = e.beta - 90;

  if(yawOffset === null) yawOffset = rawYaw;

  let yaw = rawYaw - yawOffset;
  let pitch = rawPitch;

  smoothYaw = smoothYaw*0.85 + yaw*0.15;
  smoothPitch = smoothPitch*0.85 + pitch*0.15;

  camera3D.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
  camera3D.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

  // 🎯 DIRECT ALIGNMENT (NO PROJECTION)
  let yawDiff = ((yaw - targetYaw + 540) % 360) - 180;
  let pitchDiff = pitch - targetPitch;

  // 🔥 VERY EASY
  const aligned =
    Math.abs(yawDiff) < 20 &&
    Math.abs(pitchDiff) < 20;

  if(aligned){

    if(!holding){
      holding = true;
      holdStart = Date.now();
    }

    let p = (Date.now() - holdStart) / 700;

    progress.style.background =
      `conic-gradient(lime ${p*360}deg, transparent 0deg)`;

    if(p >= 1){

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