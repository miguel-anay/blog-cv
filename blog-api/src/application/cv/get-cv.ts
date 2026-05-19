import type { ICvRepository } from '../../domain/cv/cv-repository.js';
import type { CvData } from '../../domain/cv/types.js';

export class GetCvUseCase {
  constructor(private readonly cvRepo: ICvRepository) {}

  async execute(): Promise<CvData> {
    return this.cvRepo.getFullCv();
  }
}
