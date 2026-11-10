import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let canvas = document.querySelector('canvas.webgl'); 
let scene = new THREE.Scene();

let sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};

// 設置攝影機
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.z = 8;
camera.position.y = 3;
scene.add(camera);

// 設置渲染器
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true, 
    antialias: true
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 加入軌道控制器
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
});

// 1. 光影系統
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

// 2. 背景洋流粒子系統
const particleCount = 10000;
const waterGeo = new THREE.BufferGeometry();
const waterPos = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount * 3; i++) {
    waterPos[i] = (Math.random() - 0.5) * 20; 
}
waterGeo.setAttribute('position', new THREE.BufferAttribute(waterPos, 3));
const waterMat = new THREE.PointsMaterial({
    size: 0.05,
    color: 0x4fc3f7,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending 
});
const waterParticles = new THREE.Points(waterGeo, waterMat);
scene.add(waterParticles);

// 3. 魚類模型
const fishGroup = new THREE.Group();
const fishGeo = new THREE.ConeGeometry(0.15, 0.6, 4);
fishGeo.rotateZ(-Math.PI / 2); 
const fishMat = new THREE.MeshStandardMaterial({ 
    color: 0xff8800, 
    roughness: 0.4,
    metalness: 0.1
});
const fishes = [];

for(let i=0; i<40; i++) {
    const fish = new THREE.Mesh(fishGeo, fishMat);
    fish.position.set((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 15);
    
    const direction = Math.random() > 0.5 ? 1 : -1;
    if (direction === -1) {
        fish.rotation.y = Math.PI;
    }

    fish.userData = {
        speed: (0.02 + Math.random() * 0.03) * direction, 
        offset: Math.random() * Math.PI * 2, 
        swimPattern: Math.random(),
        direction: direction
    };
    fishes.push(fish);
    fishGroup.add(fish);
}
scene.add(fishGroup);

// 4. 汙染源與廢棄物模型
const trashGroup = new THREE.Group();
const trashGeo = new THREE.DodecahedronGeometry(0.2, 0); 
const trashMat = new THREE.MeshStandardMaterial({ 
    color: 0x8b8b8b, 
    roughness: 0.9 
});
const trashes = [];

for(let i=0; i<60; i++) {
    const trash = new THREE.Mesh(trashGeo, trashMat);
    trash.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
    const scale = 0.5 + Math.random() * 1.5;
    trash.scale.set(scale, scale, scale);
    trashes.push(trash);
    trashGroup.add(trash);
}
scene.add(trashGroup);

// 5. 新增：Raycaster 點擊互動功能 (點擊清除垃圾)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    // 將滑鼠點擊的螢幕座標轉換為 Three.js 的標準設備座標 (NDC, -1 到 +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 透過攝影機與滑鼠位置更新射線
    raycaster.setFromCamera(mouse, camera);

    // 偵測射線是否與垃圾群組中的物件相交
    const intersects = raycaster.intersectObjects(trashGroup.children);

    if (intersects.length > 0) {
        // 取得第一個被點擊到的垃圾
        const clickedTrash = intersects[0].object;
        
        // 1. 從場景(群組)中移除該垃圾，讓它在畫面上消失
        trashGroup.remove(clickedTrash);
        
        // 2. 從 trashes 陣列中移除，停止對它的動畫運算
        const index = trashes.indexOf(clickedTrash);
        if (index > -1) {
            trashes.splice(index, 1);
        }
        
        // (可選) 這裡可以加入一些音效播放，或者計分功能
    }
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    // 更新水流粒子
    const positions = waterParticles.geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
        const index = i * 3;
        let x = positions[index];
        let y = positions[index + 1];
        let z = positions[index + 2];
        const speed = 0.02;
        x += Math.sin(time + z) * speed; 
        y += Math.cos(time + x) * speed * 0.5; 
        if (x > 10) x = -10;
        if (x < -10) x = 10;
        positions[index] = x;
        positions[index + 1] = y;
    }
    waterParticles.geometry.attributes.position.needsUpdate = true;

    // 更新魚群動態
    fishes.forEach(fish => {
        fish.position.x += fish.userData.speed;
        fish.position.y += Math.sin(time * 2 + fish.userData.offset) * 0.01;
        
        const baseRotation = fish.userData.direction === 1 ? 0 : Math.PI;
        fish.rotation.y = baseRotation + Math.sin(time * 5 + fish.userData.offset) * 0.15;

        if(fish.userData.direction === 1 && fish.position.x > 10) {
            fish.position.x = -10;
            fish.position.y = (Math.random() - 0.5) * 10;
            fish.position.z = (Math.random() - 0.5) * 15;
        } else if (fish.userData.direction === -1 && fish.position.x < -10) {
            fish.position.x = 10;
            fish.position.y = (Math.random() - 0.5) * 10;
            fish.position.z = (Math.random() - 0.5) * 15;
        }
    });

    // 更新汙染物動態
    trashes.forEach(trash => {
        trash.position.y -= 0.005;
        trash.position.x += Math.sin(time + trash.position.z) * 0.005;
        trash.rotation.x += 0.01;
        trash.rotation.y += 0.005;

        if(trash.position.y < -10) {
            trash.position.y = 10;
            trash.position.x = (Math.random() - 0.5) * 18;
        }
    });

    controls.update(); 
    renderer.render(scene, camera);
}
animate();