import type { ExtensionStateSnapshot } from './extensionBridge';

export const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export async function nativeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}
export function publishDesktopSnapshot(snapshot: ExtensionStateSnapshot) {
  return nativeCommand<{ connected: boolean }>('publish_desktop_snapshot', { snapshot });
}
