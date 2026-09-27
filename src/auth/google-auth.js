/**
 * Módulo de Autenticación Google Workspace - Portal CIARM
 * Gestiona el inicio de sesión OIDC con Google Identity Services.
 */

// Configuración de autenticación con el dominio actualizado
const AUTH_CONFIG = {
  CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  ALLOWED_DOMAIN: "ciarm.edu.mx", // Dominio institucional corregido
  STORAGE_KEY: "ciarm_user_session"
};

class AuthManager {
  constructor(config = {}) {
    this.config = { ...AUTH_CONFIG, ...config };
    this.currentUser = null;
  }

  /**
   * Inicializa el SDK de Google Identity Services
   */
  init() {
    this.loadSDK()
      .then(() => {
        this.checkExistingSession();
        this.renderGoogleButton();
      })
      .catch(err => {
        console.error("❌ Error al cargar Google Identity SDK:", err);
      });
  }

  /**
   * Carga dinámicamente la librería de Google si no está presente
   */
  loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Falló la carga de GIS SDK"));
      document.head.appendChild(script);
    });
  }

  /**
   * Configura y renderiza el botón oficial de inicio de sesión de Google
   */
  renderGoogleButton() {
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: this.config.CLIENT_ID,
      callback: (response) => this.handleCredentialResponse(response),
      hosted_domain: this.config.ALLOWED_DOMAIN
    });

    const container = document.getElementById("google-auth-container");
    if (container && !this.currentUser) {
      container.innerHTML = "";
      window.google.accounts.id.renderButton(container, {
        theme: "outline",
        size: "medium",
        type: "standard",
        shape: "rectangular",
        text: "signin_with",
        logo_alignment: "left"
      });
    }
  }

  /**
   * Decodifica la respuesta JWT recibida de Google y valida el dominio
   */
  handleCredentialResponse(response) {
    try {
      const payload = this.parseJwt(response.credential);

      // Validación estricta de dominio institucional
      if (this.config.ALLOWED_DOMAIN && payload.hd !== this.config.ALLOWED_DOMAIN) {
        this.showAuthError(`Acceso denegado. Debes iniciar sesión con una cuenta @${this.config.ALLOWED_DOMAIN}`);
        return;
      }

      // Estructura de usuario validada
      this.currentUser = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        domain: payload.hd,
        token: response.credential
      };

      // Guardar sesión y emitir evento
      sessionStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(this.currentUser));
      this.updateUI();
      
      window.dispatchEvent(new CustomEvent("ciarm:auth-success", { detail: this.currentUser }));

    } catch (error) {
      console.error("❌ Error al procesar credenciales de Google:", error);
      this.showAuthError("Error al validar la sesión con Google.");
    }
  }

  /**
   * Decodifica un token JWT base64 sin dependencias externas
   */
  parseJwt(token) {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  }

  /**
   * Verifica si existe una sesión previa guardada en sessionStorage
   */
  checkExistingSession() {
    const savedSession = sessionStorage.getItem(this.config.STORAGE_KEY);
    if (savedSession) {
      try {
        this.currentUser = JSON.parse(savedSession);
        this.updateUI();
        window.dispatchEvent(new CustomEvent("ciarm:auth-success", { detail: this.currentUser }));
      } catch (e) {
        sessionStorage.removeItem(this.config.STORAGE_KEY);
      }
    }
  }

  /**
   * Actualiza el Header de la UI según el estado de la sesión
   */
  updateUI() {
    const container = document.getElementById("google-auth-container");
    if (!container) return;

    if (this.currentUser) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${this.currentUser.picture}" alt="${this.currentUser.name}" style="width: 32px; height: 32px; border-radius: 50%;">
          <div style="display: flex; flex-direction: column; text-align: right; font-size: 0.85rem;">
            <strong>${this.currentUser.name}</strong>
            <span style="opacity: 0.8;">${this.currentUser.email}</span>
          </div>
          <button id="logout-btn" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Salir</button>
        </div>
      `;

      document.getElementById("logout-btn")?.addEventListener("click", () => this.logout());
    }
  }

  showAuthError(message) {
    alert(message);
    this.logout();
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem(this.config.STORAGE_KEY);
    
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    const container = document.getElementById("google-auth-container");
    if (container) {
      container.innerHTML = "";
    }
    
    this.renderGoogleButton();
    window.dispatchEvent(new CustomEvent("ciarm:auth-logout"));
  }
}

export const authManager = new AuthManager();

document.addEventListener("DOMContentLoaded", () => {
  authManager.init();
});
