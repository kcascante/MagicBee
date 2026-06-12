const GRAPH_API_VERSION = 'v21.0'
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

function isTransientError(errText: string): boolean {
  try {
    const parsed = JSON.parse(errText)
    return parsed?.error?.is_transient === true || parsed?.error?.code === 2
  } catch {
    return false
  }
}

/**
 * POST generico al endpoint /messages de WhatsApp Cloud API, con reintento
 * automatico cuando Meta devuelve un error transitorio
 * (is_transient: true / code: 2, "retry your request later").
 */
async function postMessage(phoneNumberId: string, accessToken: string, payload: object, label: string) {
  let lastError = ''

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (res.ok) return res.json()

    lastError = await res.text()

    if (attempt < MAX_RETRIES && isTransientError(lastError)) {
      console.warn(`[whatsapp] ${label} error transitorio, reintentando (intento ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
      continue
    }

    throw new Error(`${label} failed (${res.status}): ${lastError}`)
  }

  throw new Error(`${label} failed: ${lastError}`)
}

/**
 * Envia un mensaje de texto por WhatsApp Cloud API.
 * phoneNumberId y accessToken vienen de organizations.whatsapp_phone_number_id
 * y organizations.whatsapp_access_token (configurados desde Settings).
 */
export async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, to: string, text: string) {
  return postMessage(
    phoneNumberId,
    accessToken,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    'WhatsApp send'
  )
}

/**
 * Envia un mensaje de imagen por WhatsApp Cloud API, referenciando una URL
 * publica (ej. la imagen de un servicio en Supabase Storage).
 */
export async function sendWhatsAppImage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string) {
  return postMessage(
    phoneNumberId,
    accessToken,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: caption ? { link: imageUrl, caption } : { link: imageUrl },
    },
    'WhatsApp image send'
  )
}
