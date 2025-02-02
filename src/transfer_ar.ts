import Arweave from 'arweave';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import { signWithApiSigner } from './signing/signer';
import { formRequest } from './api_request/form_request'
import { createAndSignTx } from './api_request/pushToApi'

// BIP32 for deriving from xpub
import { BIP32Factory } from 'bip32';
import * as ecc from 'tiny-secp256k1';
import dotenv from 'dotenv'

// elliptic for decompressing pubkeys
import { ec as EC } from 'elliptic';

// Get Fordefi API token
dotenv.config()
const accessToken = process.env.FORDEFI_API_USER_TOKEN ?? ""

// Create a BIP32 instance
const bip32 = BIP32Factory(ecc);

// Convert Buffer -> base64url
function toBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function main() {
  // --------------------------------------------------
  // 1) Derive the uncompressed public key from xpub
  // --------------------------------------------------

  // Replace with your actual xpub from Fordefi
  const xpub = 'xpub661MyMwAqRbcFCvjYemPD3f6o3da15jDYLgW9PzyJv6RJN7uwraUpXoXUGqWQs8xWVtqetvFF4AkW1NnHrPWCf1KQoxGSDbFuAbbr5uFBUg';

  // 1a) Get the bip32 node from xpub
  const node = bip32.fromBase58(xpub);

  // 1b) Derive the child public key (for example, index 0)
  const childNode = node.derive(0);
  const compressedPubKey = childNode.publicKey; // 33-byte compressed key

  // 1c) Decompress with elliptic
  const ec = new EC('secp256k1');
  const key = ec.keyFromPublic(compressedPubKey);
  const uncompressedHex = key.getPublic(false, 'hex'); // false => uncompressed

  // 1d) Convert to Buffer => base64url
  const pubBytes = Buffer.from(uncompressedHex, 'hex'); // length 65
  const ownerB64Url = toBase64Url(pubBytes);


  // --------------------------------------------------
  // 2) Create an Arweave transaction
  // --------------------------------------------------
  const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
  });

  // 2a) Create transaction skeleton
  // This transaction sends 1 AR to the target address
  const transaction = await arweave.createTransaction({
    target: 'r4IUcaIB-mYX6-SZ202azgfBVeayjaJU8-LRXto_ki4', // Binance address
    quantity: arweave.ar.arToWinston('0.1'),
  });

  // 2b) Set the "owner" field to your uncompressed public key
  transaction.owner = ownerB64Url;

  // --------------------------------------------------
  // 3) Prepare chunks & get signature data
  // --------------------------------------------------
  await transaction.prepareChunks(new Uint8Array());

  // “Signature data” is the exact bytes that must be signed, it comes as a data buffer
  const signatureData = await transaction.getSignatureData();

  // --------------------------------------------------
  // 4) Send the signature request to Fordefi
  // --------------------------------------------------
  const signatureDataB64 = Buffer.from(signatureData).toString('base64');

  const fordefiVault = "7ca4970b-c69b-42ab-8853-4172e88d94ad"
  const requestBody = JSON.stringify(await formRequest(fordefiVault, signatureDataB64));


  const pathEndpoint = '/api/v1/transactions/create-and-wait';
  const timestamp = new Date().getTime();
  const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;

  const signature = await signWithApiSigner(payload);

  // Example call to Fordefi's black-box signature endpoint:
  const response = await createAndSignTx(pathEndpoint, accessToken, signature, timestamp, requestBody)
  const fordDefiResult = await response.data;
  console.log(fordDefiResult)
  if (!fordDefiResult.signatures[0]) {
    throw new Error('Signature not returned from Fordefi!');
  }

  // --------------------------------------------------
  // 5) Attach signature & compute transaction ID
  // --------------------------------------------------
  const rawSignature = Buffer.from(fordDefiResult.signatures[0], 'base64');
  transaction.signature = toBase64Url(rawSignature);

  // For Arweave, tx.id = SHA-256 of the raw signature
  const sigHash = crypto.createHash('sha256').update(rawSignature).digest();
  transaction.id = toBase64Url(sigHash);

  // --------------------------------------------------
  // 6) Post the fully signed transaction
  // --------------------------------------------------
  const postResponse = await arweave.transactions.post(transaction);
  if ([200, 202].includes(postResponse.status)) {
    console.log('Transaction posted successfully!');
    console.log('Transaction ID:', transaction.id);
  } else {
    console.error('Error posting transaction:', postResponse.status, postResponse.statusText);
  }
}

main().catch(console.error);