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

    // Fibonacci-basierter Fragment-Shader mit Pastellfarben
    const fragmentShaderSource = `
        precision highp float;
        uniform float u_time;
        uniform vec2 u_resolution;

        // Fibonacci-Funktion für Farbauswahl
        float fib(float n) {
            float phi = (1.0 + sqrt(5.0)) / 2.0;
            return (pow(phi, n) - pow(1.0 - phi, n)) / sqrt(5.0);
        }

        // Pastellfarben basierend auf Fibonacci-Folge
        vec3 getFibPastel(float index) {
            index = mod(index, 5.0);

            if (index < 1.0) return vec3(1.0, 0.973, 0.882); // Pastellgelb (fff8e1)
            else if (index < 2.0) return vec3(0.910, 0.961, 0.914); // Pastellgrün (e8f5e9)
            else if (index < 3.0) return vec3(0.878, 0.973, 0.980); // Pastellblau (e0f7fa)
            else if (index < 4.0) return vec3(0.953, 0.898, 0.961); // Pastelllila (f3e5f5)
            else return vec3(1.0, 0.953, 0.878); // Pastellorange (fff3e0)
        }

        // Goldener Schnitt Spirale
        vec2 goldenSpiral(vec2 st, float time) {
            vec2 center = vec2(0.5);
            vec2 pos = st - center;

            // Polarkoordinaten
            float r = length(pos);
            float angle = atan(pos.y, pos.x);

            // Fibonacci-Spirale Transformation
            float fibAngle = angle + time * 0.3;
            float fibRadius = r * (1.0 + 0.3 * sin(fibAngle * fib(5.0)));

            // Zurück zu kartesischen Koordinaten
            vec2 fibPos;
            fibPos.x = fibRadius * cos(fibAngle);
            fibPos.y = fibRadius * sin(fibAngle);

            return center + fibPos * 0.8;
        }

        void main() {
            vec2 st = gl_FragCoord.xy / u_resolution.xy;
            st.x *= u_resolution.x / u_resolution.y; // Seitenverhältnis korrigieren

            // Fibonacci-basierte Farbauswahl
            float colorIndex = floor(mod(u_time * 0.2, 5.0));
            vec3 baseColor = getFibPastel(colorIndex);

            // Goldener Schnitt Spirale Effekt
            vec2 spiralSt = goldenSpiral(st, u_time);

            // Sanfte Wellen mit Fibonacci-Frequenzen
            float wave1 = 0.5 + 0.5 * sin(spiralSt.x * fib(3.0) + u_time * 0.5);
            float wave2 = 0.5 + 0.5 * sin(spiralSt.y * fib(5.0) + u_time * 0.3);
            float wave3 = 0.5 + 0.5 * sin(length(spiralSt) * fib(8.0) + u_time * 0.7);

            // Farbmischung mit Fibonacci-Verhältnissen
            vec3 color1 = getFibPastel(colorIndex);
            vec3 color2 = getFibPastel(colorIndex + 1.0);
            vec3 color3 = getFibPastel(colorIndex + 2.0);

            vec3 finalColor = mix(color1, color2, wave1 * 0.618); // Goldener Schnitt
            finalColor = mix(finalColor, color3, wave2 * 0.382); // 1 - Goldener Schnitt
            finalColor = mix(finalColor, vec3(1.0), wave3 * 0.2); // Leichte Aufhellung

            // Fibonacci-Spirale Muster
            float spiralPattern = smoothstep(0.4, 0.41, abs(fract(spiralSt.x * 10.0 + spiralSt.y * 15.0 + u_time * 0.2) - 0.5));
            finalColor = mix(finalColor, vec3(1.0), spiralPattern * 0.3);

            // Sanfte Vignette
            float vignette = 1.0 - smoothstep(0.0, 1.0, length(st - 0.5) * 1.5);
            finalColor = mix(finalColor, finalColor * 0.8, vignette * 0.2);

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
