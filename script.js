document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginMessage = document.getElementById('loginMessage');
    const welcomeSection = document.querySelector('.welcome-section');
    const loginSection = document.querySelector('.login-section');
    const privateFilesSection = document.querySelector('.private-files-section');
    const websiteLinkSection = document.querySelector('.website-link-section');
    const logoutButton = document.getElementById('logoutButton');
    const addNoteBtn = document.querySelector('.add-note-btn');
    const notesContainer = document.querySelector('.notes-container');
    const glCanvas = document.getElementById('glcanvas');

    // Notizen aus localStorage laden
    let notes = JSON.parse(localStorage.getItem('finn-notes')) || [];

    // Blog-Artikel aus localStorage laden
    let blogPosts = JSON.parse(localStorage.getItem('finn-blog-posts')) || [];
    let currentUser = '';
    let currentToken = '';

// --- High-Frequency Neon String Animation (CHAOS EDITION) ---
    const canvas = glCanvas;
    const gl = canvas.getContext('webgl', { antialias: true });

    if (!gl) return;

    const vs = `attribute vec2 p; void main(){gl_Position=vec4(p,0,1);}`;
    
    const fs = `
        precision highp float;
        uniform float u_time;
        uniform vec2 u_res;
        uniform vec2 u_mouse;
        
        // Farben: Electric Blue, Hot Pink, Deep Purple
        vec3 c1 = vec3(0.0, 0.6, 1.0); 
        vec3 c2 = vec3(1.0, 0.0, 0.6); 
        vec3 c3 = vec3(0.6, 0.0, 1.0); 

        void main() {
            // Normalisierte Koordinaten (-1 bis 1)
            vec2 uv = (gl_FragCoord.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);
            vec2 m = (u_mouse.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);
            
            float t = u_time * 0.4;
            vec3 finalColor = vec3(0.0);
            
            // Berechnung des Maus-Einflusses (Das Chaos-Feld)
            float dist = length(uv - m);
            
            // Chaos-Formel: Je näher die Maus, desto stärker bricht die Mathematik
            // Wir nutzen sin() mit hoher Frequenz für ein "elektrisches" Zittern
            float chaos = 0.0;
            if(dist < 0.6) {
                float strength = smoothstep(0.6, 0.0, dist); // 0 bis 1 Stärke
                // Das hier erzeugt das Zittern/Rauschen
                chaos = sin(uv.y * 50.0 + t * 20.0) * strength * 0.5; 
                chaos += sin(uv.x * 50.0 - t * 15.0) * strength * 0.5;
            }

            // Loop für die 15 Fäden
            for(float i = 0.0; i < 15.0; i++) {
                float unit = i / 15.0;
                float offset = i * 0.3;
                
                // Basis-Welle (Die Ordnung)
                float wave = sin(uv.x * (2.0 + unit) + t + offset);
                wave += sin(uv.y * (1.5 + unit) * 0.5 + t * 0.7);
                
                // INJEKTION DES CHAOS:
                // Wir addieren das Chaos direkt auf die Wellen-Position
                // und verzerren die Amplitude massiv, wenn die Maus nah ist.
                float interaction = 0.8 / (dist + 0.1); // Starke Abstoßung
                wave += sin(interaction * 5.0 - t * 10.0) * interaction * 0.5; // Schockwellen
                wave += chaos; // Das elektrische Zittern

                // Linien zeichnen
                float line = abs(uv.y - wave * 0.3);
                
                // Dicke und Glow variieren mit dem Chaos
                float thickness = 0.002 + (chaos * 0.01); 
                float glow = thickness / line;
                float softGlow = (0.001 + chaos * 0.005) / pow(line, 1.2);
                
                // Farb-Logik
                vec3 color = mix(c1, c2, sin(t + unit * 6.28) * 0.5 + 0.5);
                color = mix(color, c3, cos(uv.x + t) * 0.5 + 0.5);
                
                // Wenn Chaos herrscht, werden die Farben heller/weißer (Energie-Überladung)
                color += vec3(chaos * 2.0); 

                finalColor += color * (glow + softGlow);
            }

            finalColor *= 1.0 - length(uv * 0.5); // Vignette
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;

    function createProg(gl, vsS, fsS) {
        const p = gl.createProgram();
        [vsS, fsS].forEach((s, i) => {
            const sh = gl.createShader(i ? gl.FRAGMENT_SHADER : gl.VERTEX_SHADER);
            gl.shaderSource(sh, s);
            gl.compileShader(sh);
            gl.attachShader(p, sh);
        });
        gl.linkProgram(p);
        return p;
    }

    const program = createProg(gl, vs, fs);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'u_time');
    const uRes = gl.getUniformLocation(program, 'u_res');
    const uMouse = gl.getUniformLocation(program, 'u_mouse');

    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = window.innerHeight - e.clientY;
    });

    function render(t) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform1f(uTime, t * 0.001);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform2f(uMouse, mouseX, mouseY);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // --- Login Functionality ---
    // Automatisches Ausfüllen für Debugging (optional, aber hilfreich)
    // document.getElementById('username').value = 'Finn';
    // document.getElementById('password').value = 'test';

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const username = usernameInput ? usernameInput.value : '';
        const password = passwordInput ? passwordInput.value : '';

        try {
            // Send login request to backend
            const response = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                // Try to get error message from response
                let errorData;
                try {
                    errorData = await response.json();
                } catch (jsonError) {
                    // If JSON parsing fails, get text content
                    const text = await response.text();
                    console.error('Error response (text):', text);
                    loginMessage.textContent = 'Fehler bei der Anmeldung. Server meldet: ' + text;
                    loginMessage.className = 'message error';
                    return;
                }
                loginMessage.textContent = errorData.error || 'Ungültiger Benutzername oder Passwort.';
                loginMessage.className = 'message error';
                return;
            }

            const data = await response.json();

            if (response.ok) {
                currentUser = username;
                currentToken = data.token;
                loginMessage.textContent = 'Anmeldung erfolgreich!';
                loginMessage.className = 'message success';
                welcomeSection.style.display = 'none';
                loginSection.style.display = 'none';
                websiteLinkSection.style.display = 'none';
                privateFilesSection.style.display = 'block';

                const utilityTracker = document.getElementById('utility-tracker');
                if (utilityTracker) {
                    utilityTracker.style.display = 'block';
                    if (window.UtilityTracker && typeof window.UtilityTracker.updateTracker === 'function') {
                        window.UtilityTracker.updateTracker();
                    }
                }

                // Load user data from backend
                await loadUserData();

                // Blog-Artikel anzeigen
                renderBlogPosts();
            }
        } catch (error) {
            console.error('Login error:', error);
            loginMessage.textContent = 'Fehler bei der Anmeldung. Bitte versuchen Sie es später erneut.';
            loginMessage.className = 'message error';
        }
    });

    // Notizen-Funktionalität
    function createNoteElement(note, index) {
        const noteElement = document.createElement('div');
        noteElement.className = 'note-item';
        noteElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <h3 contenteditable="true" onblur="updateNoteTitle(${index}, this.textContent)" style="margin: 0; flex: 1;">${note.title}</h3>
                <button onclick="deleteNote(${index})" style="background: #ff4444; color: white; border: none; padding: 0.3rem 0.6rem; border-radius: 0.2rem; font-size: 0.8rem; cursor: pointer; margin-left: 1rem;">Löschen</button>
            </div>
            <p contenteditable="true" onblur="updateNoteContent(${index}, this.textContent)">${note.content}</p>
            <small>Erstellt: ${note.date}</small>
        `;
        return noteElement;
    }
    
    function renderNotes() {
        notesContainer.innerHTML = '';
        notes.forEach((note, index) => {
            const noteElement = createNoteElement(note, index);
            notesContainer.appendChild(noteElement);
        });
    }
    
    function addNote() {
        const title = prompt('Notiz-Titel:');
        if (title) {
            const content = prompt('Notiz-Inhalt:');
            const newNote = {
                title: title,
                content: content || '',
                date: new Date().toLocaleDateString('de-DE')
            };
            notes.push(newNote);
            localStorage.setItem('finn-notes', JSON.stringify(notes));
            renderNotes();
        }
    }
    
    async function updateNoteTitle(index, newTitle) {
        notes[index].title = newTitle;
        localStorage.setItem('finn-notes', JSON.stringify(notes));
        await saveNoteToBackend(notes[index], index);
    }

    async function updateNoteContent(index, newContent) {
        notes[index].content = newContent;
        localStorage.setItem('finn-notes', JSON.stringify(notes));
        await saveNoteToBackend(notes[index], index);
    }

    async function deleteNote(index) {
        if (confirm('Notiz wirklich löschen?')) {
            notes.splice(index, 1);
            localStorage.setItem('finn-notes', JSON.stringify(notes));
            // In a real app, you would also delete from backend
            renderNotes();
        }
    }
    
    // Event Listener für Notiz-Button
    addNoteBtn.addEventListener('click', addNote);
    
    // Notizen beim Laden anzeigen
    renderNotes();

    logoutButton.addEventListener('click', async () => {
        try {
            // Send logout request to backend (if needed)
            // For JWT tokens, we just clear the local token
            currentToken = '';
            currentUser = '';

            loginMessage.textContent = '';
            loginMessage.className = 'message';
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            welcomeSection.style.display = 'block';
            loginSection.style.display = 'block';
            websiteLinkSection.style.display = 'block';
            privateFilesSection.style.display = 'none';

            const utilityTracker = document.getElementById('utility-tracker');
            if (utilityTracker) {
                utilityTracker.style.display = 'none';
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
    
    // --- Blog Functionality ---
    const addBlogBtn = document.querySelector('.add-blog-btn');
    const toggleBlogViewBtn = document.querySelector('.toggle-blog-view');
    const blogEditor = document.querySelector('.blog-editor');
    const blogPostsContainer = document.querySelector('.blog-posts-container');
    const saveBlogBtn = document.getElementById('saveBlogBtn');
    const cancelBlogBtn = document.getElementById('cancelBlogBtn');
    const blogTitleInput = document.getElementById('blogTitle');
    const blogContentInput = document.getElementById('blogContent');
    const blogTagsInput = document.getElementById('blogTags');
    const blogSearchInput = document.getElementById('blogSearch');

    let isEditingBlog = false;
    let editingBlogId = null;
    let showAllPosts = false;
    let searchQuery = '';

    // Load user data from backend
    async function loadUserData() {
        try {
            const response = await fetch('http://localhost:3001/api/data/keys', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Load notes and blog posts from backend if they exist
                // This would be implemented based on your data structure
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Save note to backend
    async function saveNoteToBackend(note, index) {
        try {
            const response = await fetch('http://localhost:3001/api/data/save', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: `note_${index}`,
                    data: note
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save note');
            }
        } catch (error) {
            console.error('Error saving note:', error);
        }
    }

    // Save blog post to backend
    async function saveBlogPostToBackend(post) {
        try {
            const response = await fetch('http://localhost:3001/api/data/save', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: `blog_${post.id}`,
                    data: post
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save blog post');
            }
        } catch (error) {
            console.error('Error saving blog post:', error);
        }
    }

    // Blog-Editor anzeigen
    addBlogBtn.addEventListener('click', () => {
        blogEditor.style.display = 'block';
        addBlogBtn.style.display = 'none';
        blogTitleInput.value = '';
        blogContentInput.value = '';
        blogTagsInput.value = '';
        isEditingBlog = false;
        editingBlogId = null;
    });
    
    // Blog-Editor ausblenden
    cancelBlogBtn.addEventListener('click', () => {
        blogEditor.style.display = 'none';
        addBlogBtn.style.display = 'inline-block';
        blogTitleInput.value = '';
        blogContentInput.value = '';
        blogTagsInput.value = '';
        isEditingBlog = false;
        editingBlogId = null;
    });
    
    // Blog-Artikel speichern
    saveBlogBtn.addEventListener('click', async () => {
        const title = blogTitleInput.value.trim();
        const content = blogContentInput.value.trim();
        const tags = blogTagsInput.value.trim();

        if (!title || !content) {
            alert('Titel und Inhalt sind erforderlich!');
            return;
        }

        const tagsArray = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

        if (isEditingBlog && editingBlogId !== null) {
            // Artikel bearbeiten
            blogPosts[editingBlogId] = {
                ...blogPosts[editingBlogId],
                title: title,
                content: content,
                tags: tagsArray,
                lastModified: new Date().toLocaleDateString('de-DE')
            };
        } else {
            // Neuer Artikel
            const newPost = {
                id: Date.now(),
                title: title,
                content: content,
                tags: tagsArray,
                author: currentUser,
                date: new Date().toLocaleDateString('de-DE'),
                lastModified: new Date().toLocaleDateString('de-DE')
            };
            blogPosts.unshift(newPost);
        }

        // Save to localStorage (for demo purposes)
        localStorage.setItem('finn-blog-posts', JSON.stringify(blogPosts));

        // Save to backend
        if (isEditingBlog && editingBlogId !== null) {
            await saveBlogPostToBackend(blogPosts[editingBlogId]);
        } else {
            await saveBlogPostToBackend(blogPosts[0]);
        }

        renderBlogPosts();

        blogEditor.style.display = 'none';
        addBlogBtn.style.display = 'inline-block';
        blogTitleInput.value = '';
        blogContentInput.value = '';
        blogTagsInput.value = '';
        isEditingBlog = false;
        editingBlogId = null;
    });
    
    // Blog-Artikel rendern
    function renderBlogPosts() {
        blogPostsContainer.innerHTML = '';
        
        let postsToShow = blogPosts;
        
        // Suche anwenden
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            postsToShow = postsToShow.filter(post => 
                post.title.toLowerCase().includes(query) ||
                post.content.toLowerCase().includes(query) ||
                post.tags.some(tag => tag.toLowerCase().includes(query)) ||
                post.author.toLowerCase().includes(query)
            );
        }
        
        // Begrenzung anwenden
        if (!showAllPosts) {
            postsToShow = postsToShow.slice(0, 3);
        }
        
        if (postsToShow.length === 0) {
            const message = searchQuery ? 
                'Keine Artikel gefunden, die Ihrer Suche entsprechen.' : 
                'Noch keine Blog-Artikel vorhanden.';
            blogPostsContainer.innerHTML = `<p style="text-align: center; color: #777; font-style: italic;">${message}</p>`;
            return;
        }
        
        postsToShow.forEach((post, index) => {
            const postElement = createBlogPostElement(post, index);
            blogPostsContainer.appendChild(postElement);
        });
    }
    
    // Blog-Artikel-Element erstellen
    function createBlogPostElement(post, index) {
        const postElement = document.createElement('div');
        postElement.className = 'blog-post';
        
        const tagsHtml = post.tags.map(tag => `<span class="blog-tag">${tag}</span>`).join('');
        
        postElement.innerHTML = `
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            <div class="blog-meta">
                <div class="blog-tags">${tagsHtml}</div>
                <div>
                    <span class="blog-author">von ${post.author}</span>
                    <span class="blog-date">am ${post.date}</span>
                </div>
            </div>
            ${post.author === currentUser ? `
                <div class="blog-actions">
                    <button class="edit-blog-btn" onclick="editBlogPost(${post.id})">Bearbeiten</button>
                    <button class="delete-blog-btn" onclick="deleteBlogPost(${post.id})">Löschen</button>
                </div>
            ` : ''}
        `;
        
        return postElement;
    }
    
    // Blog-Artikel bearbeiten
    window.editBlogPost = function(postId) {
        const postIndex = blogPosts.findIndex(post => post.id === postId);
        if (postIndex === -1) return;
        
        const post = blogPosts[postIndex];
        blogTitleInput.value = post.title;
        blogContentInput.value = post.content;
        blogTagsInput.value = post.tags.join(', ');
        
        blogEditor.style.display = 'block';
        addBlogBtn.style.display = 'none';
        isEditingBlog = true;
        editingBlogId = postIndex;
    };
    
    // Blog-Artikel löschen
    window.deleteBlogPost = function(postId) {
        if (confirm('Blog-Artikel wirklich löschen?')) {
            blogPosts = blogPosts.filter(post => post.id !== postId);
            localStorage.setItem('finn-blog-posts', JSON.stringify(blogPosts));
            renderBlogPosts();
        }
    };
    
    // Blog-Suche
    blogSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderBlogPosts();
    });
    
    // Blog-Ansicht umschalten
    toggleBlogViewBtn.addEventListener('click', () => {
        showAllPosts = !showAllPosts;
        toggleBlogViewBtn.textContent = showAllPosts ? 'Neueste Artikel anzeigen' : 'Alle Artikel anzeigen';
        renderBlogPosts();
    });
    
    // Globale Funktionen für contenteditable
    window.updateNoteTitle = updateNoteTitle;
    window.updateNoteContent = updateNoteContent;
    window.deleteNote = deleteNote;

});
