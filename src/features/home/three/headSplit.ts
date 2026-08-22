import type { BufferGeometry } from "three";

// Splits a geometry into its index-buffer islands (connected triangle shells).
//
// Needed because the GLB welds hair and facial skin into ONE `head` node with a
// single material slot, so they cannot be tinted apart from the outside. Three
// other separations were tried first and all failed:
//   - node names: there is no `hair` node, only `head`.
//   - UV islands: the unwrap overlaps almost completely (face u[0.03,0.72] vs
//     hair u[0.18,0.98]). Expected — a matcap is sampled by view-space normal,
//     so this model never needed a clean unwrap.
//   - position-welded components: welding first FUSES the hair to the skull and
//     reports a single shell. The islands only survive in the raw index buffer.
//
// Triangles inside one island always share vertices, so grouping the index
// buffer by island lets three.js draw each with its own material.

export type Island = {
  /** Triangle indices (into the index buffer / 3) belonging to this island. */
  triangles: number[];
  min: [number, number, number];
  max: [number, number, number];
};

export function findIslands(geometry: BufferGeometry): Island[] {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  if (!index || !position) return [];

  const vertexCount = position.count;
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;

  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!; // path halving — keeps this near-linear
      a = parent[a]!;
    }
    return a;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const triangleCount = index.count / 3;
  for (let t = 0; t < triangleCount; t++) {
    const a = index.getX(t * 3);
    const b = index.getX(t * 3 + 1);
    const c = index.getX(t * 3 + 2);
    union(a, b);
    union(b, c);
  }

  const byRoot = new Map<number, Island>();
  for (let t = 0; t < triangleCount; t++) {
    const root = find(index.getX(t * 3));
    let island = byRoot.get(root);
    if (!island) {
      island = { triangles: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      byRoot.set(root, island);
    }
    island.triangles.push(t);
    for (let k = 0; k < 3; k++) {
      const v = index.getX(t * 3 + k);
      const p: [number, number, number] = [position.getX(v), position.getY(v), position.getZ(v)];
      for (let axis = 0; axis < 3; axis++) {
        if (p[axis]! < island.min[axis]!) island.min[axis] = p[axis]!;
        if (p[axis]! > island.max[axis]!) island.max[axis] = p[axis]!;
      }
    }
  }

  return [...byRoot.values()].sort((a, b) => b.triangles.length - a.triangles.length);
}

/**
 * Rewrites `geometry`'s index so each island occupies one contiguous run, then
 * adds a draw group per bucket. `bucketOf` maps an island to a material slot.
 * Returns the number of slots actually used.
 */
export function groupByIsland(
  geometry: BufferGeometry,
  islands: Island[],
  bucketOf: (island: Island, i: number) => number,
  bucketCount: number,
): number {
  const index = geometry.getIndex()!;
  const reordered: number[] = [];
  geometry.clearGroups();

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = reordered.length;
    islands.forEach((island, i) => {
      if (bucketOf(island, i) !== bucket) return;
      for (const t of island.triangles) {
        reordered.push(index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2));
      }
    });
    const count = reordered.length - start;
    if (count > 0) geometry.addGroup(start, count, bucket);
  }

  index.set(reordered);
  index.needsUpdate = true;
  return geometry.groups.length;
}
