// Una consulta por ventana de caché, nunca una consulta por tarjeta o botón.
let snapshot = null;
let pending = null;
let fetchedAt = 0;
const TTL_MS = 60000;

export async function getPortalPermissions() {
  if (snapshot && Date.now() - fetchedAt < TTL_MS) return snapshot;
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch('/portal-permissions.php', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const body = await response.json();
    if (!response.ok || body?.ok !== true || !body?.data) {
      throw new Error('No se pudieron comprobar los permisos institucionales.');
    }
    if (body.data.enforced === true && body.data.verified !== true) {
      throw new Error('El servidor no verificó los permisos.');
    }
    snapshot = body.data;
    fetchedAt = Date.now();
    return snapshot;
  })();
  try { return await pending; } finally { pending = null; }
}

export function clearPortalPermissionsCache() {
  snapshot = null; fetchedAt = 0; pending = null;
}
