<![CDATA[document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const welcomeSection = document.querySelector('.welcome-section');
    const loginSection = document.querySelector('.login-section');
    const privateFilesSection = document.querySelector('.private-files-section');
    const logoutButton = document.getElementById('logoutButton');
    const glCanvas = document.getElementById('glcanvas');

    // --- GLSL Background Animation ---
    const gl = glCanvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported, falling back to 2D canvas or no animation.');
        return;
    }

    // Set canvas size
    glCanvas.width = window.innerWidth;
    glCanvas.height = window.innerHeight;
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);

    window.addEventListener('resize', () => {
        glCanvas.width = window.innerWidth;
        glCanvas.height = window.innerHeight;
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    });

    const vertexShaderSource = `
        attribute vec2 a_position;
        void main() {
            gl_Position = vec4(a_position, 0, 1);
        }
    `;

    // Ein einfacher Fragment-Shader für eine Pastellwelle
    const fragmentShaderSource = `
        precision mediump float;
        uniform float u_time;
        uniform vec2 u_resolution;

        void main() {
            vec2 st = gl_FragCoord.xy / u_resolution.xy;
            st.x *= u_resolution.x / u_resolution.y; // Seitenverhältnis korrigieren

            vec3 color1 = vec3(0.878, 0.980, 0.980); // Pastell Hellblau (e0f7fa)
            vec3 color2 = vec3(0.745, 0.902, 0.890); // Pastell Türkis (b2dfdb)
            vec3 color3 = vec3(0.608, 0.843, 0.831); // Pastell Grün-Blau (9ac5c2)

            float strength = 0.5 + 0.5 * sin(st.x * 10.0 + u_time * 0.5);
            vec3 finalColor = mix(color1, color2, strength);

            float wave = 0.5 + 0.5 * sin(st.y * 15.0 + u_time * 0.8);
            finalColor = mix(finalColor, color3, wave * 0.3); // Leichte Mischung

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation failed:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking failed:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    gl.useProgram(program);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

    const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    let startTime = Date.now();

    function animate() {
        const currentTime = (Date.now() - startTime) * 0.001;
        gl.uniform1f(timeUniformLocation, currentTime);
        gl.uniform2f(resolutionUniformLocation, glCanvas.width, glCanvas.height);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(animate);
    }
    animate();

    // --- Login Functionality ---
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Einfache Frontend-Validierung (für Demonstrationszwecke)
        if (username === 'test' && password === 'test') {
            loginMessage.textContent = 'Anmeldung erfolgreich!';
            loginMessage.className = 'message success';
            welcomeSection.style.display = 'none';
            loginSection.style.display = 'none';
            privateFilesSection.style.display = 'block';
        } else {
            loginMessage.textContent = 'Ungültiger Benutzername oder Passwort.';
            loginMessage.className = 'message error';
        }
    });

    logoutButton.addEventListener('click', () => {
        loginMessage.textContent = '';
        loginMessage.className = 'message';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        welcomeSection.style.display = 'block';
        loginSection.style.display = 'block';
        privateFilesSection.style.display = 'none';
    });
});
]]>
