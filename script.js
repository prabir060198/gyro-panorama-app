window.addEventListener("load",()=>{

// ===== DOM =====

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

// ===== ERROR =====

window.onerror = function(err){

  debug.innerHTML =
  "ERROR: " + err;
};

// ===== SENSOR =====

let smoothYaw = 0;
let smoothPitch = 0;
let smoothRoll = 0;

// ===== LOCK =====

let environmentLocked = false;

let worldLockYaw = 0;
let worldLockPitch = 0;

// ===== STATE =====

let capturing = false;

let holding = false;

let holdStart = 0;

// ===== DATA =====

let capturedImages = [];
let captureData = [];

// ===== CAMERA =====

let stream;

// ===== CAPTURE INDEX =====

let currentIndex = 0;

// ===== 30 PHOTO LARGE ROOM =====

const rings = [

  // ===== ZENITH =====

  {
    pitch: 90,

    yaws: [0]
  },

  // ===== UPPER =====

  {
    pitch: 45,

    yaws: [

      0,
      45,
      90,
      135,
      180,
      225,
      270,
      315

    ]
  },

  // ===== HORIZON =====

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

  // ===== LOWER =====

  {
    pitch: -45,

    yaws: [

      0,
      45,
      90,
      135,
      180,
      225,
      270,
      315

    ]
  },

  // ===== NADIR =====

  {
    pitch: -90,

    yaws: [0]
  }

];

// ===== FLATTEN =====

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

// ===== HELPERS =====

function norm360(a){

  return (a%360+360)%360;
}

function angleDiff(a,b){

  return ((a-b+540)%360)-180;
}

// ===== STABLE PITCH =====

function getStablePitch(beta,gamma){

  let pitch;

  // PORTRAIT

  if(
    window.innerHeight >
    window.innerWidth
  ){

    pitch = beta;

  }else{

    // LANDSCAPE

    pitch = gamma;
  }

  // FIX OVERFLOW

  if(pitch > 90)
    pitch = 180 - pitch;

  if(pitch < -90)
    pitch = -180 - pitch;

  return pitch;
}

// ===== FOV =====

function getCameraFOV(){

  const aspect =
  video.videoWidth /
  video.videoHeight;

  const vertical = 50;

  return {

    vertical,

    horizontal:
    vertical * aspect
  };
}

// ===== START =====

startBtn.onclick = async ()=>{

  try{

    startScreen.style.display =
    "none";

    captureScreen.style.display =
    "block";

    statusText.innerHTML =
    "Opening camera...";

    // ===== iOS =====

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

    // ===== CAMERA =====

    stream =

    await navigator.mediaDevices
    .getUserMedia({

      video:{

        facingMode:{
          ideal:"environment"
        },

        width:{
          ideal:4096
        },

        height:{
          ideal:2160
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

// ===== SENSOR =====

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

    // ===== RAW =====

    let rawYaw =
    360 - e.alpha;

    let rawPitch =
    getStablePitch(
      e.beta || 0,
      e.gamma || 0
    );

    let rawRoll =
    e.gamma || 0;

    // ===== FIRST LOCK =====

    if(!environmentLocked){

      worldLockYaw =
      rawYaw;

      worldLockPitch =
      rawPitch;

      environmentLocked = true;

      debug.innerHTML =
      "Environment Locked";
    }

    // ===== RELATIVE =====

    let yaw =

    norm360(
      rawYaw - worldLockYaw
    );

    let pitch =
    rawPitch - worldLockPitch;

    // ===== SMOOTH =====

    smoothYaw =

    norm360(

      smoothYaw +

      angleDiff(
        yaw,
        smoothYaw
      ) * 0.12

    );

    smoothPitch +=

    (pitch-smoothPitch)*0.25;

    smoothRoll +=

    (rawRoll-smoothRoll)*0.12;

    // ===== ACTIVE =====

    const active =
    capturePoints[currentIndex];

    if(!active){

      finish();
      return;
    }

    // ===== DIFF =====

    let yawDiff =

    -angleDiff(
      smoothYaw,
      active.yaw
    );

    let pitchDiff =

    smoothPitch -
    active.pitch;

    // ===== DOT =====

    dot.style.transform =

    `translate(
      calc(-50% + ${-(yawDiff/30)*80}px),
      calc(-50% + ${-(pitchDiff/30)*80}px)
    )`;

    // ===== ARROW =====

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
      "⬇" : "⬆";
    }

    // ===== STATUS =====

    statusText.innerHTML =

    `
    Capture ${currentIndex+1}
    / ${totalPoints}

    <br>

    Target:
    Y ${active.yaw}
    P ${active.pitch}
    `;

    // ===== ALIGN =====

    const aligned =

      Math.abs(yawDiff) < 8 &&
      Math.abs(pitchDiff) < 8;

    if(aligned){

      if(!holding){

        holding = true;

        holdStart =
        Date.now();
      }

      let progressValue =

      (Date.now()-holdStart)/500;

      progress.style.background =

      `conic-gradient(
        lime ${progressValue*360}deg,
        transparent 0deg
      )`;

      if(progressValue >= 1){

        await capture(active);

        currentIndex++;

        holding = false;

        progress.style.background =
        "none";
      }

    }else{

      holding = false;

      progress.style.background =
      "none";
    }

    // ===== DEBUG =====

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

    RawGamma:
    ${(e.gamma||0).toFixed(1)}

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

// ===== CAPTURE =====

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

  const imgData =

  canvas.toDataURL(
    "image/jpeg",
    1.0
  );

  capturedImages.push(imgData);

  captureData.push({

    index:
    capturedImages.length,

    file:
    `img_${capturedImages.length}.jpg`,

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

    fov:
    getCameraFOV(),

    deviceOrientation:{

      yaw:smoothYaw,
      pitch:smoothPitch,
      roll:smoothRoll

    },

    timestamp:
    Date.now()

  });

}

// ===== FINISH =====

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
});