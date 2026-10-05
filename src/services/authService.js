/**
 * Servicio de Autenticación y Control de Sesión - Portal CIARM
 * Versión: 13.0.0
 */

const SESSION_KEY = 'ciarm_user_session';
const ALLOWED_DOMAIN = 'ciarm.edu.mx';

export function isLoggedIn() {
  const session = sessionStorage.getItem(SESSION_KEY);
  return session !== null;
}

export function getUserSession() {
  const session = sessionStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
}

export function saveUserSession(userData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.hash = '#inicio';
  window.location.reload();
}

export function handleGoogleCredential(response, onSuccess, onError) {
  try {
    const payload = parseJwt(response.credential);
    
    if (!payload.email.endsWith('@' + ALLOWED_DOMAIN) && payload.hd !== ALLOWED_DOMAIN) {
      throw new Error(`Acceso restringido. Utilice una cuenta @${ALLOWED_DOMAIN}`);
    }

    const user = {
      nombre: payload.name || 'Usuario CIARM',
      correo: payload.email,
      foto: payload.picture || '',
      token: response.credential
    };

    saveUserSession(user);
    if (onSuccess) onSuccess(user);

  } catch (err) {
    console.error('Error al validar cuenta:', err);
    if (onError) onError(err.message);
  }
}

function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}
