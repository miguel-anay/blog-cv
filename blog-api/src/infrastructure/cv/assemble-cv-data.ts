import type { CvData, CvPersonal, CvProyecto, CvExperiencia, CvEducacion, CvCurso } from '../../domain/cv/types.js';

type DbPersonal = {
  id: number;
  nombre: string;
  sitio: string | null;
  descripcion: string | null;
  empresasDestacadas: string[] | null;
  tecnologiasDestacadas: string | null;
  linkedin: string | null;
  anio: number | null;
};

type DbProyecto = {
  id: number;
  orden: number;
  titulo: string;
  empresa: string | null;
  descripcion: string | null;
  url: string | null;
  imagen: string | null;
  tecnologias: string[] | null;
};

type DbExperiencia = {
  id: number;
  orden: number;
  periodo: string | null;
  cargo: string;
  empresa: string;
  certificado: string | null;
  logo: string | null;
  tecnologias: string[] | null;
  proyectos: Array<{ nombre: string; descripcion: string }> | null;
};

type DbEducacion = {
  id: number;
  orden: number;
  institucion: string;
  titulo: string;
  estado: string | null;
  anioInicio: number | null;
  anioFin: number | null;
};

type DbCurso = {
  id: number;
  orden: number;
  categoria: string;
  nombre: string;
  institucion: string | null;
  fecha: string | null;
  certificado: string | null;
  externo: number;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T;
  try { return JSON.parse(value as string) as T; } catch { return fallback; }
}

export function assembleCvData(
  personalRows: DbPersonal[],
  proyectosRows: DbProyecto[],
  experienciaRows: DbExperiencia[],
  educacionRows: DbEducacion[],
  cursosRows: DbCurso[],
): CvData {
  const p = personalRows[0];
  const personal: CvPersonal = {
    nombre: p?.nombre ?? '',
    sitio: p?.sitio ?? '',
    descripcion: p?.descripcion ?? '',
    empresasDestacadas: parseJson<string[]>(p?.empresasDestacadas, []),
    tecnologiasDestacadas: p?.tecnologiasDestacadas ?? '',
    linkedin: p?.linkedin ?? '',
    anio: String(p?.anio ?? new Date().getFullYear()),
  };

  const proyectos: CvProyecto[] = proyectosRows.map((r) => ({
    id: r.id,
    orden: r.orden,
    titulo: r.titulo,
    empresa: r.empresa ?? '',
    descripcion: r.descripcion ?? '',
    url: r.url ?? '',
    imagen: r.imagen ?? '',
    tecnologias: parseJson<string[]>(r.tecnologias, []),
  }));

  const experiencia: CvExperiencia[] = experienciaRows.map((r) => ({
    id: r.id,
    orden: r.orden,
    periodo: r.periodo ?? '',
    cargo: r.cargo,
    empresa: r.empresa,
    certificado: r.certificado ?? null,
    logo: r.logo ?? '',
    tecnologias: parseJson<string[]>(r.tecnologias, []),
    proyectos: parseJson<Array<{ nombre: string; descripcion: string }>>(r.proyectos, []),
  }));

  const educacion: CvEducacion[] = educacionRows.map((r) => ({
    id: r.id,
    orden: r.orden,
    institucion: r.institucion,
    titulo: r.titulo,
    estado: r.estado ?? '',
    anioInicio: r.anioInicio ?? null,
    anioFin: r.anioFin ?? null,
  }));

  const cursos: CvCurso[] = cursosRows.map((r) => ({
    id: r.id,
    orden: r.orden,
    categoria: r.categoria,
    nombre: r.nombre,
    institucion: r.institucion ?? '',
    fecha: r.fecha ?? '',
    certificado: r.certificado ?? null,
    externo: r.externo === 1,
  }));

  return { personal, proyectos, experiencia, educacion, cursos };
}
