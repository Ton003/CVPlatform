import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * ✅ Emit a notification to all connected clients
   * For simplicity in this PFE, we broadcast.
   * In production, we would use rooms for specific users.
   */
  emitNotification(action: string, data: any) {
    this.server.emit('notification', {
      action,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(): string {
    return 'pong';
  }
}
