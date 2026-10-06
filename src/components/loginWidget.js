/**
 * Componente de Login Institucional - Portal CIARM
 * Versión: 18.0.1
 */

import {
  GOOGLE_CLIENT_ID,
  authenticateGoogleCredential
} from '../services/authService.js';

export function renderLoginWidget(container, onLoginSuccess) {
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; min-height:calc(100vh - 140px); background-color:#F8FAFC; padding:20px; box-sizing:border-box;">
      <div style="background:#ffffff; border-radius:8px; border-top:5px solid #C1B27E; box-shadow:0 4px 16px rgba(0,0,0,0.08); width:100%; max-width:520px; padding:40px 30px; text-align:center; box-sizing:border-box;">
        <h1 style="color:#26487F; font-family:Kefa, Georgia, 'Times New Roman', serif; font-size:2.2rem; margin:0 0 15px 0; font-weight:bold;">
          Portal CIARM
        </h1>

        <p style="color:#475569; font-size:0.95rem; line-height:1.5; margin:0 0 30px 0;">
          Información, herramientas y procesos institucionales del<br>
          <strong>Colegio Internacional Alemán de la Riviera Maya.</strong>
        </p>

        <div style="margin-bottom:25px;">
          <span style="font-size:0.75rem; font-weight:700; color:#64748B; letter-spacing:1px; text-transform:uppercase;">
            INGRESÁ CON TU CUENTA INSTITUCIONAL
          </span>
        </div>

        <div id="google-btn-wrapper" style="display:flex; justify-content:center; margin-bottom:16px; min-height:44px;"></div>

        <div id="login-status" style="min-height:22px; color:#991B1B; font-size:0.82rem; margin-bottom:10px;" aria-live="polite"></div>

        <div style="border-top:1px solid #F1F5F9; padding-top:15px; margin-top:18px;">
          <small style="color:#94A3B8; font-size:0.8rem;">
            Acceso exclusivo para colaboradores activos con cuenta <strong>@ciarm.edu.mx</strong>
          </small>
        </div>
      </div>
    </div>
  `;

  mountGoogleButton(onLoginSuccess);
}

async function mountGoogleButton(onLoginSuccess) {
  const wrapper = document.getElementById('google-btn-wrapper');
  const status = document.getElementById('login-status');

  if (!wrapper) return;

  try {
    await waitForGoogleIdentity();

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      callback: async (response) => {
        if (!response?.credential) {
          showLoginError(status, 'No se recibió una credencial válida de Google.');
          return;
        }

        status.textContent = 'Validando cuenta institucional...';

        try {
          const user = await authenticateGoogleCredential(response.credential);
          status.textContent = '';
          if (typeof onLoginSuccess === 'function') {
            onLoginSuccess(user);
          }
        } catch (error) {
          console.error('Fallo de acceso institucional:', error?.code || error);
          const message =
            error?.code === 'access_not_enabled'
              ? 'La cuenta fue autenticada, pero no está habilitada como colaborador activo en CIARM.'
              : error?.code === 'authentication_service_unavailable'
                ? 'El servicio de validación institucional no está disponible en este momento.'
                : 'No fue posible iniciar sesión con esta cuenta institucional.';
          showLoginError(status, message);
          window.google?.accounts?.id?.disableAutoSelect?.();
        }
      }
    });

    wrapper.innerHTML = '';
    window.google.accounts.id.renderButton(wrapper, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: 340
    });

  } catch (error) {
    console.error('No se pudo cargar Google Identity Services:', error);
    showLoginError(status, 'No se pudo cargar el acceso de Google. Actualizá la página e intentá nuevamente.');
  }
}

function waitForGoogleIdentity(timeoutMs = 10000) {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        reject(new Error('Google Identity Services no respondió a tiempo.'));
        return;
      }

      setTimeout(check, 100);
    };

    check();
  });
}

function showLoginError(container, message) {
  if (container) container.textContent = message;
}
