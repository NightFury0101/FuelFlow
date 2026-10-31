// Sharing and saving files/text in a way that works everywhere:
//  - store apps: write the file to the app's cache (Capacitor Filesystem) and open the system
//    share sheet (Capacitor Share) — Save to Files, WhatsApp, Viber, email, AirDrop…
//  - browsers: the Web Share API when it can share files (most phones), otherwise a download.

import { isNativeApp } from './platform';

type Bridge = {
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  PluginHeaders?: Array<{ name: string }>;
};
const bridge = () => (typeof window === 'undefined' ? undefined : (window as Window & { Capacitor?: Bridge }).Capacitor);
const hasPlugin = (name: string) => {
  const b = bridge();
  return !!b?.nativePromise && (!b.PluginHeaders || b.PluginHeaders.some((p) => p.name === name));
};

export type ShareResult = 'shared' | 'saved' | 'copied' | 'cancelled' | 'failed';

const isCancel = (e: unknown) => /cancel|abort/i.test(String((e as { name?: string; message?: string })?.name ?? '') + String((e as { message?: string })?.message ?? ''));

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Share or save a file. `preferShare` opens the share sheet on phones' browsers too. */
export async function shareFile(blob: Blob, name: string, opts: { title?: string; preferShare?: boolean } = {}): Promise<ShareResult> {
  if (isNativeApp() && hasPlugin('Filesystem') && hasPlugin('Share')) {
    try {
      const b = bridge()!;
      const data = await blobToBase64(blob);
      const { uri } = (await b.nativePromise!('Filesystem', 'writeFile', { path: name, data, directory: 'CACHE' })) as { uri: string };
      await b.nativePromise!('Share', 'share', { title: opts.title ?? name, files: [uri], dialogTitle: opts.title ?? 'Share' });
      return 'shared';
    } catch (e) {
      return isCancel(e) ? 'cancelled' : 'failed';
    }
  }
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if ((opts.preferShare || isNativeApp()) && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: opts.title ?? name });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
    }
  }
  try {
    download(blob, name);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Share text (messaging apps), falling back to copying it. */
export async function shareText(textToShare: string, title?: string): Promise<ShareResult> {
  if (isNativeApp() && hasPlugin('Share')) {
    try {
      await bridge()!.nativePromise!('Share', 'share', { title, text: textToShare, dialogTitle: title ?? 'Share' });
      return 'shared';
    } catch (e) {
      return isCancel(e) ? 'cancelled' : 'failed';
    }
  }
  if (navigator.share && matchMedia?.('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title, text: textToShare });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(textToShare);
    return 'copied';
  } catch {
    return 'failed';
  }
}
