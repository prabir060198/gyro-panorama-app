const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const targetText = document.getElementById('targetText');
const statusText = document.getElementById('statusText');
const progressEl = document.getElementById('progress');
const startBtn = document.getElementById('startBtn');

const yawVal = document.getElementById('yawVal');
const pitchVal = document.getElementById('pitchVal');

let currentYaw = 0;
let currentPitch = 0;

const targets = [0,45,90,135,180,225,270,315];

// ✅ Your calibrated pitch values
const rows = [
    { name: "LOWER", pitch: -75 },
    { name: "BOTTOM_LOW", pitch: -25 },
    { name: "BOTTOM_UP", pitch: 25 },
    { name: "TOP", pitch: 75 }
];

let rowIndex = 0;
let targetIndex = 0;

let capturedFlags = new Array(targets.length).fill(false);

let holding = false;
let holdStart = 0;

const HOLD_TIME = 1000;
const ANGLE_TOL = 8;
const PITCH_TOL = 15;

// CAMERA
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;
}
startCamera();

// CAPTURE
function capture() {
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const img = document.createElement("img");
    img.src = canvas.toDataURL("image/png");

    gallery.appendChild(img);
}

// ORIENTATION
function handleOrientation(e) {

    if (e.alpha == null) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta - 90;

    yawVal.innerText = Math.round(currentYaw);
    pitchVal.innerText = Math.round(currentPitch);

    let row = rows[rowIndex];
    let target = targets[targetIndex];

    angleText.innerText = "Yaw: " + Math.round(currentYaw);
    targetText.innerText = `Target: ${target}° | ${row.name}`;

    // Pitch check
    if (Math.abs(currentPitch - row.pitch) > PITCH_TOL) {
        holding = false;
        statusText.innerText = `Adjust ${row.name}`;
        return;
    }

    // Angle check
    let diff = Math.abs(currentYaw - target);
    if (diff > 180) diff = 360 - diff;

    if (diff < ANGLE_TOL) {

        statusText.innerText = "Hold steady...";

        if (!holding && !capturedFlags[targetIndex]) {
            holding = true;
            holdStart = Date.now();
        }

        let progress = Math.min((Date.now() - holdStart)/HOLD_TIME,1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress*360}deg, transparent 0deg)`;

        if (progress >= 1) {

            capture();

            holding = false;
            progressEl.style.background =
                `conic-gradient(#888 0deg, transparent 0deg)`;

            capturedFlags[targetIndex] = true;
            targetIndex++;

            if (targetIndex >= targets.length) {
                rowIndex++;
                targetIndex = 0;
                capturedFlags = new Array(targets.length).fill(false);

                if (rowIndex >= rows.length) {
                    window.removeEventListener('deviceorientation', handleOrientation);
                    statusText.innerText = "✅ 32 images captured!";
                    return;
                }
            }
        }

    } else {
        holding = false;
        statusText.innerText = "Move to target";
    }
}

// START
startBtn.onclick = async () => {

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        let res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return;
    }

    window.addEventListener("deviceorientation", handleOrientation);

    statusText.innerText = "Start capturing";
};