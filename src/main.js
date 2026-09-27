/**
 * Orquestador Principal - Portal CIARM
 */
import { SidebarComponent } from './components/sidebar.js';
import { NewsWidgetComponent } from './components/newsWidget.js';

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = new SidebarComponent('sidebar-container');
  sidebar.render();

  const newsWidget = new NewsWidgetComponent('news-widget-container');
  newsWidget.render();

  window.addEventListener('ciarm:navigation-change', (e) => {
    console.log('📌 Cambio de sección activa:', e.detail.id);
  });
});
