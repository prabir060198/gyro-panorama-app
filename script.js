window.addEventListener("load", () => {

const canvas = document.getElementById("renderCanvas");
const video = document.getElementById("video");
const ghost = document.getElementById("ghost");
const progress = document.getElementById("progress");
const captureCanvas = document.getElementById("captureCanvas");

let engine, scene, camera;

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

camera = new BABYLON.FreeCamera("cam",BABYLON.Vector3.Zero(),scene);

new BABYLON.HemisphericLight("l", new BABYLON.Vector3(0,1,0), scene);

const s = BABYLON.MeshBuilder.CreateSphere("s",{diameter:6},scene);
const mat = new BABYLON.StandardMaterial("m",scene);
mat.wireframe=true;
mat.alpha=0.3;
s.material=mat;

// single capture point
targetPos = spherical(0,0);

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

// ===== SHOW IMAGE =====
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

let rawYaw = e.alpha;
let rawPitch = e.beta - 90;

if(yawOffset===null) yawOffset=rawYaw;

let yaw = rawYaw - yawOffset;
let pitch = -rawPitch;

smoothYaw = smoothYaw*0.9 + yaw*0.1;
smoothPitch = smoothPitch*0.9 + pitch*0.1;

camera.rotation.y = BABYLON.Tools.ToRadians(smoothYaw);
camera.rotation.x = BABYLON.Tools.ToRadians(smoothPitch);

// ===== ALIGN =====
const screen = project(targetPos);

const rect = document.getElementById("cameraBox").getBoundingClientRect();

const cx = rect.width/2;
const cy = rect.height/2;

const dx = (screen.x - rect.left) - cx;
const dy = (screen.y - rect.top) - cy;

ghost.style.left = (screen.x - rect.left)+"px";
ghost.style.top = (screen.y - rect.top)+"px";

const aligned = Math.abs(dx)<60 && Math.abs(dy)<60;

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

console.log("CAPTURE WORKED");

const img = captureFrame();
placeImage(img,targetPos);

holding=false;
progress.style.background="none";
capturing=false;
}

}else{
holding=false;
progress.style.background="none";
}

});

});