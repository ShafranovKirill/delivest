import { PhotoEvent } from '../../shared/events/types.js';
import { PhotoProfile } from '../photo-configs/profiles.js';

export interface PhotoQueuePayload {
  targetId: string;
  fileId: string;
  profile: PhotoProfile;
  profileKey: string;
  socketId: string;
  eventType: PhotoEvent;
  failEventType: PhotoEvent;
}
