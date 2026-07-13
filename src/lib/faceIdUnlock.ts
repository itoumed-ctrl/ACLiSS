"use client";

// 管理画面をFace ID/Touch IDで解錠するための機能。
//
// PWAはネイティブアプリと違い、生体認証をサーバー側の認証として直接使うには
// 本格的な仕組み（WebAuthn + サーバー側での署名検証、パスキー管理）が必要になる。
// ここではそこまでは行わず、「合言葉をこの端末のブラウザに保存しておき、
// 次回以降はFace ID/Touch IDで解錠してから自動入力する」という、
// あくまで端末内の利便性向上として実装している。
// 実際の認証（正しい合言葉かどうか）は、これまで通りサーバー側
// （/api/admin/verify-passcode）で毎回行われる。
//
// 注意点として、合言葉はこの端末のlocalStorageに平文で保存される。
// Face IDはあくまで「この画面をすぐ開けるようにするための鍵」であり、
// 端末そのものを他人に操作された場合（ロック解除後にアプリを触られる等）の
// 保護にはならない。

const CREDENTIAL_ID_KEY = "acliss_faceid_credential_id";
const PASSCODE_KEY = "acliss_faceid_passcode";
const RP_NAME = "ACLiSS";

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** この端末でFace ID/Touch IDなどの生体認証（プラットフォーム認証器）が使えそうか。 */
export async function isFaceIdAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** この端末に既にFace ID解錠を設定済みかどうか。 */
export function hasFaceIdSetup(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(CREDENTIAL_ID_KEY);
}

/** この端末にFace ID解錠を設定する。 */
export async function setupFaceId(passcode: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: RP_NAME, id: window.location.hostname },
        user: { id: userId, name: "acliss-admin", displayName: "ACLiSS管理者" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    localStorage.setItem(CREDENTIAL_ID_KEY, bufferToBase64url(credential.rawId));
    localStorage.setItem(PASSCODE_KEY, passcode);
    return true;
  } catch {
    return false;
  }
}

/** Face IDで解錠する。成功したら保存されている合言葉を返す（失敗時はnull）。 */
export async function unlockWithFaceId(): Promise<string | null> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return null;
  const credentialId = localStorage.getItem(CREDENTIAL_ID_KEY);
  const passcode = localStorage.getItem(PASSCODE_KEY);
  if (!credentialId || !passcode) return null;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ id: base64urlToBuffer(credentialId), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return assertion ? passcode : null;
  } catch {
    return null;
  }
}

/** この端末のFace ID設定を解除する。 */
export function clearFaceId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CREDENTIAL_ID_KEY);
  localStorage.removeItem(PASSCODE_KEY);
}

/** 合言葉変更時、Face IDが設定済みならこの端末の保存値も更新する。 */
export function updateFaceIdPasscode(newPasscode: string): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CREDENTIAL_ID_KEY)) {
    localStorage.setItem(PASSCODE_KEY, newPasscode);
  }
}
