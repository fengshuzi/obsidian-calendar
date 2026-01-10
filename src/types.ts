export interface CalendarEvent {
    id: string;
    title: string;
    calendar: string;
    start: string;
    end: string;
    allDay: boolean;
    location?: string;
    notes?: string;
}
