import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-job-hub',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './job-hub.component.html',
  styleUrls: ['./job-hub.component.scss']
})
export class JobHubComponent {}
