import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#111418" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#111418" },
          animation: "none",
        }}
      />
    </SafeAreaProvider>
  );
}
