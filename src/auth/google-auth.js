/**
 * Compatibilidad de autenticación - Portal CIARM
 * Versión: 18.0.0
 *
 * El flujo productivo vive en services/authService.js + components/loginWidget.js.
 * Se conserva este archivo únicamente para imports históricos.
 */

export {
  GOOGLE_CLIENT_ID,
  getAuthenticatedUser,
  authenticateGoogleCredential,
  logout
} from '../services/authService.js';
