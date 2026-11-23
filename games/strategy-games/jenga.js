// AI Games Collection jenga 3d - Physics-based Block Tower with Three.js & cannon-es
// **Timestamp**: 2025-12-26 — migrated 2026-11-04 from CANNON 0.6.2 global to cannon-es ESM
import * as CANNON from 'cannon-es';

// Three.js scene variables
let scene, camera, renderer, controls;
let world; // Cannon.js physics world
let blocks = [];
let blockWireframes = []; // Store wireframe borders separately
let blockBodies = [];
let selectedBlock = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

// Global error handler
window.addEventListener('error', (event) => {
    console.error('🚨 GLOBAL ERROR:', event.error);
    console.error('Error details:', {
        message: event.error.message,
        stack: event.error.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });

    const jsIndicator = document.getElementById('jsLoaded');
    if (jsIndicator) {
        jsIndicator.textContent = '❌ JavaScript Error!';
        jsIndicator.style.background = 'rgba(255,0,0,0.9)';
    }

    showError('JavaScript Error', event.error.message);
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 UNHANDLED PROMISE REJECTION:', event.reason);
    event.preventDefault();
    showError('Promise Error', event.reason?.message || 'Unknown promise rejection');
});

// Error display function
function showError(title, message) {
    console.error(`❌ ${title}:`, message);
    console.error('Continuing anyway - not blocking game startup...');

    // Don't create modal - just log and continue
    // This prevents stuck modals during development
}

// Game configuration - will be updated based on variant
// Block dimensions: 3 long, 1 wide, 1 high (ratio 3:1:1)
let BLOCK_WIDTH = 3.0;  // Long side
let BLOCK_HEIGHT = 1.0; // Height
let BLOCK_DEPTH = 1.0;  // Short side (width)
let TOWER_LEVELS = 18;  // Will be set based on variant
let BLOCKS_PER_LEVEL = 3;
let currentVariant = 'classic'; // 'classic', 'jenga4', 'jenga5'
let currentTheme = 'classic'; // 'classic', 'dachshund', 'sausage', 'battery', 'random'
let currentFriction = 0.4; // 0 = slippery, 2 = glued

// Jenga variant configurations
const JENGA_VARIANTS = {
    classic: { blocksPerLevel: 3, towerLevels: 18, name: 'Classic Jenga' },
    jenga4: { blocksPerLevel: 4, towerLevels: 15, name: 'Jenga 4' },
    jenga5: { blocksPerLevel: 5, towerLevels: 12, name: 'Jenga 5' }
};

// Game state
let gameState = {
    level: 1,
    blocksRemoved: 0,
    stability: 100,
    gameActive: false,
    crashMode: false
};

// AI state
let aiEnabled = false;
let aiPersonality = 'strategic'; // 'strategic', 'conservative', 'aggressive', 'wicked', 'naive', 'random'
let currentPlayer = 'human'; // 'human' or 'ai'
let aiThinking = false;

// Create wood grain normal map for 3D effect
function createWoodGrainNormalMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Create a neutral normal map (flat surface)
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;

    // Fill with neutral normal (128, 128, 255) - pointing straight up
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;     // Red (X normal)
        data[i + 1] = 128; // Green (Y normal)
        data[i + 2] = 255; // Blue (Z normal - pointing out)
        data[i + 3] = 255; // Alpha
    }

    // Add subtle variations along the grain lines
    for (let i = 0; i < 30; i++) {
        const y = Math.random() * 512;
        const amplitude = Math.random() * 10 + 2;
        const frequency = Math.random() * 0.02 + 0.005;

        for (let x = 0; x < 512; x += 1) {
            const wave = Math.sin(x * frequency) * amplitude;
            const grainY = Math.floor(y + wave);

            if (grainY >= 0 && grainY < 512) {
                const index = (grainY * 512 + x) * 4;
                // Slightly vary the normal direction for grain effect
                data[index] = Math.max(0, Math.min(255, data[index] + (Math.random() - 0.5) * 20));
                data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + (Math.random() - 0.5) * 20));
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

// Create wood grain texture
function createWoodGrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base wood color
    const baseColor = { r: 139, g: 69, b: 19 }; // Saddle brown
    const lightColor = { r: 160, g: 82, b: 45 }; // Peru
    const darkColor = { r: 101, g: 67, b: 33 }; // Dark brown

    // Fill with base color
    ctx.fillStyle = `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
    ctx.fillRect(0, 0, 512, 512);

    // Add wood grain lines
    ctx.strokeStyle = `rgb(${lightColor.r}, ${lightColor.g}, ${lightColor.b})`;
    ctx.lineWidth = 2;

    for (let i = 0; i < 50; i++) {
        const y = Math.random() * 512;
        const amplitude = Math.random() * 20 + 5;
        const frequency = Math.random() * 0.02 + 0.005;

        ctx.beginPath();
        for (let x = 0; x < 512; x += 2) {
            const wave = Math.sin(x * frequency) * amplitude;
            const grainY = y + wave;

            if (x === 0) {
                ctx.moveTo(x, grainY);
            } else {
                ctx.lineTo(x, grainY);
            }
        }
        ctx.stroke();
    }

    // Add some darker grain lines
    ctx.strokeStyle = `rgb(${darkColor.r}, ${darkColor.g}, ${darkColor.b})`;
    ctx.lineWidth = 1;

    for (let i = 0; i < 30; i++) {
        const y = Math.random() * 512;
        const amplitude = Math.random() * 15 + 3;
        const frequency = Math.random() * 0.03 + 0.01;

        ctx.beginPath();
        for (let x = 0; x < 512; x += 1) {
            const wave = Math.sin(x * frequency) * amplitude;
            const grainY = y + wave;

            if (x === 0) {
                ctx.moveTo(x, grainY);
            } else {
                ctx.lineTo(x, grainY);
            }
        }
        ctx.stroke();
    }

    // Add some wood knots/nodes
    for (let i = 0; i < 8; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = Math.random() * 8 + 4;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgb(${darkColor.r - 20}, ${darkColor.g - 20}, ${darkColor.b - 20})`);
        gradient.addColorStop(1, `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Add subtle noise for texture variation
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 10;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // Red
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // Green
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // Blue
    }

    ctx.putImageData(imageData, 0, 0);

    return new THREE.CanvasTexture(canvas);
}

// Materials with wood grain texture
const woodTexture = createWoodGrainTexture();
woodTexture.wrapS = THREE.RepeatWrapping;
woodTexture.wrapT = THREE.RepeatWrapping;
woodTexture.repeat.set(3, 1); // Repeat horizontally to show grain direction
woodTexture.anisotropy = 16; // Improve texture quality

const woodNormalMap = createWoodGrainNormalMap();
woodNormalMap.wrapS = THREE.RepeatWrapping;
woodNormalMap.wrapT = THREE.RepeatWrapping;
woodNormalMap.repeat.set(3, 1);
woodNormalMap.anisotropy = 16;

const woodMaterial = new THREE.MeshLambertMaterial({
    color: 0x8B4513, // Fallback solid color
    transparent: true,
    opacity: 0.9
});

// Try to add texture if available
try {
    if (woodTexture && woodNormalMap) {
        woodMaterial.map = woodTexture;
        woodMaterial.normalMap = woodNormalMap;
        console.log('✅ Wood texture applied successfully');
    } else {
        console.warn('⚠️ Wood texture not available, using solid color');
    }
} catch (error) {
    console.warn('⚠️ Failed to apply wood texture:', error);
}

const woodMaterialSelected = new THREE.MeshLambertMaterial({
    color: 0xFFD700,
    transparent: true,
    opacity: 0.9,
    emissive: 0x444400
});

const groundMaterial = new THREE.MeshLambertMaterial({
    color: 0x90EE90
});

const gluedMaterial = new THREE.MeshLambertMaterial({
    color: 0xFFD700, // Gold color for glued blocks
    emissive: 0x444400,
    transparent: true,
    opacity: 0.9
});

// Jenga theme configurations with different block shapes
const JENGA_THEMES = {
    classic: {
        name: 'Classic Blocks',
        material: woodMaterial,
        blockGeometry: 'box',
        blockSize: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, depth: BLOCK_DEPTH }
    },
    dachshund: {
        name: 'Dachshund Dogs',
        material: woodMaterial,
        blockGeometry: 'dachshund',
        blockSize: { width: BLOCK_WIDTH * 1.5, height: BLOCK_HEIGHT, depth: BLOCK_DEPTH * 0.8 }
    },
    sausage: {
        name: 'German Sausages',
        material: woodMaterial,
        blockGeometry: 'cylinder',
        blockSize: { radius: BLOCK_WIDTH * 0.4, height: BLOCK_HEIGHT }
    },
    battery: {
        name: 'AA Batteries',
        material: new THREE.MeshLambertMaterial({
            color: 0xCCCCCC,
            transparent: true,
            opacity: 0.9
        }),
        blockGeometry: 'battery',
        blockSize: { radius: BLOCK_WIDTH * 0.3, height: BLOCK_HEIGHT * 1.2 }
    },
    random: {
        name: 'Random Mix',
        material: woodMaterial,
        blockGeometry: 'random',
        blockSize: { width: BLOCK_WIDTH, height: BLOCK_HEIGHT, depth: BLOCK_DEPTH }
    }
};

function init3D() {
    try {
        console.log('🔧 init3D() called - starting 3D initialization');
        const container = document.getElementById('jenga3DContainer');

        if (!container) {
            throw new Error('jenga3DContainer element not found in DOM');
        }

        // Add visual feedback
        container.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 18px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">🔧 Initializing 3D Engine...</div>';

        if (typeof THREE === 'undefined') {
            const error = new Error('Three.js library not loaded');
            console.error('3D Jenga:', error.message);
            showError('Three.js Missing', error.message + '. Please refresh the page.');
            return;
        }

        console.log('Initializing Three.js scene...');

        // Get actual container dimensions
        const width = container.clientWidth || 600;
        const height = container.clientHeight || 400;

        if (width < 100 || height < 100) {
            console.warn('Container dimensions seem too small:', width, 'x', height);
        }

        // Scene
        try {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x87CEEB); // Sky blue background
            scene.fog = new THREE.Fog(0x87CEEB, 10, 50);
            console.log('✅ Scene created successfully');
        } catch (error) {
            console.error('❌ Failed to create scene:', error);
            showError('Scene Creation Failed', error.message);
            return;
        }

        // Camera - positioned for optimal tower viewing (tall viewport)
        try {
            camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
            camera.position.set(8, 6, 8);
            camera.lookAt(0, TOWER_LEVELS * BLOCK_HEIGHT / 2, 0); // Look at middle of tower
            console.log('✅ Camera created successfully');
        } catch (error) {
            console.error('❌ Failed to create camera:', error);
            showError('Camera Creation Failed', error.message);
            return;
        }

    // Renderer - Try multiple WebGL context options for better compatibility
    try {
        // Check if WebGL is supported
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            throw new Error('WebGL is not supported in this browser. Please enable WebGL in your browser settings or update your graphics drivers.');
        }

        // Try creating renderer with different options
        let rendererOptions = {
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
        };

        try {
            renderer = new THREE.WebGLRenderer(rendererOptions);
            console.log('✅ Renderer created with full options');
        } catch (e) {
            console.warn('Failed with antialias, trying without...', e);
            try {
                rendererOptions.antialias = false;
                renderer = new THREE.WebGLRenderer(rendererOptions);
                console.log('✅ Renderer created with fallback options');
            } catch (fallbackError) {
                console.error('❌ Renderer creation failed completely:', fallbackError);
                showError('Renderer Creation Failed', 'Could not create WebGL renderer. ' + fallbackError.message);
                return;
            }
        }

        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Set clear color to sky blue
        renderer.setClearColor(0x87CEEB, 1);

        // Clear container first
        container.innerHTML = '';
        container.appendChild(renderer.domElement);
        console.log('Renderer created and added to container');
        console.log('WebGL context:', renderer.getContext());
        console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
    } catch (error) {
        console.error('Failed to create renderer:', error);
        let errorMsg = error.message || 'Unknown error';
        let helpText = '';

        if (errorMsg.includes('WebGL')) {
            helpText = '<br><br><strong>Possible solutions:</strong><ul style="text-align: left; display: inline-block;">' +
                      '<li>Enable WebGL in Firefox: about:config → search "webgl" → set webgl.disabled to false</li>' +
                      '<li>Enable hardware acceleration: Settings → General → Performance → uncheck "Use recommended performance settings" → check "Use hardware acceleration"</li>' +
                      '<li>Update your graphics drivers</li>' +
                      '<li>Try a different browser (Chrome, Edge)</li></ul>';
        }

        container.innerHTML = '<div style="color: red; padding: 20px; text-align: center; background: rgba(0,0,0,0.8); border-radius: 10px;">' +
                             '<h3>3D Rendering Error</h3>' +
                             '<p>' + errorMsg + '</p>' +
                             helpText +
                             '</div>';
        return;
    }

    // Orbit Controls - Check if loaded properly
    try {
        if (typeof THREE.OrbitControls !== 'undefined') {
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            console.log('Using THREE.OrbitControls');
        } else if (typeof OrbitControls !== 'undefined') {
            controls = new OrbitControls(camera, renderer.domElement);
            console.log('Using global OrbitControls');
        } else {
            console.error('OrbitControls not loaded!');
            container.innerHTML = '<p style="color: red; padding: 20px; text-align: center;">Error: OrbitControls not loaded. Please refresh the page.</p>';
            return;
        }
    } catch (error) {
        console.error('Failed to create OrbitControls:', error);
        container.innerHTML = '<p style="color: red; padding: 20px; text-align: center;">Error: Failed to create camera controls: ' + error.message + '</p>';
        return;
    }

    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enablePan = false; // Disable panning to avoid conflicts
    controls.enableZoom = true;
    controls.enableRotate = true;

        // Physics world
        try {
            world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
            world.broadphase = new CANNON.SAPBroadphase(world);
            world.allowSleep = true;
            world.solver.iterations = 12;
            world.defaultContactMaterial.friction = currentFriction;
            world.defaultContactMaterial.restitution = 0.05;
            console.log('✅ Physics world created successfully');
        } catch (error) {
            console.error('❌ Failed to create physics world:', error);
            showError('Physics World Failed', error.message);
            return;
        }

        // Lighting
        try {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            scene.add(directionalLight);

            const spotLight = new THREE.SpotLight(0xffffff, 0.3);
            spotLight.position.set(-5, 10, -5);
            scene.add(spotLight);
            console.log('✅ Lighting setup completed');
        } catch (error) {
            console.error('❌ Failed to setup lighting:', error);
            showError('Lighting Setup Failed', error.message);
            return;
        }

        // Ground
        try {
            createGround();
            console.log('✅ Ground created successfully');
        } catch (error) {
            console.error('❌ Failed to create ground:', error);
            showError('Ground Creation Failed', error.message);
            return;
        }

    // Force initial render
    renderer.render(scene, camera);

        // Event listeners
        renderer.domElement.addEventListener('click', onMouseClick);
        window.addEventListener('resize', onWindowResize);

        console.log('3D scene initialization complete!');
        console.log('🎮 3D ENGINE READY - Tower can be built now!');

        // Animation loop
        animate();

    } catch (error) {
        console.error('❌ 3D initialization failed:', error);
        showError('3D Initialization Failed', error.message);
    }
}

function createGround() {
    // Three.js ground
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Physics ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(groundBody);
}

function createBlock(x, y, z, id, isRotated = false) {
    const theme = JENGA_THEMES[currentTheme];
    const themeSize = theme.blockSize;

    let geometry, physicsShape;
    let actualMaterial = theme.material;

    // Determine geometry type for this block
    let geometryType = theme.blockGeometry;
    if (geometryType === 'random') {
        // Random mix: randomly choose between all available types
        const types = ['box', 'dachshund', 'cylinder', 'battery'];
        geometryType = types[Math.floor(Math.random() * types.length)];
        // Use appropriate material for random blocks
        if (geometryType === 'battery') {
            actualMaterial = JENGA_THEMES.battery.material;
        } else {
            actualMaterial = woodMaterial;
        }
    }

    switch (geometryType) {
        case 'box':
            // For rotated blocks, swap width and depth so long side is along Z
            // Use minimal segments (1,1,1) for perfect rectangular blocks without visible subdivisions
            if (isRotated) {
                // Rotated: block should be 1 unit wide along X, 3 units long along Z
                const rotWidth = themeSize.depth || BLOCK_DEPTH;   // 1.0 - short dimension
                const rotDepth = themeSize.width || BLOCK_WIDTH;   // 3.0 - long dimension
                geometry = new THREE.BoxGeometry(rotWidth, themeSize.height, rotDepth, 1, 1, 1);
                physicsShape = new CANNON.Box(new CANNON.Vec3(rotWidth/2, themeSize.height/2, rotDepth/2));
            } else {
                // Normal: block should be 3 units long along X, 1 unit wide along Z
                const normWidth = themeSize.width || BLOCK_WIDTH;  // 3.0 - long dimension
                const normDepth = themeSize.depth || BLOCK_DEPTH;  // 1.0 - short dimension
                geometry = new THREE.BoxGeometry(normWidth, themeSize.height, normDepth, 1, 1, 1);
                physicsShape = new CANNON.Box(new CANNON.Vec3(normWidth/2, themeSize.height/2, normDepth/2));
            }
            break;

        case 'cylinder':
            // Sausage shape
            geometry = new THREE.CylinderGeometry(themeSize.radius, themeSize.radius, themeSize.height, 16);
            physicsShape = new CANNON.Cylinder(themeSize.radius, themeSize.radius, themeSize.height, 16);
            break;

        case 'battery':
            // AA battery shape (cylinder with flat ends)
            geometry = new THREE.CylinderGeometry(themeSize.radius, themeSize.radius, themeSize.height, 12);
            physicsShape = new CANNON.Cylinder(themeSize.radius, themeSize.radius, themeSize.height, 12);
            break;

        case 'dachshund':
            // Dachshund dog shape (elongated with rounded ends)
            geometry = createDachshundGeometry(themeSize.width, themeSize.height, themeSize.depth);
            physicsShape = new CANNON.Box(new CANNON.Vec3(themeSize.width/2, themeSize.height/2, themeSize.depth/2));
            break;

        default:
            // Fallback to box
            geometry = new THREE.BoxGeometry(themeSize.width, themeSize.height, themeSize.depth);
            physicsShape = new CANNON.Box(new CANNON.Vec3(themeSize.width/2, themeSize.height/2, themeSize.depth/2));
    }

    // Use a simple colored material for now to ensure visibility
    const simpleMaterial = new THREE.MeshLambertMaterial({
        color: geometryType === 'battery' ? 0xCCCCCC : 0x8B4513, // Silver for batteries, brown for others
        transparent: true,
        opacity: 0.9
    });

    const mesh = new THREE.Mesh(geometry, simpleMaterial);
    mesh.position.set(x, y, z);
    // No rotation needed - geometry is already created with correct orientation

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = id;
    mesh.userData.geometryType = geometryType;

    scene.add(mesh);

    // Add visible borders/edges to the block for better definition
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x000000,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
    });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.copy(mesh.position);
    wireframe.userData.id = id + '_edges';
    wireframe.userData.geometryType = geometryType;
    scene.add(wireframe);

    // Store mesh and wireframe separately for proper management
    blocks.push(mesh);
    blockWireframes.push(wireframe);

    // Physics body - start as kinematic (mass: 0) so blocks don't fall immediately
    // Blocks will be made dynamic when removed from tower
    // cannon-es: enable sleeping so the tower rests instead of jittering
    const body = new CANNON.Body({
        mass: 0,  // Kinematic - won't fall due to gravity
        type: CANNON.Body.KINEMATIC,  // Explicit kinematic type
        sleepSpeedLimit: 0.15,
        sleepTimeLimit: 0.6
    });
    body.addShape(physicsShape);
    body.position.set(x, y, z);

    // No rotation needed - physics shape is already created with correct orientation

    // Store initial position for stability checks
    body.userData = { initialPosition: { x, y, z }, isRemoved: false };

    world.addBody(body);

    // Link the physics body to its mesh so sync loops never rely on array index pairing
    mesh.userData.body = body;

    blockBodies.push(body);

    return { mesh, body, id };
}

// Create dachshund-shaped geometry
function createDachshundGeometry(width, height, depth) {
    const geometry = new THREE.Group();

    // Body (elongated cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(height * 0.3, height * 0.25, width, 8);
    bodyGeometry.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeometry);

    // Head (smaller cylinder at front)
    const headGeometry = new THREE.CylinderGeometry(height * 0.25, height * 0.2, depth * 0.6, 8);
    const head = new THREE.Mesh(headGeometry);
    head.position.x = width * 0.35;

    // Tail (small cone at back)
    const tailGeometry = new THREE.ConeGeometry(height * 0.15, depth * 0.4, 6);
    const tail = new THREE.Mesh(tailGeometry);
    tail.position.x = -width * 0.35;
    tail.rotation.z = Math.PI / 6;

    // Legs (small cylinders)
    const legGeometry = new THREE.CylinderGeometry(height * 0.1, height * 0.08, depth * 0.3, 6);
    const legPositions = [
        { x: width * 0.2, z: depth * 0.2 },
        { x: width * 0.2, z: -depth * 0.2 },
        { x: -width * 0.2, z: depth * 0.2 },
        { x: -width * 0.2, z: -depth * 0.2 }
    ];

    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry);
        leg.position.set(pos.x, -height * 0.25, pos.z);
        geometry.add(leg);
    });

    geometry.add(body);
    geometry.add(head);
    geometry.add(tail);

    // r128 has no BufferGeometry.merge() — return a stable Box fallback so the
    // dachshund theme never crashes. Visual variety comes from material color.
    // TODO: proper merge via BufferGeometryUtils if we want the dog shape back.
    console.warn('dachshund geometry: using Box fallback (r128 has no BufferGeometry.merge)');
    return new THREE.BoxGeometry(width, height, depth);
}

function buildTower() {
    // Clear existing blocks
        blocks.forEach(block => {
            if (block && scene) scene.remove(block);
        });
        blockWireframes.forEach(wireframe => {
            if (wireframe && scene) scene.remove(wireframe);
        });
        blockBodies.forEach(body => {
            if (body && world) world.remove(body);
        });
        blocks = [];
        blockWireframes = [];
        blockBodies = [];

        const centerX = 0;
        const baseY = BLOCK_HEIGHT / 2;
        
        // Wait a moment for physics world to clear
        setTimeout(() => {
            buildTowerBlocks();
        }, 100);
}

function buildTowerBlocks() {
    console.log('=== buildTowerBlocks CALLED ===');
    const centerX = 0;
    const baseY = BLOCK_HEIGHT / 2;

    // Get current theme dimensions for positioning
    const theme = JENGA_THEMES[currentTheme];
    if (!theme) {
        console.error('Theme not found:', currentTheme, '- falling back to classic');
        currentTheme = 'classic';
    }

    const themeSize = theme.blockSize;
    const blockLength = themeSize.width || BLOCK_WIDTH;  // 3.0 - long dimension
    const blockWidth = themeSize.depth || BLOCK_DEPTH;   // 1.0 - short dimension

    console.log('=== BUILD PARAMETERS ===');
    console.log('TOWER_LEVELS =', TOWER_LEVELS);
    console.log('BLOCKS_PER_LEVEL =', BLOCKS_PER_LEVEL);
    console.log('Block length =', blockLength, 'Block width =', blockWidth);
    console.log('BLOCK_WIDTH =', BLOCK_WIDTH, 'BLOCK_DEPTH =', BLOCK_DEPTH);
    
    for (let level = 0; level < TOWER_LEVELS; level++) {
        const levelY = baseY + (level * BLOCK_HEIGHT);
        const isRotated = level % 2 === 1;

        // For 3×3 square layer: 3 blocks × 1.0 spacing = 3.0 total
        // Normal layer: blocks placed side-by-side along Z, each 3 long along X
        // Rotated layer: blocks placed side-by-side along X, each 3 long along Z
        const spacing = blockWidth; // 1.0 - spacing between block centers

        console.log(`Level ${level}: isRotated=${isRotated}, spacing=${spacing}, levelY=${levelY}`);

        // Calculate proper spacing for blocks to be touching
        // For 3 blocks of width 1.0, centers should be at -1.0, 0, 1.0
        const startOffset = -(BLOCKS_PER_LEVEL - 1) * spacing / 2; // Center the group of blocks
        
        for (let blockInLevel = 0; blockInLevel < BLOCKS_PER_LEVEL; blockInLevel++) {
            let blockX, blockZ;

            if (isRotated) {
                // Rotated: blocks side-by-side along X-axis
                // Each block is 1 unit wide along X, 3 units long along Z
                blockX = startOffset + (blockInLevel * spacing); // Centers: -1.0, 0, 1.0
                blockZ = 0; // All blocks centered at Z=0
            } else {
                // Normal: blocks side-by-side along Z-axis  
                // Each block is 3 units long along X, 1 unit wide along Z
                blockX = 0; // All blocks centered at X=0
                blockZ = startOffset + (blockInLevel * spacing); // Centers: -1.0, 0, 1.0
            }
            
            console.log(`  Block ${blockInLevel}: X=${blockX}, Z=${blockZ}`);

            const id = `block-${level}-${blockInLevel}`;
            try {
                createBlock(blockX, levelY, blockZ, id, isRotated);
            } catch (error) {
                console.error(`Failed to create block ${id}:`, error);
                // Continue with other blocks rather than failing completely
            }
        }
    }
    
    // After building, ensure all blocks are kinematic and properly positioned
    setTimeout(() => {
        blocks.forEach(mesh => {
            const body = mesh.userData.body;
            if (mesh && body) {
                // Ensure kinematic
                body.mass = 0;
                body.type = CANNON.Body.KINEMATIC;
                body.updateMassProperties();

                // Sync mesh position from its own body
                mesh.position.copy(body.position);
                mesh.quaternion.copy(body.quaternion);
            }
        });
    }, 200);
}

function onMouseClick(event) {
    if (gameState.crashMode) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(blocks);

    if (intersects.length > 0) {
        const clickedBlock = intersects[0].object;
        selectBlock(clickedBlock.userData.id);
    }
}

function selectBlock(blockId) {
    // Prevent selection during AI turn or crash mode
    if (currentPlayer === 'ai' || gameState.crashMode || aiThinking) {
        return;
    }

    // Find and select new block first
    const blockMesh = blocks.find(block => block.userData.id === blockId);
    if (blockMesh) {
        // Check if this is a valid move for the current variant
        if (!isValidJengaMove(blockId)) {
            updateStatus('❌ Cannot remove this block - it would violate game rules!');
            return;
        }

        selectedBlock = blockMesh;

        // Update all block materials (this will handle selection highlighting)
        updateBlockMaterials();

        document.getElementById('pull-btn').disabled = false;
        updateStatus('Block selected! Click "Pull Block" to remove it.');
    }
}

// Removed duplicate pullBlock function

function makeMove(blockId) {
    const blockIndex = blocks.findIndex(block => block.userData.id === blockId);
    if (blockIndex === -1) return;

    const blockMesh = blocks[blockIndex];
    const blockBody = blockBodies[blockIndex];

    // When removing a block, make it dynamic so it falls
    if (blockBody) {
        blockBody.mass = 1; // Make it dynamic
        blockBody.type = CANNON.Body.DYNAMIC;
        blockBody.updateMassProperties();
        
        // Apply a small force to pull it out
        const pullDirection = new CANNON.Vec3(
            (Math.random() - 0.5) * 2,
            0.5,
            (Math.random() - 0.5) * 2
        );
        blockBody.applyImpulse(pullDirection, blockBody.position);
    }

    // Remove from physics world after a short delay (let it fall first)
    setTimeout(() => {
        if (blockBody && world.bodies.indexOf(blockBody) !== -1) {
            world.remove(blockBody);
        }
        if (blockMesh && scene.children.indexOf(blockMesh) !== -1) {
            scene.remove(blockMesh);
        }

        // Also remove the corresponding wireframe
        const wireframeIndex = blockIndex; // Wireframes are stored at the same index as blocks
        if (blockWireframes[wireframeIndex] && scene.children.indexOf(blockWireframes[wireframeIndex]) !== -1) {
            scene.remove(blockWireframes[wireframeIndex]);
        }

        // Remove from arrays
        const meshIndex = blocks.indexOf(blockMesh);
        const bodyIndex = blockBodies.indexOf(blockBody);
        if (meshIndex !== -1) blocks.splice(meshIndex, 1);
        if (bodyIndex !== -1) blockBodies.splice(bodyIndex, 1);
        if (wireframeIndex !== -1) blockWireframes.splice(wireframeIndex, 1);
    }, 2000); // Give it time to fall away

    gameState.blocksRemoved++;
    selectedBlock = null;
    document.getElementById('pull-btn').disabled = true;

    // Check stability after physics settles
    setTimeout(() => {
        checkTowerStability();
        updateUI();
    }, 1000);

    updateUI();
}

// Removed duplicate pullBlock function

// Removed old 2D checkTowerStability function

// Removed old 2D triggerCrash function

function updateStability() {
    // Simple stability calculation based on remaining blocks
    const baseStability = Math.max(20, 100 - (gameState.blocksRemoved * 3));
    const levelBonus = (gameState.level - 1) * 5;
    gameState.stability = Math.min(100, baseStability + levelBonus);
}

function setCameraAngle(angle) {
    controls.reset();

    switch(angle) {
        case 'top':
            camera.position.set(0, 15, 0);
            camera.lookAt(0, TOWER_LEVELS * BLOCK_HEIGHT / 2, 0);
            break;
        case 'side':
            camera.position.set(10, TOWER_LEVELS * BLOCK_HEIGHT / 2, 0);
            camera.lookAt(0, TOWER_LEVELS * BLOCK_HEIGHT / 2, 0);
            break;
        case 'iso':
            camera.position.set(8, 6, 8);
            camera.lookAt(0, TOWER_LEVELS * BLOCK_HEIGHT / 2, 0);
            break;
    }

    controls.update();
}

function resetCamera() {
    camera.position.set(6, 8, 6); // Optimal position for tower viewing
    camera.lookAt(0, TOWER_LEVELS * BLOCK_HEIGHT / 2, 0);
    controls.update();
}

function onWindowResize() {
    const container = document.getElementById('jenga3DContainer');
    const newWidth = Math.max(container.clientWidth || 600, 400);
    const newHeight = Math.max(container.clientHeight || window.innerHeight * 0.8, 400);
    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Update controls
    if (controls) {
        controls.update();
    }

    // Update physics
    if (world) {
        world.step(1/60);

        // Sync Three.js meshes with Cannon.js bodies (via the body reference
        // stored on each mesh - never by array index, which can misalign)
        for (let i = 0; i < blocks.length; i++) {
            const body = blocks[i] && blocks[i].userData.body;
            if (blocks[i] && body) {
                blocks[i].position.copy(body.position);
                blocks[i].quaternion.copy(body.quaternion);
            }
        }
    }

    if (controls) {
        controls.update();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Removed 2D initializeGame function - using 3D version only

// Removed 2D buildTower function - using 3D version only

function pullBlock() {
    if (!selectedBlock || gameState.crashMode) return;

    const block = selectedBlock;
    const blockIndex = blocks.indexOf(block);

    // Remove the block from 3D scene
    blocks.splice(blockIndex, 1);
    scene.remove(block); // Remove Three.js mesh from scene

    // Also remove corresponding wireframe
    if (blockWireframes[blockIndex]) {
        scene.remove(blockWireframes[blockIndex]);
        blockWireframes.splice(blockIndex, 1);
    }

    // Also remove corresponding physics body
    if (blockBodies[blockIndex]) {
        world.remove(blockBodies[blockIndex]);
        blockBodies.splice(blockIndex, 1);
    }

    gameState.blocksRemoved++;
    gameState.selectedBlock = null;
    document.getElementById('pull-btn').disabled = true;

    // Check stability after a short delay
    setTimeout(() => {
        if (!checkTowerStability()) {
            triggerCrash();
        } else {
            updateStability();

            // Check for level advancement
            const blocksToNextLevel = gameState.level * 3;
            if (gameState.blocksRemoved >= blocksToNextLevel) {
                advanceLevel();
            } else {
                updateStatus('Good move! Tower is still stable.');
            }
        }
    }, 500);

    updateUI();
}

function advanceLevel() {
    gameState.level++;
    gameState.blocksRemoved = 0;

    updateStatus(`🎉 Level ${gameState.level} reached! Tower is more challenging now.`);

    // Make tower slightly more unstable for higher levels
    // (This could be enhanced with different tower shapes, fewer blocks, etc.)

    setTimeout(() => {
        buildTower();
        updateStatus('New level started! Select a block to continue.');
    }, 2000);
}

function checkTowerStability() {
    // For 3D physics, check if any blocks have fallen or moved significantly
    // This is a simplified stability check for the 3D version

    for (let i = 0; i < blocks.length; i++) {
        const mesh = blocks[i];
        const body = blockBodies[i];

        if (!mesh || !body) continue;

        // Check if block has fallen below ground level
        if (body.position.y < -1) {
            return false; // Tower is unstable
        }

        // Check if block has moved too far from its expected position
        // This is a simplified check - in a real physics engine we'd check for excessive velocity/rotation
        const distanceFromOrigin = Math.sqrt(body.position.x * body.position.x + body.position.z * body.position.z);
        if (distanceFromOrigin > 5) { // Arbitrary threshold
            return false; // Block has moved too far
        }
    }

    return true; // Tower is stable
}

function triggerCrash() {
    gameState.crashMode = true;

    // Show crash overlay
    const overlay = document.getElementById('crash-overlay');
    overlay.classList.add('show');

    // Make all remaining blocks fall with physics forces
    for (let i = 0; i < blocks.length; i++) {
        const body = blockBodies[i];
        if (body) {
            // Apply random forces to make blocks fall chaotically
            const force = new CANNON.Vec3(
                (Math.random() - 0.5) * 50, // Random X force
                Math.random() * 20,        // Upward force
                (Math.random() - 0.5) * 50  // Random Z force
            );
            const worldPoint = new CANNON.Vec3(0, 0, 0); // Apply force at center
            body.applyForce(force, worldPoint);

            // Apply random torque for spinning
            const torque = new CANNON.Vec3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            );
            body.applyTorque(torque);
        }
    }

    updateStatus('💥 Tower crashed! Game over.');

    // Reset after animation
    setTimeout(() => {
        overlay.classList.remove('show');
        gameState.crashMode = false;
        aiThinking = false;
        document.getElementById('aiThinking').style.display = 'none';
        newGame();
    }, 3000);
}

function updateUI() {
    document.getElementById('level').textContent = gameState.level;
    document.getElementById('blocks-removed').textContent = gameState.blocksRemoved;
    document.getElementById('stability').textContent = gameState.stability + '%';

    // Update stability color
    const stabilityEl = document.getElementById('stability');
    if (gameState.stability > 70) {
        stabilityEl.style.color = '#4CAF50';
    } else if (gameState.stability > 40) {
        stabilityEl.style.color = '#FF9800';
    } else {
        stabilityEl.style.color = '#F44336';
    }
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}

function resetTower() {
    if (gameState.crashMode) return;

    buildTower();
    gameState.blocksRemoved = 0;
    selectedBlock = null;
    document.getElementById('pull-btn').disabled = true;

    // Update block materials based on current friction
    updateBlockMaterials();

    updateStatus('Tower reset! Select a block to continue.');
    updateUI();
}

function newGame() {
    gameState.level = 1;
    gameState.blocksRemoved = 0;
    gameState.stability = 100;
    selectedBlock = null;
    gameState.gameActive = true;
    gameState.crashMode = false;
    currentPlayer = 'human'; // Always start with human
    aiThinking = false;
    document.getElementById('aiThinking').style.display = 'none';

    buildTower();
    document.getElementById('pull-btn').disabled = true;

    const statusMessage = aiEnabled ?
        'New game started! Human vs AI - you go first!' :
        'New game started! Click blocks to select and pull them.';

    updateStatus(statusMessage);
    updateUI();
}

function setJengaVariant(variant) {
    currentVariant = variant;
    const config = JENGA_VARIANTS[variant];

    BLOCKS_PER_LEVEL = config.blocksPerLevel;
    TOWER_LEVELS = config.towerLevels;

    // Update UI
    document.querySelectorAll('.variety-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="setJengaVariant('${variant}')"]`).classList.add('active');

    updateStatus(`Switched to ${config.name} - ${BLOCKS_PER_LEVEL} blocks per level`);

    // Reset game state when switching variants
    gameState.blocksRemoved = 0;
    gameState.level = 1;
    gameState.stability = 100;

    // Rebuild tower with new configuration
    if (gameState.gameActive) {
        buildTower();
        updateUI();
    }
}

function setJengaTheme(theme) {
    console.log('🎨 setJengaTheme called with:', theme);
    console.log('Previous theme:', currentTheme);

    currentTheme = theme;
    const themeConfig = JENGA_THEMES[theme];

    if (!themeConfig) {
        console.error('Invalid theme selected:', theme);
        return;
    }

    console.log('New theme config:', themeConfig);

    // Rebuild tower with new theme
    if (blocks.length > 0) {
        console.log('Rebuilding tower with new theme...');
        buildTower();
        updateBlockMaterials();
    } else {
        console.log('No existing blocks to rebuild');
    }

    updateStatus(`Switched to ${themeConfig.name} theme!`);
}

// AI Functions
function toggleAI() {
    aiEnabled = !aiEnabled;
    const btn = document.getElementById('aiToggle');
    const controls = document.getElementById('aiControls');

    if (aiEnabled) {
        btn.textContent = '🤖 AI Enabled';
        controls.style.display = 'flex';
        currentPlayer = 'human'; // Human goes first
        updateStatus('Human vs AI mode! You go first.');
    } else {
        btn.textContent = '🤖 Play vs AI';
        controls.style.display = 'none';
        currentPlayer = 'human';
        updateStatus('Single player mode.');
    }
}

function setAIPersonality() {
    aiPersonality = document.getElementById('aiPersonality').value;

    // Update status to show current personality
    const personalityNames = {
        'strategic': 'Strategic AI 🤔',
        'conservative': 'Conservative AI 🛡️',
        'aggressive': 'Aggressive AI ⚔️',
        'wicked': 'Wicked AI 😈',
        'naive': 'Naive AI 🤪',
        'random': 'Random AI 🎲'
    };

    if (aiEnabled) {
        updateStatus(`AI personality: ${personalityNames[aiPersonality]}`);
    }
}

function setFriction(value) {
    currentFriction = parseFloat(value);

    // Update physics
    if (world) {
        world.defaultContactMaterial.friction = currentFriction;
    }

    // Update visual appearance of blocks
    updateBlockMaterials();

    // Update display
    updateFrictionDisplay(value);

    updateStatus(`Block friction set to ${getFrictionLabel(value)}`);
}

function updateFrictionDisplay(value) {
    const display = document.getElementById('frictionDisplay');
    if (display) {
        display.textContent = getFrictionLabel(value);
    }
}

function getFrictionLabel(value) {
    const friction = parseFloat(value);
    if (friction < 0.2) return 'Slippery 🧊';
    if (friction < 0.6) return 'Normal 📦';
    if (friction < 1.2) return 'Sticky 🟫';
    if (friction < 1.8) return 'Grippy 🧲';
    return 'Glued 🔒';
}

function updateBlockMaterials() {
    // Update block materials based on friction level and theme
    const isHighFriction = currentFriction >= 1.5; // Glued threshold
    const theme = JENGA_THEMES[currentTheme];

    blocks.forEach((block, index) => {
        let newMaterial;

        if (block === selectedBlock) {
            // Selected blocks always stay gold
            newMaterial = woodMaterialSelected;
        } else if (isHighFriction) {
            // High friction = glued (gold) blocks
            newMaterial = gluedMaterial;
        } else {
            // Use theme-appropriate material
            if (currentTheme === 'random') {
                // For random theme, each block has its own material based on geometry
                const geometryType = block.userData.geometryType || 'box';
                if (geometryType === 'battery') {
                    newMaterial = JENGA_THEMES.battery.material;
                } else {
                    newMaterial = woodMaterial;
                }
            } else {
                newMaterial = theme.material;
            }
        }

        // Update block material
        block.material = newMaterial;

        // Update corresponding wireframe color for selected blocks
        if (blockWireframes[index]) {
            const wireframe = blockWireframes[index];
            if (block === selectedBlock) {
                // Make wireframe more visible for selected blocks
                wireframe.material.color.setHex(0xFFD700); // Gold color
                wireframe.material.opacity = 1.0;
            } else {
                // Normal wireframe appearance
                wireframe.material.color.setHex(0x000000); // Black color
                wireframe.material.opacity = 0.8;
            }
        }
    });
}

function makeAIMove() {
    if (aiThinking || gameState.crashMode) return;

    aiThinking = true;
    document.getElementById('aiThinking').style.display = 'inline';

    // Get all valid moves
    const validMoves = getValidAIMoves();

    if (validMoves.length === 0) {
        updateStatus('🤖 AI has no safe moves! Tower might collapse...');
        aiThinking = false;
        document.getElementById('aiThinking').style.display = 'none';
        return;
    }

    // AI decision making based on personality
    let chosenMove;

    switch (aiPersonality) {
        case 'strategic':
            chosenMove = makeStrategicMove(validMoves);
            break;
        case 'conservative':
            chosenMove = makeConservativeMove(validMoves);
            break;
        case 'aggressive':
            chosenMove = makeAggressiveMove(validMoves);
            break;
        case 'wicked':
            chosenMove = makeWickedMove(validMoves);
            break;
        case 'naive':
            chosenMove = makeNaiveMove(validMoves);
            break;
        case 'random':
            chosenMove = makeRandomMove(validMoves);
            break;
        default:
            chosenMove = makeStrategicMove(validMoves);
    }

    // Execute the move after a personality-based delay
    const personalityDelays = {
        'strategic': 1500,   // Thinks carefully
        'conservative': 1200, // Careful but quicker
        'aggressive': 800,   // Impulsive
        'wicked': 1000,     // Plots mischievously
        'naive': 600,       // Doesn't think much
        'random': 400       // Very quick, random
    };

    setTimeout(() => {
        makeMove(chosenMove.id);
        aiThinking = false;
        document.getElementById('aiThinking').style.display = 'none';

        // Switch back to human
        currentPlayer = 'human';
        updateStatus('Your turn! Click a block to select it.');
    }, personalityDelays[aiPersonality] || 1000);
}

function getValidAIMoves() {
    const validMoves = [];

    blocks.forEach(block => {
        const blockId = block.userData.id;

        // Check if this move is valid according to game rules
        if (isValidJengaMove(blockId)) {
            // Evaluate the risk of this move
            const risk = evaluateMoveRisk(blockId);
            const strategicValue = evaluateStrategicValue(blockId);

            validMoves.push({
                id: blockId,
                risk: risk,
                strategicValue: strategicValue,
                score: strategicValue - risk // Higher is better
            });
        }
    });

    return validMoves.sort((a, b) => b.score - a.score);
}

function evaluateMoveRisk(blockId) {
    // Simplified risk assessment
    // Higher values = more risky

    let risk = 0;

    // Parse block position from ID (format: "block-level-blockInLevel")
    const parts = blockId.split('-');
    const level = parseInt(parts[1]);
    const positionInLevel = parseInt(parts[2]);

    // Higher levels are generally safer (but not always)
    if (level < TOWER_LEVELS * 0.3) {
        risk += 40; // Bottom third is risky
    } else if (level < TOWER_LEVELS * 0.6) {
        risk += 20; // Middle third moderate risk
    } else {
        risk += 5; // Top third generally safer
    }

    // Center positions can be more stable or less depending on orientation
    const centerPosition = Math.floor(BLOCKS_PER_LEVEL / 2);
    if (positionInLevel === centerPosition) {
        risk -= 10; // Center often more stable
    }

    // For perpendicular layers, edge blocks might be more precarious
    const isRotated = level % 2 === 1;
    if (isRotated && (positionInLevel === 0 || positionInLevel === BLOCKS_PER_LEVEL - 1)) {
        risk += 15; // Edge blocks on rotated layers
    }

    return Math.max(0, Math.min(100, risk));
}

function evaluateStrategicValue(blockId) {
    // Strategic value assessment
    // Higher values = more strategically valuable

    let value = 50; // Base value

    // Parse position
    const parts = blockId.split('-');
    const level = parseInt(parts[1]);
    const positionInLevel = parseInt(parts[2]);

    // Higher levels give better future positioning
    value += (level / TOWER_LEVELS) * 30;

    // Center positions often provide better access to future moves
    const centerPosition = Math.floor(BLOCKS_PER_LEVEL / 2);
    if (Math.abs(positionInLevel - centerPosition) <= 1) {
        value += 15;
    }

    // Avoid moves that isolate sections of the tower
    if (wouldIsolateSections(blockId)) {
        value -= 25;
    }

    return Math.max(0, Math.min(100, value));
}

function wouldIsolateSections(blockId) {
    // Simplified check for moves that would isolate tower sections
    // In a full implementation, this would do more complex analysis

    const parts = blockId.split('-');
    const level = parseInt(parts[1]);

    // Removing blocks from very low levels can isolate upper sections
    if (level <= 2 && TOWER_LEVELS > 6) {
        return true;
    }

    return false;
}

function evaluateBestMove(validMoves) {
    // Hard AI: Choose based on risk-value balance
    if (validMoves.length === 0) return null;

    // Weight risk vs strategic value
    const bestMove = validMoves.reduce((best, move) => {
        const riskWeight = 1.5; // Risk is 1.5x more important than strategic value
        const score = move.strategicValue - (move.risk * riskWeight);

        return score > (best.strategicValue - (best.risk * riskWeight)) ? move : best;
    });

    return bestMove;
}

function evaluateExpertMove(validMoves) {
    // Expert AI: Consider future moves and long-term strategy
    if (validMoves.length === 0) return null;

    // Expert AI sometimes takes calculated risks for better positioning
    const expertMoves = validMoves.filter(move =>
        move.risk < 60 && move.strategicValue > 60
    );

    if (expertMoves.length > 0) {
        return expertMoves[Math.floor(Math.random() * expertMoves.length)];
    }

    // Fallback to best move
    return evaluateBestMove(validMoves);
}

// AI Personality Strategies
function makeStrategicMove(validMoves) {
    // Strategic AI: Balanced risk-reward analysis
    return evaluateBestMove(validMoves);
}

function makeConservativeMove(validMoves) {
    // Conservative AI: Always chooses the safest possible move
    if (validMoves.length === 0) return null;

    // Find the move with the lowest risk
    let safestMove = validMoves[0];
    let lowestRisk = safestMove.risk;

    for (const move of validMoves) {
        if (move.risk < lowestRisk) {
            lowestRisk = move.risk;
            safestMove = move;
        }
    }

    return safestMove;
}

function makeAggressiveMove(validMoves) {
    // Aggressive AI: Takes bigger risks for bigger rewards
    if (validMoves.length === 0) return null;

    // Prioritize high strategic value, even with higher risk
    const aggressiveMoves = validMoves.filter(move =>
        move.strategicValue > 60 || (move.strategicValue > 40 && move.risk < 70)
    );

    if (aggressiveMoves.length > 0) {
        return aggressiveMoves[Math.floor(Math.random() * aggressiveMoves.length)];
    }

    // Fallback to highest strategic value
    return validMoves.reduce((best, move) =>
        move.strategicValue > best.strategicValue ? move : best
    );
}

function makeWickedMove(validMoves) {
    // Wicked AI: Intentionally tries to cause maximum instability
    if (validMoves.length === 0) return null;

    // Prioritize moves that create instability
    const wickedMoves = validMoves.filter(move => {
        const parts = move.id.split('-');
        const level = parseInt(parts[1]);
        // Prefers bottom levels (most destructive)
        return level <= Math.max(2, TOWER_LEVELS * 0.3);
    });

    if (wickedMoves.length > 0) {
        // Choose the most destructive move
        return wickedMoves.reduce((mostWicked, move) => {
            const parts = move.id.split('-');
            const level = parseInt(parts[1]);
            const mostWickedLevel = mostWicked.id.split('-')[1];

            return level < mostWickedLevel ? move : mostWicked;
        });
    }

    // Fallback to any risky move
    const riskyMoves = validMoves.filter(move => move.risk > 50);
    if (riskyMoves.length > 0) {
        return riskyMoves[Math.floor(Math.random() * riskyMoves.length)];
    }

    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function makeNaiveMove(validMoves) {
    // Naive AI: Thinks top blocks are safest (opposite of reality)
    if (validMoves.length === 0) return null;

    // Prioritize highest level blocks (naively thinking they're safer)
    const naiveMoves = validMoves.filter(move => {
        const parts = move.id.split('-');
        const level = parseInt(parts[1]);
        return level >= TOWER_LEVELS * 0.7; // Top 30% of tower
    });

    if (naiveMoves.length > 0) {
        return naiveMoves[Math.floor(Math.random() * naiveMoves.length)];
    }

    // Fallback to any move
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function makeRandomMove(validMoves) {
    // Random AI: Completely unpredictable, makes legal moves randomly
    return validMoves[Math.floor(Math.random() * validMoves.length)];
}

function closeCrashOverlay() {
    const overlay = document.getElementById('crash-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        gameState.crashMode = false;
        aiThinking = false;
        const aiIndicator = document.getElementById('aiThinking');
        if (aiIndicator) aiIndicator.style.display = 'none';
        newGame();
    }
}

function startGame() {
    // Instructions modal was removed, so skip hiding it
    const instructionsEl = document.getElementById('instructions');
    if (instructionsEl) {
        instructionsEl.classList.add('hidden');
    }

    // Initialize 3D scene if not already done
    if (typeof scene === 'undefined' || !scene) {
        init3D();
        animate();

        // Build tower after a short delay to ensure 3D scene is ready
        // (newGame() builds the tower - do not build twice)
        setTimeout(() => {
            if (blocks.length === 0) {
                updateBlockMaterials();
                newGame();
                resetCamera(); // Ensure camera is positioned correctly to see the tower
                updateStatus('Click on a block to select it. Selected blocks turn yellow.');
            }
        }, 100);
    } else {
        // Scene already exists, just (re)build the tower via newGame()
        updateBlockMaterials();
        newGame();
        updateStatus('Click on a block to select it. Selected blocks turn yellow.');
    }
}

// Check if a move would create an impossible configuration
// Official Jenga Rules: You can remove blocks from ANY complete level below the top incomplete level
// Blocks can be pulled from the sides or pushed through the center
function isValidJengaMove(blockId) {
    const blockIndex = blocks.findIndex(block => block.userData.id === blockId);
    if (blockIndex === -1) return false;

    // Parse block ID to get level and position
    const parts = blockId.split('-');
    const level = parseInt(parts[1]);
    const positionInLevel = parseInt(parts[2]);

    // Jenga Rule: Find the top incomplete level (the level being built on)
    // You can remove blocks from ANY level BELOW the top incomplete level
    // The top incomplete level is the highest level that doesn't have all its blocks
    
    let topIncompleteLevel = TOWER_LEVELS - 1;
    
    // Check from top to bottom to find the highest incomplete level
    for (let checkLevel = TOWER_LEVELS - 1; checkLevel >= 0; checkLevel--) {
        const blocksInLevel = blocks.filter(block => {
            const blockParts = block.userData.id.split('-');
            return parseInt(blockParts[1]) === checkLevel;
        });
        
        // If this level doesn't have all its blocks, it's incomplete
        if (blocksInLevel.length < BLOCKS_PER_LEVEL) {
            topIncompleteLevel = checkLevel;
            break;
        }
    }
    
    // Official Jenga rule: Can remove from ANY level BELOW the top incomplete level
    // This means you can remove from any complete level, but NOT from the level being built on
    if (level >= topIncompleteLevel) {
        return false; // Can't remove from top incomplete level or above
    }
    
    // All other levels are valid - you can pull from sides or push through center
    return true;
}



// Removed duplicate startGame function

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('=== JENGA PAGE LOADED ===');

        // Update visual indicator
        const jsIndicator = document.getElementById('jsLoaded');
        if (jsIndicator) {
            jsIndicator.textContent = 'JavaScript Loaded ✅';
            jsIndicator.style.background = 'rgba(0,255,0,0.8)';
        }

        console.log('Checking libraries...');

        // Initialize friction display
        try {
            updateFrictionDisplay(currentFriction);
        } catch (error) {
            console.warn('Failed to initialize friction display:', error);
        }

        // Initialize theme selector
        try {
            const themeSelector = document.getElementById('themeSelector');
            if (themeSelector) {
                themeSelector.value = currentTheme;
                console.log('Theme selector initialized to:', currentTheme);
                console.log('Available theme options:', Array.from(themeSelector.options).map(opt => opt.value));
            } else {
                console.error('Theme selector element not found!');
            }
        } catch (error) {
            console.warn('Failed to initialize theme selector:', error);
        }

        // Wait for Three.js global + cannon-es ESM import to be ready
        let libraryCheckAttempts = 0;
        const maxLibraryCheckAttempts = 100; // 10 seconds max

        const checkLibraries = () => {
            try {
                libraryCheckAttempts++;
                console.log(`Library check attempt ${libraryCheckAttempts} - THREE:`, typeof THREE, 'CANNON(es):', typeof CANNON);

                if (typeof THREE === 'undefined') {
                    if (libraryCheckAttempts >= maxLibraryCheckAttempts) {
                        throw new Error('THREE.js library failed to load after 10 seconds');
                    }
                    console.warn('⏳ Waiting for THREE.js...');
                    setTimeout(checkLibraries, 100);
                    return;
                }

                if (typeof CANNON === 'undefined') {
                    if (libraryCheckAttempts >= maxLibraryCheckAttempts) {
                        throw new Error('cannon-es failed to import — check importmap + network');
                    }
                    console.warn('⏳ Waiting for cannon-es...');
                    setTimeout(checkLibraries, 100);
                    return;
                }

                console.log('✅ All libraries loaded successfully!');

                // Start the game automatically after libraries are loaded
                setTimeout(() => {
                    console.log('Starting game automatically...');
                    startGame();
                }, 500);

                // Quick test of Three.js functionality
                try {
                    const testScene = new THREE.Scene();
                    const testGeometry = new THREE.BoxGeometry(1, 1, 1);
                    const testMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const testMesh = new THREE.Mesh(testGeometry, testMaterial);
                    testScene.add(testMesh);
                    console.log('✅ Three.js basic functionality test passed!');
                } catch (error) {
                    console.error('❌ Three.js basic functionality test failed:', error);
                    throw new Error('Three.js basic functionality test failed: ' + error.message);
                }

            } catch (error) {
                console.error('❌ Library loading failed:', error);
                // showError('Library Loading Failed', error.message); // Disabled to prevent stuck modals
                console.warn('Continuing with game startup despite library loading issues...');
            }
        };

        checkLibraries();

    } catch (error) {
        console.error('❌ DOMContentLoaded initialization failed:', error);
        // showError('Page Initialization Failed', error.message); // Disabled to prevent stuck modals
        console.warn('Continuing despite initialization errors...');
    }
});

// ESM: HTML onclick="..." needs globals — re-export module functions to window.
window.pullBlock = pullBlock;
window.resetTower = typeof resetTower !== 'undefined' ? resetTower : undefined;
window.newGame = typeof newGame !== 'undefined' ? newGame : undefined;
window.toggleAI = typeof toggleAI !== 'undefined' ? toggleAI : undefined;
window.setCameraAngle = typeof setCameraAngle !== 'undefined' ? setCameraAngle : undefined;
window.resetCamera = typeof resetCamera !== 'undefined' ? resetCamera : undefined;
window.setJengaVariant = typeof setJengaVariant !== 'undefined' ? setJengaVariant : undefined;
window.setJengaTheme = typeof setJengaTheme !== 'undefined' ? setJengaTheme : undefined;
window.setFriction = typeof setFriction !== 'undefined' ? setFriction : undefined;
window.updateFrictionDisplay = typeof updateFrictionDisplay !== 'undefined' ? updateFrictionDisplay : undefined;
window.setAIPersonality = typeof setAIPersonality !== 'undefined' ? setAIPersonality : undefined;

