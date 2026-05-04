window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");

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

const rings = [
  { pitch: 0, yaws: [0,90,180,270] }
];

let guidePoints = [];

// ===== INIT =====
function init3D(){

  engine = new BABYLON.Engine(canvas,true);
  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam",
    new BABYLON.Vector3(0,0,0), scene);

  camera3D.fov = 1.2;

  new BABYLON.HemisphericLight("l",
    new BABYLON.Vector3(0,1,0), scene);

  createPoints();

  engine.runRenderLoop(()=>{
    scene.render();
  });
}

// ===== CREATE POINT =====
function createPoints(){

  const mesh = BABYLON.MeshBuilder.CreateSphere("pt",{diameter:0.2},scene);
  mesh.position = new BABYLON.Vector3(0,0,3);

  const mat = new BABYLON.StandardMaterial("m",scene);
  mat.emissiveColor = new BABYLON.Color3(1,1,1);
  mesh.material = mat;

  guidePoints.push({mesh,yaw:0,pitch:0,done:false});
}

// ===== START =====
startBtn.onclick = async ()=>{

  startScreen.style.display = "none";

  if(DeviceOrientationEvent.requestPermission){
    await DeviceOrientationEvent.requestPermission();
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"environment"}
  });

  video.srcObject = stream;
  await video.play();

  init3D();

  capturing = true;
};

// ===== CAPTURE =====
function captureFrame(){

  const ctx = capCanvas.getContext("2d");

  capCanvas.width = video.videoWidth;
  capCanvas.height = video.videoHeight;

  ctx.drawImage(video,0,0);

  return capCanvas.toDataURL();
}

// ===== 🔥 FIXED PREVIEW =====
function placeImage(imgData){

  const plane = BABYLON.MeshBuilder.CreatePlane("img",{size:2},scene);

  // 🔥 IMPORTANT: ALWAYS IN FRONT
  plane.position = new BABYLON.Vector3(0,0,3);

  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const texture = new BABYLON.Texture(imgData, scene);

  const mat = new BABYLON.StandardMaterial("mat", scene);
  mat.diffuseTexture = texture;
  mat.emissiveColor = new BABYLON.Color3(1,1,1);

  plane.material = mat;
}

// ===== SENSOR =====
window.addEventListener("deviceorientation", e => {

if(!capturing || e.alpha==null) return;

let yaw = e.alpha;
let pitch = e.beta - 90;

camera3D.rotation = new BABYLON.Vector3(
  BABYLON.Tools.ToRadians(-pitch),
  BABYLON.Tools.ToRadians(yaw),
  0
);

// ===== ALIGN =====
if(Math.abs(pitch)<5){

  if(!holding){
    holding=true;
    holdStart=Date.now();
  }

  if(Date.now()-holdStart > 800){

    const img = captureFrame();

    // 🔥 NOW WILL ALWAYS SHOW
    placeImage(img);

    holding=false;
  }

}else{
  holding=false;
}

// DEBUG
debug.innerHTML = `Yaw:${yaw.toFixed(1)} Pitch:${pitch.toFixed(1)}`;

});

});