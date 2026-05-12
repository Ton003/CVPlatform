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

    this.socket.on('connect', () => {
      console.log('📡 [Realtime] Connected to WebSocket');
    });

    this.socket.on('notification', (data: any) => {
      console.log('🔔 [Realtime] New notification:', data);
      this.notificationSubject.next(data);
    });

    this.socket.on('disconnect', () => {
      console.log('📡 [Realtime] Disconnected from WebSocket');
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
