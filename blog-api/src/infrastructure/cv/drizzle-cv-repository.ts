import { asc } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { ICvRepository } from '../../domain/cv/cv-repository.js';
import type { CvData } from '../../domain/cv/types.js';
import * as schema from '../db/schema.js';
import { assembleCvData } from './assemble-cv-data.js';

type Db = LibSQLDatabase<typeof schema>;

export class DrizzleCvRepository implements ICvRepository {
  constructor(private readonly db: Db) {}

  async getFullCv(): Promise<CvData> {
    const [personal, proyectos, experiencia, educacion, cursos] = await Promise.all([
      this.db.select().from(schema.cvPersonal).limit(1),
      this.db.select().from(schema.cvProyectos).orderBy(asc(schema.cvProyectos.orden)),
      this.db.select().from(schema.cvExperiencia).orderBy(asc(schema.cvExperiencia.orden)),
      this.db.select().from(schema.cvEducacion).orderBy(asc(schema.cvEducacion.orden)),
      this.db.select().from(schema.cvCursos).orderBy(asc(schema.cvCursos.orden)),
    ]);

    return assembleCvData(
      personal as Parameters<typeof assembleCvData>[0],
      proyectos as Parameters<typeof assembleCvData>[1],
      experiencia as Parameters<typeof assembleCvData>[2],
      educacion as Parameters<typeof assembleCvData>[3],
      cursos as Parameters<typeof assembleCvData>[4],
    );
  }
}
