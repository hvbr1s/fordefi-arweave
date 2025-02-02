import Arweave from 'arweave';
import { ec as EC } from 'elliptic';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';

// Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

const bip32 = BIP32Factory(ecc);

// Fordefi Black-box Vault xpub
const xpub = "xpub661MyMwAqRbcFCvjYemPD3f6o3da15jDYLgW9PzyJv6RJN7uwraUpXoXUGqWQs8xWVtqetvFF4AkW1NnHrPWCf1KQoxGSDbFuAbbr5uFBUg";

// 1. Derive the child *public key*.
const node = bip32.fromBase58(xpub);
const childNode = node.derive(1);
const compressedPubKey = childNode.publicKey;

// 2. Decompress it with 'elliptic'.
const ec = new EC('secp256k1');
const key = ec.keyFromPublic(compressedPubKey);
const uncompressedPoint = key.getPublic(false, 'hex');  // 'false' => uncompressed
// `uncompressedPoint` is a hex string of length 130 (0x04 + 64 bytes)

// 3. Convert to a Uint8Array (or Buffer).
const pubBytes = Buffer.from(uncompressedPoint, 'hex'); // length 65

// 4. Convert to base64url (Arweave’s “owner” format).
function bufToB64Url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
const ownerB64Url = bufToB64Url(pubBytes);

// 5. Finally, derive the address from the “owner”.
arweave.wallets.ownerToAddress(ownerB64Url)
  .then((address: string) => {
    console.log("Derived Arweave Address (public-only):", address);
    
    // Get balance for the derived address
    return arweave.wallets.getBalance(address);
  })
  .then((balance) => {
    let winston = balance;
    let ar = arweave.ar.winstonToAr(balance);

    console.log("Balance in Winston:", winston);
    console.log("Balance in AR:", ar);
  })
  .catch(console.error);

  // address -> CNj6gP3BU0rpzt-y-RGU5pmAwKoPBkNeRzXoOEnz7BQ