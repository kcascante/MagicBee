import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Sanitización del lado del servidor
function sanitizeText(value: string): string {
  return value
    .replace(/[<>'"`;]/g, '')
    .replace(/(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|SCRIPT)\b/gi, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
}

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\-']/g, '').trim()
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orgName: rawOrg, firstName: rawFirst, lastName: rawLast, email: rawEmail, password } = body

    // Sanitizar entradas del servidor
    const orgName = sanitizeText(String(rawOrg ?? ''))
    const firstName = sanitizeName(String(rawFirst ?? ''))
    const lastName = sanitizeName(String(rawLast ?? ''))
    const email = sanitizeText(String(rawEmail ?? '')).toLowerCase()

    // Validación del lado del servidor
    if (!orgName || orgName.length < 2 || orgName.length > 100) {
      return NextResponse.json({ error: 'El nombre del negocio debe tener entre 2 y 100 caracteres' }, { status: 400 })
    }
    if (!firstName || firstName.length < 2 || firstName.length > 50) {
      return NextResponse.json({ error: 'El nombre debe tener entre 2 y 50 caracteres' }, { status: 400 })
    }
    if (!lastName || lastName.length < 2 || lastName.length > 50) {
      return NextResponse.json({ error: 'Los apellidos deben tener entre 2 y 50 caracteres' }, { status: 400 })
    }
    if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'El correo electrónico no es válido' }, { status: 400 })
    }
    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'La contraseña debe tener entre 8 y 128 caracteres' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const cleanEmail = email
    const fullName = `${firstName} ${lastName}`
    const slug = orgName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      + '-' + Math.random().toString(36).substring(2, 7)

    // Verificar si el correo ya existe
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const emailExists = existingUsers?.users.some(u => u.email === cleanEmail)
    if (emailExists) {
      return NextResponse.json({ error: 'Este correo ya está registrado. Inicia sesión.' }, { status: 400 })
    }

    // Paso 1: Crear usuario con Service Role (sin rate limit, auto-confirmado)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: `Error al crear la cuenta: ${authError?.message}` }, { status: 400 })
    }

    // Paso 2: Crear organización
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName, slug })
      .select()
      .single()

    if (orgError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: `Error al crear el negocio: ${orgError.message}` }, { status: 400 })
    }

    // Paso 3: Crear perfil de usuario
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        organization_id: org.id,
        role: 'admin',
        full_name: fullName,
        email: cleanEmail,
      })

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('organizations').delete().eq('id', org.id)
      return NextResponse.json({ error: `Error al crear el perfil: ${userError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error inesperado. Intenta de nuevo.' }, { status: 500 })
  }
}