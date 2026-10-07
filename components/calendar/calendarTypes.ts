import { Event } from '../../services/firestore';

export interface CalendarScreenRouteParams {
    editEventId?: string;
}

export type EventType = Event['type'];
