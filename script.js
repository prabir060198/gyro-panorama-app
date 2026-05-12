window.addEventListener("load", async()=>{

const video =
document.getElementById("video");

const overlay =
document.getElementById("overlay");

const ctx =
overlay.getContext("2d");

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

const downloadBtn =
document.getElementById("downloadBtn");

overlay.width =
window.innerWidth;

overlay.height =
window.innerHeight;

let stream;

let running = false;

let previousDescriptors = null;
let previousKeypoints = null;

let panoCanvas =
document.createElement("canvas");

panoCanvas.width = 12000;
panoCanvas.height = 1400;

let panoCtx =
panoCanvas.getContext("2d");

let panoX = 3000;

let totalMovement = 0;

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

startBtn.onclick = async()=>{

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
overlay.width,
overlay.height
);

const frameCanvas =
document.createElement("canvas");

frameCanvas.width = 480;
frameCanvas.height = 270;

const frameCtx =
frameCanvas.getContext("2d");

frameCtx.drawImage(
video,
0,
0,
480,
270
);

const src =
cv.imread(frameCanvas);

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

let tx = 0;

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

srcPoints.push(
p1.x,
p1.y
);

dstPoints.push(
p2.x,
p2.y
);

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
"rgba(0,255,0,0.3)";

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

tx =
H.data64F[2];

visualDistance =
Math.abs(tx);

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

visualDistance > 25 &&

overlap > 0.12 &&

blurScore > 30;

if(shouldCapture){

panoX += tx * 2;

panoCtx.drawImage(
frameCanvas,
panoX,
500,
640,
360
);

captures.push({

x:panoX,

distance:
visualDistance,

overlap,

blur:
blurScore

});

captureCount.innerHTML =
captures.length;

totalMovement +=
Math.abs(tx);

flashCapture();

}

drawPanoramaPreview();

statusText.innerHTML =
`
360 Panorama Scanning
`;

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

Movement:
${totalMovement.toFixed(0)}

<br><br>

Blur:
${blurScore.toFixed(0)}
`;

if(totalMovement > 6000){

statusText.innerHTML =
"360 Panorama Complete";

running = false;

}

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

function drawPanoramaPreview(){

ctx.drawImage(

panoCanvas,

panoX - 1200,
300,
2400,
700,

0,
0,
overlay.width,
220

);

ctx.beginPath();

ctx.moveTo(
overlay.width / 2,
0
);

ctx.lineTo(
overlay.width / 2,
220
);

ctx.strokeStyle =
"yellow";

ctx.lineWidth = 3;

ctx.stroke();

}

function flashCapture(){

ctx.fillStyle =
"rgba(255,255,255,0.25)";

ctx.fillRect(
0,
0,
overlay.width,
overlay.height
);

setTimeout(()=>{

ctx.clearRect(
0,
0,
overlay.width,
overlay.height
);

},80);

}

downloadBtn.onclick =
async()=>{

const zip =
new JSZip();

const pano =
panoCanvas.toDataURL(
"image/jpeg",
0.95
);

zip.file(

"panorama.jpg",

pano.split(",")[1],

{
base64:true
}

);

zip.file(

"captures.json",

JSON.stringify(
captures,
null,
2
)

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
"360_panorama.zip";

a.click();

};

});