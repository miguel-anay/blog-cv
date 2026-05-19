const API = 'http://localhost:3000';
const TOKEN = '48afa42115b31850f9ca10fb7cb8eb62074443056ea5aad6b390677d6eef61dd';

const h = (level, text) => ({ type: 'heading', level, children: [{ type: 'text', text }] });
const p = (text) => ({ type: 'paragraph', children: [{ type: 'text', text }] });
const ul = (...items) => ({ type: 'list', format: 'unordered', children: items.map(t => ({ type: 'list-item', children: [{ type: 'text', text: t }] })) });
const code = (language, text) => ({ type: 'code', language, children: [{ type: 'text', text }] });
const quote = (text) => ({ type: 'quote', children: [{ type: 'text', text }] });

const posts = [
  {
    slug: 'ssr-en-astro-del-client-load-al-despliegue-en-aws-vercel-y-cloudflare-1',
    title: 'SSR en Astro: del client:load al despliegue en AWS, Vercel y Cloudflare',
    description: 'Entendé qué es SSR en Astro, cuándo usarlo, y cómo elegir entre client:load, hybrid mode y los distintos proveedores de despliegue.',
    published_at: '2025-11-30T00:00:00.000Z',
    categories: [],
    body: [
      h(2, '¿Qué es Astro realmente?'),
      p('Astro es un framework moderno diseñado para entregar performance, adaptabilidad e integración fluida entre HTML estático y componentes interactivos.'),
      p('Por defecto, astro build transforma tu proyecto en HTML estático ultra-rápido, desplegable en plataformas como S3 + CloudFront, Netlify o Vercel.'),
      h(3, 'Características del modo SSG por defecto'),
      ul(
        'Las páginas se generan en tiempo de build (npm run build)',
        'Produce archivos HTML estáticos',
        'El fetching de datos ocurre en la etapa de build',
        'El contenido no cambia hasta el próximo rebuild',
        'Velocidad de producción excepcional',
        'Compatible con múltiples servicios de hosting',
      ),
      p('Astro habilita la interactividad de componentes mediante directivas como client:load, client:idle o client:visible, que indican qué componentes deben hidratarse en el cliente.'),

      h(2, '⚡ client:load: interactividad sin servidores'),
      p('client:load ejecuta los componentes React directamente en el navegador del usuario, no en el servidor, habilitando hooks, manejo de eventos y consumo de APIs públicas.'),
      h(3, 'Ejemplo: componente ThemeToggle'),
      code('jsx', `import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const t = localStorage.getItem("theme") || "light";
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const toggle = () => {
    const t = theme === "light" ? "dark" : "light";
    setTheme(t);
    localStorage.setItem("theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  return <button onClick={toggle}>{theme === "dark" ? "🌙" : "☀️"}</button>;
}`),
      h(3, 'Fetching básico de API en Astro'),
      code('typescript', `const res = await fetch("https://api.example.com/posts");
const posts = await res.json();`),
      h(3, 'Implementación'),
      code('astro', `---
import ThemeToggle from "../components/ThemeToggle.jsx";
---
<ThemeToggle client:load />`),
      p('Este enfoque funciona perfectamente en S3 + CloudFront, ya que todas las operaciones ocurren dentro del navegador, eliminando la necesidad de servidor.'),

      h(2, '🧠 Entendiendo SSR y sus aplicaciones'),
      p('Server-Side Rendering (SSR) ejecuta el código de la aplicación en el servidor, generando HTML dinámicamente para cada visita antes de enviarlo al navegador.'),
      h(3, 'El proceso SSR'),
      ul(
        'El usuario navega a una página',
        'El servidor (Lambda, EC2, Vercel Function) ejecuta el código',
        'El navegador recibe HTML pre-construido con CSS',
        'JavaScript hidrata para la interactividad',
      ),
      h(3, 'Habilitando SSR'),
      code('typescript', `// astro.config.mjs
export default defineConfig({
  output: 'server',
  adapter: node(),
});`),
      h(3, 'Características de SSR'),
      ul(
        'Datos siempre actualizados mediante fetching en tiempo real',
        'Performance más lenta por el rendering en servidor',
        'Requiere infraestructura Node.js activa',
      ),

      h(2, 'Modo Hybrid: equilibrio entre SSG y SSR'),
      p('La configuración hybrid permite rendering selectivo en servidor manteniendo la generación estática como default:'),
      code('typescript', `// astro.config.mjs
export default defineConfig({
  output: 'hybrid',
  adapter: node(),
});

// Configuración por página
export const prerender = false;`),

      h(2, '🕒 Ejemplo práctico: Strapi + Astro'),
      h(3, 'Enfoque SSG'),
      code('astro', `---
const res = await fetch("https://api.mi-strapi.com/posts");
const posts = await res.json();
---
<ul>
  {posts.map(post => <li>{post.title}</li>)}
</ul>`),
      p('Con SSG, el HTML se genera una vez y se despliega en S3 + CloudFront. Las nuevas entradas en Strapi requieren rebuild y redeployment.'),
      h(3, 'Enfoque SSR'),
      p('Usando output: "server" o server:defer se habilita el fetching en tiempo real en cada visita. El nuevo contenido aparece inmediatamente sin rebuilds.'),

      h(2, '⚖️ REST APIs con client:load'),
      p('Los despliegues estáticos con consumo de APIs del lado del cliente eliminan la necesidad de SSR. El flujo es:'),
      ul(
        'Astro genera HTML básico durante el build',
        'El usuario visita y los componentes React hidratan',
        'El navegador hace las llamadas a la API directamente',
        'Los datos se muestran dinámicamente sin intervención del servidor',
      ),
      h(3, 'Casos de uso ideales'),
      ul(
        'Elementos interactivos (botones, inputs, sliders, animaciones)',
        'Consumo de APIs privadas',
        'UX mejorada sin recargas completas de página',
      ),
      h(3, 'Directivas adicionales'),
      ul(
        'client:visible — carga cuando entra al viewport',
        'client:idle — carga cuando el navegador queda disponible',
        'client:only — rendering solo en cliente, sin SSR',
      ),

      h(2, '⏱️ Actualizaciones en tiempo real sin rebuilds'),
      p('Para lograr actualizaciones instantáneas de contenido tenés dos opciones:'),
      h(3, '1. ISR con Webhooks'),
      ul(
        'Deployar en Vercel/Netlify',
        'Configurar webhooks de Strapi para rebuilds automáticos',
        'Mantiene la velocidad de SSG con datos frescos',
      ),
      h(3, '2. Modo Hybrid SSR'),
      ul(
        'Algunas páginas usan SSR (datos en tiempo real)',
        'Otras permanecen estáticas (performance)',
        'Mayor control sobre las estrategias de rendering',
      ),

      h(2, 'Comparando plataformas de despliegue para SSR'),
      h(3, 'Vercel'),
      p('Optimizado para Astro SSR sin complejidad adicional. Tiene edge functions que soportan server:defer.'),
      h(3, 'Cloudflare'),
      p('Prioriza latencia global mínima y precios económicos.'),
      h(3, 'AWS'),
      p('Provee máxima flexibilidad y control con EC2, Lambda o Fargate, aunque requiere decisiones de arquitectura propias.'),

      h(2, '🧭 Conclusión'),
      p('Si tu sitio Astro no usa server:defer, consume APIs desde el cliente y no necesita actualizaciones en tiempo real, el SSR no es necesario.'),
      p('Podés deployar tranquilamente en S3 + CloudFront para hosting rápido, económico y escalable.'),
      p('Sin embargo, proyectos que requieren actualizaciones inmediatas de datos —como contenido de Strapi que cambia frecuentemente o dashboards en vivo— necesitan SSR, ya que el hosting estático no puede ejecutar lógica de servidor.'),
    ],
  },
  {
    slug: 'dmc-instituo-data-and-ia-summit-2025',
    title: 'DMC Instituto Data & IA Summit 2025',
    description: 'Resumen de las cuatro keynotes del DMC Instituto Data & IA Summit 2025: innovación en agronegocios, medición de valor en IA, logística inteligente y salud del futuro.',
    published_at: '2026-01-08T00:00:00.000Z',
    categories: [],
    body: [
      h(2, 'Innovación y Marketing en Agronegocios (Luis Quiróz)'),
      p('La agricultura moderna ya no compite solo por precio o volumen. Para diferenciarse, los agronegocios necesitan estrategia, investigación del consumidor e innovación basada en problemas reales, no en intuiciones.'),
      p('Luis Quiróz explica que muchas empresas agrícolas fallan porque salen al mercado sin entender al cliente. La diferenciación no nace del producto sino del insight del consumidor, de saber qué busca, cómo consume y qué valora. Ejemplos como el espárrago (producto nutracéutico) o la miel (donde el valor está en la historia de origen) muestran que el storytelling agrícola puede aumentar el valor percibido.'),
      p('La innovación, además, requiere técnica: validar, medir, investigar y detectar oportunidades reales en el proceso, el territorio o la experiencia del cliente.'),
      h(3, '¿Cómo interviene la IA?'),
      p('La inteligencia artificial permite analizar tendencias globales, detectar preferencias del consumidor, evaluar escenarios, crear prototipos de productos, optimizar precios y segmentar campañas. Con IA, un pequeño productor puede competir globalmente, construir marca y agregar valor real.'),

      h(2, 'Medición del Valor en Proyectos de IA (Luis Cajachahua)'),
      quote('Menos del 5% de proyectos de IA llegan a implementarse porque muchas organizaciones no saben medir su valor.'),
      p('Luis Cajachahua propone un enfoque práctico basado en ROI, pero adaptado al contexto real, donde la IA puede generar valor en productividad, ahorro operativo, ingresos adicionales y mejoras en experiencia del cliente.'),
      p('A través de casos como copilotos de código y agentes inteligentes para procesos, muestra cómo se deben comparar escenarios "As-Is" vs. "To-Be", incluyendo costos ocultos como licencias, cloud, equipos, mantenimiento y entrenamiento.'),
      p('Los resultados son tangibles: ahorros en planillas, mayor capacidad operativa, reducción de errores, velocidad en procesos y nuevos ingresos. Sin una medición clara, los proyectos fracasan o se inflan expectativas irreales.'),
      h(3, '¿Qué aporta la IA?'),
      p('Más que automatizar, la IA optimiza recursos, reduce fricción, mejora decisiones y agiliza procesos. Pero solo es valiosa si su impacto se mide correctamente.'),
      h(3, 'Recomendación clave'),
      quote('Evita matar moscas con bombas nucleares: usá la IA con propósito, no como moda.'),

      h(2, 'De la Logística Tradicional a la Logística Inteligente (Sandra Woolcott – Ransa)'),
      p('La logística dejó de ser lineal (producir, mover, entregar) para convertirse en una cadena circular impulsada por datos, sensores y analítica. Sandra Woolcott plantea que la verdadera transformación no es tecnológica, sino humana: la tecnología debe potenciar a las personas, no reemplazarlas.'),
      p('La logística tradicional sufría de baja visibilidad, reacción lenta y dependencia de intermediarios. Ransa decidió transformar no solo procesos, sino el propósito: servir mejor conectando personas, procesos y planeta.'),
      h(3, 'Los pilares de la logística inteligente'),
      ul(
        'IA para anticipar demanda',
        'Rutas optimizadas en tiempo real',
        'Decisiones basadas en datos',
        'Seguridad preventiva (no reactiva) con señales tempranas',
        'Blockchain para trazabilidad y confianza',
        'Gemelos digitales, IoT, automatización y servicios logísticos inteligentes',
      ),
      h(3, '¿Cómo aporta la IA?'),
      p('Permite predicción, monitoreo continuo, optimización de recursos y prevención de riesgos. La confianza se convierte en un nuevo activo: trazabilidad verificable, auditorías en tiempo real y transparencia como valor competitivo.'),
      h(3, 'Conclusión'),
      p('La logística inteligente no se espera —se lidera.'),

      h(2, 'Del Cuidado Operativo a la Salud Inteligente (Willy Peña – Pacífico Salud)'),
      quote('La salud genera el 30% de los datos del mundo, pero el 97% está sin usar.'),
      p('Eso causa sobrecarga en médicos, duplicación de estudios, errores y experiencias fragmentadas. Para Willy Peña, el reto no es más tecnología, sino integrar los datos y convertirlos en cuidado humano.'),
      p('La IA permite transformar información en decisiones clínicas y operativas: predicción de demanda, gestión inteligente de camas, asignación de personal, auditoría concurrente y prevención de riesgos. Clínicamente, ya apoya diagnósticos, predice reingresos y permite tratamientos personalizados.'),
      p('La "nueva frontera" del cuidado es continua: del hospital al hogar, con monitoreo remoto, teleconsultas y alertas tempranas. El modelo de valor cambia: de pagar por volumen a pagar por resultados (Value-Based Care).'),
      p('El enemigo principal es la fragmentación. Sin interoperabilidad, la IA no funciona. Por eso se requieren estándares como HL7/FHIR, tokenización y ecosistemas integrados.'),
      h(3, 'Conclusión'),
      quote('La IA no reemplaza a los médicos; amplifica su capacidad de cuidar. Cuando datos y personas se encuentran, el cuidado se vuelve más humano.'),
    ],
  },
];

for (const post of posts) {
  const res = await fetch(`${API}/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(post),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✓ Created: ${post.slug}`);
  } else {
    console.error(`✗ Failed: ${post.slug}`, JSON.stringify(data));
  }
}
