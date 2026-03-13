/* ============================
   Python para Economistas
   Firebase Authentication
   ============================ */

(function () {
    'use strict';

    // 1. Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyCpcTO6nGTzEnPeL7HIClHqyTofLSPcAIg",
        authDomain: "python-economia.firebaseapp.com",
        projectId: "python-economia",
        storageBucket: "python-economia.firebasestorage.app",
        messagingSenderId: "696521970765",
        appId: "1:696521970765:web:a3570b2d58a3767dcef804",
        measurementId: "G-N9LPB93NL1"
    };

    // 2. Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();

    // 3. User State
    window.currentUser = null;
    window.isAuthReady = false; // Flag to let app.js know auth state is verified

    // Listeners for app.js to wait for auth state
    const authStateCallbacks = [];
    window.onAuthStateReady = function(callback) {
        if (window.isAuthReady) {
            callback(window.currentUser);
        } else {
            authStateCallbacks.push(callback);
        }
    };

    // 4. DOM Elements
    const authGate = document.getElementById('auth-gate');
    const googleLoginBtn = document.getElementById('btn-google-login');
    const headerAuth = document.getElementById('header-auth');
    
    // Auth logic
    auth.onAuthStateChanged((user) => {
        window.currentUser = user;
        window.isAuthReady = true;

        if (user) {
            // User is signed in
            if (authGate) authGate.style.display = 'none';
            document.body.classList.remove('locked');
            
            // Update Header
            if (headerAuth) {
                headerAuth.innerHTML = `
                    <div class="user-profile">
                        <img src="${user.photoURL}" alt="Perfil" class="user-avatar" referrerpolicy="no-referrer">
                        <div class="user-details">
                            <span class="user-name">${user.displayName.split(' ')[0]}</span>
                        </div>
                    </div>
                    <button class="btn-logout" id="btn-logout" title="Cerrar sesión">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="css-i6dzq1"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                `;
                document.getElementById('btn-logout').addEventListener('click', () => {
                    auth.signOut();
                });
            }

        } else {
            // User is signed out
            if (authGate) authGate.style.display = 'flex';
            document.body.classList.add('locked');
            if (headerAuth) {
                headerAuth.innerHTML = '';
            }
        }

        // Notify app.js
        authStateCallbacks.forEach(cb => cb(user));
    });

    // 5. Login Action
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            const span = googleLoginBtn.querySelector('span');
            const originalText = span.textContent;
            span.textContent = 'Conectando...';
            googleLoginBtn.style.pointerEvents = 'none';
            googleLoginBtn.style.opacity = '0.8';

            auth.signInWithPopup(provider).catch((error) => {
                console.error("Error signing in:", error);
                alert("Error al iniciar sesión: " + error.message);
                span.textContent = originalText;
                googleLoginBtn.style.pointerEvents = 'auto';
                googleLoginBtn.style.opacity = '1';
            });
        });
    }

})();
