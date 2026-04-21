import { Pipe, PipeTransform } from '@angular/core';

/**
 * Counts items in a gap-analysis array by their `status` field.
 * Usage: {{ comparisonData | countByStatus:'met' }}
 */
@Pipe({ name: 'countByStatus', standalone: true, pure: true })
export class CountByStatusPipe implements PipeTransform {
  transform(items: Array<{ status: string }> | null, status: string): number {
    if (!items) return 0;
    return items.filter(i => i.status === status).length;
  }
}
