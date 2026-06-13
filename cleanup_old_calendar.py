import os

def main():
    print("🧹 Limpieza de calendario antiguo...\n")
    
    # 1. Eliminar archivo CSS viejo
    css_file = "src/components/appointments.css"
    if os.path.exists(css_file):
        os.remove(css_file)
        print(f"✓ Eliminado: {css_file}")
    else:
        print(f"⊘ No encontrado: {css_file}")
    
    # 2. Reemplazar AppointmentsClient.tsx
    old_client = "src/components/AppointmentsClient.tsx"
    new_client = "src/components/AppointmentsClientNew.tsx"
    
    if os.path.exists(new_client):
        if os.path.exists(old_client):
            os.remove(old_client)
            print(f"✓ Eliminado: {old_client} (viejo)")
        os.rename(new_client, old_client)
        print(f"✓ Renombrado: AppointmentsClientNew.tsx -> AppointmentsClient.tsx")
    
    print("\n✅ LIMPIEZA COMPLETADA\n")
    print("Próximos pasos:")
    print("  1. npm install")
    print("  2. git add -A")
    print("  3. git commit -m 'cleanup: elimina calendario casero y CSS antiguo'")
    print("  4. git push")
    print("  5. npm run dev para probar")

if __name__ == "__main__":
    main()
