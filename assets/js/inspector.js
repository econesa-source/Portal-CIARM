/**
 * Extractor de Tokens y Activos Visuales - Portal CIARM
 * Instrucciones: Abre el portal CIARM actual en tu navegador, presiona F12 -> pestaña Console,
 * pega este código completo y presiona Enter.
 */
(() => {
  console.log("🚀 Extrayendo tokens de diseño del portal CIARM...");

  const colors = new Set();
  const fonts = new Set();
  const images = new Set();

  // 1. Escanear elementos y estilos computados
  document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
      const val = style[prop];
      if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') colors.add(val);
    });

    if (style.fontFamily) {
      style.fontFamily.split(',').forEach(font => fonts.add(font.trim().replace(/["']/g, '')));
    }
  });

  // 2. Escanear imágenes
  document.querySelectorAll('img').forEach(img => {
    if (img.src) images.add(img.src);
  });

  // Helper conversión RGB a HEX
  const rgbToHex = (rgbStr) => {
    const vals = rgbStr.match(/\d+/g);
    if (!vals || vals.length < 3) return rgbStr;
    const [r, g, b] = vals.map(Number);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
  };

  const hexColors = [...new Set(Array.from(colors).map(rgbToHex))];

  const tokens = {
    colors: hexColors,
    fonts: Array.from(fonts),
    images: Array.from(images)
  };

  console.log("✅ Extracción finalizada. Copiando tokens al portapapeles...");
  copy(JSON.stringify(tokens, null, 2));
  alert("¡Tokens copiados exitosamente! Pégalos en el archivo tokens.json de tu proyecto.");
})();
