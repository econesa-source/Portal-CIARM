/**
 * Componente Formulario de Solicitudes Internas (REQ-F-FORM) - Portal CIARM
 * Diagnóstico transparente de respuesta e integración con Google Apps Script
 */
import { createTicketAPI } from '../services/apiClient.js';

export class SolicitudesWidgetComponent {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.selectedFiles = [];
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <a class="back-link" id="btn-back-home">← Volver al inicio</a>
      <h1 class="form-page-title">Solicitudes internas</h1>
      <p class="form-page-subtitle">Petición formal de servicios para Mantenimiento, Sistemas e Intendencia.</p>

      <div class="user-audit-card">
        <div class="user-audit-avatar">EC</div>
        <div class="user-audit-info">
          <strong>Ezequiel Conesa</strong> (econesa@ciarm.edu.mx) <br>
          <span style="color: #64748B; font-size: 0.75rem;">Área: Coordinación Pedagógica | Rol: PORTAL_USUARIO</span>
        </div>
      </div>

      <div class="form-card-container">
        <form id="form-nueva-solicitud">
          <div class="form-grid-2col">
            <div>
              <label class="form-label">Tipo de Solicitud *</label>
              <select id="field-tipo" class="form-control-select" required>
                <option value="">Selecciona un servicio...</option>
                <option value="Soporte Tecnológico / TI">Soporte Tecnológico / TI</option>
                <option value="Limpieza e Intendencia">Limpieza e Intendencia</option>
                <option value="Mantenimiento de Instalaciones">Mantenimiento de Instalaciones</option>
                <option value="Recursos Humanos / Admón">Recursos Humanos / Admón</option>
              </select>
            </div>

            <div>
              <label class="form-label">¿Es de carácter urgente? *</label>
              <select id="field-urgencia" class="form-control-select" required>
                <option value="NO">NO - Atención dentro de SLA regular</option>
                <option value="SI">SÍ - Requiere atención prioritaria</option>
              </select>
            </div>
          </div>

          <div class="form-group-full">
            <label class="form-label">Descripción detallada del requerimiento *</label>
            <textarea id="field-descripcion" class="form-control-textarea" placeholder="Describe claramente el problema o servicio que requieres..." required></textarea>
          </div>

          <div class="form-group-full">
            <label class="form-label">Archivos adjuntos (Máx. 5 archivos, 10MB c/u)</label>
            <input type="file" id="field-adjuntos" multiple class="form-control-select" accept="image/*,.pdf,.doc,.docx">
            <div id="file-list-preview" style="margin-top: 0.5rem; font-size: 0.8rem; color: #475569;"></div>
          </div>

          <div class="form-actions-bar">
            <button type="submit" id="btn-submit-form" class="btn-submit-solicitud">
              Enviar Solicitud
            </button>
          </div>
        </form>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    document.getElementById("btn-back-home")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
    });

    const fileInput = document.getElementById("field-adjuntos");
    fileInput?.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 5) {
        alert("⚠️ Solo puedes adjuntar un máximo de 5 archivos.");
        fileInput.value = "";
        this.selectedFiles = [];
        return;
      }
      this.selectedFiles = files;
      const preview = document.getElementById("file-list-preview");
      if (preview) {
        preview.innerHTML = files.map(f => `📎 ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`).join("<br>");
      }
    });

    const form = document.getElementById("form-nueva-solicitud");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const btnSubmit = document.getElementById("btn-submit-form");
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "⏳ Enviando a Google Workspace...";
      }

      try {
        const processedAttachments = await Promise.all(
          this.selectedFiles.map(file => this.fileToBase64(file))
        );

        const payload = {
          nombre_solicitante: "Ezequiel Conesa",
          correo_solicitante: "econesa@ciarm.edu.mx",
          area_solicitante: "Coordinación Pedagógica",
          tipo_solicitud: document.getElementById("field-tipo").value,
          urgencia: document.getElementById("field-urgencia").value,
          descripcion: document.getElementById("field-descripcion").value,
          adjuntos: processedAttachments
        };

        const result = await createTicketAPI(payload);
        console.log("📌 Respuesta recibida del backend:", result);

        const folio = result?.id_ticket || result?.data?.id_ticket || result?.data?.id;

        if (result && (result.status === "success" || folio)) {
          alert(`✅ ¡Solicitud registrada con éxito!\n\nFolio asignado: ${folio || 'TKT-2026'}\nSe ha guardado en BD - Sistema de Tickets y Google Drive.`);
          window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "view-mis-solicitudes" } }));
        } else {
          const errorDetail = result?.message || JSON.stringify(result);
          alert(`⚠️️ La API de Google devolvió una respuesta de error:\n\n${errorDetail}`);
        }
      } catch (err) {
        console.error("❌ Error en la llamada al servidor:", err);
        alert(`❌ Error al conectar con el servidor:\n${err.message || err}`);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerText = "Enviar Solicitud";
        }
      }
    });
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        resolve({
          name: file.name,
          mimeType: file.type,
          base64Data: base64Data
        });
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }
}
