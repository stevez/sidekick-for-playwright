// ─── Optional permissions ───────────────────────────────────────────────────
// Video and downloads are optional_permissions in the manifest so a fresh install
// only asks for what recording and running need. Request them on first use;
// this must run inside the click/keypress that triggered the feature.

export const VIDEO_PERMISSIONS = ['tabCapture', 'offscreen'];
export const DOWNLOAD_PERMISSIONS = ['downloads'];

/** Ask for `permissions` if not granted yet. Returns false if the user declines. */
export async function ensurePermissions(permissions: string[]): Promise<boolean> {
    const perms = { permissions } as chrome.permissions.Permissions;
    if (await chrome.permissions.contains(perms)) return true;
    return chrome.permissions.request(perms);
}
