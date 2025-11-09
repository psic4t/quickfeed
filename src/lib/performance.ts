export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static startTimer(name: string): () => void {
    const startTime = globalThis.performance.now();

    return () => {
      const endTime = globalThis.performance.now();
      const duration = endTime - startTime;

      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }

      const durations = this.metrics.get(name)!;
      durations.push(duration);

      // Keep only last 10 measurements
      if (durations.length > 10) {
        durations.shift();
      }

      // Log if performance is poor
      if (duration > 100) {
        console.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  static logMetrics(): void {
    const result: Record<string, { avg: number; count: number }> = {};

    for (const [name, durations] of this.metrics.entries()) {
      const sum = durations.reduce((a, b) => a + b, 0);
      result[name] = {
        avg: sum / durations.length,
        count: durations.length,
      };
    }

    console.table(result);
  }
}

// Utility function to debounce expensive operations
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number;

  return (...args: Parameters<T>) => {
    globalThis.clearTimeout(timeout);
    timeout = globalThis.setTimeout(() => func(...args), wait);
  };
}
