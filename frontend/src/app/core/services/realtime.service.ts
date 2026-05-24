import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RealtimeService implements OnDestroy {
  private socket: Socket;
  private notificationSubject = new Subject<any>();

  constructor() {
    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
    });

    this.socket.on('notification', (data: any) => {
      this.notificationSubject.next(data);
    });
  }

  get notifications$(): Observable<any> {
    return this.notificationSubject.asObservable();
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
