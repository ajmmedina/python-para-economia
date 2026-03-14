/* ============================
   Python para Economistas
   Main Application Logic
   ============================ */

(function () {
    'use strict';

    // ---------- Config ----------
    const CATALOG_PATH = 'assets/data/catalog.json';

    // ⚠️ REEMPLAZA esta URL con la de tu Google Apps Script desplegado como Web App
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeUr_fb9AVWyO7bR3M0DbDEUE7V9WAS6yx6qVFP4C_CKcfmnciE4IXyQuCBYz9SilD/exec';

    // Max file size in bytes (25 MB)
    const MAX_FILE_SIZE = 25 * 1024 * 1024;

    // Store current unit data for the upload form
    let currentUnit = null;
    let submissionCounts = {};

    // ---------- Helpers ----------
    function difficultyStars(level) {
        const map = { 'básico': 1, 'intermedio': 2, 'avanzado': 3 };
        const filled = map[level] || 1;
        let html = '';
        for (let i = 1; i <= 3; i++) {
            html += `<span class="star ${i <= filled ? 'filled' : ''}">★</span>`;
        }
        return html;
    }

    function difficultyLabel(level) {
        const map = { 'básico': 'Básico', 'intermedio': 'Intermedio', 'avanzado': 'Avanzado' };
        return map[level] || level;
    }

    function librariesHTML(libs) {
        if (!libs || libs.length === 0) return '';
        const pills = libs.map(l => `<span class="lib-pill">${l}</span>`).join('');
        return `<div class="item-libraries">
                    <span class="lib-label">Se necesita:</span>
                    ${pills}
                </div>`;
    }

    function getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    // Sanitize text for safe folder names
    function sanitize(text) {
        return text.replace(/[<>:"/\\|?*]/g, '_').trim();
    }

    // ---------- File Downloads ----------
    window.downloadFile = async function (url, filename) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error en descarga');
            const blob = await response.blob();
            const urlObj = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = urlObj;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(urlObj);
            document.body.removeChild(a);
        } catch (e) {
            console.error('Error al descargar:', e);
            window.open(url, '_blank');
        }
    };

    // ---------- Card Renderers ----------
    function renderUnitCard(unit) {
        const sesCount = unit.sesiones ? unit.sesiones.length : 0;
        const proCount = unit.proyectos ? unit.proyectos.length : 0;

        return `
        <article class="unit-card" data-animate>
            <div class="unit-card-body">
                <span class="unit-number">Unidad ${unit.unidad}</span>
                <h3>${unit.titulo}</h3>
                <p>${unit.descripcion}</p>
                <div class="unit-meta">
                    <span class="unit-meta-item">🎓 ${sesCount} sesione${sesCount !== 1 ? 's' : ''}</span>
                    <span class="unit-meta-item">🛠️ ${proCount} proyecto${proCount !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="unit-card-footer">
                <a href="unidad.html?u=${unit.unidad}" class="btn btn-primary">
                    Ver Unidad →
                </a>
            </div>
        </article>`;
    }

    function renderItemCard(item, type, index) {
        const typeLabel = type === 'session' ? 'Sesión' : 'Proyecto';
        const badgeClass = type === 'session' ? 'badge-session' : 'badge-project';
        const number = index + 1;
        // Build a value for the topic select: "Sesion_01_titulo" o "Proyecto_01_titulo" (sin prefijo de unidad para fácil matcheo en doGet, wait, doPost manda Unidad_X_Tema...)
        // En doPost mandamos Unidad_X_Tema_YY. Busquemos si submissionCounts tiene esa llave.
        const topicValue = `${type === 'session' ? 'Sesion' : 'Proyecto'}_${String(number).padStart(2, '0')}_${sanitize(item.titulo).substring(0, 40)}`;
        const fullTopicName = `Unidad_${currentUnit ? currentUnit.unidad : 'X'}_${topicValue}`;

        let count = 0;
        let isFetching = false;
        if (submissionCounts && submissionCounts[fullTopicName] !== undefined) {
            count = submissionCounts[fullTopicName];
        } else if (!window.countsLoaded && window.currentUser) {
            isFetching = true;
        }

        let deliveryBadgeHtml = '';
        if (isFetching) {
            // Loader
            deliveryBadgeHtml = `<div class="delivery-badge pending" title="Cargando estado..."><span class="loader-spinner" style="display:inline-block;width:10px;height:10px;border:2px solid;border-radius:50%;border-top-color:transparent;animation:spin 1s linear infinite;margin-right:4px;"></span> Cargando...</div>`;
        } else if (count > 0) {
            deliveryBadgeHtml = `<div class="delivery-badge success" title="Has entregado este archivo ${count} vez/veces">✔️ Entregado: ${count}</div>`;
        } else {
            deliveryBadgeHtml = `<div class="delivery-badge pending" title="Aún no has entregado este archivo">⚪ Pendiente</div>`;
        }

        return `
        <article class="item-card" data-animate>
            ${deliveryBadgeHtml}
            <div class="item-actions-side">
                <button class="action-icon-btn info-btn" title="Propósito" onclick="toggleInfo(this)" aria-label="Ver propósito">
                    💡
                    <div class="info-tooltip">
                        <div class="info-tooltip-title">Propósito</div>
                        ${item.proposito}
                    </div>
                </button>
                <button class="action-icon-btn upload-btn" title="Subir resuelto" onclick="openModal('${topicValue}')" aria-label="Subir cuaderno resuelto">
                    📤
                </button>
            </div>
            <div class="item-card-body">
                <span class="item-type-badge ${badgeClass}">${typeLabel} ${number}</span>
                <h3>${item.titulo}</h3>
                <p class="item-desc">${item.descripcion}</p>
                ${librariesHTML(item.librerias)}
                <div class="item-difficulty">
                    <span class="difficulty-label">${difficultyLabel(item.dificultad)}</span>
                    <div class="stars">${difficultyStars(item.dificultad)}</div>
                </div>
            </div>
                <a href="${item.colab_url}" class="btn btn-colab btn-sm" target="_blank" rel="noopener">
                    ▶ Abrir en Colab
                </a>
                <button onclick="downloadFile('${item.raw_url}', '${item.titulo}.ipynb')" class="btn btn-download btn-sm">
                    ⬇ Descargar
                </button>
            </div>
        </article>`;
    }

    // ---------- Intersection Observer for Animations ----------
    function observeCards() {
        const cards = document.querySelectorAll('[data-animate]');
        if (!cards.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, i) => {
                if (entry.isIntersecting) {
                    const delay = Array.from(cards).indexOf(entry.target) * 80;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, delay);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });

        cards.forEach(card => observer.observe(card));
    }

    // ---------- Upload Form Topic Options ----------
    function populateTopicSelect(unit) {
        const select = document.getElementById('upload-tema');
        if (!select) return;

        // Clear old options except the placeholder
        select.innerHTML = '<option value="" disabled selected>Selecciona el tema…</option>';

        // Sessions
        if (unit.sesiones && unit.sesiones.length > 0) {
            const sessGroup = document.createElement('optgroup');
            sessGroup.label = '🎓 Sesiones';
            unit.sesiones.forEach((s, i) => {
                const num = String(i + 1).padStart(2, '0');
                const val = `Sesion_${num}_${sanitize(s.titulo).substring(0, 40)}`;
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = `Sesión ${i + 1}: ${s.titulo}`;
                sessGroup.appendChild(opt);
            });
            select.appendChild(sessGroup);
        }

        // Projects
        if (unit.proyectos && unit.proyectos.length > 0) {
            const projGroup = document.createElement('optgroup');
            projGroup.label = '🛠️ Proyectos';
            unit.proyectos.forEach((p, i) => {
                const num = String(i + 1).padStart(2, '0');
                const val = `Proyecto_${num}_${sanitize(p.titulo).substring(0, 40)}`;
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = `Proyecto ${i + 1}: ${p.titulo}`;
                projGroup.appendChild(opt);
            });
            select.appendChild(projGroup);
        }
    }

    // ---------- Modal ----------
    window.openModal = function (topicValue) {
        const modal = document.getElementById('upload-modal');
        if (!modal) return;

        // Reset form state
        const form = document.getElementById('uploadForm');
        const msg = document.getElementById('upload-msg');
        if (form) form.reset();
        if (msg) { msg.style.display = 'none'; msg.className = 'upload-msg'; }
        clearFilePreview();

        // Pre-select the topic if provided
        if (topicValue) {
            const select = document.getElementById('upload-tema');
            if (select) {
                const option = select.querySelector(`option[value="${topicValue}"]`);
                if (option) option.selected = true;
            }
        }

        // Pre-fill user email
        const inputNombre = document.getElementById('upload-nombre');
        if (inputNombre && window.currentUser) {
            inputNombre.value = window.currentUser.email;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    window.closeModal = function () {
        const modal = document.getElementById('upload-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    // Coffee Modal
    window.openCoffeeModal = function () {
        const modal = document.getElementById('coffee-modal');
        if (modal) {
            modal.style.display = 'flex';
            requestAnimationFrame(() => modal.classList.add('active'));
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeCoffeeModal = function () {
        const modal = document.getElementById('coffee-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => modal.style.display = 'none', 300);
        }
    };

    // ---------- File handling ----------
    let selectedFile = null;

    function setFilePreview(file) {
        selectedFile = file;
        const dropZone = document.getElementById('drop-zone');
        const preview = document.getElementById('file-preview');
        const previewName = document.getElementById('file-preview-name');
        const submitBtn = document.getElementById('upload-submit');

        if (dropZone) dropZone.style.display = 'none';
        if (preview) {
            preview.style.display = 'flex';
            previewName.textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
        }
        if (submitBtn) submitBtn.disabled = false;
    }

    function clearFilePreview() {
        selectedFile = null;
        const dropZone = document.getElementById('drop-zone');
        const preview = document.getElementById('file-preview');
        const fileInput = document.getElementById('upload-file');
        const submitBtn = document.getElementById('upload-submit');

        if (dropZone) dropZone.style.display = '';
        if (preview) preview.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (submitBtn) submitBtn.disabled = true;
    }

    function validateFile(file) {
        if (!file) return 'Selecciona un archivo.';
        if (!file.name.toLowerCase().endsWith('.ipynb')) return 'Solo se permiten archivos .ipynb';
        if (file.size > MAX_FILE_SIZE) return 'El archivo excede el tamaño máximo de 25 MB.';
        return null;
    }

    function initDropZone() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('upload-file');
        const removeBtn = document.getElementById('file-remove');

        if (!dropZone || !fileInput) return;

        // Click to browse
        dropZone.addEventListener('click', () => fileInput.click());

        // File selected via input
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                const err = validateFile(fileInput.files[0]);
                if (err) {
                    showMsg(err, 'error');
                    fileInput.value = '';
                    return;
                }
                setFilePreview(fileInput.files[0]);
            }
        });

        // Drag & drop
        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (!file) return;
            const err = validateFile(file);
            if (err) {
                showMsg(err, 'error');
                return;
            }
            setFilePreview(file);
        });

        // Remove button
        if (removeBtn) {
            removeBtn.addEventListener('click', clearFilePreview);
        }
    }

    // ---------- Upload ----------
    function showMsg(text, type) {
        const msg = document.getElementById('upload-msg');
        if (!msg) return;
        msg.textContent = text;
        msg.className = 'upload-msg ' + type;
        msg.style.display = 'block';
    }

    function setLoading(loading) {
        const btn = document.getElementById('upload-submit');
        const labelEl = btn ? btn.querySelector('.btn-upload-label') : null;
        const spinnerEl = btn ? btn.querySelector('.btn-upload-spinner') : null;

        if (btn) btn.disabled = loading;
        if (labelEl) labelEl.style.display = loading ? 'none' : '';
        if (spinnerEl) spinnerEl.style.display = loading ? 'inline' : 'none';
    }

    function initUploadForm() {
        const form = document.getElementById('uploadForm');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const nombre = document.getElementById('upload-nombre').value.trim();
            const tema = document.getElementById('upload-tema').value;
            const file = selectedFile;

            // Validations
            if (!nombre) { showMsg('Ingresa tu nombre.', 'error'); return; }
            if (!tema) { showMsg('Selecciona una sesión o proyecto.', 'error'); return; }

            const fileErr = validateFile(file);
            if (fileErr) { showMsg(fileErr, 'error'); return; }

            if (APPS_SCRIPT_URL === 'URL_DE_GOOGLE_APPS_SCRIPT') {
                showMsg('⚠️ La URL de Google Apps Script no ha sido configurada. Contacta al instructor.', 'error');
                return;
            }

            // Read file as Base64 and send
            setLoading(true);
            showMsg('', 'success'); // clear
            document.getElementById('upload-msg').style.display = 'none';

            const reader = new FileReader();
            reader.onload = function (evt) {
                const fileContent = evt.target.result; // data:... base64

                // Build URL-encoded body for no-cors POST
                const params = new URLSearchParams({
                    filename: file.name,
                    fileContent: fileContent,
                    tema: `Unidad_${currentUnit ? currentUnit.unidad : 'X'}_${tema}`,
                    email: window.currentUser.email
                });

                fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params
                })
                    .then(() => {
                        setLoading(false);
                        showMsg('✅ ¡Archivo enviado con éxito! Tu evidencia ha sido recibida.', 'success');

                        // Keep the readonly email value after reset
                        const inputEmail = document.getElementById('upload-nombre');
                        const emailVal = inputEmail ? inputEmail.value : '';
                        form.reset();
                        if (inputEmail) inputEmail.value = emailVal;

                        clearFilePreview();

                        // Update UI Badge Dynamically
                        const fullTopicName = `Unidad_${currentUnit ? currentUnit.unidad : 'X'}_${tema}`;
                        submissionCounts[fullTopicName] = (submissionCounts[fullTopicName] || 0) + 1;

                        // Refresh cards to show new badge
                        const sessionsGrid = document.getElementById('sessions-grid');
                        const projectsGrid = document.getElementById('projects-grid');
                        if (sessionsGrid && currentUnit && currentUnit.sesiones) {
                            sessionsGrid.innerHTML = currentUnit.sesiones.map((s, i) => renderItemCard(s, 'session', i)).join('');
                        }
                        if (projectsGrid && currentUnit && currentUnit.proyectos) {
                            projectsGrid.innerHTML = currentUnit.proyectos.map((p, i) => renderItemCard(p, 'project', i)).join('');
                        }
                        if (typeof observeCards === 'function') observeCards();

                        // Auto-close modal
                        setTimeout(() => {
                            if (typeof window.closeModal === 'function') window.closeModal();
                        }, 2000);
                    })
                    .catch(err => {
                        setLoading(false);
                        showMsg('❌ Error al subir el archivo. Verifica tu conexión e intenta de nuevo.', 'error');
                        console.error('Upload error:', err);
                    });
            };

            reader.onerror = function () {
                setLoading(false);
                showMsg('❌ Error al leer el archivo.', 'error');
            };

            reader.readAsDataURL(file);
        });
    }

    // ---------- Info Tooltip ----------
    window.toggleInfo = function (btn) {
        const tooltip = btn.querySelector('.info-tooltip');
        if (!tooltip) return;

        document.querySelectorAll('.info-tooltip.show').forEach(t => {
            if (t !== tooltip) t.classList.remove('show');
        });

        tooltip.classList.toggle('show');
    };

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.info-btn')) {
            document.querySelectorAll('.info-tooltip.show').forEach(t => {
                t.classList.remove('show');
            });
        }
    });

    // ---------- Page Init ----------
    async function fetchCatalog() {
        try {
            const response = await fetch(CATALOG_PATH);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data;
        } catch (err) {
            console.error('Error cargando catálogo:', err);
            return null;
        }
    }

    async function initIndexPage() {
        const grid = document.getElementById('units-grid');
        if (!grid) return;

        const data = await fetchCatalog();
        if (!data || !data.unidades) {
            grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No se pudieron cargar las unidades.</p>';
            return;
        }

        grid.innerHTML = data.unidades.map(u => renderUnitCard(u)).join('');
        observeCards();
    }

    async function initUnitPage() {
        const heroSection = document.getElementById('unit-hero');
        if (!heroSection) return;

        const unitNum = parseInt(getQueryParam('u'), 10);
        if (!unitNum) {
            window.location.href = 'index.html';
            return;
        }

        const data = await fetchCatalog();
        if (!data || !data.unidades) return;

        const unit = data.unidades.find(u => u.unidad === unitNum);
        if (!unit) {
            window.location.href = 'index.html';
            return;
        }

        currentUnit = unit;

        // Render first synchronously with cache or empty counts
        window.countsLoaded = false;
        if (window.currentUser && window.currentUser.email) {
            const cacheKey = `submissionCounts_${window.currentUser.email}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                try {
                    submissionCounts = JSON.parse(cached);
                    window.countsLoaded = true;
                } catch (e) { }
            }
        }

        const renderPageContent = () => {
            // Populate hero
            document.title = `Unidad ${unit.unidad} — ${unit.titulo} | Python para Economistas`;
            document.getElementById('hero-unit-number').textContent = `Unidad ${unit.unidad}`;
            document.getElementById('hero-title').textContent = unit.titulo;
            document.getElementById('hero-desc').textContent = unit.descripcion;
            document.getElementById('hero-obj').textContent = `🎯 Objetivo: ${unit.objetivo}`;

            // Render sessions
            const sessionsGrid = document.getElementById('sessions-grid');
            if (sessionsGrid && unit.sesiones && unit.sesiones.length > 0) {
                sessionsGrid.innerHTML = unit.sesiones.map((s, i) => renderItemCard(s, 'session', i)).join('');
            } else if (sessionsGrid) {
                sessionsGrid.innerHTML = '<p style="color:var(--text-muted);">No hay sesiones para esta unidad.</p>';
            }

            // Render projects
            const projectsGrid = document.getElementById('projects-grid');
            if (projectsGrid && unit.proyectos && unit.proyectos.length > 0) {
                projectsGrid.innerHTML = unit.proyectos.map((p, i) => renderItemCard(p, 'project', i)).join('');
            } else if (projectsGrid) {
                projectsGrid.innerHTML = '<p style="color:var(--text-muted);">No hay proyectos para esta unidad.</p>';
            }

            observeCards();
        };

        // Render immediately
        renderPageContent();

        // Fetch submission counts asynchronously
        if (window.currentUser && window.currentUser.email) {
            try {
                const url = `${APPS_SCRIPT_URL}?email=${encodeURIComponent(window.currentUser.email)}`;
                fetch(url).then(res => res.json()).then(data => {
                    submissionCounts = data;
                    window.countsLoaded = true;
                    // Cache the results
                    sessionStorage.setItem(`submissionCounts_${window.currentUser.email}`, JSON.stringify(data));
                    // Re-render
                    renderPageContent();
                }).catch(err => {
                    console.error('Error al obtener contadores de entrega:', err);
                    window.countsLoaded = true;
                    renderPageContent(); // Re-render to clear loaders
                });
            } catch (err) {
                console.error('Error general al obtener contadores:', err);
                window.countsLoaded = true;
                renderPageContent();
            }
        } else {
            window.countsLoaded = true;
            renderPageContent();
        }

        // Populate topic select for upload form
        populateTopicSelect(unit);

        // Init upload form interactions
        initDropZone();
        initUploadForm();

        // Modal events
        const modalOverlay = document.getElementById('upload-modal');
        const modalClose = document.getElementById('modal-close');

        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        if (modalOverlay) {
            modalOverlay.addEventListener('click', function (e) {
                if (e.target === modalOverlay) closeModal();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });

        // Add spinner animation style if not defined
        if (!document.getElementById('spin-style')) {
            const style = document.createElement('style');
            style.id = 'spin-style';
            style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    }

    // ---------- Bootstrap ----------
    document.addEventListener('DOMContentLoaded', function () {
        // Wait for Firebase auth to determine user state before loading content
        if (typeof window.onAuthStateReady === 'function') {
            window.onAuthStateReady((user) => {
                if (user) {
                    if (document.getElementById('units-grid')) {
                        initIndexPage();
                    } else if (document.getElementById('unit-hero')) {
                        initUnitPage();
                    }
                }
            });
        }
    });

    // Handle clicks outside of modals (upload and coffee)
    document.addEventListener('click', (e) => {
        const coffeeModal = document.getElementById('coffee-modal');
        if (coffeeModal && e.target === coffeeModal) {
            window.closeCoffeeModal();
        }
    });

})();
