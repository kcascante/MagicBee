import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

/**
 * Verificacion del webhook por parte de Meta.
 * Meta llama a esta URL con hub.mode=subscribe, hub.verify_token y
 * hub.challenge cuando configurás el webhook en el panel de desarrolladores.
 * Debe responder con el challenge tal cual si el token coincide.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

/**
 * Mensajes entrantes de WhatsApp.
 * Por ahora responde con un mensaje de confirmacion (eco) mientras se
 * integra la IA de agendamiento. Siempre responde 200 para que Meta no
 * reintente en bucle, incluso si algo falla internamente.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const entry = body?.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    const phoneNumberId: string | undefined = value?.metadata?.phone_number_id
    const message = value?.messages?.[0]

    // Ignorar webhooks que no son mensajes entrantes (ej. status updates: sent/delivered/read)
    if (!phoneNumberId || !message) {
      return NextResponse.json({ ok: true })
    }

    const from: string = message.from
    const text: string = message.text?.body ?? ''
    const contactName: string = value?.contacts?.[0]?.profile?.name ?? ''

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, whatsapp_access_token')
      .eq('whatsapp_phone_number_id', phoneNumberId)
      .maybeSingle()

    if (!org || !org.whatsapp_access_token) {
      console.error('whatsapp webhook: no organization configured for phone_number_id', phoneNumberId)
      return NextResponse.json({ ok: true })
    }

    // Guardar el mensaje entrante en la sesion de conversacion (historial para la IA)
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('id, messages')
      .eq('organization_id', org.id)
      .eq('phone_number', from)
      .maybeSingle()

    const incomingEntry = { role: 'user', content: text, at: new Date().toISOString() }
    const replyText = `¡Hola${contactName ? ' ' + contactName.split(' ')[0] : ''}! Soy el asistente de ${org.name}. Recibimos tu mensaje: "${text}". Muy pronto voy a poder ayudarte a agendar, consultar o cancelar tu cita por aquí.`
    const outgoingEntry = { role: 'assistant', content: replyText, at: new Date().toISOString() }

    if (session) {
      const messages = Array.isArray(session.messages) ? session.messages : []
      await supabase
        .from('whatsapp_sessions')
        .update({ messages: [...messages, incomingEntry, outgoingEntry] })
        .eq('id', session.id)
    } else {
      await supabase
        .from('whatsapp_sessions')
        .insert({
          organization_id: org.id,
          phone_number: from,
          messages: [incomingEntry, outgoingEntry],
        })
    }

    await sendWhatsAppMessage(phoneNumberId, org.whatsapp_access_token, from, replyText)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('whatsapp webhook error', err)
    return NextResponse.json({ ok: true })
  }
}
