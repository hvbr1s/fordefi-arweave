import Arweave from 'arweave';
import crypto from 'crypto';
import { Buffer } from 'buffer';
import { signWithApiSigner } from './signing/signer';
import { formRequest } from './api_request/form_request';
import { createAndSignTx } from './api_request/pushToApi';

// elliptic for decompressing pubkeys
import { ec as EC } from 'elliptic';

// Load environment vars (for FORDEFI_API_USER_TOKEN)
import dotenv from 'dotenv';
dotenv.config();
const accessToken = process.env.FORDEFI_API_USER_TOKEN ?? "";

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
  // 1) Start from a base64-encoded *compressed* pubkey fetched from Fordefi
  // --------------------------------------------------
  const compressedBase64 = "A4VJoRMaNKQd1bvKbjxl/xbcBH5dWooJ0v/QX/5K2tHE";
  
  // 1a) Decode from base64 into a 33-byte Buffer
  const compressedKeyBuf = Buffer.from(compressedBase64, 'base64');

  // 1b) Decompress with elliptic
  const ec = new EC('secp256k1');
  const keyPair = ec.keyFromPublic(compressedKeyBuf);
  const uncompressedHex = keyPair.getPublic(false, 'hex'); // false => uncompressed
  console.log("Uncompressed PubKey (hex):", uncompressedHex);

  // 1c) Convert uncompressed hex -> Buffer -> base64url
  const uncompressedBuf = Buffer.from(uncompressedHex, 'hex');
  const ownerB64Url = toBase64Url(uncompressedBuf);

  // --------------------------------------------------
  // 2) Create an Arweave transaction
  // --------------------------------------------------
  // You can point to the default Arweave gateway OR a specific node:
  // Peer phonebook -> https://arweave.net/peers
  const arweave = Arweave.init({
    host: '38.70.220.163',
    port: 1984,
    protocol: 'http'
  });

  // 2a) Create transaction skeleton
  const transaction = await arweave.createTransaction({
    target: 'uDoYWDDVtPzE8_FM3Od1K7Rh3HfWrMAOjkLA5OZ3SZw', // Random address
    quantity: arweave.ar.arToWinston('1'), // e.g., 1 AR
  });

  // 2b) Set the "owner" field to the uncompressed pubkey in base64url
  transaction.owner = ownerB64Url;
  // And specify the signature type for ECDSA secp256k1
  transaction.signatureType = 2;

  // --------------------------------------------------
  // 3) Get signature data
  // --------------------------------------------------
  const signatureData = await transaction.getSignatureData();
  const signatureDataB64 = Buffer.from(signatureData).toString('base64');

  // --------------------------------------------------
  // 4) Send the signature request to Fordefi
  // --------------------------------------------------
  // Prepare the JSON request body
  const fordefiVault = "7ca4970b-c69b-42ab-8853-4172e88d94ad"; // Fordefi vault ID
  const requestBody = JSON.stringify(await formRequest(fordefiVault, signatureDataB64));

  const pathEndpoint = '/api/v1/transactions/create-and-wait';
  const timestamp = new Date().getTime();
  const payload = `${pathEndpoint}|${timestamp}|${requestBody}`;

  const signature = await signWithApiSigner(payload);

  // Call Fordefi
  const response = await createAndSignTx(pathEndpoint, accessToken, signature, timestamp, requestBody);
  const fordDefiResult = await response.data;

  const sig = fordDefiResult.signatures[0];
  if (!sig) {
    throw new Error('Signature not returned from Fordefi!');
  }
  console.log("Signature from Fordefi:", sig);

  // --------------------------------------------------
  // 5) Attach signature & compute transaction ID
  // --------------------------------------------------
  const rawSignature = Buffer.from(sig, 'base64');

  // Arweave wants signatures in base64url
  transaction.signature = toBase64Url(rawSignature);

  // For Arweave, tx.id = SHA-256 of the raw signature
  const sigHash = crypto.createHash('sha256').update(rawSignature).digest();
  transaction.id = toBase64Url(sigHash);

  // --------------------------------------------------
  // 6) Post the fully signed transaction
  // --------------------------------------------------
  const txObject = transaction.toJSON();
  console.log("Arweave Transaction (JSON):", txObject);

  // Convert JSON back into a Transaction object
  const txParsed = arweave.transactions.fromRaw(txObject);

  const postResponse = await arweave.transactions.post(txParsed);
  if ([200, 202].includes(postResponse.status)) {
    console.log('Transaction posted successfully!');
    console.log('Transaction ID:', transaction.id);
  } else {
    console.error('Error posting transaction:', postResponse.status, postResponse.statusText);
  }
}

main().catch((error) => {
  if (error.response && error.response.data) {
    console.error('Detailed error:', {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data,
      validation: error.response.data.validation,
    });
  } else {
    console.error('Error:', error);
  }
});