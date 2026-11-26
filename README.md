# MacroTrack

Aplicación personal para registrar alimentos, calorías y macronutrientes. Funciona en el navegador, se instala en el teléfono como app (PWA) y guarda todo localmente, sin servidor ni cuentas.

## Funciones (v1.0)

- **Inicio**: navegación por días (anterior, siguiente, calendario, "Ir a hoy"), anillo de calorías (consumidas, meta y restantes), tarjetas de proteínas, carbohidratos y grasas con gramos, meta, restante y porcentaje. Las barras no se cortan al 100 %: el exceso se pinta rayado y se marca dónde estaba la meta.
- **Comidas**: Desayuno, Colación matutina, Comida, Colación vespertina, Cena y Otros. Cada sección permite agregar, editar cantidad, cambiar de comida y eliminar (con "Deshacer"). Puedes copiar una comida del día anterior con un toque.
- **Agregar alimento**: buscas primero en tus alimentos (propios, favoritos y frecuentes) mientras escribes. Al tocar **Buscar** también consultas Open Food Facts y USDA. Si escribes un código de barras (8 a 14 dígitos), se busca ese producto.
- **Cantidad**: g, ml, oz, unidades, porciones, tazas/cucharadas (para ml) y medidas personalizadas. Antes de guardar ves la vista previa de kcal y macros.
- **Alimentos propios**: nombre, marca, kcal y macros por cualquier cantidad de referencia (100 g, 1 porción, 1 unidad…), medidas personalizadas, categoría, etiquetas y favorito. Se pueden editar y eliminar; los registros pasados conservan sus valores.
- **Etiquetas** libres: crear, asignar varias, renombrar, eliminar y filtrar.
- **Historial**: gráfica semanal de calorías o proteína con línea de meta, promedio y días registrados, más el detalle de cualquier día por comida.
- **Ajustes**: metas, tema claro/oscuro/sistema, kcal o kJ, g u oz, clave de USDA, respaldo JSON, exportación CSV, importar respaldo y borrar todo.
- **Escáner de códigos** (experimental): aparece solo en navegadores con `BarcodeDetector`, como Chrome en Android.

## Ejecutar en tu computadora

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo; muestra una URL de red local para abrirla desde el teléfono
npm test           # pruebas de cálculos, mapeo de APIs y almacenamiento
npm run build      # genera la versión final en dist/
npm run preview    # sirve dist/ para probarla
```

Desde el teléfono en la misma red Wi‑Fi puedes abrir la URL `http://192.168.x.x:5173`. Para instalarla como app y usarla sin conexión se necesita **HTTPS**, así que conviene publicarla.

## Publicarla gratis (recomendado: GitHub Pages)

1. Crea un repositorio en GitHub y sube este proyecto a la rama `main`.
2. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` prueba, compila y publica en cada push. La dirección será `https://TU_USUARIO.github.io/NOMBRE_REPO/`.

Alternativas: Cloudflare Pages o Netlify. En ambas, el comando de compilación es `npm run build` y la carpeta de salida es `dist`. También puedes arrastrar la carpeta `dist/` ya compilada a Netlify Drop.

## Instalar en el teléfono

- **Android (Chrome)**: abre la dirección y toca **Instalar app** (o menú ⋮ → *Instalar app / Agregar a pantalla principal*). También hay un botón en *Ajustes → Instalar en el teléfono*.
- **iPhone (Safari)**: Compartir → **Agregar a pantalla de inicio**.

La app se abre a pantalla completa desde su icono y funciona sin conexión. Solo las búsquedas en línea necesitan internet.

## Dónde se guardan los datos

En **IndexedDB** del navegador del dispositivo, mediante Dexie. Los datos se conservan al cerrar o recargar y no se envían a ningún servidor. La app pide almacenamiento persistente para que el navegador no los borre por falta de espacio. Debes tener en cuenta que:

- Cada navegador o dispositivo tiene sus propios datos; todavía no hay sincronización.
- Si borras los datos del sitio en el navegador o desinstalas la app, se pierden. Usa **Ajustes → Respaldo JSON** de vez en cuando.
- En iPhone, Safari puede borrar los datos de sitios web que no visitas en varias semanas. Instalarla en la pantalla de inicio evita esa limpieza.

Tablas: `foods` (alimentos guardados), `entries` (registros, con una copia de los valores del alimento), `tags` y `settings`.

## Búsqueda de alimentos

| Prioridad | Fuente | Detalles |
|---|---|---|
| 1 | Mis alimentos | Los que creaste. Búsqueda instantánea sin importar acentos; también busca por marca y etiqueta. |
| 2 | Favoritos y frecuentes | Productos de búsquedas externas que ya registraste; se guardan solos y no se duplican. |
| 3 | Open Food Facts | Productos comerciales y códigos de barras. No requiere clave. Valores por 100 g/100 ml, y la porción si existe. |
| 3 | USDA FoodData Central | Alimentos genéricos (Foundation, SR Legacy, FNDDS), por 100 g. Los nombres están en inglés. |

Si un resultado no trae calorías y los tres macros, se marca como incompleto y **no se inventan valores**: al tocarlo se abre el formulario para completarlo con la etiqueta.

### Clave de USDA

USDA requiere una API key gratuita: https://fdc.nal.usda.gov/api-key-signup (llega por correo). Se usa en este orden:

1. La que pegues en **Ajustes → Bases de datos**. Se guarda solo en tu dispositivo y no se incluye en los respaldos.
2. `VITE_USDA_API_KEY` al compilar (archivo `.env.local` o secreto de GitHub Actions). Ten en cuenta que en una app estática esta clave queda visible en el JavaScript publicado. Para una clave gratuita de uso personal el riesgo es bajo, pero por eso se recomienda la opción 1.
3. `DEMO_KEY`: funciona sin registrarse, pero solo permite unas 30 búsquedas por hora.

## Limitaciones conocidas

- Open Food Facts limita las búsquedas por texto a unas 10 por minuto. Si responde con error, la app reintenta con su buscador alterno y, si también falla, lo indica claramente. Los datos los aporta la comunidad y a veces están incompletos o mal capturados.
- USDA solo está en inglés.
- La conversión entre peso y volumen no es automática. Para usar "1 taza" en un alimento por gramos, crea una medida personalizada.
- No hay sincronización entre dispositivos ni cuentas (por diseño en v1).

## Estructura

```
src/
  api/          Open Food Facts y USDA (fetch + mapeo a un formato común)
  components/   Piezas de interfaz (barras, anillo, hojas modales, filas, iconos…)
  lib/          Cálculos nutricionales, fechas, formato, acceso a datos (repo.ts), exportar
  screens/      Inicio, Historial, Alimentos, Ajustes y hojas (agregar, cantidad, formulario…)
  db.ts         Esquema de IndexedDB (Dexie)
  state.tsx     Estado global: ajustes, pestaña, hojas modales (sincronizadas con el botón Atrás), avisos
tests/          Pruebas unitarias (Vitest)
scripts/        e2e.cjs (prueba en tamaño de teléfono con Playwright) y make-icons.cjs
```

Cálculo: `valor = valor_por_referencia × cantidad_en_unidad_base / cantidad_de_referencia`, sin redondeo interno. Solo se redondea al mostrar.
