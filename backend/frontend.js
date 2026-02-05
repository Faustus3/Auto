// This is a comprehensive frontend JavaScript file for a personal dashboard
// with authentication, note-taking, and blog functionality

// WebGL Background Animation
function initWebGLAnimation() {
    // Create canvas and context
    const canvas = document.createElement('canvas');
    canvas.id = 'webgl-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    document.body.appendChild(canvas);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Vertex shader source
    const vsSource = `
        attribute vec2 aPosition;
        void main() {
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `;

    // Fragment shader source
    const fsSource = `
        precision mediump float;
        uniform float uTime;
        uniform vec2 uResolution;

        void main() {
            vec2 uv = gl_FragCoord.xy / uResolution.xy;
            uv.x *= uResolution.x / uResolution.y;

            // Slow moving patterns
            float pattern = sin(uv.x * 2.0 + uTime * 0.1) * sin(uv.y * 3.0 + uTime * 0.15);

            // Dark colors (blues, purples, dark teals)
            vec3 color = vec3(0.1, 0.15, 0.3) + pattern * 0.2;

            // Add subtle line patterns
            float lines = sin(uv.x * 20.0 + uTime * 0.05) * 0.5 + 0.5;
            color += lines * 0.1;

            // Vignette effect
            vec2 center = vec2(0.5, 0.5);
            float dist = distance(uv, center);
            float vignette = 1.0 - smoothstep(0.0, 0.8, dist);
            color *= vignette;

            gl_FragColor = vec4(color, 1.0);
        }
    `;

    // Compile shader
    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    // Create shader program
    const vertexShader = compileShader(vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fsSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);

    // Set up vertex data
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1, -1,
         1, -1,
        -1,  1,
         1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const timeUniformLocation = gl.getUniformLocation(program, 'uTime');
    const resolutionUniformLocation = gl.getUniformLocation(program, 'uResolution');

    // Animation loop
    function animate(time) {
        time = time * 0.001; // Convert to seconds

        gl.uniform1f(timeUniformLocation, time);
        gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        requestAnimationFrame(animate);
    }

    animate(0);
}

// Authentication System
class AuthService {
    constructor() {
        this.currentToken = null;
        // ALWAYS use zrok tunnel for backend - hardcoded for reliability
        this.apiBaseUrl = 'https://finnserver.share.zrok.io/api';
    }

    async login(username, password) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();
            this.currentToken = data.token;
            localStorage.setItem('authToken', data.token);
            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    logout() {
        this.currentToken = null;
        localStorage.removeItem('authToken');
        window.location.href = '/login';
    }

    isAuthenticated() {
        return !!this.currentToken;
    }

    async getAuthHeaders() {
        if (!this.currentToken) {
            throw new Error('Not authenticated');
        }

        return {
            'Authorization': `Bearer ${this.currentToken}`,
            'Content-Type': 'application/json'
        };
    }
}

// Note-Taking System
class NoteService {
    constructor() {
        this.notes = JSON.parse(localStorage.getItem('notes') || '[]');
    }

    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    }

    addNote(title, content) {
        const note = {
            id: Date.now().toString(),
            title,
            content,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.notes.push(note);
        this.saveNotes();
        return note;
    }

    updateNote(id, title, content) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.title = title;
            note.content = content;
            note.updatedAt = new Date();
            this.saveNotes();
        }
    }

    deleteNote(id) {
        this.notes = this.notes.filter(note => note.id !== id);
        this.saveNotes();
    }

    getAllNotes() {
        return this.notes;
    }
}

// Blog System
class BlogService {
    constructor() {
        this.posts = JSON.parse(localStorage.getItem('blogPosts') || '[]');
    }

    savePosts() {
        localStorage.setItem('blogPosts', JSON.stringify(this.posts));
    }

    createPost(title, content, tags = []) {
        const post = {
            id: Date.now().toString(),
            title,
            content,
            tags,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.posts.push(post);
        this.savePosts();
        return post;
    }

    updatePost(id, title, content, tags = []) {
        const post = this.posts.find(p => p.id === id);
        if (post) {
            post.title = title;
            post.content = content;
            post.tags = tags;
            post.updatedAt = new Date();
            this.savePosts();
        }
    }

    deletePost(id) {
        this.posts = this.posts.filter(post => post.id !== id);
        this.savePosts();
    }

    searchPosts(query) {
        return this.posts.filter(post =>
            post.title.toLowerCase().includes(query.toLowerCase()) ||
            post.content.toLowerCase().includes(query.toLowerCase()) ||
            post.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
    }

    getAllPosts() {
        return this.posts;
    }

    getRecentPosts(count = 5) {
        return [...this.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, count);
    }
}

// Initialize the application
function initApp() {
    // Initialize WebGL animation
    initWebGLAnimation();

    // Initialize services
    const authService = new AuthService();
    const noteService = new NoteService();
    const blogService = new BlogService();

    // Set up login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                await authService.login(username, password);
                window.location.href = '/dashboard';
            } catch (error) {
                alert('Login failed: ' + error.message);
            }
        });
    }

    // Set up logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            authService.logout();
        });
    }

    // Set up note functionality
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('noteTitle').value;
            const content = document.getElementById('noteContent').value;

            noteService.addNote(title, content);
            alert('Note saved!');
            noteForm.reset();
        });
    }

    // Set up blog functionality
    const blogForm = document.getElementById('blogForm');
    if (blogForm) {
        blogForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('blogTitle').value;
            const content = document.getElementById('blogContent').value;
            const tags = document.getElementById('blogTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);

            blogService.createPost(title, content, tags);
            alert('Blog post created!');
            blogForm.reset();
        });
    }

    // Load existing data
    if (authService.isAuthenticated()) {
        // Load notes and posts
        const notes = noteService.getAllNotes();
        const posts = blogService.getAllPosts();
        console.log('Loaded notes:', notes.length);
        console.log('Loaded posts:', posts.length);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AuthService,
        NoteService,
        BlogService,
        initApp
    };
}