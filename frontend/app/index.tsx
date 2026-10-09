import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  Platform,
  Linking,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera } from "expo-camera";
import { WebView } from "react-native-webview";

const APP_URL = process.env.EXPO_PUBLIC_BACKEND_URL
  ? `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/app/`
  : "https://kynaro.preview.emergentagent.com/api/app/";

// Domain check: allow only our app's domain and subpaths
function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const appParsed = new URL(APP_URL);
    return parsed.hostname === appParsed.hostname;
  } catch {
    return false;
  }
}

export default function Index() {
  const webviewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Request camera permissions on mount (needed for WebView camera access)
  useEffect(() => {
    (async () => {
      try {
        await Camera.requestCameraPermissionsAsync();
      } catch {}
    })();
  }, []);

  // Android back button: navigate back in WebView first
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack && webviewRef.current) {
        webviewRef.current.goBack();
        return true; // prevent app close
      }
      return false; // let system handle (close app)
    });
    return () => handler.remove();
  }, [canGoBack]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    webviewRef.current?.reload();
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState: { canGoBack: boolean; url: string }) => {
      setCanGoBack(navState.canGoBack);
    },
    []
  );

  const handleShouldStartLoad = useCallback(
    (event: { url: string }): boolean => {
      const { url } = event;
      // Allow internal URLs
      if (isInternalUrl(url)) return true;
      // Open external URLs in system browser
      Linking.openURL(url).catch(() => {});
      return false;
    },
    []
  );

  if (hasError) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.errorContent}>
          <Text style={styles.errorIcon}>📡</Text>
          <Text style={styles.errorTitle}>Sem conexão</Text>
          <Text style={styles.errorSubtitle}>
            Não foi possível carregar o aplicativo.
          </Text>
          <TouchableOpacity
            testID="retry-button"
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#a3e635" />
          <Text style={styles.loadingText}>Carregando Kynaro...</Text>
        </View>
      )}
      <WebView
        ref={webviewRef}
        testID="main-webview"
        source={{ uri: APP_URL }}
        style={styles.webview}
        // JS & storage
        javaScriptEnabled
        domStorageEnabled
        // Media & camera
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        // iOS navigation
        allowsBackForwardNavigationGestures
        // Refresh
        pullToRefreshEnabled
        // Cookies
        sharedCookiesEnabled
        // Android file access
        allowFileAccess
        // Allow all origins
        originWhitelist={["*"]}
        // Events
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          if (nativeEvent.statusCode >= 500) {
            setHasError(true);
          }
        }}
        // WebView settings
        startInLoadingState={false}
        allowsFullscreenVideo
        allowsProtectedMedia
        setSupportMultipleWindows={false}
        webviewDebuggingEnabled={__DEV__}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111418",
  },
  webview: {
    flex: 1,
    backgroundColor: "#111418",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#111418",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadingText: {
    color: "#9ca3af",
    fontSize: 15,
    marginTop: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#111418",
  },
  errorContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorSubtitle: {
    color: "#9ca3af",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: "#a3e635",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  retryText: {
    color: "#111418",
    fontSize: 16,
    fontWeight: "700",
  },
});
