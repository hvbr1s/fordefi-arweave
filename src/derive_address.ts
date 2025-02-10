import Arweave from 'arweave';
import { ec as EC } from 'elliptic';
import { Buffer } from 'buffer';

// 1) Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

// 2) The base64-encoded compressed public key from Fordefi
const compressedBase64 = "A4VJoRMaNKQd1bvKbjxl/xbcBH5dWooJ0v/QX/5K2tHE";

// 3) Decode base64 -> Buffer (33 bytes for a secp256k1 compressed key)
const compressedKeyBuf = Buffer.from(compressedBase64, 'base64');

// 4) Decompress it with 'elliptic'.
const ec = new EC('secp256k1');
const key = ec.keyFromPublic(compressedKeyBuf);
const uncompressedHex = key.getPublic(false, 'hex');  // 'false' => uncompressed
// `uncompressedHex` is a hex string of length 130 (1 byte prefix + 64 bytes)

// 5) Convert the uncompressed key to a Uint8Array (or Buffer).
const pubBytes = Buffer.from(uncompressedHex, 'hex'); // length 65

// 6) Convert to base64url (Arweave “owner” format).
function bufToB64Url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
const ownerB64Url = bufToB64Url(pubBytes);
console.log("Owner ->", ownerB64Url);

// 7) Finally, derive the address from the “owner”.
arweave.wallets.ownerToAddress(ownerB64Url)
  .then((address: string) => {
    console.log("Derived Arweave Address (public-only):", address);

    // Get balance for the derived address
    return arweave.wallets.getBalance(address);
  })
  .then((balance) => {
    const winston = balance;
    const ar = arweave.ar.winstonToAr(winston);

    console.log("Balance in Winston:", winston);
    console.log("Balance in AR:", ar);
  })
  .catch(console.error);