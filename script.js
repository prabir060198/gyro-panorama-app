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

const capCanvas =
document.getElementById("capCanvas");

// ===== 3D =====

let engine;
let scene;
let camera3D;

// ===== CAMERA =====

let stream;
let imageCapture;

// ===== LOCK =====

let worldLockYaw = null;
let worldLockPitch = null;

let calibrationSamples = [];

let latestOrientation = null;

// ===== STATE =====

let capturing = false;

let smoothYaw = 0;
let smoothPitch = 0;

let holding = false;
let holdStart = 0;

let capturedImages = [];
let captureData = [];

// ===== RINGS =====

const rings = [

  { pitch:80, yaws:[0,180] },

  { pitch:45,
    yaws:[0,60,120,180,240,300] },

  { pitch:0,
    yaws:[
      0,30,60,90,120,150,
      180,210,240,270,300,330
    ]},

  { pitch:-45,
    yaws:[0,60,120,180,240,300] },

  { pitch:-80,
    yaws:[90,270] }
];

let guidePoints = [];

let totalPoints =
rings.reduce((s,r)=>s+r.yaws.length,0);

// ===== HELPERS =====

function norm360(a){
  return (a%360+360)%360;
}

function angleDiff(a,b){
  return ((a-b+540)%360)-180;
}

// ===== INIT 3D =====

function init3D(){

  engine =
  new BABYLON.Engine(renderCanvas,true);

  scene =
  new BABYLON.Scene(engine);

  camera3D =
  new BABYLON.FreeCamera(
    "cam",
    BABYLON.Vector3.Zero(),
    scene
  );

  new BABYLON.HemisphericLight(
    "l",
    new BABYLON.Vector3(0,1,0),
    scene
  );

  createPoints();

  engine.runRenderLoop(()=>{
    scene.render();
  });
}

// ===== POINTS =====

function createPoints(){

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
      ).scale(3);

      const mesh =
      BABYLON.MeshBuilder.CreateSphere(
        "pt",
        {diameter:0.12},
        scene
      );

      mesh.position = pos;

      const mat =
      new BABYLON.StandardMaterial(
        "m",
        scene
      );

      mat.emissiveColor =
      new BABYLON.Color3(1,1,1);

      mesh.material = mat;

      guidePoints.push({
        mesh,
        yaw,
        pitch:r.pitch,
        done:false
      });

    });

  });

}

// ===== START =====

startBtn.onclick = async ()=>{

  startScreen.style.display="none";

  captureScreen.style.display="block";

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
      },

      resizeMode:"none"
    }

  });

  video.srcObject = stream;

  await video.play();

  const track =
  stream.getVideoTracks()[0];

  imageCapture =
  new ImageCapture(track);

  init3D();

  statusText.innerHTML =
  "Hold phone steady...";
};

// ===== CALIBRATION =====

function startCalibration(){

  calibrationSamples = [];

  const collect =
  setInterval(()=>{

    if(!latestOrientation) return;

    calibrationSamples.push({
      yaw:latestOrientation.yaw,
      pitch:latestOrientation.pitch
    });

    if(calibrationSamples.length>=40){

      clearInterval(collect);

      let avgYawX=0;
      let avgYawY=0;

      let avgPitch=0;

      calibrationSamples.forEach(s=>{

        const r =
        BABYLON.Tools.ToRadians(s.yaw);

        avgYawX += Math.cos(r);
        avgYawY += Math.sin(r);

        avgPitch += s.pitch;

      });

      avgPitch /=
      calibrationSamples.length;

      worldLockYaw =
      norm360(
        BABYLON.Tools.ToDegrees(
          Math.atan2(avgYawY,avgYawX)
        )
      );

      worldLockPitch = avgPitch;

      capturing = true;

      statusText.innerHTML =
      "LOCKED ✓";

    }

  },50);

}

// ===== SENSOR =====

window.addEventListener(
"deviceorientation",
e=>{

  if(e.alpha==null) return;

  let rawYaw = e.alpha;

  let rawPitch = e.beta - 90;

  latestOrientation = {
    yaw:rawYaw,
    pitch:rawPitch
  };

  if(worldLockYaw===null){

    startCalibration();

    return;
  }

  if(!capturing) return;

  let yaw =
  norm360(rawYaw-worldLockYaw);

  let pitch =
  rawPitch-worldLockPitch;

  let yawDelta =
  angleDiff(yaw,smoothYaw);

  if(Math.abs(yawDelta)<0.15)
    yawDelta=0;

  smoothYaw =
  norm360(
    smoothYaw + yawDelta*0.08
  );

  let pitchDelta =
  pitch-smoothPitch;

  if(Math.abs(pitchDelta)<0.15)
    pitchDelta=0;

  smoothPitch +=
  pitchDelta*0.08;

  // CAMERA

  camera3D.rotation.y =
  BABYLON.Tools.ToRadians(
    smoothYaw
  );

  camera3D.rotation.x =
  BABYLON.Tools.ToRadians(
    -smoothPitch
  );

  // ACTIVE

  const active =
  guidePoints.find(p=>!p.done);

  if(!active) return;

  let yawDiff =
  -angleDiff(
    smoothYaw,
    active.yaw
  );

  let pitchDiff =
  smoothPitch-active.pitch;

  // DOT

  dot.style.transform =
  `translate(
    calc(-50% + ${-(yawDiff/30)*70}px),
    calc(-50% + ${-(pitchDiff/30)*70}px)
  )`;

  // ARROW

  if(Math.abs(yawDiff)>
     Math.abs(pitchDiff)){

    arrow.innerText =
    yawDiff>0 ? "⬅":"➡";

  }else{

    arrow.innerText =
    pitchDiff>0 ? "⬇":"⬆";
  }

  // ALIGN

  if(
    Math.abs(yawDiff)<5 &&
    Math.abs(pitchDiff)<5
  ){

    if(!holding){

      holding=true;

      holdStart=Date.now();
    }

    let p =
    (Date.now()-holdStart)/900;

    progress.style.background =
    `conic-gradient(
      lime ${p*360}deg,
      transparent 0deg
    )`;

    if(p>=1){

      captureHQ();

      active.done=true;

      active.mesh.material
      .emissiveColor =
      new BABYLON.Color3(0,1,0);

      holding=false;

      progress.style.background=
      "none";

      if(
        capturedImages.length===
        totalPoints
      ){
        finish();
      }
    }

  }else{

    holding=false;

    progress.style.background=
    "none";
  }

  debug.innerHTML = `
  Yaw:${smoothYaw.toFixed(1)}<br>
  Pitch:${smoothPitch.toFixed(1)}
  `;

});

// ===== CAPTURE =====

async function captureHQ(){

  try{

    const blob =
    await imageCapture.takePhoto();

    const reader =
    new FileReader();

    reader.onload=()=>{

      const imgData =
      reader.result;

      capturedImages.push(imgData);

      const active =
      guidePoints.find(
        p=>!p.done
      );

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

        timestamp:
        Date.now()
      });

      placeImage(
        imgData,
        active.mesh.position
      );

    };

    reader.readAsDataURL(blob);

  }catch(err){

    console.log(err);
  }
}

// ===== PLACE IMAGE =====

function placeImage(img,pos){

  const plane =
  BABYLON.MeshBuilder.CreatePlane(
    "img",
    {size:1},
    scene
  );

  plane.position = pos.clone();

  plane.billboardMode =
  BABYLON.Mesh.BILLBOARDMODE_ALL;

  const tex =
  new BABYLON.DynamicTexture(
    "dt",
    {width:512,height:512},
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

  image.src=img;

  const mat =
  new BABYLON.StandardMaterial(
    "mat",
    scene
  );

  mat.diffuseTexture = tex;

  plane.material = mat;
}

// ===== FINISH =====

function finish(){

  capturing=false;

  captureScreen.style.display=
  "none";

  resultScreen.style.display=
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
).onclick=async()=>{

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