window.addEventListener("load",()=>{

const startBtn=document.getElementById("startBtn");
const startScreen=document.getElementById("startScreen");
const captureScreen=document.getElementById("captureScreen");
const resultScreen=document.getElementById("resultScreen");
const video=document.getElementById("video");
const dot=document.getElementById("dot");
const arrow=document.getElementById("arrow");
const progress=document.getElementById("progress");
const debug=document.getElementById("debug");
const statusText=document.getElementById("status");

window.onerror=function(err){
debug.innerHTML="ERROR: "+err;
};

let smoothYaw=0;
let smoothPitch=0;
let smoothRoll=0;

let stableYaw=0;
let stablePitch=0;

let displayedYaw=0;
let displayedPitch=0;

let captureCooldown=false;
let isCapturingFrame=false;

let environmentLocked=false;
let worldLockYaw=0;

let capturing=false;
let holding=false;
let holdStart=0;

let capturedImages=[];
let captureData=[];

let stream;

let currentIndex=0;

let cameraFOV={
vertical:50,
horizontal:58,
width:0,
height:0,
aspect:0
};

const rings=[

{
pitch:75,
yaws:[0,120,240]
},

{
pitch:45,
yaws:[
0,36,72,108,144,
180,216,252,288,324
]
},

{
pitch:0,
yaws:[
0,30,60,90,120,150,
180,210,240,270,300,330
]
},

{
pitch:-45,
yaws:[
0,36,72,108,144,
180,216,252,288,324
]
},

{
pitch:-75,
yaws:[60,180,300]
}

];

const capturePoints=[];

rings.forEach(r=>{

r.yaws.forEach(yaw=>{

capturePoints.push({
yaw,
pitch:r.pitch
});

});

});

const totalPoints=
capturePoints.length;

function norm360(a){
return (a%360+360)%360;
}

function angleDiff(a,b){
return ((a-b+540)%360)-180;
}

function getStablePitch(beta){

let pitch=beta-90;

if(pitch>90) pitch=90;
if(pitch<-90) pitch=-90;

return pitch;
}

startBtn.onclick=async()=>{

try{

startScreen.style.display="none";
captureScreen.style.display="block";

statusText.innerHTML=
"Opening camera...";

if(
typeof DeviceOrientationEvent!=="undefined" &&
typeof DeviceOrientationEvent.requestPermission==="function"
){

const permission=
await DeviceOrientationEvent.requestPermission();

debug.innerHTML=
"Permission: "+permission;
}

stream=
await navigator.mediaDevices.getUserMedia({

video:{
facingMode:{
ideal:"environment"
},
width:{
ideal:1920
},
height:{
ideal:1080
}
}

});

video.srcObject=stream;

await video.play();

cameraFOV.width=
video.videoWidth;

cameraFOV.height=
video.videoHeight;

cameraFOV.aspect=
video.videoWidth/video.videoHeight;

capturing=true;

statusText.innerHTML=
"Move phone to start";

}catch(err){

debug.innerHTML=
"START ERROR:<br>"+err;
}

};

window.addEventListener(

"deviceorientation",

async e=>{

try{

if(!capturing) return;

if(
captureCooldown ||
isCapturingFrame
){
return;
}

if(e.alpha==null){

debug.innerHTML=
"No sensor data";

return;
}

let rawYaw=
360-e.alpha;

let rawPitch=
getStablePitch(
e.beta||0
);

let rawRoll=
e.gamma||0;

if(!environmentLocked){

worldLockYaw=rawYaw;

environmentLocked=true;

debug.innerHTML=
"Environment Locked";
}

let yaw=
norm360(
rawYaw-worldLockYaw
);

let pitch=
rawPitch;

smoothYaw=
norm360(

smoothYaw+

angleDiff(
yaw,
smoothYaw
)*0.14

);

smoothPitch+=
(pitch-smoothPitch)*0.20;

smoothRoll+=
(rawRoll-smoothRoll)*0.12;

stableYaw=
norm360(

stableYaw+

angleDiff(
smoothYaw,
stableYaw
)*0.35

);

stablePitch+=
(smoothPitch-stablePitch)*0.35;

displayedYaw=
norm360(

displayedYaw+

angleDiff(
stableYaw,
displayedYaw
)*0.55

);

displayedPitch+=
(stablePitch-displayedPitch)*0.55;

const active=
capturePoints[currentIndex];

if(!active){

finish();
return;
}

let yawDiff=
angleDiff(
stableYaw,
active.yaw
);

let pitchDiff=
active.pitch-
stablePitch;

let displayYawDiff=
angleDiff(
displayedYaw,
active.yaw
);

let displayPitchDiff=
active.pitch-
displayedPitch;

let visualYaw=
displayYawDiff;

let visualPitch=
displayPitchDiff;

if(Math.abs(visualYaw)<2)
visualYaw=0;

if(Math.abs(visualPitch)<2)
visualPitch=0;

visualYaw=
Math.max(
-18,
Math.min(18,visualYaw)
);

visualPitch=
Math.max(
-18,
Math.min(18,visualPitch)
);

dot.style.transform=
`
translate(
calc(-50% + ${-(visualYaw/18)*70}px),
calc(-50% + ${(visualPitch/18)*70}px)
)
`;

if(
Math.abs(yawDiff)>
Math.abs(pitchDiff)
){

arrow.innerText=
yawDiff>0?"⬅":"➡";

}else{

arrow.innerText=
pitchDiff>0?"⬆":"⬇";
}

statusText.innerHTML=
`
Captured ${capturedImages.length}
/ ${totalPoints}

<br>

Target:
Y ${active.yaw}
P ${active.pitch}
`;

const aligned=

Math.abs(yawDiff)<10 &&
Math.abs(pitchDiff)<10;

if(aligned){

if(!holding){

holding=true;

holdStart=
Date.now();
}

let progressValue=
(Date.now()-holdStart)/500;

progress.style.background=
`
conic-gradient(
lime ${progressValue*360}deg,
transparent 0deg
)
`;

if(
progressValue>=1 &&
!captureCooldown &&
!isCapturingFrame
){

isCapturingFrame=true;
captureCooldown=true;

holding=false;

progress.style.background=
"none";

const currentCapture=
capturePoints[currentIndex];

await capture(
currentCapture
);

currentIndex++;

await new Promise(r=>
setTimeout(r,550)
);

captureCooldown=false;
isCapturingFrame=false;
}

}else{

holding=false;

progress.style.background=
"none";
}

debug.innerHTML=
`
StableYaw:
${stableYaw.toFixed(1)}

<br>

StablePitch:
${stablePitch.toFixed(1)}

<br>

Roll:
${smoothRoll.toFixed(1)}

<br>

Captured:
${capturedImages.length}

<br>

TargetYaw:
${active.yaw}

<br>

TargetPitch:
${active.pitch}
`;

}catch(err){

debug.innerHTML=
"SENSOR ERROR:<br>"+err;
}

});

async function capture(active){

const canvas=
document.createElement("canvas");

canvas.width=
video.videoWidth;

canvas.height=
video.videoHeight;

const ctx=
canvas.getContext("2d");

ctx.drawImage(
video,
0,
0
);

const imgData=
canvas.toDataURL(
"image/png"
);

capturedImages.push(
imgData
);

captureData.push({

index:
capturedImages.length,

file:
`img_${capturedImages.length}.png`,

targetYaw:
active.yaw,

targetPitch:
active.pitch,

actualYaw:
stableYaw,

actualPitch:
stablePitch,

roll:
smoothRoll,

camera:{

width:
cameraFOV.width,

height:
cameraFOV.height,

aspect:
cameraFOV.aspect,

fovHorizontal:
cameraFOV.horizontal,

fovVertical:
cameraFOV.vertical

},

deviceOrientation:{

yaw:
stableYaw,

pitch:
stablePitch,

roll:
smoothRoll

},

timestamp:
Date.now()

});

}

function finish(){

capturing=false;

if(stream){

stream.getTracks().forEach(track=>{

track.stop();

});

}

video.srcObject=null;

captureScreen.style.display=
"none";

resultScreen.style.display=
"block";

statusText.innerHTML=
"Capture Complete";

const gallery=
document.getElementById(
"gallery"
);

gallery.innerHTML="";

capturedImages.forEach(img=>{

const el=
document.createElement("img");

el.src=img;

gallery.appendChild(el);

});

}

document.getElementById(
"downloadBtn"
).onclick=async()=>{

const zip=
new JSZip();

capturedImages.forEach((img,i)=>{

zip.file(

`img_${i+1}.png`,

img.split(",")[1],

{base64:true}

);

});

const stitchData={

camera:{

width:
cameraFOV.width,

height:
cameraFOV.height,

aspect:
cameraFOV.aspect,

fovHorizontal:
cameraFOV.horizontal,

fovVertical:
cameraFOV.vertical

},

totalCaptures:
captureData.length,

images:[]

};

captureData.forEach(d=>{

stitchData.images.push({

name:
d.file,

yaw:
d.actualYaw,

pitch:
d.actualPitch,

roll:
d.roll,

targetYaw:
d.targetYaw,

targetPitch:
d.targetPitch,

camera:
d.camera,

timestamp:
d.timestamp

});

});

zip.file(

"data.json",

JSON.stringify(
stitchData,
null,
2
)

);

const blob=
await zip.generateAsync({

type:"blob",

compression:"DEFLATE",

compressionOptions:{
level:6
}

});

const a=
document.createElement("a");

a.href=
URL.createObjectURL(blob);

a.download=
"360_capture.zip";

a.click();

};

});