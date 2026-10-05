/**
 * Componente de Pantalla de Login Institucional - Portal CIARM
 * Versión: 13.0.0 (Look & Feel Oficial)
 */

export function renderLoginWidget(container, onLoginSuccess) {
  if (!container) return;

  container.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 140px); background-color: #F8FAFC; padding: 20px; box-sizing: border-box;">
      <div style="background: #ffffff; border-radius: 8px; border-top: 5px solid #C5A059; box-shadow: 0 4px 16px rgba(0,0,0,0.08); width: 100%; max-width: 520px; padding: 40px 30px; text-align: center; box-sizing: border-box;">
        
        <h1 style="color: #0A192F; font-family: 'Times New Roman', Georgia, serif; font-size: 2.2rem; margin: 0 0 15px 0; font-weight: bold;">
          Portal CIARM
        </h1>

        <p style="color: #475569; font-size: 0.95rem; line-height: 1.5; margin: 0 0 30px 0;">
          Información, herramientas y procesos institucionales del<br>
          <strong>Colegio Internacional Alemán de la Riviera Maya.</strong>
        </p>

        <div style="margin-bottom: 25px;">
          <span style="font-size: 0.75rem; font-weight: 700; color: #64748B; letter-spacing: 1px; text-transform: uppercase;">
            INGRESÁ CON TU CUENTA INSTITUCIONAL
          </span>
        </div>

        <div id="google-btn-wrapper" style="display: flex; justify-content: center; margin-bottom: 20px; min-height: 44px;">
          <button id="btn-login-demo" style="background:#0A192F; color:#FFF; border:none; padding:12px 24px; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.9rem;">
            🔑 Iniciar Sesión con Google (@ciarm.edu.mx)
          </button>
        </div>

        <div style="border-top: 1px solid #F1F5F9; padding-top: 15px; margin-top: 25px;">
          <small style="color: #94A3B8; font-size: 0.8rem;">
            Acceso exclusivo con cuenta <strong>@ciarm.edu.mx</strong>
          </small>
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-login-demo')?.addEventListener('click', () => {
    const demoUser = {
      nombre: 'Ezequiel Conesa',
      correo: 'econesa@ciarm.edu.mx',
      foto: '',
      token: 'demo-token'
    };
    
    sessionStorage.setItem('ciarm_user_session', JSON.stringify(demoUser));
    if (onLoginSuccess) onLoginSuccess(demoUser);
  });
}
