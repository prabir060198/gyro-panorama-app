window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const ghost = document.getElementById("ghost");
const progress = document.getElementById("progress");
const captureCanvas = document.getElementById("captureCanvas");

let engine, scene, camera;
let targetMesh;

let yawOffset = null;
let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

// ===== INIT =====
function init3D(){

engine = new BABYLON.Engine(canvas,true);
engine.setHardwareScalingLevel(1 / window.devicePixelRatio);

scene = new BABYLON.Scene(engine);

camera = new BABYLON.FreeCamera("cam", BABYLON.Vector3.Zero(), scene);

new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

// sphere
const sphere = BABYLON.MeshBuilder.CreateSphere("s",{diameter:6},scene);
const mat = new BABYLON.StandardMaterial("m",scene);
mat.wireframe=true;
mat.alpha=0.2;
sphere.material=mat;

// 🔥 TARGET POINT (VISIBLE IN 3D)
targetMesh = BABYLON.MeshBuilder.CreateSphere("target",{diameter:0.25},scene);
targetMesh.position = spherical(0,0);

const tmat = new BABYLON.StandardMaterial("tm",scene);
tmat.emissiveColor = new BABYLON.Color3(1,0.5,0);
targetMesh.material = tmat;

engine.runRenderLoop(()=>scene.render());

window.addEventListener("resize",()=>{
engine.resize();
});

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

// ===== PROJECT FIX =====
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

// ===== PLACE IMAGE FIX =====
function placeImage(img,pos){

const plane = BABYLON.MeshBuilder.CreatePlane("img",{size:1},scene);

plane.position = pos.clone();
plane.lookAt(camera.position); // 🔥 FIX

const texture = new BABYLON.DynamicTexture("dt", {width:512,height:512}, scene);
const ctx = texture.getContext();

const image = new Image();
image.onload = ()=>{
ctx.drawImage(image,0,0,512,512);
texture.update();
};
image.src = img;

const mat = new BABYLON.StandardMaterial("mat",scene);
mat.diffuseTexture = texture;
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

// 🔥 FIXED YAW (NO DRIFT)
let rawYaw = e.alpha;

if(yawOffset===null) yawOffset=rawYaw;

let yaw = rawYaw - yawOffset;

// 🔥 FIXED PITCH
let pitch = -(e.beta - 90);

smoothYaw = smoothYaw*0.9 + yaw*0.1;
smoothPitch = smoothPitch*0.9 + pitch*0.1;

camera.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
camera.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

// ===== ALIGNMENT FIX =====
const screen = project(targetMesh.position);

const rect = document.getElementById("cameraBox").getBoundingClientRect();

const cx = rect.width/2;
const cy = rect.height/2;

const gx = screen.x - rect.left;
const gy = screen.y - rect.top;

ghost.style.left = gx+"px";
ghost.style.top = gy+"px";

const dx = gx - cx;
const dy = gy - cy;

// 🔥 MORE RELAXED
const aligned = Math.abs(dx)<80 && Math.abs(dy)<80;

// ===== CAPTURE =====
if(aligned){

if(!holding){
holding=true;
holdStart=Date.now();
}

let p=(Date.now()-holdStart)/700;

progress.style.background =
`conic-gradient(lime ${p*360}deg, transparent 0deg)`;

if(p>=1){

const img = captureFrame();
placeImage(img, targetMesh.position);

holding=false;
progress.style.background="none";
capturing=false;

console.log("CAPTURE SUCCESS");
}

}else{
holding=false;
progress.style.background="none";
}

});

});