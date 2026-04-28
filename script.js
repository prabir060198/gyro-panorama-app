const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");

const startScreen = document.getElementById("startScreen");
const cameraScreen = document.getElementById("cameraScreen");
const resultScreen = document.getElementById("resultScreen");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const dot = document.getElementById("dot");
const arrow = document.getElementById("arrow");
const progressEl = document.getElementById("progress");

const gallery = document.getElementById("gallery");
const statusText = document.getElementById("statusText");

const downloadBtn = document.getElementById("downloadBtn");
const retakeBtn = document.getElementById("retakeBtn");

let capturing = false;
let capturedImages = [];
let captureData = [];

let currentYaw = 0;
let currentPitch = 0;

// ROW STRUCTURE
const rows = [
    { name: "TOP", pitch: -80, count: 2 },
    { name: "UPPER", pitch: -40, count: 8 },
    { name: "MIDDLE", pitch: 0, count: 12 },
    { name: "LOWER", pitch: 40, count: 8 },
    { name: "BOTTOM", pitch: 80, count: 2 }
];

let rowIndex = 0;
let targetIndex = 0;
let targets = [];

const HFOV = 70;
const OVERLAP = 0.3;

function generateTargets(row) {
    const rad = row.pitch * Math.PI / 180;
    const effectiveFOV = HFOV * Math.cos(rad);
    const step = effectiveFOV * (1 - OVERLAP);

    let arr = [];
    for (let i = 0; i < row.count; i++) {
        arr.push((i * step) % 360);
    }
    return arr;
}

// START
startBtn.onclick = async () => {

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") {
            alert("Gyro permission needed");
            return;
        }
    }

    startScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });

    video.srcObject = stream;
};

// START CAPTURE
captureBtn.onclick = () => {
    capturing = true;
    captureBtn.style.display = "none";

    targets = generateTargets(rows[rowIndex]);
    window.addEventListener("deviceorientation", handleOrientation);
};

// HOLD SYSTEM
let holding = false;
let holdStart = 0;

function handleOrientation(e) {

    if (!capturing) return;
    if (e.alpha == null) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta - 90;

    const targetYaw = targets[targetIndex];
    const targetPitch = rows[rowIndex].pitch;

    let yawDiff = currentYaw - targetYaw;
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;

    let pitchDiff = currentPitch - targetPitch;

    // DOT
    dot.style.transform =
        `translate(calc(-50% + ${yawDiff * 2}px), calc(-50% + ${pitchDiff * 2}px))`;

    // ARROW
    if (Math.abs(yawDiff) > 8) {
        arrow.innerText = yawDiff > 0 ? "⬅" : "➡";
    } else if (Math.abs(pitchDiff) > 15) {
        arrow.innerText = pitchDiff > 0 ? "⬆" : "⬇";
    } else {
        arrow.innerText = "●";
    }

    // HOLD CAPTURE
    if (Math.abs(yawDiff) < 8 && Math.abs(pitchDiff) < 15) {

        if (!holding) {
            holding = true;
            holdStart = Date.now();
        }

        let progress = Math.min((Date.now() - holdStart) / 1000, 1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

        if (progress >= 1) {

            capture();

            holding = false;

            progressEl.style.background =
                `conic-gradient(#888 0deg, transparent 0deg)`;

            targetIndex++;

            if (targetIndex >= targets.length) {

                rowIndex++;

                if (rowIndex >= rows.length) {
                    finish();
                    return;
                }

                targets = generateTargets(rows[rowIndex]);
                targetIndex = 0;
            }
        }

    } else {
        holding = false;
        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;
    }

    statusText.innerText = `${capturedImages.length} / 32`;
}

// CAPTURE (NO preview / NO gallery here)
function capture() {

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const img = canvas.toDataURL("image/png");

    capturedImages.push(img);

    captureData.push({
        name: `img_${capturedImages.length}.png`,
        yaw: currentYaw,
        pitch: currentPitch,
        row: rows[rowIndex].name
    });
}

// FINISH
function finish() {

    capturing = false;
    window.removeEventListener("deviceorientation", handleOrientation);

    cameraScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    gallery.innerHTML = "";

    capturedImages.forEach(img => {
        const i = document.createElement("img");
        i.src = img;
        gallery.appendChild(i);
    });
}

// DOWNLOAD
downloadBtn.onclick = async () => {

    const zip = new JSZip();

    capturedImages.forEach((img, i) => {
        zip.file(`img_${i}.png`, img.split(",")[1], { base64: true });
    });

    zip.file("metadata.json", JSON.stringify(captureData, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "photosphere.zip";
    a.click();
};

retakeBtn.onclick = () => location.reload();