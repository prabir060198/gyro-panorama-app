window.addEventListener("load", () => {

// ===== DOM =====
const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");
const captureScreen = document.getElementById("captureScreen");
const resultScreen = document.getElementById("resultScreen");

const video = document.getElementById("video");
const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");
const progress = document.getElementById("progress");
const debug = document.getElementById("debug");
const capCanvas = document.getElementById("capCanvas");

// ===== 3D =====
let engine, scene, camera3D;

// ===== STATE =====
let capturing = false;
let yawOffset = null;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

let capturedImages = [];
let captureData = [];

// ===== RINGS =====
const rings = [
  { pitch: 80, yaws: [0,180] },
  { pitch: 45, yaws: [0,60,120,180,240,300] },
  { pitch: 0,  yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },
  { pitch: -45, yaws: [0,60,120,180,240,300] },
  { pitch: -80, yaws: [90,270] }
];

let guidePoints = [];
let totalPoints = rings.reduce((s,r)=>s+r.yaws.length,0);

// ===== INIT =====
function init3D(){

  engine = new BABYLON.Engine(renderCanvas,true);
  scene = new BABYLON.Scene(engine);

  camera3D = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

  new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

  createPoints();

  engine.runRenderLoop(()=>scene.render());
}

// ===== CREATE POINTS =====
function createPoints(){

  rings.forEach(r=>{
    r.yaws.forEach(yaw=>{

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

      guidePoints.push({mesh,yaw,pitch:r.pitch,done:false});
    });
  });
}

// ===== START =====
startBtn.onclick = async ()=>{

  startScreen.style.display = "none";
  captureScreen.style.display = "block";

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
  yawOffset = null;
};

// ===== HELPERS =====
function norm360(a){ return (a%360+360)%360; }
function angleDiff(a,b){ return ((a-b+540)%360)-180; }

// ===== CAPTURE =====
function captureFrame(){

  const ctx = capCanvas.getContext("2d");

  const w = video.videoWidth;
  const h = video.videoHeight;

  capCanvas.width = w;
  capCanvas.height = h;

  ctx.drawImage(video,0,0,w,h);

  return {
    data: capCanvas.toDataURL(),
    width: w,
    height: h
  };
}

// ===== PLACE IMAGE (FIXED) =====
function placeImage(img,pos){

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
  mat.emissiveColor = new BABYLON.Color3(1,1,1);

  plane.material = mat;
}

// ===== SENSOR =====
window.addEventListener("deviceorientation", e => {

if(!capturing || e.alpha==null) return;

let rawYaw = e.alpha;
let rawPitch = e.beta - 90;

// ===== LOCK START =====
if(yawOffset === null){
  yawOffset = rawYaw;
}

// ===== RELATIVE YAW =====
let yaw = norm360(rawYaw - yawOffset);

// ===== SMOOTH =====
smoothYaw = norm360(smoothYaw + angleDiff(yaw, smoothYaw)*0.15);
smoothPitch = smoothPitch*0.85 + rawPitch*0.15;

// ===== CAMERA =====
camera3D.rotation = new BABYLON.Vector3(
  BABYLON.Tools.ToRadians(-smoothPitch),
  BABYLON.Tools.ToRadians(smoothYaw),
  0
);

// ===== ACTIVE =====
const active = guidePoints.find(p=>!p.done);
if(!active) return;

let yawDiff = -angleDiff(smoothYaw, active.yaw);
let pitchDiff = smoothPitch - active.pitch;

// ===== DOT =====
dot.style.transform =
`translate(calc(-50% + ${-(yawDiff/30)*70}px),
           calc(-50% + ${-(pitchDiff/30)*70}px))`;

// ===== ARROW =====
if(Math.abs(yawDiff)>Math.abs(pitchDiff)){
  arrow.innerText = yawDiff>0 ? "⬅":"➡";
}else{
  arrow.innerText = pitchDiff>0 ? "⬇":"⬆";
}

// ===== ALIGN =====
if(Math.abs(yawDiff)<8 && Math.abs(pitchDiff)<8){

  if(!holding){
    holding=true;
    holdStart=Date.now();
  }

  let p=(Date.now()-holdStart)/700;

  progress.style.background =
  `conic-gradient(lime ${p*360}deg, transparent 0deg)`;

  if(p>=1){

    const cap = captureFrame();

    capturedImages.push(cap.data);

    captureData.push({
      yaw: active.yaw,
      pitch: active.pitch,
      actualYaw: smoothYaw,
      actualPitch: smoothPitch,
      width: cap.width,
      height: cap.height
    });

    // 🔥 FIXED: SHOW PREVIEW
    placeImage(cap.data, active.mesh.position);

    active.done = true;
    active.mesh.material.emissiveColor =
      new BABYLON.Color3(0,1,0);

    holding=false;
    progress.style.background="none";

    if(capturedImages.length===totalPoints){
      alert("DONE");
    }
  }

}else{
  holding=false;
  progress.style.background="none";
}

// ===== DEBUG =====
debug.innerHTML = `
Yaw:${smoothYaw.toFixed(1)}
Pitch:${smoothPitch.toFixed(1)}
`;

});

});