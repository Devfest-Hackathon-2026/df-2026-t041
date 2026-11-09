/** Snapshot-based undo/redo over serialized canvas state. */
export class History {
  private stack: string[] = [];
  private index = -1;
  private readonly limit: number;
  constructor(limit = 60) {
    this.limit = limit;
  }
  reset(state: string) {
    this.stack = [state];
    this.index = 0;
  }
  push(state: string) {
    if (this.index >= 0 && this.stack[this.index] === state) return false;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(state);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
    return true;
  }
  canUndo() {
    return this.index > 0;
  }
  canRedo() {
    return this.index < this.stack.length - 1;
  }
  undo(): string | null {
    if (!this.canUndo()) return null;
    this.index -= 1;
    return this.stack[this.index];
  }
  redo(): string | null {
    if (!this.canRedo()) return null;
    this.index += 1;
    return this.stack[this.index];
  }
  current(): string | null {
    return this.index >= 0 ? this.stack[this.index] : null;
  }
}
