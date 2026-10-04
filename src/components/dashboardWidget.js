export function renderDashboardWidget(containerElement, onNavigate) {
  if (!containerElement) return;

  containerElement.innerHTML = `
    <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
      
      <!-- Banner Asistente CIARM con Contenedor de Chat Embedded -->
      <div style="background: linear-gradient(135deg, #1B2B48 0%, #2A4365 100%); border-radius: 12px; padding: 2rem; color: white; margin-bottom: 2rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <h1 style="margin: 0; font-size: 1.8rem; font-weight: bold; color: #FFF;">Asistente CIARM</h1>
            <p style="margin: 0.5rem 0 0 0; color: #CBD5E1; font-size: 0.95rem;">Consulta normativa, procesos y herramientas del colegio en tiempo real.</p>
          </div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #C5A059; font-weight: bold;">CONSULTA INSTITUCIONAL</span>
        </div>

        <!-- Contenedor Oficial para el Widget de Voiceflow -->
        <div id="voiceflow-chat-container" style="min-height: 220px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px dashed rgba(255, 255, 255, 0.2); margin-top: 1rem; padding: 0.5rem;">
          <p style="color: #CBD5E1; font-size: 0.85rem; text-align: center; margin-top: 2rem;">Iniciando Asistente CIARM...</p>
        </div>
      </div>

      <!-- Grid de 6 Tarjetas -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        <!-- Tarjeta 1: Solicitudes internas -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">SERVICIOS INTERNOS</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Solicitudes internas</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Realiza solicitudes de Operaciones, Mantenimiento y otros servicios internos.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
            <a href="#solicitudes" style="flex: 1; text-align: center; background: #1B2B48; color: #FFF; padding: 0.6rem 0.5rem; border-radius: 6px; font-weight: bold; font-size: 0.85rem; text-decoration: none;">+ Crear Solicitud</a>
            <a href="#mis-solicitudes" style="flex: 1; text-align: center; background: #C5A059; color: #FFF; padding: 0.6rem 0.5rem; border-radius: 6px; font-weight: bold; font-size: 0.85rem; text-decoration: none;">📋 Mis Solicitudes</a>
          </div>
        </div>

        <!-- Tarjeta 2: Libros y Papers -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">BIBLIOTECA CIARM</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Libros y Papers</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Busca bibliografía académica, consulta fuentes y propón o inicia una investigación.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Acceder a Biblioteca</button>
        </div>

        <!-- Tarjeta 3: Normas y herramientas -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">FICHE - SISTEMA INTEGRAL DE CUMPLIMIENTO</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Normas y herramientas</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Consultar Normativa</button>
        </div>

        <!-- Tarjeta 4: Comunicados -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">COMUNICACIÓN INSTITUCIONAL</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Comunicados</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Ver Comunicados</button>
        </div>

        <!-- Tarjeta 5: Administración -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">SIGCGE - SISTEMA DE CONTROL DE GESTIÓN</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Administración</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Órdenes de compra, reportes y herramientas administrativas habilitadas para tu perfil.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Gestión Administrativa</button>
        </div>

        <!-- Tarjeta 6: IB -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">BACHILLERATO INTERNACIONAL</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">IB</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Accede a documentación, programas, recursos y herramientas correspondientes a tu función.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Acceso Módulo IB</button>
        </div>

      </div>
    </div>
  `;

  // Carga defensiva e inyección del SDK de Voiceflow
  setTimeout(() => {
    initVoiceflowWidget();
  }, 100);
}

function initVoiceflowWidget() {
  const targetEl = document.getElementById('voiceflow-chat-container');
  if (!targetEl) return;

  const loadVF = () => {
    if (window.voiceflow && window.voiceflow.chat) {
      window.voiceflow.chat.load({
        verify: { projectID: '6a81e72529695cfeb738ad6e' },
        url: 'https://general-runtime.voiceflow.com',
        voice: {
          url: "https://runtime-api.voiceflow.com"
        },
        render: {
          mode: 'embedded',
          target: targetEl
        }
      });
    }
  };

  // Verificar si el script ya fue inyectado previamente
  if (document.getElementById('voiceflow-script')) {
    loadVF();
    return;
  }

  // Inyectar dinámicamente el SDK de Voiceflow
  const script = document.createElement('script');
  script.id = 'voiceflow-script';
  script.src = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
  script.type = "text/javascript";
  script.onload = loadVF;
  document.head.appendChild(script);
}
