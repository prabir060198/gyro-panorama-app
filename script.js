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

const previewPopup = document.getElementById("previewPopup");
const previewImg = document.getElementById("previewImg");

const downloadBtn = document.getElementById("downloadBtn");
const retakeBtn = document.getElementById("retakeBtn");

let capturing = false;
let capturedImages = [];
let captureData = [];

let currentYaw = 0;
let currentPitch = 0;
let currentRoll = 0;

/* ✅ FIXED PATTERN */
const rings = [
  { pitch: 75, yaws: [45, 225] },
  { pitch: 45, yaws: [22.5,67.5,112.5,157.5,202.5,247.5,292.5,337.5] },
  { pitch: 0, yaws: [0,30,60,90,120,150,180,210,240,270,300,330] },
  { pitch: -45, yaws: [22.5,67.5,112.5,157.5,202.5,247.5,292.5,337.5] },
  { pitch: -75, yaws: [135,315] }
];

let ringIndex = 0;
let targetIndex = 0;

/* START */
startBtn.onclick = async () => {

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return;
    }

    startScreen.classList.add("hidden");
    cameraScreen.classList.remove("hidden");

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });

    video.srcObject = stream;
};

/* START CAPTURE */
captureBtn.onclick = () => {
    capturing = true;
    captureBtn.style.display = "none";
    window.addEventListener("deviceorientation", handleOrientation);
};

/* ORIENTATION */
let holding = false;
let holdStart = 0;

function handleOrientation(e) {

    if (!capturing || e.alpha == null) return;

    currentYaw = (e.alpha + 360) % 360;
    currentPitch = e.beta;
    currentRoll = e.gamma;

    const targetYaw = rings[ringIndex].yaws[targetIndex];
    const targetPitch = rings[ringIndex].pitch;

    let yawDiff = currentYaw - targetYaw;
    if (yawDiff > 180) yawDiff -= 360;
    if (yawDiff < -180) yawDiff += 360;

    let pitchDiff = currentPitch - targetPitch;

    dot.style.transform =
        `translate(calc(-50% + ${yawDiff * 2}px), calc(-50% + ${pitchDiff * 2}px))`;

    if (Math.abs(yawDiff) > 6) {
        arrow.innerText = yawDiff > 0 ? "⬅" : "➡";
    } else if (Math.abs(pitchDiff) > 8) {
        arrow.innerText = pitchDiff > 0 ? "⬆" : "⬇";
    } else {
        arrow.innerText = "●";
    }

    if (Math.abs(yawDiff) < 6 && Math.abs(pitchDiff) < 8) {

        if (!holding) {
            holding = true;
            holdStart = Date.now();
        }

        let progress = Math.min((Date.now() - holdStart) / 800, 1);

        progressEl.style.background =
            `conic-gradient(#00c853 ${progress * 360}deg, transparent 0deg)`;

        if (progress >= 1) {

            capture(targetYaw, targetPitch, ringIndex);

            holding = false;
            progressEl.style.background =
                `conic-gradient(#888 0deg, transparent 0deg)`;

            targetIndex++;

            if (targetIndex >= rings[ringIndex].yaws.length) {
                ringIndex++;
                targetIndex = 0;

                if (ringIndex >= rings.length) {
                    finish();
                    return;
                }
            }
        }

    } else {
        holding = false;
        progressEl.style.background =
            `conic-gradient(#888 0deg, transparent 0deg)`;
    }

    statusText.innerText = `${capturedImages.length} / 32`;
}

/* CAPTURE */
function capture(targetYaw, targetPitch, ringIndex) {

    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const img = canvas.toDataURL("image/png");

    const name = `img_${capturedImages.length + 1}.png`;

    capturedImages.push(img);

    captureData.push({
        name,
        ring: ringIndex,
        target: { yaw: targetYaw, pitch: targetPitch },
        actual: {
            yaw: currentYaw,
            pitch: currentPitch,
            roll: currentRoll
        },
        timestamp: Date.now()
    });
}

/* FINISH */
function finish() {

    capturing = false;
    window.removeEventListener("deviceorientation", handleOrientation);

    cameraScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    capturedImages.forEach(img => {
        const i = document.createElement("img");
        i.src = img;

        i.onclick = () => {
            previewImg.src = img;
            previewPopup.classList.remove("hidden");
        };

        gallery.appendChild(i);
    });
}

/* PREVIEW CLOSE */
previewPopup.onclick = () => {
    previewPopup.classList.add("hidden");
};

/* DOWNLOAD */
downloadBtn.onclick = async () => {

    const zip = new JSZip();

    capturedImages.forEach((img, i) => {
        zip.file(`img_${i+1}.png`, img.split(",")[1], { base64: true });
    });

    const json = {
        device: { hfov: 70, vfov: 60 },
        totalImages: capturedImages.length,
        rings: rings.map(r => ({
            pitch: r.pitch,
            count: r.yaws.length
        })),
        images: captureData
    };

    zip.file("metadata.json", JSON.stringify(json, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "photosphere.zip";
    a.click();
};

retakeBtn.onclick = () => location.reload();