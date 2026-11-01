import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { isoDate } from '../domain/time';

export const useLines = () => useLiveQuery(() => db.lines.toArray(), [], []);
export const useTrips = () => useLiveQuery(() => db.trips.toArray(), [], []);
export const useUsers = () => useLiveQuery(() => db.users.toArray(), [], []);
export const useVehicles = () => useLiveQuery(() => db.vehicles.toArray(), [], []);
export const useSettings = () => useLiveQuery(() => db.settings.get('settings'), [], undefined);
export const useDutiesOn = (date: string) => useLiveQuery(() => db.duties.where('date').equals(date).toArray(), [date], []);
export const useCountsOn = (date: string) => useLiveQuery(() => db.counts.where('date').equals(date).toArray(), [date], []);
export const today = () => isoDate(new Date());
export const useDutiesAll = () => useLiveQuery(() => db.duties.toArray(), [], []);
export const useCalendars = () => useLiveQuery(() => db.calendars.toArray(), [], []);
