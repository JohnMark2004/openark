// script.js

document.addEventListener('DOMContentLoaded', function () {
  // --------------------------
  // Modal helper
  // --------------------------
  function ensureModalRoots() {
    if (document.getElementById('app-modal-root')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'app-modal-overlay';

    const root = document.createElement('div');
    root.className = 'modal-root';
    root.id = 'app-modal-root';

    const card = document.createElement('div');
    card.className = 'modal-card';

    card.innerHTML = `
      <div class="modal-header" id="app-modal-title">Notice</div>
      <div class="modal-body" id="app-modal-message"></div>
      <div class="modal-actions" id="app-modal-actions"></div>
    `;

    root.appendChild(card);
    document.body.appendChild(overlay);
    document.body.appendChild(root);

    overlay.addEventListener('click', closeModal);
  }

  function closeModal() {
    document.body.classList.remove('modal-open');
  }

  function showModal(options) {
    ensureModalRoots();
    const {
      title = 'Notice',
      message = '',
      buttons = [{ label: 'OK', variant: 'info', onClick: closeModal }]
    } = options || {};

    document.getElementById('app-modal-title').textContent = title;
    const msgEl = document.getElementById('app-modal-message');
    msgEl.innerHTML = '';
    if (typeof message === 'string') {
      msgEl.textContent = message;
    } else if (message instanceof Node) {
      msgEl.appendChild(message);
    }

    const actions = document.getElementById('app-modal-actions');
    actions.innerHTML = '';
    (buttons || []).forEach((b) => {
      const btn = document.createElement('button');
      btn.className = `modal-btn ${b.variant || 'info'}`;
      btn.textContent = b.label || 'OK';
      btn.addEventListener('click', () => {
        try { b.onClick ? b.onClick() : null; } finally { closeModal(); }
      });
      actions.appendChild(btn);
    });

    document.body.classList.add('modal-open');
  }

  // Convenience wrappers
  function showInfo(message, title = 'Info') {
    showModal({ title, message, buttons: [{ label: 'OK', variant: 'info' }] });
  }
  function showSuccess(message, title = 'Success') {
    showModal({ title, message, buttons: [{ label: 'Great', variant: 'primary' }] });
  }
  function showWarning(message, title = 'Warning') {
    showModal({ title, message, buttons: [{ label: 'OK', variant: 'warn' }] });
  }
  function showError(message, title = 'Error') {
    showModal({ title, message, buttons: [{ label: 'OK', variant: 'danger' }] });
  }

  // expose locally
  const ui = { showModal, showInfo, showSuccess, showWarning, showError };

  // --------------------------
  // Shared auth state helpers
  // --------------------------
  const AUTH_KEY = 'isAuthenticated';
  const setAuthed = (val) =>
    localStorage.setItem(AUTH_KEY, val ? 'true' : 'false');

  const logoutLink = document.getElementById('logout-link');

  const onAuthPage = document.body.classList.contains('auth-page');
  const onLibrarianPage =
    document.getElementById('librarian-login-form') !== null ||
    document.getElementById('librarian-signup-form') !== null;
  const onRolePage = document.getElementById('choose-student') !== null;

  // --------------------------
  // API helpers
  // --------------------------
  async function apiPost(url, payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false || data?.error) {
      const msg = data?.error || data?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  const studentSignup = (payload) => apiPost('/api/signup/student', payload);
  const studentLogin = (payload) => apiPost('/api/login/student', payload);
  const librarianSignup = (payload) => apiPost('/api/signup/librarian', payload);
  const librarianLogin = (payload) => apiPost('/api/login/librarian', payload);
  const passwordForgot = (payload) => apiPost('/api/password/forgot', payload);
  const passwordReset = (payload) => apiPost('/api/password/reset', payload);

  // --------------------------
  // STUDENT AUTH (auth.html)
  // --------------------------
  if (onAuthPage && !onLibrarianPage) {
    const form = document.getElementById('auth-form');
    const toggleLink = document.getElementById('toggle-auth-mode');
    const submitBtn = document.getElementById('auth-submit');
    const titleEl = document.getElementById('auth-title');
    const subEl = document.getElementById('auth-sub');
    const fieldStudentId = document.getElementById('field-student-id');
    const fieldUsername = document.getElementById('field-username');
    const fieldCourse = document.getElementById('field-course');
    const fieldPassword = document.getElementById('field-password');

    let mode = 'login'; // 'login' | 'signup'

    // Switch login <-> signup
    toggleLink?.addEventListener('click', (e) => {
      e.preventDefault();
      mode = mode === 'signup' ? 'login' : 'signup';

      if (mode === 'login') {
        titleEl.textContent = 'Welcome back';
        subEl.textContent = 'Log in to continue.';
        submitBtn.textContent = 'Log In';
        toggleLink.textContent = "Don't have an account? Sign Up";

        fieldStudentId.style.display = 'none';
        fieldCourse.style.display = 'none';
      } else {
        titleEl.textContent = 'Create your account';
        subEl.textContent = 'Sign up to continue.';
        submitBtn.textContent = 'Sign Up';
        toggleLink.textContent = 'Have an account? Log In';

        fieldStudentId.style.display = '';
        fieldCourse.style.display = '';
      }
    });

    // Default view: login
    fieldStudentId.style.display = 'none';
    fieldCourse.style.display = '';

    // Forgot password (student) - modal prompts
    document.getElementById('forgot-password-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();

      // Step 1: ask for identifier
      const container = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Enter your username';
      container.appendChild(input);

      ui.showModal({
        title: 'Reset Password',
        message: container,
        buttons: [
          { label: 'Cancel', variant: 'danger' },
          { label: 'Continue', variant: 'info', onClick: async () => {
              const identifier = input.value.trim();
              if (!identifier) { ui.showWarning('Username is required'); return; }
              try {
                const resp = await passwordForgot({ identifier });
                // Step 2: show token and ask new password
                const content = document.createElement('div');
                const tip = document.createElement('div');
                tip.style.fontSize = '12px';
                tip.style.color = '#666';
                tip.style.marginBottom = '8px';
                tip.textContent = 'For demo only: use this token to reset.';
                const tokenBox = document.createElement('div');
                tokenBox.style.padding = '10px';
                tokenBox.style.background = '#f8f9fa';
                tokenBox.style.border = '1px solid #e9ecef';
                tokenBox.style.borderRadius = '8px';
                tokenBox.style.marginBottom = '10px';
                tokenBox.textContent = resp.token;
                const pwd = document.createElement('input');
                pwd.type = 'password';
                pwd.placeholder = 'New password';
                content.appendChild(tip);
                content.appendChild(tokenBox);
                content.appendChild(pwd);

                ui.showModal({
                  title: 'Set New Password',
                  message: content,
                  buttons: [
                    { label: 'Cancel', variant: 'danger' },
                    { label: 'Reset', variant: 'primary', onClick: async () => {
                        const np = pwd.value.trim();
                        if (!np) { ui.showWarning('Password is required'); return; }
                        await passwordReset({ token: resp.token, newPassword: np });
                        ui.showSuccess('Password reset successful. You can now log in.');
                      } }
                  ]
                });
              } catch (err) {
                ui.showError(err.message || 'Failed to initiate password reset');
              }
            } }
        ]
      });
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (mode === 'signup') {
        const sid = document.getElementById('student-id');
        const uname = document.getElementById('username');
        const course = document.getElementById('course');
        const pwd = document.getElementById('password');

        [sid, uname, course, pwd].forEach((inp) =>
          inp.classList.remove('input-error')
        );

        if (
          !sid.value.trim() ||
          !uname.value.trim() ||
          !course.value.trim() ||
          !pwd.value.trim()
        ) {
          [sid, uname, course, pwd].forEach((inp) => {
            if (!inp.value.trim()) inp.classList.add('input-error');
          });
          return;
        }

        try {
          await studentSignup({
            studentId: sid.value.trim(),
            username: uname.value.trim(),
            course: course.value.trim(),
            password: pwd.value.trim(),
          });
          ui.showSuccess('Signup successful. Please log in.');
          // After sign up, go back to login
          mode = 'login';
          titleEl.textContent = 'Welcome back';
          subEl.textContent = 'Log in to continue.';
          submitBtn.textContent = 'Log In';
          toggleLink.textContent = "Don't have an account? Sign Up";
          fieldStudentId.style.display = 'none';
          fieldCourse.style.display = 'none';
        } catch (err) {
          ui.showError(err.message || 'Signup failed');
        }
        return;
      }

      // Login flow
      const uname = document.getElementById('username');
      const pwd = document.getElementById('password');

      [uname, pwd].forEach((inp) => inp.classList.remove('input-error'));
      if (!uname.value.trim() || !pwd.value.trim()) {
        [uname, pwd].forEach((inp) => {
          if (!inp.value.trim()) inp.classList.add('input-error');
        });
        return;
      }

      try {
        const resp = await studentLogin({ username: uname.value.trim(), password: pwd.value.trim() });
        const returnedUser = resp?.user || { username: uname.value.trim(), role: 'student' };
        localStorage.setItem('username', returnedUser.username);
        localStorage.setItem('userRole', returnedUser.role || 'student');
        setAuthed(true);
        window.location.href = 'index.html';
      } catch (err) {
        ui.showError(err.message || 'Login failed');
      }
    });

    return; // stop here on student auth page
  }

  // --------------------------
  // LIBRARIAN AUTH (librarian-auth.html)
  // --------------------------
  if (onLibrarianPage) {
    const loginForm = document.getElementById('librarian-login-form');
    const signupForm = document.getElementById('librarian-signup-form');
    const linkToSignup = document.getElementById('lib-link-to-signup');
    const linkToLogin = document.getElementById('lib-link-to-login');
    const title = document.getElementById('lib-auth-title');
    const sub = document.getElementById('lib-auth-sub');

    // Toggle to signup
    linkToSignup?.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      signupForm.style.display = '';
      title.textContent = 'Create Librarian Account';
      sub.textContent = 'Sign up for librarian access.';
    });

    // Toggle back to login
    linkToLogin?.addEventListener('click', (e) => {
      e.preventDefault();
      signupForm.style.display = 'none';
      loginForm.style.display = '';
      title.textContent = 'Librarian Access';
      sub.textContent = 'Log in with librarian credentials.';
    });

    // Forgot password (librarian)
    document.getElementById('lib-forgot-password-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();

      const container = document.createElement('div');
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Enter email or username';
      container.appendChild(input);

      ui.showModal({
        title: 'Reset Password',
        message: container,
        buttons: [
          { label: 'Cancel', variant: 'danger' },
          { label: 'Continue', variant: 'info', onClick: async () => {
              const identifier = input.value.trim();
              if (!identifier) { ui.showWarning('Email or username is required'); return; }
              try {
                const resp = await passwordForgot({ identifier });
                const content = document.createElement('div');
                const tip = document.createElement('div');
                tip.style.fontSize = '12px';
                tip.style.color = '#666';
                tip.style.marginBottom = '8px';
                tip.textContent = 'For demo only: use this token to reset.';
                const tokenBox = document.createElement('div');
                tokenBox.style.padding = '10px';
                tokenBox.style.background = '#f8f9fa';
                tokenBox.style.border = '1px solid #e9ecef';
                tokenBox.style.borderRadius = '8px';
                tokenBox.style.marginBottom = '10px';
                tokenBox.textContent = resp.token;
                const pwd = document.createElement('input');
                pwd.type = 'password';
                pwd.placeholder = 'New password';
                content.appendChild(tip);
                content.appendChild(tokenBox);
                content.appendChild(pwd);

                ui.showModal({
                  title: 'Set New Password',
                  message: content,
                  buttons: [
                    { label: 'Cancel', variant: 'danger' },
                    { label: 'Reset', variant: 'primary', onClick: async () => {
                        const np = pwd.value.trim();
                        if (!np) { ui.showWarning('Password is required'); return; }
                        await passwordReset({ token: resp.token, newPassword: np });
                        ui.showSuccess('Password reset successful. You can now log in.');
                      } }
                  ]
                });
              } catch (err) {
                ui.showError(err.message || 'Failed to initiate password reset');
              }
            } }
        ]
      });
    });

    // Handle signup
    signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('lib-signup-email');
      const uname = document.getElementById('lib-signup-username');
      const pwd = document.getElementById('lib-signup-password');
      const code = document.getElementById('lib-signup-code');

      [email, uname, pwd, code].forEach((inp) =>
        inp.classList.remove('input-error')
      );

      if (
        !email.value.trim() ||
        !uname.value.trim() ||
        !pwd.value.trim() ||
        !code.value.trim()
      ) {
        [email, uname, pwd, code].forEach((inp) => {
          if (!inp.value.trim()) inp.classList.add('input-error');
        });
        return;
      }

      try {
        await librarianSignup({
          email: email.value.trim(),
          username: uname.value.trim(),
          password: pwd.value.trim(),
          accessCode: code.value.trim(),
        });
        ui.showSuccess('Librarian signup successful. Please log in.');
        // After signup, go back to login form
        signupForm.style.display = 'none';
        loginForm.style.display = '';
        title.textContent = 'Librarian Access';
        sub.textContent = 'Log in with librarian credentials.';
      } catch (err) {
        ui.showError(err.message || 'Signup failed');
      }
    });

    // Handle login
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const uname = document.getElementById('lib-login-username');
      const pwd = document.getElementById('lib-login-password');
      const code = document.getElementById('lib-login-code');

      [uname, pwd, code].forEach((inp) =>
        inp.classList.remove('input-error')
      );

      if (!uname.value.trim() || !pwd.value.trim() || !code.value.trim()) {
        [uname, pwd, code].forEach((inp) => {
          if (!inp.value.trim()) inp.classList.add('input-error');
        });
        return;
      }

      try {
        const resp = await librarianLogin({
          username: uname.value.trim(),
          password: pwd.value.trim(),
          accessCode: code.value.trim(),
        });
        const returnedUser = resp?.user || { username: uname.value.trim(), role: 'librarian' };
        localStorage.setItem('username', returnedUser.username);
        localStorage.setItem('userRole', returnedUser.role || 'librarian');
        setAuthed(true);
        window.location.href = 'index.html';
      } catch (err) {
        ui.showError(err.message || 'Login failed');
      }
    });

    return; // stop here on librarian auth page
  }

  // --------------------------
  // ROLE SELECT PAGE
  // --------------------------
  if (onRolePage) {
    return; // links go to the correct pages
  }

  // --------------------------
  // APP PAGES
  // --------------------------
  if (localStorage.getItem(AUTH_KEY) !== 'true') {
    window.location.replace('role-select.html');
    return;
  }

  // logout
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem('userRole');
      window.location.replace('role-select.html');
    });
  }

  // show username in header
  const nameEl = document.getElementById('site-username');
  const savedUsername = localStorage.getItem('username');
  if (nameEl && savedUsername) {
    nameEl.textContent = savedUsername;
  }

  // (keep your existing app code: nav tabs, OCR upload, bookmarks, etc.)

  const convertUploadTab = document.getElementById('convert-upload-tab');
  const convertUploadContent = document.getElementById('convert-upload-content');
  const bookmarksTab = document.getElementById('bookmarks-tab'); // Bookmarks tab
  const bookmarksContent = document.getElementById('bookmarks-content');
  const helpSupportTab = document.querySelector('.nav-link:last-child'); // Help & Support tab
  const helpSupportContent = document.getElementById('help-support-content');
  const searchSection = document.querySelector('.search-section');
  const browseTab = document.getElementById('browse-tab');
  const advancedTab = document.getElementById('advanced-tab');
  const lowerContent = document.querySelector('.lower-content');

    // ...existing code...
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const countSpan = this.querySelector('.like-count');
      let count = parseInt(countSpan.textContent, 10) || 0;
      countSpan.textContent = count + 1;
    });
  });
  // ...existing code...

  // Initialize default state - show bookmarks content
  searchSection.style.display = 'none';
  convertUploadContent.style.display = 'none';
  helpSupportContent.style.display = 'none';
  bookmarksContent.style.display = 'block';
  if (lowerContent) lowerContent.style.display = '';

  // Show Convert & Upload content when tab is clicked
  convertUploadTab.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Hide other sections and show convert upload content
    searchSection.style.display = 'none';
    bookmarksContent.style.display = 'none';
    helpSupportContent.style.display = 'none';
    convertUploadContent.style.display = 'block';
    if (lowerContent) lowerContent.style.display = 'none';
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    convertUploadTab.classList.add('active');
  });

  // Show Bookmarks content when tab is clicked
  bookmarksTab.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Hide other sections and show bookmarks content
    searchSection.style.display = 'none';
    convertUploadContent.style.display = 'none';
    helpSupportContent.style.display = 'none';
    bookmarksContent.style.display = 'block';
    if (lowerContent) lowerContent.style.display = '';
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    bookmarksTab.classList.add('active');
  });

  // Show Help & Support content when tab is clicked
  helpSupportTab.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Hide other sections and show help support content
    searchSection.style.display = 'none';
    convertUploadContent.style.display = 'none';
    bookmarksContent.style.display = 'none';
    helpSupportContent.style.display = 'block';
    if (lowerContent) lowerContent.style.display = 'none';
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    helpSupportTab.classList.add('active');
  });

  // Handle other nav links (EXPLORE COLLECTIONS) - show search section
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkText = link.textContent.trim();
    
    // Skip tabs that have specific handlers
    if (linkText === 'CONVERT & UPLOAD' || 
        linkText === 'BOOKMARKS' || 
        linkText === 'HELP & SUPPORT') {
      return; // Skip these as they have their own handlers
    }
    
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Hide all content sections and show search
      searchSection.style.display = 'flex';
      convertUploadContent.style.display = 'none';
      bookmarksContent.style.display = 'none';
      helpSupportContent.style.display = 'none';
      if (lowerContent) lowerContent.style.display = '';
      
      // Update active nav link
      document.querySelectorAll('.nav-link').forEach(navLink => {
        navLink.classList.remove('active');
      });
      this.classList.add('active');
    });
  });

  // Search tab functionality
  browseTab.addEventListener('click', function() {
    browseTab.classList.add('active');
    advancedTab.classList.remove('active');
  });

  advancedTab.addEventListener('click', function() {
    advancedTab.classList.add('active');
    browseTab.classList.remove('active');
  });

  // Search button functionality
  document.getElementById('search-button').addEventListener('click', function() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.trim();
    
    if (searchTerm) {
      ui.showInfo(`Searching for: "${searchTerm}"`, 'Searching');
      // Here you would implement actual search functionality
    } else {
      ui.showWarning('Please enter a search term', 'Missing search term');
    }
  });

  // Search input enter key
  document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('search-button').click();
    }
  });

  // FAQ functionality
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', function() {
      const faqItem = this.parentElement;
      const isActive = faqItem.classList.contains('active');
      
      // Close all FAQ items
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
      });
      
      // Toggle current item
      if (!isActive) {
        faqItem.classList.add('active');
      }
    });
  });

  // Bookmark removal functionality (will be used when books are added)
  function setupBookmarkRemoval() {
    document.querySelectorAll('.remove-bookmark').forEach(button => {
      button.addEventListener('click', function(e) {
        e.stopPropagation();
        const bookmarkItem = this.closest('.bookmark-item');
        bookmarkItem.remove();
        
        // Check if there are any bookmarks left
        const bookmarksGrid = document.getElementById('bookmarks-grid');
        const remainingBookmarks = bookmarksGrid.querySelectorAll('.bookmark-item');
        
        if (remainingBookmarks.length === 0) {
          // Show no bookmarks message
          document.getElementById('bookmarks-grid').style.display = 'none';
          document.getElementById('no-bookmarks').style.display = 'block';
        }
      });
    });
  }

  // Initialize bookmark removal functionality
  setupBookmarkRemoval();

  // Explore button functionality
  document.querySelector('.explore-btn')?.addEventListener('click', function() {
    // Switch to search section
    searchSection.style.display = 'flex';
    bookmarksContent.style.display = 'none';
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector('.nav-link').classList.add('active'); // First nav link (EXPLORE COLLECTIONS)
  });

  // --- App-only: Convert button and Drag & Drop setup ---
  const convertBtnEl = document.getElementById("convert-btn");
  if (convertBtnEl) {
    // Open native file picker when clicking the label
    const hiddenInput = document.getElementById('file-input');
    const labelEl = document.querySelector('label[for="file-input"]');
    labelEl?.addEventListener('click', function(e) {
      e.preventDefault();
      hiddenInput?.click();
    });

    // When file chosen via picker, show selected filename (same as drop)
    hiddenInput?.addEventListener('change', function() {
      const dropArea = document.querySelector('.upload-section');
      const files = hiddenInput.files;
      if (!files || files.length === 0) return;
      const fileName = document.createElement('div');
      fileName.className = 'selected-filename';
      fileName.textContent = `Selected: ${files[0].name}`;
      fileName.style.marginTop = '10px';
      fileName.style.fontSize = '14px';
      fileName.style.color = '#666';
      const prev = dropArea.querySelector('.selected-filename');
      if (prev) dropArea.removeChild(prev);
      dropArea.appendChild(fileName);
    });
    convertBtnEl.addEventListener("click", async () => {
      const fileInput = document.getElementById("file-input");
      const convertBtn = document.getElementById("convert-btn");
      const statusDiv = document.getElementById("status");
      const enableSummary = document.getElementById('enable-summary');

      if (!fileInput.files.length) {
        ui.showWarning("Please upload an image file first!", 'File required');
        return;
      }

      let file = fileInput.files[0];
      // Client-side compression for images (skip PDFs)
      if (file && file.type.startsWith('image/')) {
        statusDiv.textContent = "Optimizing image...";
        try {
          file = await (async function compressImage(sourceFile) {
            const bitmap = await createImageBitmap(sourceFile);
            const maxDim = 1600; // cap long edge
            let { width, height } = bitmap;
            if (Math.max(width, height) > maxDim) {
              const scale = maxDim / Math.max(width, height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, width, height);
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
            return new File([blob], sourceFile.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          })(file);
        } catch (e) {
          console.warn('Compression failed, using original file:', e);
        }
      }
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/tiff",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        ui.showError("Invalid file type. Use JPG, PNG, GIF, BMP, TIFF, or PDF.", 'Invalid file');
        return;
      }

      convertBtn.disabled = true;
      convertBtn.textContent = "Processing...";
      statusDiv.hidden = false;
      statusDiv.textContent = `Uploading ${enableSummary?.checked ? '(with summary)' : '(without summary)'}...`;
      document.getElementById("conversion-output").hidden = true;
      document.getElementById("summary-output").hidden = true;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const wantSummary = !!enableSummary?.checked;
        const response = await fetch(`http://localhost:3000/upload?summary=${wantSummary ? 'true' : 'false'}`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Server error: ${response.status} ${errText}`);
        }

        statusDiv.textContent = "Running OCR...";
        const data = await response.json();
        if (!data.success) throw new Error(data.error || "OCR failed");

        // Show text
        document.getElementById("converted-text").textContent = data.text;
        document.getElementById("conversion-output").hidden = false;
        statusDiv.hidden = true;

        // Summary handling
        const summaryEl = document.getElementById("summary-output");
        const summaryTextEl = document.getElementById("summary-text");
        if (wantSummary) {
          if (data.summary) {
            summaryTextEl.textContent = data.summary;
            summaryEl.hidden = false;
          } else {
            summaryTextEl.textContent = 'Summary could not be generated.';
            summaryEl.hidden = false;
          }
        } else {
          summaryEl.hidden = true;
        }

        // Download button
        document.getElementById("download-txt").onclick = () => {
          window.open(`http://localhost:3000${data.download}`, "_blank");
        };

        // Copy button
        document.getElementById("copy-text").onclick = () => {
          navigator.clipboard.writeText(data.text);
          ui.showSuccess("Text copied to clipboard!", 'Copied');
        };

        // Confidence
        if (data.confidence !== null && typeof data.confidence !== "undefined") {
          statusDiv.hidden = false;
          statusDiv.innerHTML = `OCR Confidence: <strong>${Number(
            data.confidence
          ).toFixed(2)}%</strong>`;
        }
      } catch (err) {
        console.error("Error:", err);
        ui.showError("Error: " + (err.message || "Could not connect to server."));
        statusDiv.hidden = true;
        document.getElementById("summary-output").hidden = true;
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = "Convert";
      }
    });

    // Drag & Drop
    const dropArea = document.querySelector(".upload-section");
    const fileInput = document.getElementById("file-input");

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eName) => {
      dropArea.addEventListener(eName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach((eName) => {
      dropArea.addEventListener(eName, () => {
        dropArea.style.borderColor = "#4a90e2";
        dropArea.style.backgroundColor = "#f0f8ff";
      });
    });

    ["dragleave", "drop"].forEach((eName) => {
      dropArea.addEventListener(eName, () => {
        dropArea.style.borderColor = "";
        dropArea.style.backgroundColor = "";
      });
    });

    dropArea.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      fileInput.files = files;

      const fileName = document.createElement("div");
      fileName.className = 'selected-filename';
      fileName.textContent = `Selected: ${files[0].name}`;
      fileName.style.marginTop = "10px";
      fileName.style.fontSize = "14px";
      fileName.style.color = "#666";

      const prev = dropArea.querySelector('.selected-filename');
      if (prev) dropArea.removeChild(prev);
      dropArea.appendChild(fileName);
    });
  }
});

// The remaining duplicate convert/upload handlers are kept below; consider consolidating.
