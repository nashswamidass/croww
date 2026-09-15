/**
 * Isolated 3D viewer HTML. No Firestore. No splat decoder bundled in V1.
 * Used by web iframe / future native WebView. Does not claim Gaussian Splatting works.
 */
export function buildSpatialViewerHtml({ assetUrl, posterUrl, assetFormat } = {}) {
    const url = JSON.stringify(assetUrl || '');
    const poster = JSON.stringify(posterUrl || '');
    const format = JSON.stringify(assetFormat || 'gaussian_splat');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Croww 3D viewer</title>
  <style>
    html, body { margin: 0; height: 100%; background: #111; color: #eee; font-family: system-ui, sans-serif; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; }
    img { max-width: 100%; max-height: 40vh; object-fit: contain; border-radius: 8px; }
    p { line-height: 1.4; }
  </style>
</head>
<body>
  <div class="wrap" id="root"></div>
  <script>
    const assetUrl = ${url};
    const posterUrl = ${poster};
    const assetFormat = ${format};
    const root = document.getElementById('root');
    function canvasGl() {
      try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      } catch (e) { return false; }
    }
    function msg(title, body) {
      root.innerHTML = (posterUrl ? '<img alt="3D tour poster" src="' + posterUrl.replace(/"/g, '') + '" />' : '')
        + '<p><strong>' + title + '</strong></p><p>' + body + '</p>';
    }
    const webgl = canvasGl();
    window.parent && window.parent.postMessage({ source: 'croww-3d', webgl: webgl, format: assetFormat, hasAsset: !!assetUrl }, '*');
    if (!webgl) {
      msg('3D unavailable on this device', 'WebGL is not available. View photos instead.');
    } else if (!assetUrl) {
      msg('3D tour unavailable', 'No READY 3D asset is attached.');
    } else {
      msg('3D unavailable on this device', 'A compatible Gaussian Splat renderer is not bundled in this build. Photos remain available.');
    }
  </script>
</body>
</html>`;
}
