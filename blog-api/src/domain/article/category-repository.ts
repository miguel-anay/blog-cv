import type { Category } from './types.js';

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  countsBySlug(): Promise<Record<string, number>>;
}
