export function renderDashboardWidget(containerElement, onNavigate) {
  if (!containerElement) return;

  // Actualizar Escudo en el Header si existe
  const logoEl = document.querySelector('.logo-icon') || document.querySelector('.brand-logo');
  if (logoEl) {
    logoEl.innerHTML = `
      <svg width="32" height="38" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 20 H90 V32 H10 Z M20 20 V32 M40 20 V32 M60 20 V32 M80 20 V32" stroke="white" stroke-width="4" fill="none"/>
        <path d="M10 38 C10 38 10 85 50 110 C90 85 90 38 90 38 Z" stroke="white" stroke-width="5" fill="none"/>
        <path d="M22 46 C22 46 22 80 50 100 C78 80 78 46 78 46 Z" stroke="white" stroke-width="4" fill="none"/>
        <path d="M50 52 L32 88 H42 L50 72 L58 88 H68 L50 52 Z" fill="white"/>
      </svg>
    `;
  }

  containerElement.innerHTML = `
    <div style="padding: 1.5rem; max-width: 1200px; margin: 0 auto; font-family: system-ui, -apple-system, sans-serif;">
      
      <!-- Banner Asistente CIARM con Marco Dorado Superior -->
      <div style="background: linear-gradient(135deg, #1B2B48 0%, #2A4365 100%); border-radius: 12px; padding: 2rem; color: white; margin-bottom: 2rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); position: relative; border-top: 5px solid #C5A059;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <h1 style="margin: 0; font-size: 1.8rem; font-weight: bold; color: #FFF;">Asistente CIARM</h1>
            <p style="margin: 0.5rem 0 0 0; color: #CBD5E1; font-size: 0.95rem;">Consulta normativa, procesos y herramientas del colegio.</p>
          </div>
          <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #C5A059; font-weight: bold;">CONSULTA INSTITUCIONAL</span>
        </div>

        <!-- Contenedor Oficial para el Widget de Voiceflow -->
        <div id="voiceflow-chat-container" style="min-height: 200px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(197, 160, 89, 0.4); margin-top: 1rem; padding: 0.5rem;">
          <p style="color: #CBD5E1; font-size: 0.85rem; text-align: center; margin-top: 2rem;">Iniciando Asistente CIARM...</p>
        </div>
      </div>

      <!-- Grid de 6 Tarjetas con Borde Superior Dorado (#C5A059) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        <!-- Tarjeta 1: Solicitudes internas -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
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
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">BIBLIOTECA CIARM</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Libros y Papers</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Busca bibliografía académica, consulta fuentes y propón o inicia una investigación.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Acceder a Biblioteca</button>
        </div>

        <!-- Tarjeta 3: Normas y herramientas -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">FICHE - SISTEMA INTEGRAL DE CUMPLIMIENTO</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Normas y herramientas</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Consulta normativa aplicable, protocolos, formatos, hojas de registro y genera informes.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Consultar Normativa</button>
        </div>

        <!-- Tarjeta 4: Comunicados -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">COMUNICACIÓN INSTITUCIONAL</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Comunicados</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Consulta avisos, novedades y comunicaciones institucionales relevantes para tu función.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Ver Comunicados</button>
        </div>

        <!-- Tarjeta 5: Administración -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span style="font-size: 0.7rem; text-transform: uppercase; color: #64748B; font-weight: 600;">SIGCGE - SISTEMA DE CONTROL DE GESTIÓN</span>
            <h3 style="color: #1E293B; margin: 0.5rem 0; font-size: 1.2rem;">Administración</h3>
            <p style="color: #64748B; font-size: 0.875rem; line-height: 1.4; margin: 0;">Órdenes de compra, reportes y herramientas administrativas habilitadas para tu perfil.</p>
          </div>
          <button style="margin-top: 1.5rem; width: 100%; background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 0.6rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer;">Gestión Administrativa</button>
        </div>

        <!-- Tarjeta 6: IB -->
        <div style="background: #FFF; border-radius: 12px; padding: 1.5rem; border: 1px solid #E2E8F0; border-top: 5px solid #C5A059; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; flex-direction: column; justify-content: space-between;">
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

  if (document.getElementById('voiceflow-script')) {
    loadVF();
    return;
  }

  const script = document.createElement('script');
  script.id = 'voiceflow-script';
  script.src = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
  script.type = "text/javascript";
  script.onload = loadVF;
  document.head.appendChild(script);
}
