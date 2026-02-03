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

    // Blog posts will be loaded from shared backend
    let blogPosts = [];
    let currentUser = '';
    let currentToken = '';

    // Auto-detect API URL for zrok compatibility
    // If running on zrok domain (zrok.io) or sohaltweil.de, use relative URLs (same origin)
    // Otherwise, use localhost:3001 for local development
    const isZrokDomain = window.location.hostname.includes('zrok.io') || 
                         window.location.hostname.includes('sohaltweil.de');
    const API_BASE_URL = isZrokDomain 
        ? 'https://finnserver.share.zrok.io/api'
        : 'http://localhost:3001/api';
    
    console.log('API Base URL:', API_BASE_URL);

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
        
        // Reine Neon-Farben ohne Grün-Anteile
        vec3 c1 = vec3(0.0, 0.5, 1.0); // Blau
        vec3 c2 = vec3(1.0, 0.0, 0.5); // Pink
        vec3 c3 = vec3(0.5, 0.0, 1.0); // Violett

        void main() {
            vec2 uv = (gl_FragCoord.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);
            vec2 m = (u_mouse.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);
            
            float t = u_time * 0.4;
            vec3 finalColor = vec3(0.0);
            
            float dist = length(uv - m);
            
            // Chaos-Zittern reduziert und stabilisiert gegen Artefakte
            float chaos = 0.0;
            if(dist < 0.5) {
                float strength = smoothstep(0.5, 0.0, dist);
                // Wir nutzen nur uv.y für das Zittern, um Moiré-Effekte (Punkte) zu vermeiden
                chaos = sin(uv.y * 40.0 + t * 15.0) * strength * 0.15;
            }

            for(float i = 0.0; i < 15.0; i++) {
                float unit = i / 15.0;
                float offset = i * 0.3;
                
                // Basis-Wellenfunktion
                float wave = sin(uv.x * (1.5 + unit) + t + offset);
                wave += cos(uv.y * (1.0 + unit) * 0.5 + t * 0.5);
                
                // Subtiler Ripple ohne mathematische Singularitäten
                // Wir addieren 0.8 zum Nenner, um Division durch 0 (Punkte-Bildung) zu verhindern
                float interaction = 0.3 / (dist + 0.8); 
                wave += sin(interaction * 4.0 - t * 8.0) * interaction * 0.12;
                wave += chaos; 

                // Linien-Berechnung mit "Safe-Zone" gegen Pixel-Fehler
                float line = abs(uv.y - wave * 0.3);
                line = max(line, 0.001); // Verhindert unendlich helle Punkte (Artefakte)
                
                float glow = 0.0015 / line;
                float softGlow = 0.0008 / pow(line, 1.1);
                
                // Farb-Mischung
                vec3 color = mix(c1, c2, sin(t + unit * 6.28) * 0.5 + 0.5);
                color = mix(color, c3, cos(uv.x + t) * 0.5 + 0.5);
                
                // Wir klemmen die Helligkeit, damit keine "Neon-Explosionen" entstehen
                finalColor += clamp(color * (glow + softGlow), 0.0, 1.5);
            }

            // Starke Vignette, um den Fokus auf die Mitte zu legen und Ränder sauber zu halten
            finalColor *= smoothstep(1.5, 0.3, length(uv * 0.7));
            
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
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                loginMessage.textContent = data.error || 'Ungültiger Benutzername oder Passwort.';
                loginMessage.className = 'message error';
                return;
            }

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

    // Admin Panel Functionality
    async function loadPendingUsers() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/pending-users`, {
                headers: { 
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            
            if (response.ok) {
                const pendingUsers = await response.json();
                const pendingContainer = document.getElementById('pending-users-container');
                
                if (pendingUsers.length === 0) {
                    pendingContainer.innerHTML = '<p>Keine ausstehenden Benutzeranfragen.</p>';
                } else {
                    pendingContainer.innerHTML = pendingUsers.map(user => `
                        <div class="pending-user-card">
                            <div class="user-info">
                                <strong>${user.displayName}</strong> (@${user.username})
                                <br><small>Registriert: ${new Date(user.createdAt).toLocaleDateString()}</small>
                            </div>
                            <div class="user-actions">
                                <button onclick="approveUser('${user.id}')" class="approve-btn">Freischalten</button>
                                <button onclick="rejectUser('${user.id}')" class="reject-btn">Ablehnen</button>
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                console.error('Failed to load pending users');
            }
        } catch (error) {
            console.error('Error loading pending users:', error);
        }
    }

    // Make functions global for onclick handlers
    window.approveUser = async function(userId) {
        if (!confirm('Benutzer wirklich freischalten?')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/approve-user/${userId}`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Benutzer erfolgreich freigeschaltet!');
                loadPendingUsers(); // Refresh the list
            } else {
                alert(`Fehler: ${result.error}`);
            }
        } catch (error) {
            console.error('Error approving user:', error);
            alert('Fehler beim Freischalten');
        }
    };

    window.rejectUser = async function(userId) {
        if (!confirm('Benutzeranfrage wirklich ablehnen?')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/reject-user/${userId}`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${currentToken}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                alert('Benutzeranfrage abgelehnt');
                loadPendingUsers(); // Refresh the list
            } else {
                alert(`Fehler: ${result.error}`);
            }
        } catch (error) {
            console.error('Error rejecting user:', error);
            alert('Fehler beim Ablehnen');
        }
    };

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
            const response = await fetch(`${API_BASE_URL}/data/keys`, {
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

            // Load shared blog posts
            await loadSharedBlogPosts();
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Load shared blog posts from backend
    async function loadSharedBlogPosts() {
        try {
            const response = await fetch(`${API_BASE_URL}/blog/posts`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                blogPosts = await response.json();
                renderBlogPosts();
            }
        } catch (error) {
            console.error('Error loading shared blog posts:', error);
        }
    }

    // Save note to backend
    async function saveNoteToBackend(note, index) {
        try {
const response = await fetch(`${API_BASE_URL}/data/save`, {
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

    // Save blog post to shared backend
    async function saveBlogPostToBackend(post) {
        try {
            const response = await fetch(`${API_BASE_URL}/blog/posts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: post.title,
                    content: post.content,
                    tags: post.tags
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save blog post');
            }
        } catch (error) {
            console.error('Error saving blog post:', error);
        }
    }

    // Update blog post on shared backend
    async function updateBlogPostOnBackend(post) {
        try {
            const response = await fetch(`${API_BASE_URL}/blog/posts/${post.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: post.title,
                    content: post.content,
                    tags: post.tags
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update blog post');
            }
        } catch (error) {
            console.error('Error updating blog post:', error);
        }
    }

    // Delete blog post from shared backend
    async function deleteBlogPostOnBackend(postId) {
        try {
            const response = await fetch(`${API_BASE_URL}/blog/posts/${postId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete blog post');
            }
        } catch (error) {
            console.error('Error deleting blog post:', error);
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
            const post = blogPosts.find(p => p.id === editingBlogId);
            if (post) {
                post.title = title;
                post.content = content;
                post.tags = tagsArray;
                post.lastModified = new Date().toLocaleDateString('de-DE');
                await updateBlogPostOnBackend(post);
            }
        } else {
            // Neuer Artikel
            const newPost = {
                id: Date.now().toString(),
                title: title,
                content: content,
                tags: tagsArray,
                author: currentUser,
                date: new Date().toLocaleDateString('de-DE'),
                lastModified: new Date().toLocaleDateString('de-DE')
            };
            blogPosts.unshift(newPost);
            await saveBlogPostToBackend(newPost);
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
        const authorDisplay = post.authorDisplayName || post.author;
        
        postElement.innerHTML = `
            <h3>${post.title}</h3>
            <p>${post.content}</p>
            <div class="blog-meta">
                <div class="blog-tags">${tagsHtml}</div>
                <div>
                    <span class="blog-author">von ${authorDisplay}</span>
                    <span class="blog-date">am ${post.date}</span>
                </div>
            </div>
            <div class="blog-actions">
                <button class="edit-blog-btn" onclick="editBlogPost('${post.id}')">Bearbeiten</button>
                <button class="delete-blog-btn" onclick="deleteBlogPost('${post.id}')">Löschen</button>
            </div>
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
        editingBlogId = postId;
    };
    
    // Blog-Artikel löschen
    window.deleteBlogPost = async function(postId) {
        if (confirm('Blog-Artikel wirklich löschen?')) {
            blogPosts = blogPosts.filter(post => post.id !== postId);
            await deleteBlogPostOnBackend(postId);
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