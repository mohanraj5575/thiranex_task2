// Redirect if already logged in
if (localStorage.getItem('token')) {
  window.location.href = '/';
}

function switchTab(mode) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginTab = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const alertBox = document.getElementById('auth-alert');

  // Clear alerts
  alertBox.className = 'alert hidden';
  alertBox.innerText = '';

  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginTab.classList.remove('active');
    registerTab.classList.add('active');
  }
}

async function handleAuth(event, mode) {
  event.preventDefault();

  const alertBox = document.getElementById('auth-alert');
  alertBox.className = 'alert hidden';
  alertBox.innerText = '';

  let payload = {};
  let url = '';

  if (mode === 'login') {
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;

    payload = { username: usernameInput, password: passwordInput };
    url = '/api/auth/login';
  } else {
    const usernameInput = document.getElementById('register-username').value.trim();
    const passwordInput = document.getElementById('register-password').value;
    const confirmPasswordInput = document.getElementById('register-confirm-password').value;

    if (passwordInput !== confirmPasswordInput) {
      showAlert('Passwords do not match.', 'error');
      return;
    }

    payload = { username: usernameInput, password: passwordInput };
    url = '/api/auth/register';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed');
    }

    if (mode === 'login') {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showAlert('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } else {
      showAlert('Account registered! You can now log in.', 'success');
      setTimeout(() => {
        switchTab('login');
        // Pre-fill username
        document.getElementById('login-username').value = payload.username;
        document.getElementById('login-password').focus();
      }, 1500);
    }
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

function showAlert(message, type) {
  const alertBox = document.getElementById('auth-alert');
  alertBox.innerText = message;
  alertBox.className = `alert alert-${type}`;
  alertBox.classList.remove('hidden');
}
