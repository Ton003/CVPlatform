import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { ToastComponent }   from '../../shared/toast/toast.component';
import { RealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, ToastComponent],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent implements OnInit {
  private realtime = inject(RealtimeService);
  private toast = inject(ToastService);

  ngOnInit() {
    this.realtime.notifications$.subscribe((notif) => {
      this.handleNotification(notif);
    });
  }

  private handleNotification(notif: any) {
    if (notif.action === 'application_created') {
      this.toast.info('Recruitment Alert: New application received!');
    } else if (notif.action === 'stage_changed') {
      const stage = notif.data?.to?.toUpperCase() || 'NEW STAGE';
      this.toast.info(`Pipeline Update: Candidate moved to ${stage}`);
    }
  }
}
