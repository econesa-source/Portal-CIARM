/**
 * Módulo de Inicio - Dashboard Oficial CIARM
 * Versión: 18.1.0
 * Asistente CIARM: interfaz propia del Portal, Voiceflow sólo como motor server-side.
 */

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function cleanPlainText(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd();
}

function appendInlineMarkdown(parent, text) {
  const pattern = /\[([^\]]+)]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parent.append(document.createTextNode(cleanPlainText(text.slice(cursor, match.index))));
    }

    if (match[1] !== undefined) {
      const href = safeExternalUrl(match[2]);
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = match[1];
        parent.append(link);
      } else {
        parent.append(document.createTextNode(match[1]));
      }
    } else {
      const strong = document.createElement('strong');
      strong.textContent = match[3];
      parent.append(strong);
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    parent.append(document.createTextNode(cleanPlainText(text.slice(cursor))));
  }
}

function isTableDivider(line) {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

function renderMarkdown(markdown) {
  const root = document.createElement('div');
  root.className = 'sicpe-answer';

  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const value = paragraph.join('\n').trim();
    paragraph = [];
    if (!value) return;
    const p = document.createElement('p');
    appendInlineMarkdown(p, value);
    root.append(p);
  };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const heading = line.match(/^\s*#{1,4}\s+(.+)$/);

    if (heading) {
      flushParagraph();
      const h3 = document.createElement('h3');
      appendInlineMarkdown(h3, heading[1]);
      root.append(h3);
      index += 1;
      continue;
    }

    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      flushParagraph();
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }

      const wrap = document.createElement('div');
      wrap.className = 'sicpe-table-wrap';
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');

      headers.forEach(cell => {
        const th = document.createElement('th');
        appendInlineMarkdown(th, cell);
        headRow.append(th);
      });

      thead.append(headRow);
      table.append(thead);

      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach((_, cellIndex) => {
          const td = document.createElement('td');
          appendInlineMarkdown(td, row[cellIndex] || '');
          tr.append(td);
        });
        tbody.append(tr);
      });

      table.append(tbody);
      wrap.append(table);
      root.append(wrap);
      continue;
    }

    const listMatch = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = Boolean(listMatch[2]);
      const list = document.createElement(ordered ? 'ol' : 'ul');

      while (index < lines.length) {
        const itemMatch = lines[index].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/);
        if (!itemMatch || Boolean(itemMatch[2]) !== ordered) break;
        const li = document.createElement('li');
        appendInlineMarkdown(li, itemMatch[3]);
        list.append(li);
        index += 1;
      }

      root.append(list);
      continue;
    }

    if (!line.trim()) flushParagraph();
    else paragraph.push(line);
    index += 1;
  }

  flushParagraph();
  return root;
}

function randomConversationID() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'ciarm-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}

function mountAssistant() {
  const assistant = document.getElementById('ciarm-assistant');
  const form = document.getElementById('ciarm-chat-form');
  const input = document.getElementById('ciarm-chat-input');
  const button = document.getElementById('ciarm-chat-send');
  const dialog = document.getElementById('ciarm-chat-dialog');

  if (!assistant || !form || !input || !button || !dialog) return;

  const state = {
    messages: [],
    busy: false,
    error: '',
    conversationID: ''
  };

  function isActive() {
    return Boolean(input.value.trim() || state.messages.length || state.busy || state.error);
  }

  function syncActiveState() {
    assistant.classList.toggle('ciarm-assistant--active', isActive());
  }

  function renderConversation() {
    dialog.innerHTML = '';

    state.messages.forEach(item => {
      if (item.role === 'user') {
        const message = document.createElement('div');
        message.className = 'ciarm-chat-user';
        message.textContent = item.content;
        dialog.append(message);
      } else {
        const message = document.createElement('div');
        message.className = 'ciarm-chat-assistant';
        message.append(renderMarkdown(item.content));
        dialog.append(message);
      }
    });

    if (state.busy) {
      const loading = document.createElement('div');
      loading.className = 'ciarm-chat-assistant ciarm-chat-loading';
      loading.textContent = 'Consultando…';
      dialog.append(loading);
    }

    if (state.error) {
      const error = document.createElement('div');
      error.className = 'ciarm-chat-error';
      error.setAttribute('role', 'alert');
      error.textContent = state.error;
      dialog.append(error);
    }

    const hasContent = state.messages.length > 0 || state.busy || state.error;
    dialog.hidden = !hasContent;
    button.disabled = state.busy || !input.value.trim();
    input.disabled = state.busy;
    syncActiveState();

    requestAnimationFrame(() => {
      dialog.scrollTop = dialog.scrollHeight;
    });
  }

  input.addEventListener('input', () => {
    button.disabled = state.busy || !input.value.trim();
    syncActiveState();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || state.busy) return;

    if (!state.conversationID) state.conversationID = randomConversationID();
    const launch = state.messages.length === 0;

    input.value = '';
    state.error = '';
    state.messages.push({ role: 'user', content: message });
    state.busy = true;
    renderConversation();

    try {
      const response = await fetch('/voiceflow.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationID: state.conversationID,
          launch
        })
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Voiceflow devolvió una respuesta inválida.');
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Voiceflow no pudo responder.');
      }

      const replies = Array.isArray(data?.messages)
        ? data.messages.filter(value => typeof value === 'string' && value.trim())
        : [];

      if (!replies.length) {
        throw new Error('El asistente no devolvió una respuesta.');
      }

      replies.forEach(content => {
        state.messages.push({ role: 'assistant', content });
      });
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Voiceflow no pudo responder.';
    } finally {
      state.busy = false;
      renderConversation();
      input.focus();
    }
  });

  renderConversation();
}

export function render(container, userSession) {
  if (!container) return;

  container.innerHTML = `
    <div class="home-content portal-home-content">

      <section class="sicpe-search">
        <div class="sicpe-heading">
          <div>
            <div class="sicpe-title">
              <h1>Asistente <span class="ciarm-word">C<span class="ai-accent">IA</span>RM</span></h1>
            </div>
            <p>Consulta normativa, procesos y herramientas del colegio.</p>
          </div>
          <span>CONSULTA INSTITUCIONAL</span>
        </div>

        <div id="ciarm-assistant" aria-label="Asistente CIARM">
          <div id="ciarm-chat-dialog" class="ciarm-chat-dialog" aria-live="polite" hidden></div>
          <form id="ciarm-chat-form" class="ciarm-chat-form">
            <input id="ciarm-chat-input" autocomplete="off" placeholder="Mensaje…" aria-label="Mensaje para el Asistente CIARM">
            <button id="ciarm-chat-send" type="submit" aria-label="Enviar mensaje" disabled>↑</button>
          </form>
        </div>
      </section>

      <div class="dashboard-grid-exact">
        <div class="exact-card">
          <span class="exact-card-category">SERVICIOS INTERNOS</span>
          <h3 class="exact-card-title">Solicitudes internas</h3>
          <p class="exact-card-desc">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
          <div class="exact-card-btn-group">
            <a href="#solicitudes" class="exact-btn dark">+ Crear Solicitud</a>
            <a href="#mis-solicitudes" class="exact-btn gold">📋 Mis Solicitudes</a>
          </div>
        </div>

        <div class="exact-card">
          <span class="exact-card-category">BIBLIOTECA CIARM</span>
          <h3 class="exact-card-title">Libros y Papers</h3>
          <p class="exact-card-desc">Busca bibliografía académica, consulta fuentes y propón o inicia una investigación.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Acceder a Biblioteca</span>
        </div>

        <div class="exact-card">
          <span class="exact-card-category">SICPE · SISTEMA INTEGRAL DE CUMPLIMIENTO</span>
          <h3 class="exact-card-title">Normas y herramientas</h3>
          <p class="exact-card-desc">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Consultar Normativa</span>
        </div>

        <div class="exact-card">
          <span class="exact-card-category">COMUNICACIÓN INSTITUCIONAL</span>
          <h3 class="exact-card-title">Comunicados</h3>
          <p class="exact-card-desc">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Ver Comunicados</span>
        </div>

        <div class="exact-card">
          <span class="exact-card-category">SCGRC · SISTEMA DE CONTROL DE GESTIÓN</span>
          <h3 class="exact-card-title">Administración</h3>
          <p class="exact-card-desc">Órdenes de compra, reportes y herramientas administrativas habilitadas para tu perfil.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Gestión Administrativa</span>
        </div>

        <div class="exact-card">
          <span class="exact-card-category">BACHILLERATO INTERNACIONAL</span>
          <h3 class="exact-card-title">IB</h3>
          <p class="exact-card-desc">Accede a documentación, programas, recursos y herramientas correspondientes a tu función.</p>
          <span class="exact-btn light exact-btn-disabled" aria-disabled="true">Acceso Módulo IB</span>
        </div>
      </div>
    </div>
  `;

  mountAssistant();
}

export const renderDashboardWidget = render;
