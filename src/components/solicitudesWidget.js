/**
 * Componente Formulario de Solicitudes Internas (REQ-F-FORM) - Portal CIARM
 * Soporte Multi-archivo con validación de máximo 5 archivos y 10MB por archivo.
 */

export class SolicitudesWidgetComponent {
  constructor(containerId, userData = {}) {
    this.container = document.getElementById(containerId);
    this.userData = {
      name: userData.name || "Ezequiel Conesa",
      email: userData.email || "e.conesa@ciarm.edu.mx",
      area: userData.area || "Dirección / Docencia",
      initials: userData.initials || "EC"
    };
    this.selectedFiles = [];
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <a class="back-link" id="btn-back-home" style="margin-bottom: 0;">← Volver al inicio</a>
        <button id="btn-view-mis-solicitudes" style="background: var(--ciarm-navy); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
          📋 Ver mis Solicitudes
        </button>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--ciarm-gold); letter-spacing: 0.08em;">SERVICIOS INTERNOS</div>
        <h1 class="form-page-title">Solicitudes internas</h1>
        <p class="form-page-subtitle">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
      </div>

      <div class="orientation-banner">
        <div>
          <div class="orientation-title">ORIENTACIÓN</div>
          <div class="orientation-main-text">¿Qué puedes solicitar?</div>
        </div>

        <div class="orientation-items-group">
          <div class="orientation-item">
            <svg class="orientation-icon" viewBox="0 0 24 24">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <div>
              <div class="orientation-item-title">Operaciones</div>
              <div class="orientation-item-desc">Apoyo logístico, espacios y servicios internos.</div>
            </div>
          </div>

          <div class="orientation-item">
            <svg class="orientation-icon" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <div>
              <div class="orientation-item-title">Mantenimiento</div>
              <div class="orientation-item-desc">Reparaciones, instalaciones y adecuaciones.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="user-audit-card">
        <div class="user-audit-avatar">${this.userData.initials}</div>
        <div class="user-audit-info">
          <div><strong>Solicitud realizada por:</strong> ${this.userData.name}</div>
          <div><strong>Correo institucional:</strong> ${this.userData.email} | <strong>Área:</strong> ${this.userData.area}</div>
        </div>
      </div>

      <form class="form-card-container" id="solicitud-form">
        <div class="form-grid-2col">
          <div>
            <label class="form-label">Área / Departamento Solicitante</label>
            <input type="text" class="form-control-select" value="${this.userData.area}" readonly style="background-color: #F1F5F9; color: #64748B;">
          </div>

          <div>
            <label class="form-label">Tipo de Solicitud</label>
            <select class="form-control-select" id="field-tipo-solicitud" required>
              <option value="" disabled selected>Selecciona una opción</option>
              <option value="SOPORTE_TI">Soporte Tecnológico / TI</option>
              <option value="MANTENIMIENTO">Mantenimiento Físico</option>
              <option value="RECURSOS_HUMANOS">Recursos Humanos / Capital Humano</option>
              <option value="INTENDENCIA_LOGISTICA">Limpieza e Intendencia / Logística</option>
            </select>
          </div>
        </div>

        <div class="form-group-full">
          <label class="form-label">Descripción del Requerimiento</label>
          <textarea class="form-control-textarea" id="field-descripcion" placeholder="Ingresa el detalle del requerimiento (mínimo 10 caracteres)..." required minlength="10"></textarea>
        </div>

        <div class="form-grid-2col">
          <div>
            <label class="form-label">¿Es Urgente?</label>
            <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
              <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.9rem;">
                <input type="radio" name="urgencia" value="SI"> Sí
              </label>
              <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.9rem;">
                <input type="radio" name="urgencia" value="NO" checked> No
              </label>
            </div>
          </div>

          <div id="container-fecha-requerida" style="display: none;">
            <label class="form-label">Fecha Requerida de Entrega</label>
            <input type="date" class="form-control-select" id="field-fecha-requerida">
          </div>
        </div>

        <div class="form-group-full" style="margin-top: 1rem;">
          <label class="form-label">Adjuntar archivos (Máximo 5 archivos, hasta 10 MB cada uno)</label>
          <span class="form-label-sub">Opcional</span>
          <div class="form-file-box">
            <input type="file" id="field-files-multi" multiple accept="*/*" style="display: block; font-size: 0.85rem;">
            <div id="files-list-preview" style="margin-top: 0.5rem; font-size: 0.8rem; color: #475569;"></div>
          </div>
        </div>

        <div class="form-actions-bar">
          <button type="submit" class="btn-submit-solicitud active" id="btn-submit-solicitud">
            Enviar solicitud
          </button>
        </div>
      </form>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const selectTipo = document.getElementById("field-tipo-solicitud");
    const containerFecha = document.getElementById("container-fecha-requerida");
    const inputFecha = document.getElementById("field-fecha-requerida");
    const inputFiles = document.getElementById("field-files-multi");
    const previewList = document.getElementById("files-list-preview");

    if (inputFecha) {
      inputFecha.min = new Date().toISOString().split("T")[0];
    }

    selectTipo?.addEventListener("change", (e) => {
      if (e.target.value === "INTENDENCIA_LOGISTICA") {
        containerFecha.style.display = "block";
        inputFecha.required = true;
      } else {
        containerFecha.style.display = "none";
        inputFecha.required = false;
        inputFecha.value = "";
      }
    });

    inputFiles?.addEventListener("change", (e) => {
      const files = Array.from(e.target.files);
      const MAX_FILES = 5;
      const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

      if (files.length > MAX_FILES) {
        alert(`⚠️ Solo se permite adjuntar un máximo de ${MAX_FILES} archivos por solicitud.`);
        inputFiles.value = "";
        previewList.innerHTML = "";
        this.selectedFiles = [];
        return;
      }

      const invalidFile = files.find(f => f.size > MAX_SIZE_BYTES);
      if (invalidFile) {
        alert(`⚠️ El archivo "${invalidFile.name}" supera el límite máximo permitido de 10 MB (${(invalidFile.size / (1024*1024)).toFixed(2)} MB).`);
        inputFiles.value = "";
        previewList.innerHTML = "";
        this.selectedFiles = [];
        return;
      }

      this.selectedFiles = files;
      previewList.innerHTML = `<strong>Archivos seleccionados (${files.length}):</strong><br>` + 
        files.map(f => `📄 ${f.name} (${(f.size / (1024*1024)).toFixed(2)} MB)`).join("<br>");
    });

    document.getElementById("btn-view-mis-solicitudes")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "view-mis-solicitudes" } }));
    });

    document.getElementById("btn-back-home")?.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "menu-inicio" } }));
    });

    document.getElementById("solicitud-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById("btn-submit-solicitud");
      btnSubmit.innerText = "⏳ Procesando adjuntos y enviando...";
      btnSubmit.disabled = true;

      try {
        const base64Files = await this.readFilesAsBase64(this.selectedFiles);
        const payload = {
          correo_solicitante: this.userData.email,
          nombre_solicitante: this.userData.name,
          area_solicitante: this.userData.area,
          tipo_solicitud: selectTipo.value,
          descripcion: document.getElementById("field-descripcion").value,
          urgencia: document.querySelector('input[name="urgencia"]:checked').value,
          fecha_requerida: inputFecha.value,
          adjuntos: base64Files
        };

        alert(`✅ Solicitud enviada con éxito con ${base64Files.length} archivo(s) adjunto(s).`);
        window.dispatchEvent(new CustomEvent("ciarm:navigation-change", { detail: { id: "view-mis-solicitudes" } }));
      } catch (err) {
        alert("❌ Error al procesar los archivos adjuntos.");
        btnSubmit.innerText = "Enviar solicitud";
        btnSubmit.disabled = false;
      }
    });
  }

  readFilesAsBase64(files) {
    return Promise.all(files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            base64Data: base64String
          });
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });
    }));
  }
}
