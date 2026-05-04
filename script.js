window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const ghost = document.getElementById("targetGhost");
const progressCircle = document.getElementById("progressCircle");
const debugBox = document.getElementById("debugBox");
const captureCanvas = document.getElementById("captureCanvas");

let engine, scene, camera;

let yawOffset = null;
let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let stageIndex = 0;
let pointIndex = 0;

let guidePoints = [];

let holding = false;
let holdStart = 0;

// ===== FLOW =====
const captureFlow = [
  [{ pitch: 0, yaw: 0 }],
  [
    { pitch: 0, yaw: 0 },
    { pitch: 0, yaw: 90 },
    { pitch: 0, yaw: 180 },
    { pitch: 0, yaw: 270 }
  ],
  [
    { pitch: 45, yaw: 0 },
    { pitch: 45, yaw: 90 },
    { pitch: 45, yaw: 180 },
    { pitch: 45, yaw: 270 }
  ],
  [
    { pitch: -45, yaw: 0 },
    { pitch: -45, yaw: 90 },
    { pitch: -45, yaw: 180 },
    { pitch: -45, yaw: 270 }
  ]
];

// ===== INIT =====
function init3D(){

engine = new BABYLON.Engine(canvas,true);
engine.setHardwareScalingLevel(1/window.devicePixelRatio);

scene = new BABYLON.Scene(engine);

camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

const s = BABYLON.MeshBuilder.CreateSphere("s",{diameter:6},scene);
const mat = new BABYLON.StandardMaterial("m",scene);
mat.wireframe=true;
mat.alpha=0.3;
s.material=mat;

createStagePoints();

engine.runRenderLoop(()=>scene.render());
window.addEventListener("resize",()=>engine.resize());
}

// ===== SPHERE =====
function spherical(yaw,pitch){
const y = BABYLON.Tools.ToRadians(yaw);
const p = BABYLON.Tools.ToRadians(pitch);

return new BABYLON.Vector3(
  Math.sin(y)*Math.cos(p),
  Math.sin(p),
  Math.cos(y)*Math.cos(p)
).scale(3);
}

// ===== CREATE POINTS =====
function createStagePoints(){

guidePoints.forEach(g=>g.mesh.dispose());
guidePoints=[];

const stage = captureFlow[stageIndex];

stage.forEach((p,i)=>{
const mesh = BABYLON.MeshBuilder.CreateSphere("p",{diameter:0.18},scene);
mesh.position = spherical(p.yaw,p.pitch);

const m = new BABYLON.StandardMaterial("m",scene);
m.emissiveColor = new BABYLON.Color3(1,1,1);
mesh.material = m;

guidePoints.push({
mesh,
yaw:p.yaw,
pitch:p.pitch,
done:false
});
});

pointIndex=0;
}

// ===== PROJECT =====
function project(pos){
const p = BABYLON.Vector3.Project(
pos,
BABYLON.Matrix.Identity(),
scene.getTransformMatrix(),
camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight())
);
return {x:p.x,y:p.y};
}

// ===== CAPTURE =====
function captureFrame(){

const ctx = captureCanvas.getContext("2d");
captureCanvas.width = video.videoWidth;
captureCanvas.height = video.videoHeight;

ctx.drawImage(video,0,0);

return captureCanvas.toDataURL("image/png");
}

// ===== PLACE IMAGE =====
function placeImage(img,pos){

const plane = BABYLON.MeshBuilder.CreatePlane("img",{size:0.8},scene);
plane.position = pos.clone();
plane.lookAt(BABYLON.Vector3.Zero());

const tex = new BABYLON.Texture(img,scene);
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
capturing=true;
yawOffset=null;
};

// ===== ORIENTATION =====
window.addEventListener("deviceorientation",e=>{

if(!camera || !capturing || e.alpha==null) return;

let yaw=(e.alpha+360)%360;
let pitch=-(e.beta-90);

pitch=Math.max(-90,Math.min(90,pitch));

if(yawOffset===null) yawOffset=yaw;
yaw=(yaw-yawOffset+360)%360;

smoothYaw = smoothYaw*0.9 + yaw*0.1;
smoothPitch = smoothPitch*0.9 + pitch*0.1;

camera.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
camera.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

// ACTIVE
const active = guidePoints[pointIndex];
if(!active) return;

const screen = project(active.mesh.position);

ghost.style.left = screen.x+"px";
ghost.style.top = screen.y+"px";

// ALIGN
const cx = engine.getRenderWidth()/2;
const cy = engine.getRenderHeight()/2;

const dx = screen.x-cx;
const dy = screen.y-cy;

const aligned = Math.abs(dx)<30 && Math.abs(dy)<30;

// HOLD
if(aligned){

if(!holding){
holding=true;
holdStart=Date.now();
}

let progress=(Date.now()-holdStart)/700;

progressCircle.style.background=
`conic-gradient(lime ${progress*360}deg, transparent 0deg)`;

if(progress>=1){

const img = captureFrame();
placeImage(img, active.mesh.position);

active.done=true;

pointIndex++;

if(pointIndex>=guidePoints.length){
stageIndex++;

if(stageIndex < captureFlow.length){
createStagePoints();
}
}

holding=false;
progressCircle.style.background="none";
}

}else{
holding=false;
progressCircle.style.background="none";
}

// COLOR
guidePoints.forEach((g,i)=>{
if(g.done){
g.mesh.material.emissiveColor=new BABYLON.Color3(0,1,0);
}else if(i===pointIndex){
g.mesh.material.emissiveColor=new BABYLON.Color3(1,0.5,0);
}else{
g.mesh.material.emissiveColor=new BABYLON.Color3(1,1,1);
}
});

// DEBUG
debugBox.innerHTML=
`Yaw:${smoothYaw.toFixed(1)}<br>
Pitch:${smoothPitch.toFixed(1)}<br>
dx:${dx.toFixed(1)} dy:${dy.toFixed(1)}<br>
aligned:${aligned}`;

});

});