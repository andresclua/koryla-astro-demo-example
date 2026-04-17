# Cómo funciona un experimento Edge en Koryla

> **En una frase:** El servidor reescribe la URL antes de que Astro renderice — el navegador nunca sabe que existe una segunda página.

## Qué estamos haciendo

Tenemos dos páginas separadas:
- `src/pages/demo-edge.astro` → layout centrado (control)
- `src/pages/demo-edge-b.astro` → layout 2 columnas (variante B)

El navegador siempre ve `/demo-edge`. El edge function decide en silencio qué página sirve.

## Por qué "Edge"

"Edge" significa que el código corre en el borde de la red (CDN/Netlify), antes de llegar a tu servidor. En Netlify se llama "Edge Function" y corre en Deno (no Node.js).

## El flujo completo

```
GET /demo-edge
     │
     ▼
┌──────────────────────────────────────────┐
│  netlify/edge-functions/koryla.ts         │
│                                          │
│  1. Pide config de Koryla API (caché 60s)│
│  2. Encuentra experimento para /demo-edge│
│  3. ¿Cookie ky_<id>? → usa variante      │
│     guardada (sticky)                    │
│  4. ¿Sin cookie? → random 50/50          │
│                                          │
│  Si control:                             │
│    context.next() → sirve demo-edge.astro│
│                                          │
│  Si variante B:                          │
│    context.rewrite('/demo-edge-b')       │
│    → sirve demo-edge-b.astro             │
│    → navegador sigue viendo /demo-edge   │
│                                          │
│  5. Set-Cookie ky_<id>=<variant-uuid>    │
└──────────────────────────────────────────┘
     │
     ▼
HTML de control o variante B
(mismo URL, distinto contenido)
```

## Lo que NO toca el edge function

- ❌ No modifica HTML
- ❌ No inyecta JavaScript
- ❌ No hace redirect (302) — el navegador no se entera
- ❌ No afecta al ranking SEO

## Configurar en el dashboard

| Campo | Valor |
|-------|-------|
| Type | Edge |
| Base URL | https://tu-sitio.com/demo-edge |
| Control — Target URL | https://tu-sitio.com/demo-edge |
| Variant B — Target URL | https://tu-sitio.com/demo-edge-b |
| Traffic split | 50% / 50% |

## Probarlo

El 50% de las visitas ven la variante B. Para forzarla, borra la cookie `ky_<id>` en DevTools → Application → Cookies y recarga varias veces hasta que te toque variante B.
