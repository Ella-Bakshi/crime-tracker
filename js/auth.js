// Authentication Module
const ADMIN_HASH = '166d1337c4641be7b320ddb2e0bad8be0bc630b3efb3917b0f2128ed5a5506d8';

let currentUser = null;
let isAdmin = false;
let authStateListeners = [];

async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function initAuth() {
  const auth = getAuth();
  if (!auth) return;

  auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    isAdmin = false;

    if (user && user.email) {
      const userHash = await hashEmail(user.email);
      isAdmin = (userHash === ADMIN_HASH);
    }

    updateAuthUI(user);
    notifyAuthStateListeners(user);
  });
}

async function signInWithGoogle() {
  const auth = getAuth();
  if (!auth) {
    showAuthError('Authentication service unavailable');
    return;
  }

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.signInWithPopup(provider);
  } catch (error) {
    handleAuthError(error);
  }
}

async function signOut() {
  const auth = getAuth();
  if (!auth) return;

  try {
    await auth.signOut();
  } catch (error) {
    // Silent fail
  }
}

function getCurrentUser() {
  return currentUser;
}

function isAdminUser() {
  return isAdmin;
}

function isAuthenticated() {
  return currentUser !== null;
}

function onAuthStateChange(listener) {
  if (typeof listener === 'function') {
    authStateListeners.push(listener);
  }
}

function notifyAuthStateListeners(user) {
  authStateListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      // Silent fail
    }
  });
}

function updateAuthUI(user) {
  const authButton = document.getElementById('auth-button');
  const userInfo = document.getElementById('user-info');
  const adminPanel = document.getElementById('admin-panel');

  if (!authButton) return;

  if (user) {
    authButton.textContent = 'Sign Out';
    authButton.onclick = signOut;

    if (userInfo) {
      const displayName = user.displayName || user.email || 'User';
      userInfo.textContent = displayName;
      userInfo.style.display = 'inline';
    }

    if (adminPanel) {
      adminPanel.style.display = isAdminUser() ? 'block' : 'none';
    }
  } else {
    authButton.textContent = 'Sign In';
    authButton.onclick = signInWithGoogle;

    if (userInfo) {
      userInfo.textContent = '';
      userInfo.style.display = 'none';
    }

    if (adminPanel) {
      adminPanel.style.display = 'none';
    }
  }
}

function handleAuthError(error) {
  const messages = {
    'auth/popup-closed-by-user': 'Sign-in cancelled',
    'auth/popup-blocked': 'Please allow popups for this site',
    'auth/cancelled-popup-request': 'Sign-in cancelled',
    'auth/network-request-failed': 'Network error. Please try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait.',
    'auth/user-disabled': 'This account has been disabled',
    'auth/unauthorized-domain': 'Domain not authorized',
    'auth/operation-not-allowed': 'Sign-in method not enabled'
  };

  const message = messages[error.code] || 'Sign-in failed';
  showAuthError(message);
}

function showAuthError(message) {
  let errorEl = document.getElementById('auth-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'auth-error';
    errorEl.className = 'auth-error';
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
      authContainer.appendChild(errorEl);
    }
  }

  errorEl.textContent = message;
  errorEl.style.display = 'block';

  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 5000);
}
