export interface CvPersonal {
  id?: number;
  nombre: string;
  sitio: string;
  descripcion: string;
  empresasDestacadas: string[];
  tecnologiasDestacadas: string;
  linkedin: string;
  anio: string;
}

export interface CvProyecto {
  id?: number;
  orden: number;
  titulo: string;
  empresa: string;
  descripcion: string;
  url: string;
  imagen: string;
  tecnologias: string[];
}

export interface CvSubProyecto {
  nombre: string;
  descripcion: string;
}

export interface CvExperiencia {
  id?: number;
  orden: number;
  periodo: string;
  cargo: string;
  empresa: string;
  certificado: string | null;
  logo: string;
  tecnologias: string[];
  proyectos: CvSubProyecto[];
}

export interface CvCurso {
  id?: number;
  orden: number;
  categoria: string;
  nombre: string;
  institucion: string;
  fecha: string;
  certificado: string | null;
  externo: boolean;
}

export interface CvEducacion {
  id?: number;
  orden: number;
  institucion: string;
  titulo: string;
  estado: string;
  anioInicio?: number | null;
  anioFin?: number | null;
}

export interface CvData {
  personal: CvPersonal;
  proyectos: CvProyecto[];
  experiencia: CvExperiencia[];
  educacion: CvEducacion[];
  cursos: CvCurso[];
}
