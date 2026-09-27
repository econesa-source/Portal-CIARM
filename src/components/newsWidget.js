/**
 * Componente Tarjetas de Noticias (News Widget) - Portal CIARM
 * Despliega comunicados y novedades institucionales.
 */

const DEFAULT_NEWS = [
  {
    id: "news-1",
    category: "Aviso Importante",
    title: "Bienvenida al Nuevo Ciclo Académico",
    summary: "Les damos la más cordial bienvenida a todo el personal docente y administrativo al entorno digital CIARM.",
    date: "28 Sep, 2026",
    author: "Dirección General",
    badgeColor: "#0D9488"
  },
  {
    id: "news-2",
    category: "Gestión Documental",
    title: "Actualización de Políticas Internas en Drive",
    summary: "Se han actualizado los formatos de solicitud de permisos e incidencias en la carpeta compartida.",
    date: "25 Sep, 2026",
    author: "Recursos Humanos",
    badgeColor: "#1A365D"
  }
];

export class NewsWidgetComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.newsList = DEFAULT_NEWS;
  }

  render(customNews = null) {
    if (!this.container) return;
    const items = customNews || this.newsList;

    this.container.innerHTML = `
      <div class="news-widget-header">
        <h3>📢 Comunicados y Novedades Institucionales</h3>
      </div>
      <div class="news-grid">
        ${items.map(news => `
          <article class="news-card">
            <div class="news-card-header">
              <span class="news-badge" style="background-color: ${news.badgeColor};">${news.category}</span>
              <span class="news-date">${news.date}</span>
            </div>
            <h4 class="news-title">${news.title}</h4>
            <p class="news-summary">${news.summary}</p>
            <div class="news-card-footer">
              <span class="news-author">✍️ ${news.author}</span>
              <button class="news-read-more" data-id="${news.id}">Leer más</button>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }
}
