// Test using Deno's crypto API - same as our Edge Function

// Official Svix test case
const secret = 'whsec_plJ3nmyCDGBKInavdOK15jsl';
const payload = '{"event_type":"ping","data":{"success":true}}';
const msgId = 'msg_loFOjxBNrRLzqYUf';
const timestamp = '1731705121';
const expectedSignature = 'rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=';

async function verifySvixSignature() {
  // Decode the secret - it's in format "whsec_XXXXX" where XXXXX is base64 encoded
  const secretParts = secret.split('_');
  
  // Base64 decode the secret using atob (like in Edge Function)
  const secretBytes = Uint8Array.from(atob(secretParts[1]), c => c.charCodeAt(0));
  console.log('Decoded secret length:', secretBytes.length);
  
  // Svix signs the format: webhook-id.webhook-timestamp.body
  const signedContent = `${msgId}.${timestamp}.${payload}`;
  console.log('Signed content:', signedContent);
  console.log('Signed content length:', signedContent.length);
  
  // Use Web Crypto API to sign
  const encoder = new TextEncoder();
  const messageData = encoder.encode(signedContent);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  console.log('\nResults:');
  console.log('Expected:', expectedSignature);
  console.log('Computed:', computed);
  console.log('Match:', computed === expectedSignature ? '✅ YES' : '❌ NO');
}

verifySvixSignature();
