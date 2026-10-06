/**
 * Servicio de Autenticación y Sesión - Portal CIARM
 * Versión: 18.0.1
 *
 * La sesión real vive en PHP mediante cookie HttpOnly.
 * El navegador nunca persiste el ID token de Google.
 */

export const GOOGLE_CLIENT_ID =
  '202621439702-c0sm91am6s8pl8oi6v2245hk1md3bbea.apps.googleusercontent.com';

let currentUser = null;

export async function getAuthenticatedUser(forceRefresh = false) {
  if (currentUser && !forceRefresh) {
    return currentUser;
  }

  try {
    const response = await fetch('/auth-session.php', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (response.status === 401) {
      currentUser = null;
      return null;
    }

    if (!response.ok) {
      throw new Error(`No se pudo validar la sesión (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    currentUser = payload?.ok === true && payload?.user ? payload.user : null;
    return currentUser;

  } catch (error) {
    console.error('Error consultando sesión institucional:', error);
    currentUser = null;
    return null;
  }
}

export async function authenticateGoogleCredential(credential) {
  const response = await fetch('/auth-google.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ credential })
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (_) {}

  if (!response.ok || payload?.ok !== true || !payload?.user) {
    const error = new Error('No fue posible iniciar sesión con esta cuenta.');
    error.code = payload?.code || `http_${response.status}`;
    throw error;
  }

  currentUser = payload.user;
  return currentUser;
}

export async function logout() {
  try {
    await fetch('/auth-logout.php', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
  } catch (error) {
    console.warn('No fue posible confirmar el cierre de sesión en servidor:', error);
  }

  currentUser = null;
  window.google?.accounts?.id?.disableAutoSelect?.();
  window.location.hash = '#inicio';
  window.location.reload();
}
