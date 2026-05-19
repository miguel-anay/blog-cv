import type { CvData } from './types.js';

export interface ICvRepository {
  getFullCv(): Promise<CvData>;
}
