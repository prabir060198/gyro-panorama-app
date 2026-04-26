const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const gallery = document.getElementById('gallery');

const angleText = document.getElementById('angleText');
const targetText = document.getElementById('targetText');
const statusText = document.getElementById('statusText');
const progressEl = document.getElementById('progress');

const startBtn = document.getElementById('startBtn');
const downloadBtn = document.getElementById('downloadAll');

const previewModal = document.getElementById('previewModal');
const previewImg = document.getElementById('previewImg');

const dot = document.getElementById('dot');
const arrow = document.getElementById('arrow');

let currentYaw = 0;
let currentPitch = 0;

const targets = [0,45,90,135,180,225,270,315];

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
    if (!video.videoWidth) return;

    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const imgData = canvas.toDataURL("image/png");

    const img = document.createElement("img");
    img.src = imgData;

    img.onclick = () => {
        previewModal.style.display = "flex";
        previewImg.src = imgData;
    };

    gallery.appendChild(img);
}

// DOT + ARROW
function updateDot(targetYaw, targetPitch) {

    let yawDiff = currentYaw - targetYaw;
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;

    let pitchDiff = currentPitch - targetPitch;

    let x = yawDiff * 2;
    let y = pitchDiff * 2;

    x = Math.max(-100, Math.min(100, x));
    y = Math.max(-100, Math.min(100, y));

    dot.style.transform =
        `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    let aligned =
        Math.abs(yawDiff) < ANGLE_TOL &&
        Math.abs(pitchDiff) < PITCH_TOL;

    dot.style.background = aligned ? "#00c853" : "white";

    // Arrow direction
    let arrowText = "";

    if (Math.abs(yawDiff) > ANGLE_TOL) {
        arrowText += yawDiff > 0 ? "⬅ " : "➡ ";
    }

    if (Math.abs(pitchDiff) > PITCH_TOL) {
        arrowText += pitchDiff > 0 ? "⬆" : "⬇";
    }

    arrow.innerText = arrowText;
}

// ORIENTATION
function handleOrientation(e) {

    if (e.alpha == null) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta - 90;

    let row = rows[rowIndex];
    let target = targets[targetIndex];

    angleText.innerText = "Yaw: " + Math.round(currentYaw);
    targetText.innerText = `Target: ${target}° | ${row.name}`;

    updateDot(target, row.pitch);

    if (Math.abs(currentPitch - row.pitch) > PITCH_TOL) {
        holding = false;
        statusText.innerText = `Adjust ${row.name} (tilt phone)`;
        return;
    }

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
                    downloadBtn.style.display = "block";
                    return;
                }
            }
        }

    } else {
        holding = false;
        statusText.innerText = "Follow arrow to align";
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

// PREVIEW CLOSE
previewModal.onclick = () => {
    previewModal.style.display = "none";
};

// DOWNLOAD
downloadBtn.onclick = () => {
    const imgs = gallery.querySelectorAll("img");

    imgs.forEach((img, i) => {
        const a = document.createElement("a");
        a.href = img.src;
        a.download = `photo_${i}.png`;
        a.click();
    });
};