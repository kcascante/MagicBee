const GRAPH_API_VERSION = 'v21.0'

/**
 * Envia un mensaje de texto por WhatsApp Cloud API.
 * phoneNumberId y accessToken vienen de organizations.whatsapp_phone_number_id
 * y organizations.whatsapp_access_token (configurados desde Settings).
 */
export async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`WhatsApp send failed (${res.status}): ${errText}`)
  }

  return res.json()
}

/**
 * Envia un mensaje de imagen por WhatsApp Cloud API, referenciando una URL
 * publica (ej. la imagen de un servicio en Supabase Storage).
 */
export async function sendWhatsAppImage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string) {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: caption ? { link: imageUrl, caption } : { link: imageUrl },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`WhatsApp image send failed (${res.status}): ${errText}`)
  }

  return res.json()
}
