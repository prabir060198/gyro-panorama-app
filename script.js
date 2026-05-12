window.addEventListener("load", async()=>{

const video =
document.getElementById("video");

const preview =
document.getElementById("preview");

const ctx =
preview.getContext("2d");

const statusText =
document.getElementById("status");

const debug =
document.getElementById("debug");

const captureCount =
document.getElementById("captureCount");

const loading =
document.getElementById("loading");

const startBtn =
document.getElementById("startBtn");

let stream;

let running = false;

let lastCaptureTime = 0;

let previousDescriptors = null;
let previousKeypoints = null;

let captures = [];

let overlap = 0;
let blurScore = 0;
let visualDistance = 0;
let goodMatchesCount = 0;

let focalLength = 700;

while(
typeof cv === "undefined" ||
!cv.Mat
){

await new Promise(r=>
setTimeout(r,100)
);

}

loading.style.display =
"none";

preview.width =
window.innerWidth;

preview.height =
window.innerHeight;

startBtn.onclick = async()=>{

startBtn.style.display =
"none";

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

running = true;

processLoop();

};

function detectBlur(gray){

const lap =
new cv.Mat();

cv.Laplacian(
gray,
lap,
cv.CV_64F
);

const mean =
new cv.Mat();

const stddev =
new cv.Mat();

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

function cylindricalWarp(src,f){

const dst =
new cv.Mat.zeros(
src.rows,
src.cols,
src.type()
);

const cx = src.cols / 2;
const cy = src.rows / 2;

for(let y=0;y<src.rows;y++){

for(let x=0;x<src.cols;x++){

const theta =
(x - cx) / f;

const h =
(y - cy) / f;

const X =
Math.sin(theta);

const Y = h;

const Z =
Math.cos(theta);

const x2 =
f * X / Z + cx;

const y2 =
f * Y / Z + cy;

if(
x2 >= 0 &&
x2 < src.cols &&
y2 >= 0 &&
y2 < src.rows
){

const pixel =
src.ucharPtr(y,x);

const target =
dst.ucharPtr(
Math.floor(y2),
Math.floor(x2)
);

for(let i=0;i<4;i++){

target[i] = pixel[i];

}

}

}

}

return dst;

}

async function processLoop(){

if(!running)
return;

ctx.clearRect(
0,
0,
preview.width,
preview.height
);

const canvas =
document.createElement("canvas");

canvas.width = 480;
canvas.height = 270;

const cctx =
canvas.getContext("2d");

cctx.drawImage(
video,
0,
0,
480,
270
);

const src =
cv.imread(canvas);

const warped =
cylindricalWarp(
src,
focalLength
);

const gray =
new cv.Mat();

cv.cvtColor(
warped,
gray,
cv.COLOR_RGBA2GRAY
);

blurScore =
detectBlur(gray);

const orb =
new cv.ORB(1200);

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

let goodMatches = [];

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

for(
let i=0;
i<matches.size();
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
0.72 * m2.distance
){

goodMatches.push(m1);

}

}

const srcPoints = [];
const dstPoints = [];

for(const m of goodMatches){

const p1 =
keypoints.get(m.queryIdx).pt;

const p2 =
previousKeypoints.get(m.trainIdx).pt;

srcPoints.push(p1.x,p1.y);
dstPoints.push(p2.x,p2.y);

ctx.beginPath();

ctx.arc(
p1.x * 2,
p1.y * 2,
3,
0,
Math.PI * 2
);

ctx.fillStyle =
"lime";

ctx.fill();

ctx.beginPath();

ctx.moveTo(
p1.x * 2,
p1.y * 2
);

ctx.lineTo(
p2.x * 2,
p2.y * 2
);

ctx.strokeStyle =
"rgba(0,255,0,0.4)";

ctx.stroke();

}

if(goodMatches.length > 12){

const srcMat =
cv.matFromArray(
goodMatches.length,
1,
cv.CV_32FC2,
srcPoints
);

const dstMat =
cv.matFromArray(
goodMatches.length,
1,
cv.CV_32FC2,
dstPoints
);

const H =
cv.findHomography(
srcMat,
dstMat,
cv.RANSAC,
5
);

if(H && !H.empty()){

const tx =
H.data64F[2];

const ty =
H.data64F[5];

visualDistance =
Math.sqrt(
tx * tx +
ty * ty
);

}

srcMat.delete();
dstMat.delete();

if(H)
H.delete();

}

matcher.delete();
matches.delete();

}

goodMatchesCount =
goodMatches.length;

overlap =
Math.min(
goodMatches.length / 120,
1
);

const shouldCapture =

visualDistance > 55 &&

overlap > 0.15 &&

blurScore > 35 &&

Date.now() -
lastCaptureTime >
1200;

if(shouldCapture){

capture(canvas);

lastCaptureTime =
Date.now();

}

statusText.innerHTML =
`
Move Slowly
`;

captureCount.innerHTML =
captures.length;

debug.innerHTML =
`
Features:
${keypoints.size()}

<br><br>

Matches:
${goodMatchesCount}

<br><br>

Overlap:
${(overlap * 100).toFixed(0)}%

<br><br>

Distance:
${visualDistance.toFixed(1)}

<br><br>

Blur:
${blurScore.toFixed(0)}
`;

if(previousDescriptors)
previousDescriptors.delete();

if(previousKeypoints)
previousKeypoints.delete();

previousDescriptors =
descriptors.clone();

previousKeypoints =
keypoints;

src.delete();
warped.delete();
gray.delete();
descriptors.delete();
orb.delete();

requestAnimationFrame(
processLoop
);

}

function capture(canvas){

const img =
canvas.toDataURL(
"image/jpeg",
0.92
);

captures.push({

image:img,

timestamp:
Date.now(),

overlap,

blur:blurScore,

distance:
visualDistance,

matches:
goodMatchesCount

});

flashCapture();

}

function flashCapture(){

ctx.fillStyle =
"rgba(255,255,255,0.3)";

ctx.fillRect(
0,
0,
preview.width,
preview.height
);

setTimeout(()=>{

ctx.clearRect(
0,
0,
preview.width,
preview.height
);

},100);

}

});