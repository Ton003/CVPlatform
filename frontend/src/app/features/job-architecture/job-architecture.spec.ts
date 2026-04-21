import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobArchitecture } from './job-architecture';

describe('JobArchitecture', () => {
  let component: JobArchitecture;
  let fixture: ComponentFixture<JobArchitecture>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobArchitecture]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobArchitecture);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
