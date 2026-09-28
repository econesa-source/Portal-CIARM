import { DashboardRealComponent } from './components/dashboardReal.js';

document.addEventListener('DOMContentLoaded', () => {
  const dashboard = new DashboardRealComponent('main-content-area');
  dashboard.render();
});
