export class Slug {
  private constructor(public readonly value: string) {}

  static fromString(raw: string): Slug {
    const value = raw
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!value) throw new Error(`Invalid slug: "${raw}"`);
    return new Slug(value);
  }

  toString(): string {
    return this.value;
  }
}
