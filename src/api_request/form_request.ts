export async function formRequest(vault_id: string, signatureDataB64: any){

    const requestJson =  {
        vault_id: vault_id,
        note: 'Testing sending AR',
        signer_type: 'api_signer',
        sign_mode: 'auto',
        type: 'black_box_signature',
        details: {
          format: 'hash_binary',
          hash_binary: signatureDataB64,
        },
        wait_for_state: 'signed'
      }

    return requestJson
}
