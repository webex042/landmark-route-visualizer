/* ===========================================================================
 * BINARY MIN-HEAP PRIORITY QUEUE
 * Deterministic: ties on priority are broken by the `tie` field (we pass the
 * node label), so an identical graph always produces an identical trace.
 * ========================================================================= */

export interface PQEntry<T> { item: T; priority: number; tie: string }

export class PriorityQueue<T> {
  private heap: PQEntry<T>[] = [];

  get size(): number { return this.heap.length; }
  get isEmpty(): boolean { return this.heap.length === 0; }

  /** Lower priority first; equal priority → lexicographically smaller tie key. */
  private before(a: PQEntry<T>, b: PQEntry<T>): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.tie < b.tie;
  }

  push(item: T, priority: number, tie: string): void {
    this.heap.push({ item, priority, tie });
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(this.heap[i], this.heap[parent])) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }

  pop(): PQEntry<T> | undefined {
    if (!this.heap.length) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length) {
      this.heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let best = i;
        if (l < this.heap.length && this.before(this.heap[l], this.heap[best])) best = l;
        if (r < this.heap.length && this.before(this.heap[r], this.heap[best])) best = r;
        if (best === i) break;
        [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];
        i = best;
      }
    }
    return top;
  }

  peek(): PQEntry<T> | undefined { return this.heap[0]; }

  /** Snapshot of queued entries, sorted the way the heap will serve them.
   *  Used by the UI to render the frontier — never by the algorithm itself. */
  toSortedArray(): PQEntry<T>[] {
    return [...this.heap].sort((a, b) => (this.before(a, b) ? -1 : 1));
  }

  has(predicate: (item: T) => boolean): boolean {
    return this.heap.some((e) => predicate(e.item));
  }
}
