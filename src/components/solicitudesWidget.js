export function renderSolicitudesWidget(containerElement, userSession, gasUrl) {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #E2E8F0;">
      <h2 style="color: #1B2B48; margin-top: 0;">📝 Nueva Solicitud de Servicio</h2>
      <p style="color: #475569; font-size: 0.95rem;">Complete el formulario para enviar su solicitud al departamento correspondiente.</p>
      
      <form id="form-solicitud" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <label style="display: block; font-weight: bold; margin-bottom: 0.3rem; color: #1E293B;">Área Destino</label>
          <select id="area-destino" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1;">
            <option value="Mantenimiento">Mantenimiento</option>
            <option value="Sistemas / IT">Sistemas / IT</option>
            <option value="Intendencia">Intendencia</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-weight: bold; margin-bottom: 0.3rem; color: #1E293B;">Descripción del Requerimiento</label>
          <textarea id="descripcion-solicitud" rows="4" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1; box-sizing: border-box;" placeholder="Detalle la solicitud..."></textarea>
        </div>

        <button type="button" style="background: #1B2B48; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: bold; cursor: pointer; align-self: flex-start;">
          Enviar Solicitud
        </button>
      </form>
    </div>
  `;
}
