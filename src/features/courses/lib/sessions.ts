import type { CourseResource, CourseSession } from '../../../lib/api-types';

export function groupSessions(resources: CourseResource[]): CourseSession[] {
  const map = new Map<number, CourseResource[]>();

  for (const r of resources) {
    if (r.sessionNumber == null) continue;
    if (!map.has(r.sessionNumber)) map.set(r.sessionNumber, []);
    map.get(r.sessionNumber)!.push(r);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, items]) => {
      const sorted = [...items].sort((a, b) => a.order - b.order);
      const video = sorted.find((r) => r.type === 'video');
      const primary = video ?? sorted[0];
      return {
        number: num,
        title: primary.title,
        video,
        materials: sorted.filter((r) => r !== video),
        anchorId: `session-${num}`,
      };
    });
}
