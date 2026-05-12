window.addEventListener("load", () => {

const startScreen =
document.getElementById("startScreen");

const captureScreen =
document.getElementById("captureScreen");

const resultScreen =
document.getElementById("resultScreen");

const video =
document.getElementById("video");

const dot =
document.getElementById("dot");

const arrow =
document.getElementById("arrow");

const progress =
document.getElementById("progress");

const debug =
document.getElementById("debug");

const statusText =
document.getElementById("status");

const modeButtons =
document.querySelectorAll(".modeBtn");

let smoothYaw = 0;
let smoothPitch = 0;

let stableYaw = 0;
let stablePitch = 0;

let displayYaw = 0;
let displayPitch = 0;

let captureCooldown = false;
let isCapturing = false;

let worldLockYaw = 0;
let environmentLocked = false;

let capturing = false;

let holding = false;
let holdStart = 0;

let stream;

let currentIndex = 0;

let capturedImages = [];
let captureData = [];

let capturePoints = [];
let totalPoints = 0;

let previousDescriptors = null;

let featureMatchScore = 0;
let overlapConfidence = 0;
let blurScore = 0;

function norm360(a){

return (a % 360 + 360) % 360;

}

function angleDiff(a,b){

return ((a - b + 540) % 360) - 180;

}

function getPitch(beta){

let pitch = beta - 90;

if(pitch > 90) pitch = 90;
if(pitch < -90) pitch = -90;

return pitch;

}

function detectBlur(gray){

const lap = new cv.Mat();

cv.Laplacian(
gray,
lap,
cv.CV_64F
);

const mean = new cv.Mat();
const stddev = new cv.Mat();

cv.meanStdDev(
lap,
mean,
stddev
);

const variance =
stddev.doubleAt(0,0) *
stddev.doubleAt(0,0);

lap.delete();
mean.delete();
stddev.delete();

return variance;

}

async function analyzeFrame(){

if(
typeof cv === "undefined" ||
!video.videoWidth
){
return;
}

const canvas =
document.createElement("canvas");

canvas.width = 320;
canvas.height = 240;

const ctx =
canvas.getContext("2d");

ctx.drawImage(
video,
0,
0,
320,
240
);

const src =
cv.imread(canvas);

const gray =
new cv.Mat();

cv.cvtColor(
src,
gray,
cv.COLOR_RGBA2GRAY
);

blurScore =
detectBlur(gray);

const orb =
new cv.ORB(800);

const keypoints =
new cv.KeyPointVector();

const descriptors =
new cv.Mat();

orb.detectAndCompute(
gray,
new cv.Mat(),
keypoints,
descriptors
);

featureMatchScore = 0;
overlapConfidence = 0;

if(
previousDescriptors &&
!previousDescriptors.empty() &&
!descriptors.empty()
){

const matcher =
new cv.BFMatcher(
cv.NORM_HAMMING,
false
);

const matches =
new cv.DMatchVectorVector();

matcher.knnMatch(
descriptors,
previousDescriptors,
matches,
2
);

let goodMatches = 0;

for(
let i = 0;
i < matches.size();
i++
){

const pair =
matches.get(i);

if(pair.size() < 2)
continue;

const m1 = pair.get(0);
const m2 = pair.get(1);

if(
m1.distance <
0.75 * m2.distance
){

goodMatches++;

}

}

featureMatchScore =
goodMatches /
Math.max(
keypoints.size(),
1
);

overlapConfidence =
Math.min(
featureMatchScore * 2,
1
);

matches.delete();
matcher.delete();

}

if(previousDescriptors){

previousDescriptors.delete();

}

previousDescriptors =
descriptors.clone();

src.delete();
gray.delete();
descriptors.delete();
keypoints.delete();
orb.delete();

}

function setMode(mode){

capturePoints = [];

if(mode === "horizontal"){

for(
let y = 0;
y < 360;
y += 20
){

capturePoints.push({

yaw:y,
pitch:0

});

}

}
else{

const rings = [

{
pitch:60,
yaws:[0,90,180,270]
},

{
pitch:20,
yaws:[
0,30,60,90,
120,150,180,210,
240,270,300,330
]
},

{
pitch:-20,
yaws:[
15,45,75,105,
135,165,195,225,
255,285,315,345
]
},

{
pitch:-60,
yaws:[45,135,225,315]
}

];

rings.forEach(r=>{

r.yaws.forEach(yaw=>{

capturePoints.push({

yaw,
pitch:r.pitch

});

});

});

}

totalPoints =
capturePoints.length;

}

modeButtons.forEach(btn=>{

btn.onclick = async()=>{

setMode(
btn.dataset.mode
);

try{

startScreen.style.display =
"none";

captureScreen.style.display =
"block";

if(
typeof DeviceOrientationEvent !== "undefined" &&
typeof DeviceOrientationEvent.requestPermission === "function"
){

await DeviceOrientationEvent
.requestPermission();

}

stream =
await navigator.mediaDevices
.getUserMedia({

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

video.srcObject = stream;

await video.play();

capturing = true;

}
catch(err){

debug.innerHTML = err;

}

};

});

window.addEventListener(
"deviceorientation",
async e=>{

if(!capturing) return;

if(
captureCooldown ||
isCapturing
){
return;
}

let rawYaw =
360 - e.alpha;

let rawPitch =
getPitch(
e.beta || 0
);

if(!environmentLocked){

worldLockYaw =
rawYaw;

environmentLocked = true;

}

let yaw =
norm360(
rawYaw - worldLockYaw
);

smoothYaw =
norm360(

smoothYaw +

angleDiff(
yaw,
smoothYaw
) * 0.08

);

smoothPitch +=
(rawPitch - smoothPitch) * 0.1;

stableYaw =
norm360(

stableYaw +

angleDiff(
smoothYaw,
stableYaw
) * 0.2

);

stablePitch +=
(smoothPitch - stablePitch) * 0.2;

displayYaw =
norm360(

displayYaw +

angleDiff(
stableYaw,
displayYaw
) * 0.16

);

displayPitch +=
(stablePitch - displayPitch) * 0.16;

const active =
capturePoints[currentIndex];

if(!active){

finish();
return;

}

let yawDiff =
angleDiff(
stableYaw,
active.yaw
);

let pitchDiff =
active.pitch -
stablePitch;

let visualYaw =
angleDiff(
displayYaw,
active.yaw
);

let visualPitch =
active.pitch -
displayPitch;

dot.style.transform =
`
translate(
calc(-50% + ${-(visualYaw / 20) * 40}px),
calc(-50% + ${(visualPitch / 20) * 40}px)
)
`;

await analyzeFrame();

const aligned =

Math.abs(yawDiff) < 8 &&
Math.abs(pitchDiff) < 8;

const motionStable =

Math.abs(
angleDiff(
smoothYaw,
stableYaw
)
) < 3 &&

Math.abs(
smoothPitch -
stablePitch
) < 3;

if(
Math.abs(yawDiff) > 8 ||
Math.abs(pitchDiff) > 8
){

if(
Math.abs(yawDiff) >
Math.abs(pitchDiff)
){

arrow.innerText =
yawDiff > 0
? "⬅"
: "➡";

}
else{

arrow.innerText =
pitchDiff > 0
? "⬆"
: "⬇";

}

}
else{

arrow.innerText = "✅";

}

if(
aligned &&
motionStable
){

if(!holding){

holding = true;
holdStart = Date.now();

}

let progressValue =
(Date.now() - holdStart) / 500;

progress.style.background =
`
conic-gradient(
lime ${progressValue * 360}deg,
transparent 0deg
)
`;

if(progressValue >= 1){

isCapturing = true;
captureCooldown = true;

await capture(active);

currentIndex++;

holding = false;

progress.style.background =
"none";

await new Promise(r=>
setTimeout(r,300)
);

captureCooldown = false;
isCapturing = false;

}

}
else{

holding = false;

progress.style.background =
"none";

}

statusText.innerHTML =
`
Captured
${capturedImages.length}
/
${totalPoints}
`;

debug.innerHTML =
`
Feature:
${featureMatchScore.toFixed(2)}

<br>

Overlap:
${(overlapConfidence * 100).toFixed(0)}%

<br>

Blur:
${blurScore.toFixed(0)}

<br><br>

Yaw:
${stableYaw.toFixed(1)}

<br>

Pitch:
${stablePitch.toFixed(1)}
`;

});

async function capture(active){

const canvas =
document.createElement("canvas");

canvas.width =
video.videoWidth;

canvas.height =
video.videoHeight;

const ctx =
canvas.getContext("2d");

ctx.drawImage(
video,
0,
0
);

const img =
canvas.toDataURL(
"image/jpeg",
0.92
);

capturedImages.push(img);

captureData.push({

file:
`img_${capturedImages.length}.jpg`,

yaw:
stableYaw,

pitch:
stablePitch,

targetYaw:
active.yaw,

targetPitch:
active.pitch,

feature:
featureMatchScore,

overlap:
overlapConfidence,

blur:
blurScore,

timestamp:
Date.now()

});

}

function finish(){

capturing = false;

if(stream){

stream.getTracks()
.forEach(track=>{

track.stop();

});

}

captureScreen.style.display =
"none";

resultScreen.style.display =
"block";

const gallery =
document.getElementById(
"gallery"
);

capturedImages.forEach(img=>{

const el =
document.createElement("img");

el.src = img;

gallery.appendChild(el);

});

}

document.getElementById(
"downloadBtn"
).onclick = async()=>{

const zip =
new JSZip();

capturedImages.forEach((img,i)=>{

zip.file(

`img_${i + 1}.jpg`,

img.split(",")[1],

{
base64:true
}

);

});

zip.file(

"data.json",

JSON.stringify({

images:
captureData

},
null,
2)

);

const blob =
await zip.generateAsync({

type:"blob"

});

const a =
document.createElement("a");

a.href =
URL.createObjectURL(blob);

a.download =
"panorama_capture.zip";

a.click();

};

});