import { AppState, type AppStateStatus } from "react-native";
import { apiFetch } from "./api";

export function startPresenceHeartbeat() {
  let active = true;
  let timer: ReturnType<typeof setInterval> | null = null;

  const beat = () => {
    if (!active) return;
    void apiFetch("/api/presence", { method: "POST" }).catch(() => {});
  };

  const start = () => {
    if (timer) clearInterval(timer);
    beat();
    timer = setInterval(beat, 25_000);
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    void apiFetch("/api/presence", { method: "DELETE" }).catch(() => {});
  };

  const handleState = (nextState: AppStateStatus) => {
    active = nextState === "active";
    if (active) start();
    else stop();
  };

  const subscription = AppState.addEventListener("change", handleState);
  start();

  return () => {
    active = false;
    subscription.remove();
    if (timer) clearInterval(timer);
    timer = null;
    void apiFetch("/api/presence", { method: "DELETE" }).catch(() => {});
  };
}
