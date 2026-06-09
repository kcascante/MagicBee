import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { orgName, firstName, lastName, email, password } = body

    // Validación del lado del servidor
    if (!orgName || orgName.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre del negocio debe tener al menos 2 caracteres' }, { status: 400 })
    }
    if (!firstName || firstName.trim().length < 2) {
      return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
    }
    if (!lastName || lastName.trim().length < 2) {
      return NextResponse.json({ error: 'Los apellidos deben tener al menos 2 caracteres' }, { status: 400 })
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'El correo electrónico no es válido' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const cleanEmail = email.trim().toLowerCase()
    const fullName = `${firstName.trim()} ${lastName.trim()}`
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
      .insert({ name: orgName.trim(), slug })
      .select()
      .single()

    if (orgError) {
      // Rollback: borrar el usuario si falla la organización
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
      // Rollback
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('organizations').delete().eq('id', org.id)
      return NextResponse.json({ error: `Error al crear el perfil: ${userError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Error inesperado. Intenta de nuevo.' }, { status: 500 })
  }
}