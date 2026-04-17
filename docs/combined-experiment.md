# Cómo funciona un experimento Edge + SDK combinado

> **En una frase:** Edge decide qué página sirves (layout grande); SDK decide qué componente renders dentro (detalle fino). Dos experimentos independientes, dos niveles de control.

## Cuándo usarlo

Cuando el test principal cambia la estructura de la página (layout, secciones), pero dentro de esa página quieres testear variantes más pequeñas (un botón, un headline, un banner).

## El flujo con `?variant=b`

```
GET /demo-combined?variant=b
     │
     ▼
┌──────────────────────────────────┐
│  Edge function (koryla.ts)       │
│  ─ Lee query param variant=b     │
│  ─ Coincide con rule del exp.    │
│  ─ context.rewrite('/demo-combined-b') │
│  ─ Set-Cookie ky_<edge-id>=<b>   │
└──────────────────────────────────┘
     │  (reescribe a demo-combined-b)
     ▼
┌──────────────────────────────────┐
│  Astro SSR (demo-combined-b.astro) │
│  ─ <Experiment id="sdk-id">      │
│    corre en el frontmatter       │
│  ─ Lee cookie del experimento SDK│
│  ─ Asigna variante CTA           │
│  ─ Renderiza el slot activo      │
└──────────────────────────────────┘
     │
     ▼
HTML final: layout variante B + CTA según SDK
```

## Dos experimentos, dos cookies

El sistema pone **dos cookies separadas**:
- `ky_<edge-exp-id>` → decide qué PÁGINA muestra el edge
- `ky_<sdk-exp-id>` → decide qué COMPONENTE muestra el SDK

Cada usuario puede estar en la combinación: control/control, control/b, b/control, o b/b. Esto te da una matriz 2×2 de datos.

## Configurar en el dashboard

**Experimento Edge (Combined):**

| Campo | Valor |
|-------|-------|
| Type | Edge |
| Base URL | /demo-combined |
| Variant B — Target URL | /demo-combined-b |
| Variant B — Rules | query param: `variant` = `b` |

**Experimento SDK (CTA):**

| Campo | Valor |
|-------|-------|
| Type | SDK |
| Base URL | /demo-combined (o cualquier página) |
| Variant B — Rules | UTM param: `utm_text` = `variation-1` |

## Probarlo

```bash
# Control (edge control + SDK asignado aleatoriamente)
open http://localhost:4321/demo-combined

# Edge fuerza variante B (luego SDK asigna CTA)
open "http://localhost:4321/demo-combined?variant=b"

# Edge variante B + SDK variante B (ambas forzadas)
open "http://localhost:4321/demo-combined?variant=b&utm_text=variation-1"
```

## Cuándo NO usarlo

Si el test es simple (un texto, un color), usa solo SDK. Si cambias páginas completas sin detalle fino, usa solo Edge. El combinado añade complejidad — úsalo cuando necesites los dos niveles realmente.
