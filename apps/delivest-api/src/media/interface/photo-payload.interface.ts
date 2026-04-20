import { PhotoKey } from '@delivest/common';
import { DelivestEvent } from '../../shared/events/types.js';
import { PhotoProfile } from '../photo-configs/profiles.js';

export interface ParentPhotoQueuePayload {
  targetId: string;
  socketId: string;
  originalFileKey: string;
  succesEventType: DelivestEvent;
  failEventType: DelivestEvent;
}

export interface ChildPhotoQueuePayload {
  targetId: string;
  originalFileId: string;
  profile: PhotoProfile;
  profileKey: PhotoKey;
}
