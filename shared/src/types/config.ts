export interface PiWatchConfig {
  ghostMode: boolean;
  ghostOpacity: number;
  visible: boolean;
}

export const DEFAULT_CONFIG: PiWatchConfig = {
  ghostMode: false,
  ghostOpacity: 0.3,
  visible: true,
};
