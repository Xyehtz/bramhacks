import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global variables for Three.js
let scene, camera, renderer, model, controls;
let loadingEl = null;
let animationId = null;

// Initialize Three.js scene
window.initThreeJS = function() {
    try {
        const container = document.getElementById("satelliteModel");
        if (!container) {
            console.error('Satellite model container not found');
            return;
        }

    const width = container.clientWidth;
    const height = container.clientHeight;

    console.log('initThreeJS: container size', width, height);

    // Scene setup
    scene = new THREE.Scene();
    // Use a more forgiving frustum and familiar FOV that worked before
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance" 
        });
        
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.setPixelRatio(window.devicePixelRatio);

    container.innerHTML = ''; // Clear container
    container.appendChild(renderer.domElement);

    // Create a loading overlay element (so we don't remove the canvas while loading)
    loadingEl = document.createElement('div');
    loadingEl.className = 'sat-model-loading text-blue-400';
    loadingEl.style.position = 'absolute';
    loadingEl.style.top = '50%';
    loadingEl.style.left = '50%';
    loadingEl.style.transform = 'translate(-50%, -50%)';
    loadingEl.style.pointerEvents = 'none';
    loadingEl.style.zIndex = '10';
    loadingEl.style.textAlign = 'center';
    loadingEl.style.width = '100%';
    loadingEl.style.padding = '0 20px';
    loadingEl.textContent = 'Loading 3D model...';
    // Make sure the container is relatively positioned
    container.style.position = 'relative';
    container.appendChild(loadingEl);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

    // Position camera to view model from front
    camera.position.set(0, 0, 3);
    camera.lookAt(0, 0, 0);

    // Add OrbitControls
    controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // Add smooth damping effect
        controls.dampingFactor = 0.05;
        controls.minDistance = 1.5;
        controls.maxDistance = 10;

        // Load GLB model
        const loader = new GLTFLoader();
        
        // Optional: Add loading manager for better error handling
        const loadingManager = new THREE.LoadingManager();
        loadingManager.onError = function(url) {
            console.error('Error loading', url);
        };
        loader.manager = loadingManager;

        // Optional: Add Draco compression support
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader(dracoLoader);

        console.log('Loading GLB from /models/satellite.glb');
        loader.load('/models/satellite.glb', 
            // Success callback
            (gltf) => {
                model = gltf.scene;
                
                // Center and position the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                
                // Scale the model to fit the view
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 1.5 / maxDim;
                model.scale.multiplyScalar(scale);
                
                // Add model to scene at centered position
                const sizeAfter = box.getSize(new THREE.Vector3()).multiplyScalar(model.scale.x);
                console.log('Model size before adjust:', box.getSize(new THREE.Vector3()), 'scaled approx:', sizeAfter);
                model.position.y = 0; // Keep model centered
                
                scene.add(model);
                
                // Clear loading overlay
                try { if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl); } catch(e){}
                // Auto-fit camera to the loaded model
                try { fitCameraToObject(camera, model, controls, 1.15); } catch (e) { console.warn('fitCameraToObject failed:', e); }

                // Start animation
                animate();
            },
            // Progress callback
            (xhr) => {
                if (xhr.lengthComputable && loadingEl) {
                    const percent = (xhr.loaded / xhr.total) * 100;
                    loadingEl.textContent = `Loading 3D model: ${percent.toFixed(0)}%`;
                }
            },
            // Error callback
            (error) => {
                console.error('Error loading GLB model:', error);
                try { if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl); } catch(e){}
                container.appendChild(Object.assign(document.createElement('div'), { innerHTML: '<p class="text-red-500">Error loading 3D model</p>' }));
            }
        );

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);
        
    } catch (error) {
        console.error('Error initializing Three.js:', error);
    }
}

// Helper: fit camera to an object (frames the object in view)
function fitCameraToObject(camera, object, controls, offset = 1.25) {
    const box = new THREE.Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    if (!sphere || !isFinite(sphere.radius)) return;

    const center = sphere.center.clone();
    const radius = sphere.radius;

    // Compute camera distance based on fov to fit the sphere
    const fov = camera.fov * (Math.PI / 180);
    // distance from center to camera
    let distance = Math.abs(radius / Math.sin(fov / 2));
    distance = distance * offset; // add some padding

    // Place camera along its current direction from the center if possible, otherwise along Z
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    if (camDir.lengthSq() === 0) camDir.set(0, 0, 1);

    const newPos = center.clone().sub(camDir.normalize().multiplyScalar(-distance));

    camera.position.copy(newPos);
    camera.near = Math.max(0.1, distance / 1000);
    camera.far = Math.max(1000, distance * 10);
    camera.updateProjectionMatrix();

    if (controls) {
        controls.target.copy(center);
        controls.maxDistance = distance * 5;
        controls.minDistance = Math.max(0.1, distance * 0.3);
        controls.update();
    } else {
        camera.lookAt(center);
    }
}

// Animation loop
function animate() {
    try {
        animationId = requestAnimationFrame(animate);
        
        if (model) {
            // No need for automatic rotation as we have controls now
        }
        // Update controls if available
        if (controls) controls.update();

        renderer.render(scene, camera);
    } catch (error) {
        console.error('Animation error:', error);
        cancelAnimationFrame(animationId);
    }
}

// Handle window resize
function onWindowResize() {
    try {
        const container = document.getElementById("satelliteModel");
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    } catch (error) {
        console.error('Resize error:', error);
    }
}

// Clean up function
window.cleanupThreeJS = function() {
    try {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        if (model) {
            scene.remove(model);
            model.traverse((node) => {
                if (node.isMesh) {
                    if (node.geometry) node.geometry.dispose();
                    if (node.material) {
                        if (Array.isArray(node.material)) {
                            node.material.forEach(material => material.dispose());
                        } else {
                            node.material.dispose();
                        }
                    }
                }
            });
        }
        
        if (renderer) {
            renderer.dispose();
        }

        if (controls) {
            try { controls.dispose(); } catch (e) { /* ignore */ }
            controls = null;
        }

        // Remove loading overlay if present
        try { if (loadingEl && loadingEl.parentNode) loadingEl.parentNode.removeChild(loadingEl); } catch(e){}
        loadingEl = null;

        // Clear references
        scene = null;
        camera = null;
        renderer = null;
        model = null;
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}
