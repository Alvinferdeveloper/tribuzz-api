import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { roomExists, getRoomStatus } from '../room.service';
import { IChatAdapter, ChatMessage } from './adapters/base.adapter';
import { isFeatureEnabled, SETTING_KEYS } from '../setting.service';
import * as UserRepository from '../../repositories/user.repository';
import * as ReportRepository from '../../repositories/report.repository';
import { getTotalOnlineUsers } from '../../services/room-active-users.service';
import * as RoomRepository from '../../repositories/room.repository';
import * as ReportRepo from '../../repositories/report.repository';
import { supabase } from '@/lib/supabase';
import ApiError, { ERROR_MESSAGES } from '@/utils/ApiError';
import logger from '@/lib/logger';
import { CHAT_UPLOAD_RULES, chatUploadKind, extensionFor, type ChatUploadKind } from '@/utils/uploadPolicy';

const sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a'],
    allowedAttributes: { 'a': ['href'] },
    allowedSchemes: ['http', 'https']
};

const CHAT_BUCKET = 'chat-images';
const GIPHY_DOMAINS = ['giphy.com'];

/** Upload requests allowed per socket per minute (presigned URLs aren't free). */
const UPLOAD_REQUESTS_PER_MINUTE = 10;

const isHttpsUrl = (url: unknown): url is string => {
    try {
        return typeof url === 'string' && new URL(url).protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * A file uploaded through our own presigned flow: our bucket, this
 * sub-room, the right folder. Anything else (another Supabase project,
 * another bucket or room) is rejected.
 */
const isOwnChatUpload = (url: unknown, subRoomName: string, kind: ChatUploadKind): boolean => {
    if (!isHttpsUrl(url)) return false;
    // Same builder that produced the URL when the upload was granted.
    const prefix = supabase.storage.from(CHAT_BUCKET).getPublicUrl(`${subRoomName}/${CHAT_UPLOAD_RULES[kind].folder}/`).data.publicUrl;
    return url.startsWith(prefix) && !url.slice(prefix.length).includes('/');
};

const isGiphyUrl = (url: unknown): boolean => {
    if (!isHttpsUrl(url)) return false;
    const { hostname } = new URL(url);
    return GIPHY_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
};

const MAX_MESSAGES_HISTORY = parseInt(process.env.MAX_MESSAGES_HISTORY || '10', 10);

interface ReplyContext {
    id: string;
    author: string;
    messageSnippet: string;
}

export class ChatService {
    private io: Server;
    private adapter: IChatAdapter;
    private adminSockets: Set<string> = new Set();
    private statsInterval: NodeJS.Timeout | null = null;

    constructor(io: Server, adapter: IChatAdapter) {
        this.io = io;
        this.adapter = adapter;
        this.startStatsInterval();
    }

    private startStatsInterval(): void {
        this.statsInterval = setInterval(async () => {
            if (this.adminSockets.size === 0) return;

            try {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);

                const [
                    onlineUsers,
                    totalUsers,
                    newUsersToday,
                    pendingReports,
                    activeRooms,
                    pendingRooms,
                ] = await Promise.all([
                    getTotalOnlineUsers(),
                    UserRepository.countAll(),
                    UserRepository.countSince(startOfToday),
                    ReportRepo.countPending(),
                    RoomRepository.countByStatus('ACCEPTED' as any),
                    RoomRepository.countByStatus('IN_REVISION' as any),
                ]);

                this.io.to([...this.adminSockets]).emit('admin-stats-update', {
                    onlineUsers,
                    totalUsers,
                    newUsersToday,
                    pendingReports,
                    activeRooms,
                    pendingRooms,
                });
            } catch (error) {
                logger.error('Error emitting admin stats', { error: (error as Error).message });
            }
        }, 10000);
    }

    /**
     * Fetches all sockets in a room, maps them to a user list payload,
     * and broadcasts the list to that room.
     * @param subRoomName - The name of the sub-room to broadcast to.
     */
    /**
     * Broadcasts a system message to ALL connected clients across all rooms.
     */
    public broadcastGlobalMessage(message: string): void {
        this.io.emit('global_system_message', {
            id: crypto.randomUUID(),
            message: sanitizeHtml(message, sanitizeOptions),
            timestamp: new Date().toISOString(),
            system: true,
            isGlobal: true
        });
    }

    public registerAdminSocket(socketId: string): void {
        this.adminSockets.add(socketId);
    }

    public unregisterAdminSocket(socketId: string): void {
        this.adminSockets.delete(socketId);
    }

    public emitNewReport(payload: { reportedUserId: string; username: string; reason: string }): void {
        this.io.to([...this.adminSockets]).emit('admin-new-report', payload);
    }

    public emitNewRoom(payload: { roomId: string; name: string; ownerUsername: string; status: string }): void {
        this.io.to([...this.adminSockets]).emit('admin-room-created', payload);
    }

    private async _broadcastUserList(subRoomName: string): Promise<void> {
        try {
            const sockets = await this.io.in(subRoomName).fetchSockets();
            const uniqueUsers = new Map();

            for (const socket of sockets) {
                const userId = socket.data.userId;
                if (!uniqueUsers.has(userId)) {
                    uniqueUsers.set(userId, {
                        id: userId, // Use userId as the unique identifier
                        username: socket.data.username,
                        profileImage: socket.data.userProfileImage,
                    });
                }
            }

            const userList = Array.from(uniqueUsers.values());
            this.io.to(subRoomName).emit('room_users', userList);
        } catch (error) {
            logger.error('Error broadcasting user list for room', { subRoomName, error: (error as Error).message });
        }
    }

    public handleConnection(socket: Socket): void {
        // Socket.IO doesn't await listeners, so a rejected promise from an async
        // handler (e.g. a DB timeout inside joinRoom) became an unhandled
        // rejection and crashed the whole process, dropping every connected
        // user. Every handler goes through this guard instead: the failure is
        // logged and reported only to the socket that triggered it.
        const on = (event: string, handler: (...args: any[]) => unknown) => {
            socket.on(event, async (...args: any[]) => {
                try {
                    await handler(...args);
                } catch (error) {
                    logger.error('Socket event handler failed', {
                        event,
                        socketId: socket.id,
                        error: (error as Error).message,
                    });
                    if (event !== 'disconnecting' && socket.connected) {
                        socket.emit('error', 'Algo salió mal. Inténtalo de nuevo en un momento.');
                    }
                }
            });
        };

        on('get-initial-room-state', () => this.getInitialRoomState(socket));
        on('join-room', (room, username) => this.runRoomOp(socket, () => this.joinRoom(socket, room, username)));
        on('leave-room', () => this.runRoomOp(socket, () => this.leaveRoom(socket)));
        on('message', (payload) => this.handleMessage(socket, payload));
        on('report-user', (payload) => this.handleReportUser(socket, payload));

        on('request-chat-image-upload', (payload) => this.handleRequestChatImageUpload(socket, payload));
        on('image', (payload) => this.handleImage(socket, payload));
        on('audio', (payload) => this.handleAudio(socket, payload));
        on('gif', (payload) => this.handleGif(socket, payload));

        on('send_reaction', (payload) => this.handleSendReaction(socket, payload));
        on('edit-message', (payload) => this.handleEditMessage(socket, payload));
        on('delete-message', (payload) => this.handleDeleteMessage(socket, payload));
        on('start-typing', () => this.handleStartTyping(socket));
        on('stop-typing', () => this.handleStopTyping(socket));
        on('disconnecting', () => this.runRoomOp(socket, () => this.handleDisconnect(socket)));
    }

    /**
     * Runs join/leave/disconnect for one socket strictly one after another.
     * They're async (DB checks, adapter calls), so two join-room events sent
     * back to back used to both pass their checks before either recorded the
     * membership, and the room was counted twice for one connection.
     */
    private runRoomOp(socket: Socket, op: () => Promise<void>): Promise<void> {
        const previous: Promise<void> = socket.data.roomOp ?? Promise.resolve();
        const next = previous.catch(() => undefined).then(op);
        socket.data.roomOp = next;
        return next;
    }

    private async getInitialRoomState(socket: Socket): Promise<void> {
        const state = await this.adapter.getInitialState();
        socket.emit('initial-room-state', state);
    }

    private async joinRoom(socket: Socket, parentRoom: string, clientUsername: string): Promise<void> {
        // The same socket asking again for the room it's already in (e.g. the
        // client re-joining on connect) must not be counted twice: the extra
        // count stayed after the user left, so others kept seeing them there.
        if (socket.data.parentRoom === parentRoom && socket.data.subRoomName) {
            const recentMessages = await this.adapter.getRecentMessages(socket.data.subRoomName, MAX_MESSAGES_HISTORY);
            socket.emit('message-history', recentMessages);
            await this._broadcastUserList(socket.data.subRoomName);
            return;
        }
        // Moving to another room without leaving the previous one first.
        if (socket.data.subRoomName) {
            await this.leaveRoom(socket);
        }

        const chatEnabled = await isFeatureEnabled(SETTING_KEYS.CHAT_ENABLED);
        if (!chatEnabled) {
            socket.emit('error', ERROR_MESSAGES.CHAT_DISABLED);
            return;
        }

        const maintenanceMode = await isFeatureEnabled(SETTING_KEYS.MAINTENANCE_MODE, false);
        if (maintenanceMode) {
            const userRole = socket.data.user?.role;
            if (userRole !== 'ADMIN') {
                socket.emit('error', ERROR_MESSAGES.MAINTENANCE_MODE);
                return;
            }
        }

        const roomStatus = await getRoomStatus(parentRoom);

        if (!roomStatus.exists) {
            socket.emit('error', 'La sala no existe');
            return;
        }

        if (roomStatus.status !== 'ACCEPTED') {
            socket.emit('error', 'La sala no está disponible para unirse');
            return;
        }

        const userId = socket.data.user?.id || clientUsername;

        // Check if user is banned
        if (socket.data.user?.id) {
            const dbUser = await UserRepository.findProfileById(socket.data.user.id);
            if ((dbUser as any).isBanned) {
                socket.emit('error', 'Tu cuenta ha sido suspendida. Contacta con soporte.');
                socket.disconnect();
                return;
            }
        }
        const { subRoomName, totalUsersInParentRoom } = await this.adapter.joinRoom(parentRoom, userId);
        await socket.join(subRoomName);

        let finalUsername = clientUsername;
        let userProfileImage: string | null = null;

        if (socket.data.user) {
            const sessionUser = socket.data.user;
            finalUsername = sessionUser.username;
            userProfileImage = await UserRepository.findImageById(sessionUser.id);
        }

        socket.data.username = finalUsername;
        socket.data.userId = userId;
        socket.data.userProfileImage = userProfileImage;
        socket.data.subRoomName = subRoomName;
        socket.data.parentRoom = parentRoom;

        const recentMessages = await this.adapter.getRecentMessages(subRoomName, MAX_MESSAGES_HISTORY);
        socket.emit('message-history', recentMessages);

        socket.broadcast.to(subRoomName).emit('user-joined', {
            username: finalUsername,
            system: true,
            message: 'se ha unido a la sala.',
            timestamp: new Date().toISOString(),
        });

        this.io.emit('user-count', { roomId: parentRoom, count: totalUsersInParentRoom });

        await this._broadcastUserList(subRoomName);
    }

    private async leaveRoom(socket: Socket): Promise<void> {
        const { parentRoom, subRoomName } = socket.data;
        if (subRoomName && parentRoom) {
            socket.leave(subRoomName);
            await this.handleDisconnect(socket);
        }
    }

    private async handleMessage(socket: Socket, payload: string | { message: string; replyTo?: ReplyContext }): Promise<void> {
        const { subRoomName, username, userProfileImage } = socket.data;
        if (!subRoomName) {
            socket.emit('error', 'No estás en una sala');
            return;
        }

        const isObjectPayload = typeof payload === 'object' && payload !== null;
        const messageContent = isObjectPayload ? payload.message : payload;
        const rawReplyTo = isObjectPayload ? payload.replyTo : undefined;

        const replyTo = rawReplyTo ? {
            ...rawReplyTo,
            messageSnippet: sanitizeHtml(rawReplyTo.messageSnippet, sanitizeOptions)
        } : undefined;

        const chatMessage: ChatMessage = {
            id: crypto.randomUUID(),
            username,
            userProfileImage,
            message: sanitizeHtml(messageContent, sanitizeOptions),
            replyTo,
            reactions: [],
            timestamp: new Date().toISOString(),
        };

        this.io.to(subRoomName).emit('message', chatMessage);
        await this.adapter.saveMessage(subRoomName, chatMessage);
        this.handleStopTyping(socket);
    }

    private async handleReportUser(socket: Socket, payload: { reportedUserId: string; reason: any; details?: string }): Promise<void> {
        const { subRoomName, parentRoom, userId: reporterId } = socket.data;
        if (!reporterId) return;

        try {
            let chatContext: ChatMessage[] | undefined = undefined;
            if (subRoomName) {
                // Capture last 20 messages as evidence
                chatContext = await this.adapter.getRecentMessages(subRoomName, 20);
            }

            await ReportRepository.create({
                reporterId,
                reportedUserId: payload.reportedUserId,
                roomId: parentRoom,
                reason: payload.reason,
                details: payload.details,
                chatContext
            });

            const reportedUser = await UserRepository.findProfileById(payload.reportedUserId).catch(() => null);
            this.emitNewReport({
                reportedUserId: payload.reportedUserId,
                username: reportedUser?.username || 'Usuario desconocido',
                reason: payload.reason,
            });

            socket.emit('report-success', 'Reporte enviado correctamente.');
        } catch (error) {
            logger.error('Error handling report-user via socket', { error: (error as Error).message });
            socket.emit('error', 'No se pudo procesar el reporte.');
        }
    }

    /**
     * Grants a presigned URL to upload one chat image or voice note straight
     * to storage. The type must be on the allowlist and the extension comes
     * from it (never from the client); the declared size is checked here and
     * the bucket's own limits enforce the real one on upload.
     */
    private async handleRequestChatImageUpload(socket: Socket, payload: { contentType?: string; tempId?: string; size?: number }) {
        const { subRoomName, user } = socket.data;
        if (!subRoomName) return socket.emit('error', 'No estás en una sala para enviar archivos.');

        const kind = chatUploadKind(payload?.contentType);
        if (!kind) return socket.emit('error', 'Ese tipo de archivo no se puede enviar.');
        const rule = CHAT_UPLOAD_RULES[kind];
        const extension = extensionFor(payload.contentType, rule.types)!;

        if (typeof payload.size === 'number' && payload.size > rule.maxBytes) {
            return socket.emit('error', `El archivo supera el máximo de ${Math.round(rule.maxBytes / (1024 * 1024))} MB.`);
        }

        // Sliding one-minute window per socket.
        const now = Date.now();
        const recent: number[] = (socket.data.uploadRequests ?? []).filter((t: number) => now - t < 60_000);
        if (recent.length >= UPLOAD_REQUESTS_PER_MINUTE) {
            return socket.emit('error', 'Estás enviando archivos muy rápido. Espera un momento.');
        }
        socket.data.uploadRequests = [...recent, now];

        try {
            const owner = user ? user.id : 'anonymous';
            const filePath = `${subRoomName}/${rule.folder}/${owner}-${now}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

            const { data, error } = await supabase.storage
                .from(CHAT_BUCKET)
                .createSignedUploadUrl(filePath, { upsert: false });

            if (error) {
                logger.error('Supabase createSignedUploadUrl error', { error: (error as Error).message });
                socket.emit('error', 'No se pudo procesar la subida del archivo.');
                return;
            }

            const { data: publicUrlData } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(filePath);

            socket.emit('grant-chat-image-upload', {
                tempId: payload.tempId,
                signedUploadUrl: data.signedUrl,
                publicUrl: publicUrlData.publicUrl,
            });
        } catch (error) {
            logger.error('Error handling request for chat upload', { error: (error as Error).message });
            socket.emit('error', 'No se pudo procesar la subida del archivo.');
        }
    }

    private async handleImage(socket: Socket, payload: { imageUrl: string; description?: string; replyTo?: ReplyContext; tempId?: string }): Promise<void> {
        const { subRoomName, username, userProfileImage } = socket.data;
        if (!subRoomName) {
            socket.emit('error', 'No estás en una sala');
            return;
        }

        if (!isOwnChatUpload(payload.imageUrl, subRoomName, 'image')) {
            socket.emit('error', 'URL de imagen no permitida');
            return;
        }

        const chatMessage = {
            id: crypto.randomUUID(),
            username,
            userProfileImage,
            imageUrl: payload.imageUrl,
            description: sanitizeHtml(payload.description || '', sanitizeOptions),
            replyTo: payload.replyTo,
            reactions: [],
            timestamp: new Date().toISOString(),
            tempId: payload.tempId
        };

        this.io.to(subRoomName).emit('image', chatMessage);
        await this.adapter.saveMessage(subRoomName, chatMessage);
        this.handleStopTyping(socket);
    }

    private async handleAudio(socket: Socket, payload: { audioUrl: string; duration?: number; replyTo?: ReplyContext; tempId?: string }): Promise<void> {
        const { subRoomName, username, userProfileImage } = socket.data;
        if (!subRoomName) {
            socket.emit('error', 'No estás en una sala');
            return;
        }

        if (!isOwnChatUpload(payload.audioUrl, subRoomName, 'audio')) {
            socket.emit('error', 'URL de audio no permitida');
            return;
        }

        const chatMessage = {
            id: crypto.randomUUID(),
            username,
            userProfileImage,
            audioUrl: payload.audioUrl,
            duration: payload.duration,
            replyTo: payload.replyTo,
            reactions: [],
            timestamp: new Date().toISOString(),
            tempId: payload.tempId
        };

        this.io.to(subRoomName).emit('audio', chatMessage);
        await this.adapter.saveMessage(subRoomName, chatMessage);
        this.handleStopTyping(socket);
    }

    private async handleGif(socket: Socket, payload: { gifUrl: string; giphyId: string; replyTo?: ReplyContext, tempId?: string }): Promise<void> {
        const { subRoomName, username, userProfileImage } = socket.data;
        if (!subRoomName) {
            socket.emit('error', 'No estás en una sala');
            return;
        }

        if (!isGiphyUrl(payload.gifUrl)) {
            socket.emit('error', 'URL de GIF no permitida');
            return;
        }

        const chatMessage = {
            id: crypto.randomUUID(),
            username,
            userProfileImage,
            gifUrl: payload.gifUrl,
            giphyId: payload.giphyId,
            replyTo: payload.replyTo,
            reactions: [],
            timestamp: new Date().toISOString(),
            tempId: payload.tempId
        };

        this.io.to(subRoomName).emit('gif', chatMessage);
        await this.adapter.saveMessage(subRoomName, chatMessage);
        this.handleStopTyping(socket);
    }

    private async handleEditMessage(socket: Socket, payload: { messageId: string; message: string }): Promise<void> {
        const { subRoomName, username } = socket.data;
        if (!subRoomName || !username) {
            socket.emit('error', 'No estás en una sala');
            return;
        }

        const recentMessages = await this.adapter.getRecentMessages(subRoomName, 100);
        const targetMessage = recentMessages.find(m => m.id === payload.messageId);

        if (!targetMessage) {
            socket.emit('error', 'Mensaje no encontrado');
            return;
        }

        if (targetMessage.username !== username) {
            socket.emit('error', 'No puedes editar mensajes de otros usuarios');
            return;
        }

        const sanitizedMessage = sanitizeHtml(payload.message, sanitizeOptions);
        await this.adapter.updateMessage(subRoomName, payload.messageId, { message: sanitizedMessage });

        this.io.to(subRoomName).emit('message-edited', {
            id: payload.messageId,
            message: sanitizedMessage,
            edited: true,
        });
    }

    private async handleDeleteMessage(socket: Socket, payload: { messageId: string }): Promise<void> {
        const { subRoomName, username } = socket.data;
        if (!subRoomName || !username) {
            socket.emit('error', 'No estás en una sala');
            return;
        }

        const recentMessages = await this.adapter.getRecentMessages(subRoomName, 100);
        const targetMessage = recentMessages.find(m => m.id === payload.messageId);

        if (!targetMessage) {
            socket.emit('error', 'Mensaje no encontrado');
            return;
        }

        if (targetMessage.username !== username) {
            socket.emit('error', 'No puedes eliminar mensajes de otros usuarios');
            return;
        }

        await this.adapter.deleteMessage(subRoomName, payload.messageId);

        this.io.to(subRoomName).emit('message-deleted', {
            id: payload.messageId,
        });
    }

    private handleSendReaction(socket: Socket, payload: { messageId: string; emoji: string }): void {
        const { subRoomName, username } = socket.data;
        if (!subRoomName) return;

        this.io.to(subRoomName).emit('reaction_update', {
            messageId: payload.messageId,
            emoji: payload.emoji,
            reactingUsername: username,
        });
    }

    private handleStartTyping(socket: Socket): void {
        const { subRoomName, username } = socket.data;
        if (!subRoomName || !username) return;

        socket.broadcast.to(subRoomName).emit('user-started-typing', { username });
    }

    private handleStopTyping(socket: Socket): void {
        const { subRoomName, username } = socket.data;
        if (!subRoomName || !username) return;

        socket.broadcast.to(subRoomName).emit('user-stopped-typing', { username });
    }

    private async handleDisconnect(socket: Socket): Promise<void> {
        const { parentRoom, subRoomName, username, userId } = socket.data;
        if (!parentRoom || !subRoomName || !userId) return;

        this.handleStopTyping(socket);
        // Forget the membership before counting the leave: leave-room followed
        // by the socket disconnecting used to decrement the room twice.
        socket.data.parentRoom = undefined;
        socket.data.subRoomName = undefined;
        // While "disconnecting" the socket is still in its rooms; leave now so
        // the member list broadcast below no longer includes it.
        socket.leave(subRoomName);

        const { totalUsersInParentRoom } = await this.adapter.leaveRoom(parentRoom, subRoomName, userId);

        socket.to(subRoomName).emit('user-left', `${username || 'Anónimo'} ha salido de la sala.`);
        this.io.emit('user-count', { roomId: parentRoom, count: totalUsersInParentRoom });
        await this._broadcastUserList(subRoomName);
    }
}
