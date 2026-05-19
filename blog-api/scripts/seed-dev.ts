/**
 * seed-dev.ts
 * Inserts CV and blog fixtures into Turso.
 * Idempotent — uses ON CONFLICT DO NOTHING where possible.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/infrastructure/db/schema.js';
import type { ArticleBlock } from '../src/domain/article/types.js';

async function main() {
  const client = createClient({
    url: process.env.TURSO_URL ?? 'file:local.db',
    authToken: process.env.TURSO_TOKEN,
  });
  const db = drizzle(client, { schema });

  // ── Author ───────────────────────────────────────────────────────────────
  await db
    .insert(schema.authors)
    .values({ name: 'Miguel Anay', email: 'mba.miguel18@gmail.com', avatarUrl: null })
    .onConflictDoNothing();
  console.log('[seed] author');

  // ── Categories ───────────────────────────────────────────────────────────
  await db
    .insert(schema.categories)
    .values([
      { slug: 'tech', name: 'Tech', description: 'Software, tools, and engineering.' },
      { slug: 'devops', name: 'DevOps', description: 'Infrastructure, CI/CD, and deployments.' },
      { slug: 'ia', name: 'IA', description: 'Inteligencia artificial y machine learning.' },
    ])
    .onConflictDoNothing();
  console.log('[seed] categories');

  // ── Site Config ──────────────────────────────────────────────────────────
  await db
    .insert(schema.siteConfig)
    .values({
      siteTitle: 'Miguel Anay',
      siteDescription:
        'Full Stack Developer, DevOps Engineer & AI Specialist con más de 12 años de experiencia.',
      aboutMarkdown:
        '## Sobre mí\n\nFull Stack Developer, DevOps e Ingeniero en IA con especialización en desarrollo web e inteligencia artificial. Más de 12 años construyendo productos digitales.',
      email: 'mba.miguel18@gmail.com',
      rol: 'Full Stack Developer, DevOps Engineer & AI Specialist',
      linkedin: 'https://linkedin.com/in/miguel-anay/',
      github: 'https://github.com/miguelanay',
      twitter: '',
      ogImage: null,
    })
    .onConflictDoNothing();
  console.log('[seed] site_config');

  // ── Sample Articles ──────────────────────────────────────────────────────
  const body: ArticleBlock[] = [
    {
      type: 'paragraph',
      children: [{ type: 'text', text: 'Contenido de ejemplo para desarrollo.' }],
    },
  ];

  await db
    .insert(schema.articles)
    .values([
      {
        slug: 'hello-world',
        title: 'Hello World',
        description: 'El primer post del blog.',
        body: JSON.stringify(body) as unknown as (typeof schema.articles.$inferInsert)['body'],
        readMin: 1,
        publishedAt: new Date().toISOString(),
      },
    ])
    .onConflictDoNothing();
  console.log('[seed] articles');

  // ── CV Personal ──────────────────────────────────────────────────────────
  await db
    .insert(schema.cvPersonal)
    .values({
      nombre: 'Miguel Angel Anay Gomez',
      sitio: 'miguel-anay.nom.pe',
      descripcion:
        'Full Stack Developer, DevOps e Ingeniero en IA con especialización en desarrollo web e inteligencia artificial. Más de 12 años de experiencia.',
      empresasDestacadas: JSON.stringify([
        'Yiwu Import Corporation',
        'Encora Company',
        'Profuturo AFP',
      ]) as unknown as string[],
      tecnologiasDestacadas:
        'React.js · Next.js · Vue.js · Node.js · Python · Docker · AWS · Azure · TypeScript',
      linkedin: 'https://linkedin.com/in/miguel-anay/',
      anio: 2025,
    })
    .onConflictDoNothing();
  console.log('[seed] cv_personal');

  // ── CV Proyectos ─────────────────────────────────────────────────────────
  await db
    .insert(schema.cvProyectos)
    .values([
      {
        orden: 1,
        titulo: 'Agencia Virtual',
        empresa: 'Profuturo AFP',
        descripcion:
          'Plataforma para la gestión de trámites y registros de afiliados. Reduce la carga operacional y agiliza los procesos de autoservicio.',
        url: 'https://enlinea.profuturo.com.pe/agenciavirtual',
        imagen: 'agencia_virtual.png',
        tecnologias: JSON.stringify(['React', 'Node.js', 'Docker']) as unknown as string[],
      },
      {
        orden: 2,
        titulo: 'Clave Web',
        empresa: 'Profuturo AFP',
        descripcion:
          'Sistema de recuperación de credenciales y actualización de contraseñas. Redujo incidentes de soporte por contraseñas en un 40%.',
        url: 'https://claveweb.profuturo.com.pe',
        imagen: 'claveweb.png',
        tecnologias: JSON.stringify(['React', 'Node.js', 'Docker', 'AWS']) as unknown as string[],
      },
      {
        orden: 3,
        titulo: 'Disfruta Profuturo',
        empresa: 'Profuturo AFP',
        descripcion:
          'Portal de promociones y cupones para afiliados. Mejora el engagement y los beneficios de los usuarios afiliados.',
        url: 'https://disfrutaprofuturo.com.pe',
        imagen: 'disfruta.png',
        tecnologias: JSON.stringify(['Vue', 'Python']) as unknown as string[],
      },
      {
        orden: 4,
        titulo: 'FactuFacil',
        empresa: 'Yiwu Import Corp',
        descripcion:
          'Sistema de facturación electrónica headless con integraciones YAPE-CHECK, agentes IA y conectividad SUNAT. Módulos de Compras, Ventas y Contabilidad.',
        url: 'https://factufacil.pe',
        imagen: 'factufacil.png',
        tecnologias: JSON.stringify(['Vue', 'PHP', 'MariaDB', 'Docker']) as unknown as string[],
      },
    ])
    .onConflictDoNothing();
  console.log('[seed] cv_proyectos');

  // ── CV Experiencia ───────────────────────────────────────────────────────
  await db
    .insert(schema.cvExperiencia)
    .values([
      {
        orden: 1,
        periodo: 'Abril 2025 – Presente',
        cargo: 'CEO & Full Stack Developer',
        empresa: 'Yiwu Import Corporation',
        certificado: null,
        logo: 'LogoFactu.png',
        tecnologias: JSON.stringify(['React.js', 'Next.js', 'Vue', 'Docker', 'Angular']) as unknown as string[],
        proyectos: JSON.stringify([
          { nombre: 'FactuFacil', descripcion: 'Plataforma de facturación headless con integraciones YAPE-CHECK y agentes IA.' },
          { nombre: 'YAPE-CHECK', descripcion: 'App móvil para verificación de pagos YAPE.' },
          { nombre: 'YUPI.PE & Agentes', descripcion: 'Plataforma B2B de compras mayoristas para PYMES con sistema de consulta por agentes.' },
        ]) as unknown as Array<{ nombre: string; descripcion: string }>,
      },
      {
        orden: 2,
        periodo: 'Noviembre 2020 – Abril 2025',
        cargo: 'Software Engineer III',
        empresa: 'Encora Company',
        certificado: '/TRABAJO/ENCORA.pdf',
        logo: 'enncora.png',
        tecnologias: JSON.stringify(['React.js', 'Next.js', 'Vue', 'Docker', 'Angular']) as unknown as string[],
        proyectos: JSON.stringify([
          { nombre: 'Agencia Virtual', descripcion: 'Plataforma de autoservicio para afiliados que redujo la carga operacional.' },
          { nombre: 'Clave Web', descripcion: 'Sistema de recuperación de credenciales que redujo incidentes de soporte en 40%.' },
          { nombre: 'Disfruta Profuturo', descripcion: 'Portal de beneficios que mejoró el engagement de usuarios.' },
        ]) as unknown as Array<{ nombre: string; descripcion: string }>,
      },
      {
        orden: 3,
        periodo: 'Abril 2018 – Marzo 2020',
        cargo: 'Process Analyst',
        empresa: 'Prosegur',
        certificado: '/TRABAJO/prosegur_certificado.pdf',
        logo: 'prosegur.png',
        tecnologias: JSON.stringify(['React.js', 'PHP Laravel', 'MySQL', 'SQL Server', 'Android Studio']) as unknown as string[],
        proyectos: JSON.stringify([
          { nombre: 'Web Audit', descripcion: 'Plataforma de auditoría de reabastecimiento de ATMs basada en video.' },
          { nombre: 'Web PER', descripcion: 'Monitoreo GPS en tiempo real de rutas y vehículos con alertas automatizadas.' },
          { nombre: 'Supervisiones App', descripcion: 'App Android para captura de evidencia fotográfica en campo.' },
        ]) as unknown as Array<{ nombre: string; descripcion: string }>,
      },
      {
        orden: 4,
        periodo: 'Abril 2014 – Marzo 2018',
        cargo: 'Web Developer & Full Stack .NET',
        empresa: 'Medios Industriales',
        certificado: '/TRABAJO/Medios_Industriales.pdf',
        logo: 'medios.png',
        tecnologias: JSON.stringify(['C#.NET', 'PHP', 'MySQL', 'SQL Server', 'Android Studio']) as unknown as string[],
        proyectos: JSON.stringify([
          { nombre: 'CTO', descripcion: 'Sistema de sincronización y control de tiempos operativos del personal.' },
          { nombre: 'Balizas', descripcion: 'Plataforma de monitoreo GPS en tiempo real para vehículos blindados con alertas inteligentes.' },
        ]) as unknown as Array<{ nombre: string; descripcion: string }>,
      },
    ])
    .onConflictDoNothing();
  console.log('[seed] cv_experiencia');

  // ── CV Educacion ─────────────────────────────────────────────────────────
  await db
    .insert(schema.cvEducacion)
    .values([
      {
        orden: 1,
        institucion: 'Universidad Privada del Norte',
        titulo: 'Diplomado en Gestión de TI (Tech Disruption)',
        estado: 'En curso',
        anioInicio: 2025,
        anioFin: 2025,
      },
      {
        orden: 2,
        institucion: 'Universidad Nacional de Ingeniería',
        titulo: 'Ingeniero Industrial',
        estado: 'Completado',
        anioInicio: 2004,
        anioFin: 2012,
      },
    ])
    .onConflictDoNothing();
  console.log('[seed] cv_educacion');

  // ── CV Cursos ────────────────────────────────────────────────────────────
  await db
    .insert(schema.cvCursos)
    .values([
      {
        orden: 1,
        categoria: 'Software Developer FullStack',
        nombre: 'Arquitectura Hexagonal C#.NET',
        institucion: 'Technical Track',
        fecha: 'Octubre 2025',
        certificado: '/ESTUDIO/Hexagonal_C.pdf',
        externo: 0,
      },
      {
        orden: 2,
        categoria: 'Software Developer FullStack',
        nombre: 'Visual Basic.Net',
        institucion: 'Technical Training Institute',
        fecha: 'Septiembre 2011',
        certificado: '/ESTUDIO/visual_basic_NET.pdf',
        externo: 0,
      },
      {
        orden: 3,
        categoria: 'Data Engineer',
        nombre: 'Diplomado Advanced Data Engineer',
        institucion: 'DMC Instituto',
        fecha: 'Septiembre 2025',
        certificado: null,
        externo: 0,
      },
      {
        orden: 4,
        categoria: 'Data Engineer',
        nombre: 'Administración SQL Server',
        institucion: 'Sistemas UNI',
        fecha: 'Junio 2015',
        certificado: '/ESTUDIO/data_base_administrator.pdf',
        externo: 0,
      },
      {
        orden: 5,
        categoria: 'Data Engineer',
        nombre: 'Business Intelligence Expert',
        institucion: 'Sistemas UNI',
        fecha: 'Febrero 2016',
        certificado: '/ESTUDIO/business_intelligence.pdf',
        externo: 0,
      },
      {
        orden: 6,
        categoria: 'Data Science',
        nombre: 'Python Data Science',
        institucion: 'DSRP Certification Program',
        fecha: 'Octubre 2025',
        certificado: '/ESTUDIO/Certificate_Python_Data_Scientist.pdf',
        externo: 1,
      },
      {
        orden: 7,
        categoria: 'Data Science',
        nombre: 'Gen AI Training Path',
        institucion: 'Coursera / Technical Track',
        fecha: 'Marzo 2025',
        certificado: 'https://credly.com/badges/c4c59c1f-de34-47e4-b2c1-7ca90ee3403b',
        externo: 1,
      },
      {
        orden: 8,
        categoria: 'DevOps Engineer',
        nombre: 'Azure Fundamentals AZ-900',
        institucion: 'Udemy / Microsoft Azure',
        fecha: 'Noviembre 2024',
        certificado: '/ESTUDIO/Azure.pdf',
        externo: 1,
      },
    ])
    .onConflictDoNothing();
  console.log('[seed] cv_cursos');

  console.log('[seed] Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Fatal:', err);
  process.exit(1);
});
