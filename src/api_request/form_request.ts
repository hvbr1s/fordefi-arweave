export async function formRequest(vault_id: string, signatureDataB64: any){

    const requestJson =  {
        vault_id: vault_id,
        note: 'Sending AR via MPC!',
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: 'black_box_signature',
        details: {
          format: 'hash_binary',
          hash_binary: signatureDataB64,
        },
      }

    return requestJson
}
