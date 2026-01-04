document.addEventListener('DOMContentLoaded', () => {
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

    // Fragment-Shader mit dunkleren, ruhigeren Farben
    const fragmentShaderSource = `
        precision highp float;
        uniform float u_time;
        uniform vec2 u_resolution;

        // Dunklere, satte Farben
        vec3 getDarkColor(float index) {
            index = mod(index, 5.0);

            if (index < 1.0) return vec3(0.2, 0.1, 0.4);      // Dunkelblau
            else if (index < 2.0) return vec3(0.3, 0.0, 0.3); // Dunkellila
            else if (index < 3.0) return vec3(0.1, 0.1, 0.5); // Tiefblau
            else if (index < 4.0) return vec3(0.4, 0.0, 0.2); // Dunkelrot
            else return vec3(0.0, 0.2, 0.3);                  // Dunkeltürkis
        }

        // Minimalistische Linien-Muster
        float linePattern(vec2 st, float angle, float spacing, float width) {
            float line = abs(sin(st.x * cos(angle) + st.y * sin(angle) + u_time * 0.05));
            return smoothstep(0.0, width, line) * smoothstep(spacing, spacing - width, line);
        }

        // Sanfte Wellen mit viel langsamerer Animation
        void main() {
            vec2 st = gl_FragCoord.xy / u_resolution.xy;
            st.x *= u_resolution.x / u_resolution.y; // Seitenverhältnis korrigieren

            // Langsame Farbauswahl
            float colorIndex = floor(mod(u_time * 0.05, 5.0)); // 20x langsamer
            vec3 baseColor = getDarkColor(colorIndex);

            // Sehr sanfte Wellen mit reduzierter Frequenz
            float wave1 = 0.5 + 0.5 * sin(st.x * 2.0 + u_time * 0.1); // 10x langsamer
            float wave2 = 0.5 + 0.5 * sin(st.y * 3.0 + u_time * 0.08);
            float wave3 = 0.5 + 0.5 * sin(length(st - 0.5) * 4.0 + u_time * 0.12);

            // Sanfte Farbmischung
            vec3 color1 = getDarkColor(colorIndex);
            vec3 color2 = getDarkColor(colorIndex + 1.0);
            vec3 color3 = getDarkColor(colorIndex + 2.0);

            vec3 finalColor = mix(color1, color2, wave1 * 0.3); // Weniger intensive Mischung
            finalColor = mix(finalColor, color3, wave2 * 0.2);
            finalColor = mix(finalColor, vec3(0.1), wave3 * 0.1); // Leichte Abdunkelung

            // Minimalistische Linien-Muster hinzufügen
            float lines = 0.0;
            
            // Horizontale Linien (sehr subtil)
            lines += linePattern(st, 0.0, 0.15, 0.002) * 0.3;
            
            // Vertikale Linien (sehr subtil)
            lines += linePattern(st, 1.57, 0.15, 0.002) * 0.3;
            
            // Diagonale Linien (sehr subtil)
            lines += linePattern(st, 0.785, 0.2, 0.0015) * 0.2;
            lines += linePattern(st, -0.785, 0.2, 0.0015) * 0.2;
            
            // Linien zu den Farben hinzufügen (leicht aufgehellt)
            vec3 lineColor = finalColor + vec3(0.15);
            finalColor = mix(finalColor, lineColor, lines);

            // Sanfte Vignette
            float vignette = 1.0 - smoothstep(0.0, 1.0, length(st - 0.5) * 1.2);
            finalColor = finalColor * vignette;

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
        if (username === 'Finn' && password === 'test') {
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
