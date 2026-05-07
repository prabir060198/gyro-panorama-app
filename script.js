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

// ===== BABYLON =====

let engine;
let scene;

let camera3D;

let previewRoot;
let worldRoot;

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

let guidePoints = [];

// ===== CAMERA =====

let stream;

// ===== RINGS =====

const rings = [

  // TOP
  {
    pitch:90,
    yaws:[0]
  },

  // UPPER
  {
    pitch:45,
    yaws:[0,60,120,180,240,300]
  },

  // HORIZON
  {
    pitch:0,
    yaws:[
      0,30,60,90,120,150,
      180,210,240,270,300,330
    ]
  },

  // LOWER
  {
    pitch:-45,
    yaws:[0,60,120,180,240,300]
  },

  // BOTTOM
  {
    pitch:-90,
    yaws:[0]
  }

];

let totalPoints =
rings.reduce((s,r)=>s+r.yaws.length,0);

// ===== HELPERS =====

function norm360(a){
  return (a%360+360)%360;
}

function angleDiff(a,b){
  return ((a-b+540)%360)-180;
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

// ===== INIT =====

function init3D(){

  engine =
  new BABYLON.Engine(
    renderCanvas,
    true
  );

  scene =
  new BABYLON.Scene(engine);

  scene.clearColor =
  new BABYLON.Color4(0,0,0,0);

  // CAMERA

  camera3D =
  new BABYLON.FreeCamera(
    "cam",
    new BABYLON.Vector3(0,0,-8),
    scene
  );

  camera3D.setTarget(
    BABYLON.Vector3.Zero()
  );

  camera3D.fov = 1.0;

  // LIGHT

  new BABYLON.HemisphericLight(
    "light",
    new BABYLON.Vector3(0,1,0),
    scene
  );

  // PREVIEW ROOT

  previewRoot =
  new BABYLON.TransformNode(
    "previewRoot",
    scene
  );

  // WORLD ROOT

  worldRoot =
  new BABYLON.TransformNode(
    "worldRoot",
    scene
  );

  worldRoot.parent =
  previewRoot;

  createPoints();

  engine.runRenderLoop(()=>{
    scene.render();
  });

  window.addEventListener(
    "resize",
    ()=>engine.resize()
  );
}

// ===== CREATE POINTS =====

function createPoints(){

  guidePoints = [];

  rings.forEach(r=>{

    r.yaws.forEach(yaw=>{

      const y =
      BABYLON.Tools.ToRadians(yaw);

      const p =
      BABYLON.Tools.ToRadians(r.pitch);

      const pos =
      new BABYLON.Vector3(
        Math.sin(y)*Math.cos(p),
        Math.sin(p),
        Math.cos(y)*Math.cos(p)
      ).scale(4);

      const mesh =
      BABYLON.MeshBuilder.CreateSphere(
        "pt",
        {
          diameter:0.25
        },
        scene
      );

      mesh.parent = worldRoot;

      mesh.position = pos;

      const mat =
      new BABYLON.StandardMaterial(
        "m",
        scene
      );

      mat.emissiveColor =
      new BABYLON.Color3(
        0.3,
        0.3,
        0.3
      );

      mesh.material = mat;

      guidePoints.push({

        mesh,
        yaw,
        pitch:r.pitch,
        done:false

      });

    });

  });

  updateGuideVisuals();
}

// ===== GUIDE VISUALS =====

function updateGuideVisuals(){

  const active =
  guidePoints.find(p=>!p.done);

  guidePoints.forEach(p=>{

    if(p.done){

      // DONE

      p.mesh.material.emissiveColor =
      new BABYLON.Color3(0,1,0);

      p.mesh.scaling.setAll(1);

    }else if(p===active){

      // ACTIVE

      p.mesh.material.emissiveColor =
      new BABYLON.Color3(1,1,0);

      p.mesh.scaling.setAll(2);

    }else{

      // FUTURE

      p.mesh.material.emissiveColor =
      new BABYLON.Color3(
        0.25,
        0.25,
        0.25
      );

      p.mesh.scaling.setAll(1);
    }

  });

}

// ===== START =====

startBtn.onclick = async ()=>{

  startScreen.style.display =
  "none";

  captureScreen.style.display =
  "block";

  if(DeviceOrientationEvent.requestPermission){

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
        ideal:4096
      },

      height:{
        ideal:2160
      }

    }

  });

  video.srcObject = stream;

  await video.play();

  init3D();

  capturing = true;
};

// ===== SENSOR =====

window.addEventListener(
"deviceorientation",
async e=>{

  if(!capturing) return;

  if(e.alpha==null) return;

  // ===== RAW =====

  let rawYaw = e.alpha;

  // FIXED PITCH
  let rawPitch = e.beta;

  // ROLL
  let rawRoll = e.gamma;

  // ===== FIRST LOCK =====

  if(!environmentLocked){

    smoothYaw = 0;
    smoothPitch = 0;
    smoothRoll = 0;

  }else{

    let yaw =
    norm360(rawYaw-worldLockYaw);

    let pitch =
    rawPitch-worldLockPitch;

    // SMOOTH

    smoothYaw =
    norm360(
      smoothYaw +
      angleDiff(yaw,smoothYaw)*0.08
    );

    smoothPitch +=
    (pitch-smoothPitch)*0.08;

    smoothRoll +=
    (rawRoll-smoothRoll)*0.08;
  }

  // ===== PREVIEW ROTATION =====

  previewRoot.rotation.y =
  BABYLON.Tools.ToRadians(
    smoothYaw * 0.25
  );

  previewRoot.rotation.x =
  BABYLON.Tools.ToRadians(
    -smoothPitch * 0.25
  );

  // ===== ACTIVE =====

  const active =
  guidePoints.find(p=>!p.done);

  if(!active) return;

  let yawDiff;
  let pitchDiff;

  if(!environmentLocked){

    yawDiff = 0;
    pitchDiff = 0;

  }else{

    yawDiff =
    -angleDiff(
      smoothYaw,
      active.yaw
    );

    pitchDiff =
    smoothPitch-active.pitch;
  }

  // ===== DOT =====

  dot.style.transform =
  `translate(
    calc(-50% + ${-(yawDiff/30)*70}px),
    calc(-50% + ${-(pitchDiff/30)*70}px)
  )`;

  // ===== ARROW =====

  if(Math.abs(yawDiff)>
     Math.abs(pitchDiff)){

    arrow.innerText =
    yawDiff>0 ? "⬅":"➡";

  }else{

    arrow.innerText =
    pitchDiff>0 ? "⬇":"⬆";
  }

  // ===== STATUS =====

  statusText.innerHTML =
  `Capture ${capturedImages.length+1}
   / ${totalPoints}`;

  // ===== ALIGN =====

  if(
    Math.abs(yawDiff)<5 &&
    Math.abs(pitchDiff)<5
  ){

    if(!holding){

      holding = true;

      holdStart = Date.now();
    }

    let p =
    (Date.now()-holdStart)/900;

    progress.style.background =
    `conic-gradient(
      lime ${p*360}deg,
      transparent 0deg
    )`;

    if(p>=1){

      // FIRST LOCK

      if(!environmentLocked){

        environmentLocked = true;

        worldLockYaw =
        rawYaw;

        worldLockPitch =
        rawPitch;
      }

      await captureHQ(active);

      active.done = true;

      updateGuideVisuals();

      holding = false;

      progress.style.background =
      "none";

      if(
        capturedImages.length===
        totalPoints
      ){
        finish();
      }

    }

  }else{

    holding = false;

    progress.style.background =
    "none";
  }

  // DEBUG

  debug.innerHTML = `
  Yaw:${smoothYaw.toFixed(1)}<br>
  Pitch:${smoothPitch.toFixed(1)}<br>
  Roll:${smoothRoll.toFixed(1)}
  `;

});

// ===== CAPTURE =====

async function captureHQ(active){

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

    }

  });

  placeImage(
    imgData,
    active.mesh.position
  );
}

// ===== PLACE IMAGE =====

function placeImage(img,pos){

  const plane =
  BABYLON.MeshBuilder.CreatePlane(
    "img",
    {
      width:1.2,
      height:1.6
    },
    scene
  );

  plane.parent = worldRoot;

  plane.position = pos.clone();

  plane.lookAt(
    BABYLON.Vector3.Zero()
  );

  const tex =
  new BABYLON.DynamicTexture(
    "dt",
    {
      width:512,
      height:512
    },
    scene
  );

  const ctx =
  tex.getContext();

  const image =
  new Image();

  image.onload=()=>{

    ctx.drawImage(
      image,
      0,
      0,
      512,
      512
    );

    tex.update();
  };

  image.src = img;

  const mat =
  new BABYLON.StandardMaterial(
    "mat",
    scene
  );

  mat.diffuseTexture = tex;

  mat.emissiveColor =
  new BABYLON.Color3(1,1,1);

  plane.material = mat;
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

// ===== DOWNLOAD =====

document.getElementById(
"downloadBtn"
).onclick = async ()=>{

  const zip =
  new JSZip();

  capturedImages.forEach((img,i)=>{

    zip.file(
      `img_${i+1}.jpg`,
      img.split(",")[1],
      {base64:true}
    );

  });

  zip.file(
    "data.json",
    JSON.stringify(
      captureData,
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
  "360_capture.zip";

  a.click();

};

});