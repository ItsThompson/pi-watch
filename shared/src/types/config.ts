export interface PiWatchConfig {
  ghostMode: boolean;
  ghostOpacity: number;
  visible: boolean;
  soundEnabled: boolean;
}

export const DEFAULT_CONFIG: PiWatchConfig = {
  ghostMode: false,
  ghostOpacity: 0.3,
  visible: true,
  soundEnabled: true,
};
