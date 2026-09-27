/**
 * Componente Barra Lateral (Sidebar) - Portal CIARM
 * Renderiza el menú de navegación institucional respetando la identidad visual.
 */

const NAV_ITEMS = [
  { id: "nav-home", label: "📌 Inicio / Avisos", icon: "home", active: true },
  { id: "nav-drive", label: "📁 Gestor Documental", icon: "folder", active: false },
  { id: "nav-calendar", label: "📅 Calendario Escolar", icon: "calendar", active: false },
  { id: "nav-directory", label: "👥 Directorio Personal", icon: "users", active: false },
  { id: "nav-settings", label: "⚙️ Configuración", icon: "settings", active: false }
];

export class SidebarComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.items = NAV_ITEMS;
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="ciarm-sidebar-inner">
        <div class="sidebar-section-title">Navegación Principal</div>
        <ul class="sidebar-nav-list">
          ${this.items.map(item => `
            <li class="sidebar-nav-item ${item.active ? 'active' : ''}" data-id="${item.id}">
              <a href="#" class="sidebar-nav-link">
                <span class="sidebar-nav-label">${item.label}</span>
              </a>
            </li>
          `).join('')}
        </ul>
        <div class="sidebar-footer">
          <small>Colegio CIARM Intranet v1.0</small>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const listItems = this.container.querySelectorAll('.sidebar-nav-item');
    listItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const navId = item.getAttribute('data-id');
        this.setActive(navId);
      });
    });
  }

  setActive(selectedId) {
    this.items.forEach(item => item.active = (item.id === selectedId));
    this.render();
    window.dispatchEvent(new CustomEvent('ciarm:navigation-change', { detail: { id: selectedId } }));
  }
}
