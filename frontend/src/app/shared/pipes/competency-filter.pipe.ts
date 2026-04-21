import { Pipe, PipeTransform } from '@angular/core';
import { Competency, CompetencyCategory } from '../../core/services/competency.service';

@Pipe({ name: 'competencyFilter', standalone: true, pure: true })
export class CompetencyFilterPipe implements PipeTransform {
  transform(competencies: Competency[], category: CompetencyCategory): Competency[] {
    return competencies.filter(c => c.category === category);
  }
}
