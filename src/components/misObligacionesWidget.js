/**
 * Componente Mis obligaciones - Portal CIARM
 */

export function renderMisObligacionesWidget(container) {
  if (!container) return;

  container.innerHTML = `
    <section class="inner-page">
      <a href="#inicio" class="back">← Volver al inicio</a>
      <div class="page-title">
        <div>
          <span>PORTAL CIARM</span>
          <h1>Mis obligaciones</h1>
          <p>Acá vas a consultar obligaciones, constancias, capacitaciones y documentación asignadas a tu perfil.</p>
        </div>
      </div>
      <div class="empty-state">
        <h2>Próxima etapa funcional</h2>
        <p>La interfaz ya está preparada para conectar esta sección con su fuente oficial.</p>
      </div>
    </section>
  `;
}

export const render = renderMisObligacionesWidget;
