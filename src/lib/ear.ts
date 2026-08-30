// A pure function extracted for EAR computation
export function computeEAR(mesh: [number, number, number][], indices: number[]): number {
  const dist = (a: [number, number, number], b: [number, number, number]) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

  const [p1, p2, p3, p4, p5, p6] = indices.map((i) => mesh[i]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1;

  const vertical = dist(p2, p6) + dist(p3, p5);
  const horizontal = 2 * dist(p1, p4);

  if (horizontal === 0) return 1;
  return vertical / horizontal;
}
