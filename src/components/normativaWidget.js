/**
 * Componente Normativa - Portal CIARM
 */

export function renderNormativaWidget(container) {
  if (!container) return;

  container.innerHTML = `
    <section class="inner-page">
      <a href="#inicio" class="back">← Volver al inicio</a>
      <div class="page-title">
        <div>
          <span>PORTAL CIARM</span>
          <h1>Normativa</h1>
          <p>Acceso a políticas, reglamentos, protocolos y documentos institucionales vigentes.</p>
        </div>
      </div>
      <div class="empty-state">
        <h2>Próxima etapa funcional</h2>
        <p>La interfaz ya está preparada para conectar esta sección con su fuente oficial.</p>
      </div>
    </section>
  `;
}

export const render = renderNormativaWidget;
