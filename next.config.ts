import type { NextConfig } from "next";

const securityHeaders = [
  // Evita que la app se cargue en iframes externos (clickjacking)
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // Previene MIME type sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Política de referrer segura
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // Previene XSS en navegadores antiguos
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  // Solo HTTPS (HSTS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Limita permisos de APIs del navegador
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Content Security Policy
  // 'unsafe-inline' en style-src es necesario para Tailwind/CSS-in-JS
  // 'unsafe-eval' en script-src es necesario para Next.js en desarrollo
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",   // unsafe-eval solo para dev; en prod se puede quitar
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['sharp'],
  async headers() {
    return [
      {
        // Aplica a todas las rutas
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
