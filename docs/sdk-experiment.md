# Cómo funciona un experimento SDK en Koryla

> **En una frase:** Misma URL, contenido diferente según un parámetro UTM. Todo pasa en el servidor — el navegador nunca ve JS de A/B testing.

## Qué estamos haciendo

Tenemos una página (`/demo-sdk`) con un botón CTA. Queremos mostrar dos versiones:
- **Control** (sin UTM): "Start testing free →"
- **Variante B** (`?utm_text=variation-1`): "A/B test in 5 min →"

## Qué NO necesitamos

- ❌ Dos páginas separadas
- ❌ Cambios en el edge function
- ❌ JavaScript en el cliente
- ❌ Librería de A/B testing en el bundle

## Las dos capas del sistema

```
Tu navegador
     │
     ▼
┌─────────────────────────────────────┐
│  Edge function (netlify/koryla.ts)  │
│  ─ Ve la URL /demo-sdk              │
│  ─ Este experimento es tipo         │
│    "component" con target_url=""    │
│  ─ Devuelve null → NO hace nada     │
└─────────────────────────────────────┘
     │  (pasa a Astro sin tocar)
     ▼
┌─────────────────────────────────────┐
│  Astro SSR (src/pages/demo-sdk.astro) │
│  ─ <Experiment id="..."> se ejecuta │
│    en el FRONTMATTER (servidor)     │
│  ─ Lee ?utm_text=variation-1        │
│  ─ Si coincide → variante B         │
│  ─ Si no → control (peso 100%)      │
│  ─ Pone cookie sticky 30 días       │
│  ─ Renderiza solo el slot activo    │
└─────────────────────────────────────┘
     │
     ▼
HTML final al navegador (sin JS de A/B)
```

## El código en tu página Astro

```astro
---
import Experiment from '../components/Experiment.astro'
import Variant from '../components/Variant.astro'
---

<Experiment id="<tu-experiment-uuid>">
  <Variant slot="control">
    <button>Start testing free →</button>
  </Variant>
  <Variant slot="b">
    <button>A/B test in 5 min →</button>
  </Variant>
</Experiment>
```

**¿Por qué `slot="control"` y no `name="control"`?**  
En Astro, los hijos de un componente se pasan como *slots*, no como props. El atributo `slot="control"` le dice a Astro qué slot del `<Experiment>` debe llenar. Es la forma idiomática de Astro de hacer lo que en React harías con `<Variant name="control">`.

## Cómo funciona `Experiment.astro` internamente

```astro
---
// 1. Pide el config del experimento a la API de Koryla (caché 60s)
// 2. Lee las cookies del request
// 3. Si hay regla UTM que coincide → usa esa variante
// 4. Si no hay cookie → asigna aleatoriamente según traffic_weight
// 5. Pone la cookie para la próxima visita
const active = result?.variant.name ?? 'control'  // "control" o "b"
---
<slot name={active} />  <!-- Solo renderiza el slot activo -->
```

## Cómo configurar el experimento en el dashboard

| Campo | Valor |
|-------|-------|
| Type | SDK (component) |
| Base URL | https://tu-sitio.com/tu-pagina |
| Variant B — Rules | UTM param: `utm_text` = `variation-1` |
| Variant B — Weight | 0% (solo se activa por regla, no aleatoriamente) |
| Control — Weight | 100% (todo el tráfico sin UTM) |

## Probarlo localmente

```bash
# Control (texto por defecto)
open http://localhost:4321/demo-sdk

# Variante B (texto alternativo)
open "http://localhost:4321/demo-sdk?utm_text=variation-1"
```
