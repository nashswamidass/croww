import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Typography from '../Typography';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

function buildViewerHtml(assetUrl, posterUrl, title = 'Spatial Walkthrough') {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
  body, html { width: 100%; height: 100%; overflow: hidden; background: #0b0f19; color: #fff; font-family: -apple-system, sans-serif; }
  #viewer { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
  #poster { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url("${posterUrl || ''}") center/cover no-repeat; filter: brightness(0.5) blur(4px); transition: opacity 0.5s; }
  #loader { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; gap: 12px; }
  .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .bar-wrap { width: 160px; height: 5px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden; }
  .bar { width: 0%; height: 100%; background: #3b82f6; transition: width 0.2s; }
  #error-box { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 20; background: #0b0f19; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; gap: 12px; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js",
    "@mkkellogg/gaussian-splats-3d": "https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.7/+esm"
  }
}
</script>
</head>
<body>
<div id="poster"></div>
<div id="viewer"></div>
<div id="loader">
  <div class="spinner"></div>
  <div style="font-size:13px; color:#cbd5e1" id="label">Loading Spatial Walkthrough…</div>
  <div class="bar-wrap"><div class="bar" id="bar"></div></div>
</div>
<div id="error-box">
  <div style="font-size:16px; font-weight:600">Spatial Walkthrough isn't available on this device.</div>
  <div style="font-size:13px; color:#94a3b8">Photos and property facts remain available.</div>
</div>
<script type="module">
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

const assetUrl = "${assetUrl || ''}";
const bar = document.getElementById('bar');
const label = document.getElementById('label');
const loader = document.getElementById('loader');
const poster = document.getElementById('poster');
const errorBox = document.getElementById('error-box');

function post(action, data = {}) {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ action, ...data }));
  }
}

if (!assetUrl) {
  loader.style.display = 'none';
  errorBox.style.display = 'flex';
  post('error', { message: 'No asset URL' });
} else {
  try {
    const viewer = new GaussianSplats3D.Viewer({
      rootElement: document.getElementById('viewer'),
      cameraUp: [0, 1, 0],
      initialCameraPosition: [0, 1.2, 3],
      initialCameraLookAt: [0, 1.0, 0],
      gpuAcceleratedSort: true,
      sharedMemoryForWorkers: false,
      useBuiltInControls: true,
    });

    const format = assetUrl.endsWith('.ksplat')
      ? GaussianSplats3D.SceneFormat.KSplat
      : (assetUrl.endsWith('.ply') ? GaussianSplats3D.SceneFormat.Ply : GaussianSplats3D.SceneFormat.Splat);

    viewer.addSplatScene(assetUrl, {
      format,
      streamView: true,
      progressiveLoad: true,
      onProgress: (pct) => {
        const p = Math.round(pct);
        bar.style.width = p + '%';
        label.textContent = 'Loading ' + p + '%';
      }
    }).then(() => {
      loader.style.opacity = '0';
      poster.style.opacity = '0';
      setTimeout(() => { loader.style.display = 'none'; poster.style.display = 'none'; }, 400);
      viewer.start();
      post('ready');
    }).catch((err) => {
      console.error(err);
      loader.style.display = 'none';
      errorBox.style.display = 'flex';
      post('error', { message: err?.message });
    });
  } catch (err) {
    loader.style.display = 'none';
    errorBox.style.display = 'flex';
    post('error', { message: err?.message });
  }
}
</script>
</body>
</html>`;
}

const Property3DViewer = ({
    descriptor,
    onClose,
    onViewPhotos,
    onReset,
}) => {
    const [loading, setLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const webViewRef = useRef(null);
    const assetUrl = descriptor?.assetUrl || null;
    const posterUrl = descriptor?.posterUrl || null;

    // Timeout safety: if load takes > 25 seconds, fallback gracefully
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (loading && !hasError) {
                setLoading(false);
                setHasError(true);
            }
        }, 25000);
        return () => clearTimeout(timeout);
    }, [loading, hasError]);

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent?.data || '{}');
            if (data.action === 'ready') {
                setLoading(false);
            } else if (data.action === 'close') {
                if (onClose) onClose();
            } else if (data.action === 'error') {
                setLoading(false);
                setHasError(true);
            }
        } catch {}
    };

    if (!assetUrl || hasError) {
        return (
            <View style={styles.errorContainer}>
                {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={styles.errorPoster} />
                ) : (
                    <View style={styles.errorIconCircle}>
                        <Ionicons name="cube-outline" size={36} color={COLORS.secondary} />
                    </View>
                )}
                <Typography variant="h3" style={styles.errorTitle}>
                    {"Spatial Walkthrough isn't available on this device."}
                </Typography>
                <Typography variant="body" style={styles.errorBody}>
                    Photos and property facts remain available.
                </Typography>
                <View style={styles.controlsRow}>
                    {onViewPhotos ? (
                        <TouchableOpacity
                            onPress={onViewPhotos}
                            style={styles.actionBtn}
                            accessibilityRole="button"
                            accessibilityLabel="View Photos"
                        >
                            <Typography variant="caption" style={styles.actionBtnText}>View photos</Typography>
                        </TouchableOpacity>
                    ) : null}
                    {onClose ? (
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.actionBtnSecondary}
                            accessibilityRole="button"
                            accessibilityLabel="Close Walkthrough"
                        >
                            <Typography variant="caption" style={styles.actionBtnSecondaryText}>Close</Typography>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        );
    }

    const htmlContent = buildViewerHtml(assetUrl, posterUrl);

    return (
        <View style={styles.container}>
            <WebView
                ref={webViewRef}
                originWhitelist={['*']}
                source={{ html: htmlContent, baseUrl: 'https://cdn.jsdelivr.net' }}
                style={styles.webview}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                onMessage={handleMessage}
                onError={() => {
                    setLoading(false);
                    setHasError(true);
                }}
            />
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Typography variant="caption" style={styles.loadingText}>
                        Starting Spatial Walkthrough…
                    </Typography>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0b0f19', position: 'relative' },
    webview: { flex: 1, backgroundColor: 'transparent' },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0b0f19',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.m,
        zIndex: 5,
    },
    loadingText: { color: COLORS.white },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.xl,
        backgroundColor: COLORS.background,
    },
    errorPoster: {
        width: '100%',
        height: 180,
        borderRadius: BORDER_RADIUS.m,
        marginBottom: SPACING.l,
    },
    errorIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.m,
    },
    errorTitle: { textAlign: 'center', marginBottom: SPACING.s },
    errorBody: { textAlign: 'center', color: COLORS.secondary, marginBottom: SPACING.l },
    controlsRow: { flexDirection: 'row', gap: SPACING.m },
    actionBtn: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: 20,
    },
    actionBtnText: { color: COLORS.white, fontWeight: '600' },
    actionBtnSecondary: {
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.l,
        paddingVertical: 10,
        borderRadius: 20,
    },
    actionBtnSecondaryText: { color: COLORS.primary },
});

export default Property3DViewer;
