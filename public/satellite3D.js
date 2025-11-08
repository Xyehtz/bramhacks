import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global variables for Three.js
let scene, camera, renderer, model, controls;
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

        // Scene setup
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, width / height, 0.5, 800);
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

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        // Position camera
        camera.position.set(0, 0.1, 2);// <--- CHANGED: Set a Z distance of 3 and lowered Y to 0.5
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

        // Show loading text
        container.innerHTML = '<p class="text-blue-400">Loading 3D model...</p>';

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
                
                // Adjust model position
                model.position.y = 0.001; // Raise the model up
                
                scene.add(model);
                
                // Clear loading text
                container.innerHTML = '';
                container.appendChild(renderer.domElement);
                
                // Start animation
                animate();
            },
            // Progress callback
            (xhr) => {
                if (xhr.lengthComputable) {
                    const percent = (xhr.loaded / xhr.total) * 100;
                    container.innerHTML = `<p class="text-blue-400">Loading 3D model: ${percent.toFixed(0)}%</p>`;
                }
            },
            // Error callback
            (error) => {
                console.error('Error loading GLB model:', error);
                container.innerHTML = '<p class="text-red-500">Error loading 3D model</p>';
            }
        );

        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);
        
    } catch (error) {
        console.error('Error initializing Three.js:', error);
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

        // Clear references
        scene = null;
        camera = null;
        renderer = null;
        model = null;
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}
