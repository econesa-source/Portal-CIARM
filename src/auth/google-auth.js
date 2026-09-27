/**
 * Módulo de Autenticación Google Workspace - Portal CIARM
 * Soporta Modo Real (OIDC GIS) y Modo Desarrollo/Mock si no hay Client ID configurado.
 */

const AUTH_CONFIG = {
  CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  ALLOWED_DOMAIN: "ciarm.edu.mx",
  STORAGE_KEY: "ciarm_user_session"
};

class AuthManager {
  constructor(config = {}) {
    this.config = { ...AUTH_CONFIG, ...config };
    this.currentUser = null;
  }

  init() {
    this.checkExistingSession();
    
    if (this.isPlaceholderClientId()) {
      console.warn("⚠️ [AuthManager] Client ID no configurado. Operando en Modo Desarrollo (Mock).");
      this.renderMockButton();
    } else {
      this.loadSDK()
        .then(() => this.renderGoogleButton())
        .catch(() => this.renderMockButton());
    }
  }

  isPlaceholderClientId() {
    return !this.config.CLIENT_ID || this.config.CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID");
  }

  loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) return resolve();
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Error al cargar Google Identity SDK"));
      document.head.appendChild(script);
    });
  }

  renderGoogleButton() {
    const container = document.getElementById("google-auth-container");
    if (!container || this.currentUser) return;

    window.google.accounts.id.initialize({
      client_id: this.config.CLIENT_ID,
      callback: (res) => this.handleCredentialResponse(res),
      hosted_domain: this.config.ALLOWED_DOMAIN
    });

    container.innerHTML = "";
    window.google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "medium",
      type: "standard"
    });
  }

  renderMockButton() {
    const container = document.getElementById("google-auth-container");
    if (!container || this.currentUser) return;

    container.innerHTML = `
      <button id="mock-login-btn" style="background: #1A365D; color: white; border: 1px solid #ffffff44; padding: 0.4rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
        🔑 Iniciar Sesión (Modo Dev)
      </button>
    `;

    document.getElementById("mock-login-btn")?.addEventListener("click", () => {
      const mockUser = {
        id: "mock-12345",
        email: "usuario@ciarm.edu.mx",
        name: "Rodrigo Valencia (Dev)",
        picture: "https://ui-avatars.com/api/?name=Rodrigo+Valencia&background=0D9488&color=fff",
        domain: "ciarm.edu.mx"
      };
      this.currentUser = mockUser;
      sessionStorage.setItem(this.config.STORAGE_KEY, JSON.stringify(mockUser));
      this.updateUI();
      window.dispatchEvent(new CustomEvent("ciarm:auth-success", { detail: mockUser }));
    });
  }

  checkExistingSession() {
    const saved = sessionStorage.getItem(this.config.STORAGE_KEY);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
        this.updateUI();
        window.dispatchEvent(new CustomEvent("ciarm:auth-success", { detail: this.currentUser }));
      } catch (e) {
        sessionStorage.removeItem(this.config.STORAGE_KEY);
      }
    }
  }

  updateUI() {
    const container = document.getElementById("google-auth-container");
    if (!container) return;

    if (this.currentUser) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${this.currentUser.picture}" alt="${this.currentUser.name}" style="width: 32px; height: 32px; border-radius: 50%;">
          <div style="display: flex; flex-direction: column; text-align: right; font-size: 0.8rem;">
            <strong>${this.currentUser.name}</strong>
            <span style="opacity: 0.8;">${this.currentUser.email}</span>
          </div>
          <button id="logout-btn" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Salir</button>
        </div>
      `;

      document.getElementById("logout-btn")?.addEventListener("click", () => this.logout());
    }
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem(this.config.STORAGE_KEY);
    const container = document.getElementById("google-auth-container");
    if (container) container.innerHTML = "";
    
    if (this.isPlaceholderClientId()) {
      this.renderMockButton();
    } else {
      this.renderGoogleButton();
    }
    window.dispatchEvent(new CustomEvent("ciarm:auth-logout"));
  }
}

export const authManager = new AuthManager();

document.addEventListener("DOMContentLoaded", () => {
  authManager.init();
});
