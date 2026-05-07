window.addEventListener("load",()=>{

// ======================================================
// DOM
// ======================================================

const startBtn =
document.getElementById("startBtn");

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

// ======================================================
// ERROR
// ======================================================

window.onerror = function(err){

  debug.innerHTML =
  "ERROR: " + err;
};

// ======================================================
// SENSOR
// ======================================================

let smoothYaw = 0;
let smoothPitch = 0;
let smoothRoll = 0;

// ======================================================
// LOCK
// ======================================================

let environmentLocked = false;

let worldLockYaw = 0;

// ======================================================
// STATE
// ======================================================

let capturing = false;

let holding = false;

let holdStart = 0;

// ======================================================
// DATA
// ======================================================

let capturedImages = [];
let captureData = [];

// ======================================================
// CAMERA
// ======================================================

let stream;

// ======================================================
// CAPTURE INDEX
// ======================================================

let currentIndex = 0;

// ======================================================
// 38 CAPTURE PROFESSIONAL OVERLAP
// ======================================================

const rings = [

  // ================= TOP =================

  {
    pitch: 75,

    yaws: [

      0,
      120,
      240

    ]
  },

  // ================= UPPER =================

  {
    pitch: 45,

    yaws: [

      0,
      36,
      72,
      108,
      144,
      180,
      216,
      252,
      288,
      324

    ]
  },

  // ================= MIDDLE =================

  {
    pitch: 0,

    yaws: [

      0,
      30,
      60,
      90,
      120,
      150,
      180,
      210,
      240,
      270,
      300,
      330

    ]
  },

  // ================= LOWER =================

  {
    pitch: -45,

    yaws: [

      0,
      36,
      72,
      108,
      144,
      180,
      216,
      252,
      288,
      324

    ]
  },

  // ================= BOTTOM =================

  {
    pitch: -75,

    yaws: [

      60,
      180,
      300

    ]
  }

];

// ======================================================
// FLATTEN
// ======================================================

const capturePoints = [];

rings.forEach(r=>{

  r.yaws.forEach(yaw=>{

    capturePoints.push({

      yaw,
      pitch:r.pitch

    });

  });

});

const totalPoints =
capturePoints.length;

// ======================================================
// HELPERS
// ======================================================

function norm360(a){

  return (a%360+360)%360;
}

function angleDiff(a,b){

  return ((a-b+540)%360)-180;
}

// ======================================================
// PITCH FIX
// beta 0   -> -90
// beta 90  -> 0
// beta 180 -> +90
// ======================================================

function getStablePitch(beta){

  let pitch = beta - 90;

  if(pitch > 90)
    pitch = 90;

  if(pitch < -90)
    pitch = -90;

  return pitch;
}

// ======================================================
// START
// ======================================================

startBtn.onclick = async ()=>{

  try{

    startScreen.style.display =
    "none";

    captureScreen.style.display =
    "block";

    statusText.innerHTML =
    "Opening camera...";

    // ================= iOS =================

    if(

      typeof DeviceOrientationEvent !==
      "undefined" &&

      typeof DeviceOrientationEvent
      .requestPermission ===
      "function"

    ){

      const permission =

      await DeviceOrientationEvent
      .requestPermission();

      debug.innerHTML =
      "Permission: " + permission;
    }

    // ================= CAMERA =================

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

    statusText.innerHTML =
    "Move phone to start";

  }catch(err){

    debug.innerHTML =
    "START ERROR:<br>" + err;
  }

};

// ======================================================
// SENSOR
// ======================================================

window.addEventListener(

"deviceorientation",

async e=>{

  try{

    if(!capturing) return;

    if(e.alpha == null){

      debug.innerHTML =
      "No sensor data";

      return;
    }

    // ======================================================
    // RAW
    // ======================================================

    let rawYaw =
    360 - e.alpha;

    let rawPitch =
    getStablePitch(
      e.beta || 0
    );

    let rawRoll =
    e.gamma || 0;

    // ======================================================
    // FIRST LOCK
    // ======================================================

    if(!environmentLocked){

      worldLockYaw =
      rawYaw;

      environmentLocked = true;

      debug.innerHTML =
      "Environment Locked";
    }

    // ======================================================
    // RELATIVE
    // ======================================================

    let yaw =

    norm360(
      rawYaw - worldLockYaw
    );

    let pitch =
    rawPitch;

    // ======================================================
    // SMOOTH
    // ======================================================

    smoothYaw =

    norm360(

      smoothYaw +

      angleDiff(
        yaw,
        smoothYaw
      ) * 0.06

    );

    smoothPitch +=

    (pitch-smoothPitch)*0.12;

    smoothRoll +=

    (rawRoll-smoothRoll)*0.08;

    // ======================================================
    // ACTIVE
    // ======================================================

    const active =
    capturePoints[currentIndex];

    if(!active){

      finish();
      return;
    }

    // ======================================================
    // DIFF
    // ======================================================

    let yawDiff =

    angleDiff(
      smoothYaw,
      active.yaw
    );

    let pitchDiff =

    active.pitch -
    smoothPitch;

    // ======================================================
    // DEADZONE
    // ======================================================

    if(Math.abs(yawDiff) < 1.5)
      yawDiff = 0;

    if(Math.abs(pitchDiff) < 1.5)
      pitchDiff = 0;

    // ======================================================
    // DOT
    // ======================================================

    dot.style.transform =

    `translate(
      calc(-50% + ${-(yawDiff/30)*55}px),
      calc(-50% + ${(pitchDiff/30)*55}px)
    )`;

    // ======================================================
    // ARROW
    // ======================================================

    if(
      Math.abs(yawDiff) >
      Math.abs(pitchDiff)
    ){

      arrow.innerText =

      yawDiff > 0 ?
      "⬅" : "➡";

    }else{

      arrow.innerText =

      pitchDiff > 0 ?
      "⬆" : "⬇";
    }

    // ======================================================
    // STATUS
    // ======================================================

    statusText.innerHTML =

    `
    Capture ${currentIndex+1}
    / ${totalPoints}

    <br>

    Target:
    Y ${active.yaw}
    P ${active.pitch}
    `;

    // ======================================================
    // ALIGN
    // ======================================================

    const aligned =

      Math.abs(yawDiff) < 6 &&
      Math.abs(pitchDiff) < 6;

    // ======================================================
    // CAPTURE FLOW
    // ======================================================

    if(aligned){

      if(!holding){

        holding = true;

        holdStart =
        Date.now();
      }

      let progressValue =

      (Date.now()-holdStart)/700;

      // ===== CLAMP =====

      const clamped =

      Math.min(progressValue,1);

      // ===== PROGRESS =====

      progress.style.background =

      `conic-gradient(
        lime ${clamped*360}deg,
        rgba(255,255,255,0.15) 0deg
      )`;

      // ===== COMPLETE =====

      if(progressValue >= 1){

        // ===== SUCCESS =====

        progress.style.background =
        "rgba(0,255,120,0.35)";

        dot.style.background =
        "#00ff66";

        // ===== WAIT =====

        await new Promise(r=>
          setTimeout(r,180)
        );

        // ===== CAPTURE =====

        await capture(active);

        currentIndex++;

        // ===== RESET =====

        holding = false;

        progress.style.background =
        "none";

        dot.style.background =
        "#00ffcc";
      }

    }else{

      holding = false;

      progress.style.background =
      "none";

      dot.style.background =
      "#00ffcc";
    }

    // ======================================================
    // DEBUG
    // ======================================================

    debug.innerHTML =

    `
    Yaw:
    ${smoothYaw.toFixed(1)}

    <br>

    Pitch:
    ${smoothPitch.toFixed(1)}

    <br>

    RawBeta:
    ${(e.beta||0).toFixed(1)}

    <br>

    Roll:
    ${smoothRoll.toFixed(1)}

    <br>

    TargetYaw:
    ${active.yaw}

    <br>

    TargetPitch:
    ${active.pitch}
    `;

  }catch(err){

    debug.innerHTML =
    "SENSOR ERROR:<br>" + err;
  }

});

// ======================================================
// CAPTURE PNG
// ======================================================

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

  // ======================================================
  // PNG
  // ======================================================

  const imgData =

  canvas.toDataURL(
    "image/png"
  );

  capturedImages.push(imgData);

  // ======================================================
  // META
  // ======================================================

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
    smoothYaw,

    actualPitch:
    smoothPitch,

    roll:
    smoothRoll,

    fov:{

      vertical:50,

      horizontal:58
    },

    deviceOrientation:{

      yaw:smoothYaw,
      pitch:smoothPitch,
      roll:smoothRoll

    },

    timestamp:
    Date.now()

  });

}

// ======================================================
// FINISH
// ======================================================

function finish(){

  capturing = false;

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

// ======================================================
// DOWNLOAD
// ======================================================

document.getElementById(
"downloadBtn"
).onclick = async ()=>{

  const zip =
  new JSZip();

  // ======================================================
  // SAVE PNG
  // ======================================================

  capturedImages.forEach((img,i)=>{

    zip.file(

      `img_${i+1}.png`,

      img.split(",")[1],

      {base64:true}

    );

  });

  // ======================================================
  // STITCH FORMAT
  // ======================================================

  const stitchData = {

    images: []

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

      timestamp:
      d.timestamp

    });

  });

  // ======================================================
  // SAVE JSON
  // ======================================================

  zip.file(

    "data.json",

    JSON.stringify(
      stitchData,
      null,
      2
    )

  );

  // ======================================================
  // ZIP
  // ======================================================

  const blob =

  await zip.generateAsync({

    type:"blob",

    compression:"DEFLATE",

    compressionOptions:{
      level:6
    }

  });

  const a =
  document.createElement("a");

  a.href =
  URL.createObjectURL(blob);

  a.download =
  "360_capture.zip";

  a.click();

};

});