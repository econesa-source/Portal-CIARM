// Una consulta por ventana de caché, nunca una consulta por tarjeta o botón.
let snapshot = null;
let pending = null;
let fetchedAt = 0;
const TTL_MS = 60000;
let generation = 0;

export async function getPortalPermissions() {
  if (snapshot && Date.now() - fetchedAt < TTL_MS) return snapshot;
  if (pending) return pending;
  const requestGeneration = generation;
  const request = (async () => {
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
    if (requestGeneration !== generation) throw new Error("La sesión cambió durante la consulta de permisos.");
    snapshot = body.data;
    fetchedAt = Date.now();
    return snapshot;
  })();
  pending = request;
  try { return await request; } finally { if (pending === request) pending = null; }
}

export function clearPortalPermissionsCache() {
  generation++;
  snapshot = null; fetchedAt = 0; pending = null;
}
