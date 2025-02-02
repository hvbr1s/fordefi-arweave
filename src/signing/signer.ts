import fs from 'fs';
import * as crypto from 'crypto';

const privateKeyFilePath = './src/fordefi_secret/private.pem';
const privateKeyPem = fs.readFileSync(privateKeyFilePath, 'utf8');

export async  function signWithApiSigner(payload: string): Promise<string> {


  console.log('Prepare to sign transaction 🖋️')
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const sign = crypto.createSign('SHA256').update(payload, 'utf8').end();
  const signature = sign.sign(privateKey, 'base64');
  console.log('Transaction signed! ✅')

  return signature
}