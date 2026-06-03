// E2EE Utility — Web Crypto API (RSA-OAEP + AES-GCM hybrid encryption)

const DB_NAME = 'ChatSphereE2EE';
const STORE_NAME = 'keys';

// ── IndexedDB Helpers ─────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveToIDB(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getFromIDB(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// ── Key Helpers ───────────────────────────────────────────────────────────────
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ── Generate RSA-OAEP Keypair ─────────────────────────────────────────────────
async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
  return keyPair;
}

// ── Export public key to base64 (spki) ────────────────────────────────────────
async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  return arrayBufferToBase64(exported);
}

// ── Import public key from base64 (spki) ─────────────────────────────────────
async function importPublicKey(base64) {
  const buffer = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    'spki',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

// ── Export private key to base64 (pkcs8) ──────────────────────────────────────
async function exportPrivateKey(privateKey) {
  const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
  return arrayBufferToBase64(exported);
}

// ── Import private key from base64 (pkcs8) ────────────────────────────────────
async function importPrivateKey(base64) {
  const buffer = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    'pkcs8',
    buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

// ── initE2EE — called on login/register ───────────────────────────────────────
// Generates keypair if not already stored, then uploads public key to server.
export async function initE2EE(api) {
  try {
    let privateKeyB64 = await getFromIDB('privateKey');
    let publicKeyB64 = await getFromIDB('publicKey');

    if (!privateKeyB64 || !publicKeyB64) {
      const keyPair = await generateKeyPair();
      privateKeyB64 = await exportPrivateKey(keyPair.privateKey);
      publicKeyB64 = await exportPublicKey(keyPair.publicKey);
      await saveToIDB('privateKey', privateKeyB64);
      await saveToIDB('publicKey', publicKeyB64);
    }

    // Upload public key to server
    await api.put('/api/users/public-key', { publicKey: publicKeyB64 });
  } catch (err) {
    console.error('initE2EE failed:', err);
  }
}

// ── loadPrivateKey — returns CryptoKey from IDB ───────────────────────────────
export async function loadPrivateKey() {
  const privateKeyB64 = await getFromIDB('privateKey');
  if (!privateKeyB64) return null;
  return importPrivateKey(privateKeyB64);
}

// ── getPublicKey — returns base64 public key string ───────────────────────────
export async function getPublicKey() {
  return getFromIDB('publicKey');
}

// ── encryptMessage — hybrid RSA+AES encryption ────────────────────────────────
// Generates a random AES-GCM key, encrypts the plaintext with it, then wraps
// the AES key with both the recipient's and sender's RSA public keys.
// Returns: { encryptedContent, encryptedKey, senderEncryptedKey, iv } all as base64 strings.
export async function encryptMessage(plaintext, recipientPublicKeyBase64) {
  // Import recipient's RSA public key
  const recipientKey = await importPublicKey(recipientPublicKeyBase64);

  // Also get sender's own public key for dual-key encryption
  const senderPublicKeyBase64 = await getPublicKey();

  // Generate random AES-256-GCM key
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the message with AES-GCM
  const encoder = new TextEncoder();
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(plaintext)
  );

  // Export the AES key and encrypt it with recipient's RSA-OAEP key
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    recipientKey,
    rawAesKey
  );

  // Also encrypt AES key with sender's own public key (so sender can decrypt their own messages)
  let senderEncryptedAesKey = null;
  if (senderPublicKeyBase64) {
    const senderKey = await importPublicKey(senderPublicKeyBase64);
    senderEncryptedAesKey = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      senderKey,
      rawAesKey
    );
  }

  return {
    encryptedContent: arrayBufferToBase64(encryptedBuffer),
    encryptedKey: arrayBufferToBase64(encryptedAesKey),
    senderEncryptedKey: senderEncryptedAesKey ? arrayBufferToBase64(senderEncryptedAesKey) : null,
    iv: arrayBufferToBase64(iv),
  };
}

// ── decryptMessage — hybrid RSA+AES decryption ────────────────────────────────
// Unwraps the AES key with our RSA private key, then decrypts the ciphertext.
export async function decryptMessage(encryptedContentB64, encryptedKeyB64, ivB64, privateKey) {
  // Decrypt the AES key using our private RSA key
  const encryptedAesKey = base64ToArrayBuffer(encryptedKeyB64);
  const rawAesKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedAesKey
  );

  // Import the raw AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Decrypt the message content
  const iv = base64ToArrayBuffer(ivB64);
  const encryptedContent = base64ToArrayBuffer(encryptedContentB64);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedContent
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}
