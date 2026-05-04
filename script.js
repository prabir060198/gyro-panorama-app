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

// ===== INIT =====
function init3D(){

  engine = new BABYLON.Engine(canvas,true);
  engine.setHardwareScalingLevel(1/window.devicePixelRatio);

  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  const s = BABYLON.MeshBuilder.CreateSphere("s",{diameter:6},scene);
  const sm = new BABYLON.StandardMaterial("sm",scene);
  sm.wireframe = true;
  sm.alpha = 0.2;
  s.material = sm;

  targetMesh = BABYLON.MeshBuilder.CreateSphere("target",{diameter:0.3},scene);
  targetMesh.position = new BABYLON.Vector3(0,0,3);

  const tm = new BABYLON.StandardMaterial("tm",scene);
  tm.emissiveColor = new BABYLON.Color3(1,0.5,0);
  targetMesh.material = tm;

  engine.runRenderLoop(()=>scene.render());
  window.addEventListener("resize",()=>engine.resize());
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
  plane.position = targetMesh.position.clone();

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
  mat.emissiveColor = new BABYLON.Color3(1,1,1);

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
  let rawPitch = -(e.beta - 90);

  if(yawOffset === null) yawOffset = rawYaw;

  let yaw = rawYaw - yawOffset;
  let pitch = rawPitch;

  smoothYaw = smoothYaw*0.85 + yaw*0.15;
  smoothPitch = smoothPitch*0.85 + pitch*0.15;

  camera3D.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
  camera3D.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

  // ===== TRUE 3D ALIGNMENT =====
  const forward = new BABYLON.Vector3(
    Math.sin(BABYLON.Tools.ToRadians(smoothYaw)) * Math.cos(BABYLON.Tools.ToRadians(smoothPitch)),
    Math.sin(BABYLON.Tools.ToRadians(smoothPitch)),
    Math.cos(BABYLON.Tools.ToRadians(smoothYaw)) * Math.cos(BABYLON.Tools.ToRadians(smoothPitch))
  );

  const targetDir = targetMesh.position.normalize();

  const dotVal = BABYLON.Vector3.Dot(forward, targetDir);

  const error = 1 - dotVal;

  // ghost scale feedback
  ghost.style.transform =
    `translate(-50%, -50%) scale(${1 - error*3})`;

  const aligned = error < 0.15;

  // ===== CAPTURE =====
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

      setTimeout(()=>{
        placeImage(img);
      },50);

      holding = false;
      progress.style.background = "none";
    }

  } else {
    holding = false;
    progress.style.background = "none";
  }

});

});