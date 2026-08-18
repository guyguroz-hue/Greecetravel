'use client';

import { create } from 'zustand';
import { deleteBlob, getLocalRepository, getRepository, getStorageMode } from '@/lib/db';
import {
  EMPTY_DATA,
  type Activity,
  type CarRental,
  type Checklist,
  type ChecklistItem,
  type CurrencyCode,
  type Day,
  type Expense,
  type Flight,
  type Hotel,
  type ID,
  type Place,
  type ShareMember,
  type Traveler,
  type Trip,
  type TripData,
  type TripDocument,
} from '@/lib/types';
import { newId } from '@/lib/utils/id';
import { addDays, daysBetweenInclusive, eachDate } from '@/lib/utils/date';
import { defaultRates } from '@/lib/services/currency';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface UndoEntry {
  label: string;
  snapshot: TripData;
}

interface TripState {
  data: TripData;
  activeTripId: ID | null;
  status: Status;
  error: string | null;
  /** Set while cloud writes are failing; the app keeps working meanwhile. */
  syncError: string | null;
  undoStack: UndoEntry[];

  hydrate: () => Promise<void>;
  /** Re-reads everything after the storage backend changes (sign in/out). */
  rehydrate: () => Promise<void>;
  /** Replaces in-memory state with rows pushed from another device. */
  applyRemote: (data: TripData) => void;
  /** Copies the trips held on this device into the signed-in account. */
  uploadLocalTripsToCloud: () => Promise<{ ok: boolean; message: string }>;
  persist: () => void;
  setActiveTrip: (id: ID | null) => void;
  undo: () => string | null;
  canUndo: () => boolean;
  clearAll: () => Promise<void>;
  importData: (raw: string) => { ok: boolean; message: string };
  exportData: () => string;

  /* trips */
  createTrip: (input: CreateTripInput) => ID;
  updateTrip: (id: ID, patch: Partial<Trip>) => void;
  deleteTrip: (id: ID) => void;

  /* travelers */
  addTraveler: (tripId: ID, name: string) => ID;
  updateTraveler: (id: ID, patch: Partial<Traveler>) => void;
  removeTraveler: (id: ID) => void;

  /* days */
  updateDay: (id: ID, patch: Partial<Day>) => void;

  /* activities */
  addActivity: (input: Omit<Activity, 'id' | 'order'> & { order?: number }) => ID;
  updateActivity: (id: ID, patch: Partial<Activity>) => void;
  deleteActivity: (id: ID) => void;
  moveActivity: (id: ID, dayId: ID, startTime?: string, order?: number) => void;
  reorderActivities: (dayId: ID, orderedIds: ID[]) => void;

  /* hotels */
  addHotel: (input: Omit<Hotel, 'id'>) => ID;
  updateHotel: (id: ID, patch: Partial<Hotel>) => void;
  deleteHotel: (id: ID) => void;

  /* flights */
  addFlight: (input: Omit<Flight, 'id'>) => ID;
  updateFlight: (id: ID, patch: Partial<Flight>) => void;
  deleteFlight: (id: ID) => void;

  /* cars */
  addCar: (input: Omit<CarRental, 'id'>) => ID;
  updateCar: (id: ID, patch: Partial<CarRental>) => void;
  deleteCar: (id: ID) => void;

  /* places */
  addPlace: (input: Omit<Place, 'id' | 'createdAt'>) => ID;
  updatePlace: (id: ID, patch: Partial<Place>) => void;
  deletePlace: (id: ID) => void;
  placeToActivity: (placeId: ID, dayId: ID, startTime?: string) => ID | null;

  /* expenses */
  addExpense: (input: Omit<Expense, 'id' | 'createdAt'>) => ID;
  updateExpense: (id: ID, patch: Partial<Expense>) => void;
  deleteExpense: (id: ID) => void;

  /* documents */
  addDocument: (input: Omit<TripDocument, 'id' | 'createdAt'>) => ID;
  updateDocument: (id: ID, patch: Partial<TripDocument>) => void;
  deleteDocument: (id: ID) => void;

  /* checklists */
  addChecklist: (input: Omit<Checklist, 'id' | 'createdAt'>) => ID;
  updateChecklist: (id: ID, patch: Partial<Checklist>) => void;
  deleteChecklist: (id: ID) => void;
  addChecklistItem: (checklistId: ID, text: string) => void;
  toggleChecklistItem: (checklistId: ID, itemId: ID) => void;
  updateChecklistItem: (checklistId: ID, itemId: ID, patch: Partial<ChecklistItem>) => void;
  deleteChecklistItem: (checklistId: ID, itemId: ID) => void;

  /* sharing */
  addShare: (input: Omit<ShareMember, 'id' | 'invitedAt'>) => ID;
  updateShare: (id: ID, patch: Partial<ShareMember>) => void;
  removeShare: (id: ID) => void;
}

export interface CreateTripInput {
  name: string;
  destination: string;
  countryCode?: string;
  startDate: string;
  endDate: string;
  travelerNames: string[];
  baseCurrency: CurrencyCode;
  currencies: CurrencyCode[];
  totalBudget: number;
  coverImage?: string;
  seedFlights?: boolean;
  seedCar?: boolean;
  seedHotel?: boolean;
}

const MAX_UNDO = 25;

/** Deep-ish clone that's plenty for our plain-JSON state. */
function snapshot(data: TripData): TripData {
  return JSON.parse(JSON.stringify(data)) as TripData;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useTripStore = create<TripState>()((set, get) => {
  /** Writes through to the repository, debounced so drag operations don't thrash. */
  const schedulePersist = () => {
    if (typeof window === 'undefined') return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      getRepository()
        .save(get().data)
        .then(() => {
          if (get().syncError) set({ syncError: null });
        })
        .catch((err) => {
          console.error('[store] persist failed', err);
          if (getStorageMode() === 'cloud') {
            // The change is safe locally and will be replayed on the next
            // successful save, so this is a status line rather than an error.
            set({
              syncError: 'אין חיבור לשרת — השינויים נשמרו במכשיר ויסונכרנו כשהחיבור יחזור.',
            });
          } else {
            set({ error: 'שמירת הנתונים נכשלה — ייתכן שנגמר מקום האחסון בדפדפן.' });
          }
        });
    }, 220);
  };

  /**
   * Every mutation goes through here: it records an undo point, applies the
   * change, and schedules a write. `undoLabel` omitted = not undoable.
   */
  const mutate = (undoLabel: string | null, recipe: (draft: TripData) => void) => {
    set((state) => {
      const next = snapshot(state.data);
      recipe(next);
      const undoStack = undoLabel
        ? [...state.undoStack, { label: undoLabel, snapshot: state.data }].slice(-MAX_UNDO)
        : state.undoStack;
      return { data: next, undoStack, error: null };
    });
    schedulePersist();
  };

  const touchTrip = (draft: TripData, tripId?: ID) => {
    const id = tripId ?? get().activeTripId;
    const trip = draft.trips.find((t) => t.id === id);
    if (trip) trip.updatedAt = new Date().toISOString();
  };

  return {
    data: EMPTY_DATA,
    activeTripId: null,
    status: 'idle',
    error: null,
    syncError: null,
    undoStack: [],

    async hydrate() {
      if (get().status === 'loading') return;
      set({ status: 'loading' });
      const repo = getRepository();
      try {
        const stored = await repo.load();

        if (stored && stored.trips.length > 0) {
          const savedActive =
            typeof window !== 'undefined' ? window.localStorage.getItem('mtp:activeTrip') : null;
          const active =
            savedActive && stored.trips.some((t) => t.id === savedActive)
              ? savedActive
              : stored.trips[0].id;
          set({ data: stored, activeTripId: active, status: 'ready', syncError: null });
          return;
        }

        set({
          data: stored ?? EMPTY_DATA,
          activeTripId: null,
          status: 'ready',
          syncError: null,
        });
      } catch (err) {
        console.error('[store] hydrate failed', err);
        set({ status: 'error', error: 'טעינת הנתונים נכשלה.' });
      }
    },

    async rehydrate() {
      // Called when the storage backend changes under us (sign in, sign out).
      // Reset to idle first so `hydrate`'s in-flight guard doesn't skip it.
      set({ status: 'idle', data: EMPTY_DATA, activeTripId: null, undoStack: [] });
      await get().hydrate();
    },

    applyRemote(data) {
      set((state) => {
        // Keep the open trip open if it still exists after the remote change.
        const activeStillThere =
          state.activeTripId && data.trips.some((t) => t.id === state.activeTripId);
        return {
          data,
          activeTripId: activeStillThere ? state.activeTripId : (data.trips[0]?.id ?? null),
          syncError: null,
        };
      });
    },

    async uploadLocalTripsToCloud() {
      if (getStorageMode() !== 'cloud') {
        return { ok: false, message: 'צריך להיות מחוברים לחשבון כדי להעלות לענן.' };
      }

      const local = await getLocalRepository().load();
      if (!local || local.trips.length === 0) {
        return { ok: false, message: 'אין טיולים שמורים במכשיר הזה.' };
      }

      const current = get().data;
      const existing = new Set(current.trips.map((t) => t.id));
      const newTrips = local.trips.filter((t) => !existing.has(t.id));
      if (newTrips.length === 0) {
        return { ok: false, message: 'כל הטיולים שבמכשיר כבר נמצאים בחשבון.' };
      }

      const newTripIds = new Set(newTrips.map((t) => t.id));
      const belongs = <T extends { tripId: ID }>(rows: T[]) =>
        rows.filter((r) => newTripIds.has(r.tripId));

      const merged: TripData = {
        trips: [...current.trips, ...newTrips],
        travelers: [...current.travelers, ...belongs(local.travelers)],
        days: [...current.days, ...belongs(local.days)],
        activities: [...current.activities, ...belongs(local.activities)],
        hotels: [...current.hotels, ...belongs(local.hotels)],
        flights: [...current.flights, ...belongs(local.flights)],
        cars: [...current.cars, ...belongs(local.cars)],
        places: [...current.places, ...belongs(local.places)],
        expenses: [...current.expenses, ...belongs(local.expenses)],
        // Uploaded documents keep their metadata; the files themselves stay on
        // this device until they are re-uploaded, so the link is dropped.
        documents: [...current.documents, ...belongs(local.documents).map((d) => ({
          ...d,
          fileKey: undefined,
        }))],
        checklists: [...current.checklists, ...belongs(local.checklists)],
        shares: current.shares,
      };

      try {
        await getRepository().save(merged);
      } catch (err) {
        console.error('[store] upload failed', err);
        // The reason is the whole value of this message. "Try again" on its
        // own asks the person to repeat an action that cannot succeed.
        const reason = err instanceof Error ? err.message : String(err);
        set({ syncError: `ההעלאה נכשלה — ${reason}` });
        return { ok: false, message: `ההעלאה נכשלה: ${reason}` };
      }

      set({ data: merged, activeTripId: newTrips[0].id, undoStack: [], syncError: null });
      return {
        ok: true,
        message:
          newTrips.length === 1
            ? `"${newTrips[0].name}" הועלה לחשבון`
            : `${newTrips.length} טיולים הועלו לחשבון`,
      };
    },

    persist: schedulePersist,

    setActiveTrip(id) {
      set({ activeTripId: id });
      if (typeof window !== 'undefined') {
        if (id) window.localStorage.setItem('mtp:activeTrip', id);
        else window.localStorage.removeItem('mtp:activeTrip');
      }
    },

    canUndo() {
      return get().undoStack.length > 0;
    },

    undo() {
      const stack = get().undoStack;
      if (stack.length === 0) return null;
      const last = stack[stack.length - 1];
      set({ data: last.snapshot, undoStack: stack.slice(0, -1) });
      schedulePersist();
      return last.label;
    },

    async clearAll() {
      await getRepository().clear();
      set({ data: EMPTY_DATA, activeTripId: null, undoStack: [], error: null });
      if (typeof window !== 'undefined') window.localStorage.removeItem('mtp:activeTrip');
    },

    exportData() {
      return JSON.stringify(get().data, null, 2);
    },

    importData(raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<TripData>;
        if (!Array.isArray(parsed.trips)) {
          return { ok: false, message: 'הקובץ אינו קובץ גיבוי תקין של האפליקציה.' };
        }
        const merged: TripData = { ...EMPTY_DATA, ...parsed };
        set((state) => ({
          data: merged,
          activeTripId: merged.trips[0]?.id ?? null,
          undoStack: [...state.undoStack, { label: 'ייבוא נתונים', snapshot: state.data }].slice(
            -MAX_UNDO
          ),
        }));
        schedulePersist();
        return { ok: true, message: `יובאו ${merged.trips.length} טיולים.` };
      } catch {
        return { ok: false, message: 'לא הצלחנו לקרוא את הקובץ.' };
      }
    },

    /* ---------------------------- trips ---------------------------- */

    createTrip(input) {
      const tripId = newId('trip');
      const now = new Date().toISOString();
      const currencies = Array.from(new Set([input.baseCurrency, ...input.currencies]));

      mutate('יצירת טיול', (draft) => {
        draft.trips.push({
          id: tripId,
          name: input.name,
          destination: input.destination,
          countryCode: input.countryCode ?? '',
          coverImage: input.coverImage,
          startDate: input.startDate,
          endDate: input.endDate,
          baseCurrency: input.baseCurrency,
          totalBudget: input.totalBudget,
          currencies,
          rates: defaultRates(input.baseCurrency, currencies),
          ratesSource: 'manual',
          createdAt: now,
          updatedAt: now,
        });

        input.travelerNames.forEach((name, i) => {
          draft.travelers.push({
            id: newId('trv'),
            tripId,
            name: name.trim() || `מטייל ${i + 1}`,
            color: TRAVELER_COLORS[i % TRAVELER_COLORS.length],
            isOwner: i === 0,
          });
        });

        eachDate(input.startDate, input.endDate).forEach((date, i) => {
          draft.days.push({
            id: newId('day'),
            tripId,
            date,
            index: i + 1,
            title: `יום ${i + 1}`,
          });
        });

        // Optional starters requested in the wizard — placeholders the user
        // fills in, so the relevant screens aren't empty on day one.
        if (input.seedFlights) {
          draft.flights.push(
            blankFlight(tripId, 'outbound', input.startDate, input.baseCurrency),
            blankFlight(tripId, 'return', input.endDate, input.baseCurrency)
          );
        }
        if (input.seedCar) {
          draft.cars.push({
            id: newId('car'),
            tripId,
            company: '',
            pickupDate: input.startDate,
            pickupLocation: '',
            dropoffDate: input.endDate,
            dropoffLocation: '',
            currency: input.baseCurrency,
          });
        }
        if (input.seedHotel) {
          draft.hotels.push({
            id: newId('htl'),
            tripId,
            name: '',
            city: input.destination,
            checkIn: input.startDate,
            checkOut: input.endDate,
            currency: input.baseCurrency,
          });
        }

        draft.checklists.push({
          id: newId('chk'),
          tripId,
          title: 'לפני הטיסה',
          group: 'before-flight',
          items: [
            'צ׳ק־אין אונליין',
            'לבדוק תוקף דרכונים',
            'ביטוח נסיעות',
            'להוריד מפות אופליין',
          ].map((text) => ({ id: newId('chi'), text, done: false })),
          createdAt: now,
        });
      });

      get().setActiveTrip(tripId);
      return tripId;
    },

    updateTrip(id, patch) {
      mutate('עדכון טיול', (draft) => {
        const trip = draft.trips.find((t) => t.id === id);
        if (!trip) return;
        const prevStart = trip.startDate;
        const prevEnd = trip.endDate;
        Object.assign(trip, patch, { updatedAt: new Date().toISOString() });

        // Dates changed — re-align the day rows without losing planned days.
        if (
          (patch.startDate && patch.startDate !== prevStart) ||
          (patch.endDate && patch.endDate !== prevEnd)
        ) {
          syncDays(draft, trip);
        }
      });
    },

    deleteTrip(id) {
      mutate('מחיקת טיול', (draft) => {
        draft.trips = draft.trips.filter((t) => t.id !== id);
        draft.travelers = draft.travelers.filter((x) => x.tripId !== id);
        const dayIds = new Set(draft.days.filter((d) => d.tripId === id).map((d) => d.id));
        draft.days = draft.days.filter((d) => d.tripId !== id);
        draft.activities = draft.activities.filter(
          (a) => a.tripId !== id && !dayIds.has(a.dayId)
        );
        draft.hotels = draft.hotels.filter((x) => x.tripId !== id);
        draft.flights = draft.flights.filter((x) => x.tripId !== id);
        draft.cars = draft.cars.filter((x) => x.tripId !== id);
        draft.places = draft.places.filter((x) => x.tripId !== id);
        draft.expenses = draft.expenses.filter((x) => x.tripId !== id);
        draft.documents = draft.documents.filter((x) => x.tripId !== id);
        draft.checklists = draft.checklists.filter((x) => x.tripId !== id);
        draft.shares = draft.shares.filter((x) => x.tripId !== id);
      });
      if (get().activeTripId === id) {
        get().setActiveTrip(get().data.trips[0]?.id ?? null);
      }
    },

    /* -------------------------- travelers -------------------------- */

    addTraveler(tripId, name) {
      const id = newId('trv');
      mutate('הוספת מטייל', (draft) => {
        const count = draft.travelers.filter((t) => t.tripId === tripId).length;
        draft.travelers.push({
          id,
          tripId,
          name: name.trim() || `מטייל ${count + 1}`,
          color: TRAVELER_COLORS[count % TRAVELER_COLORS.length],
        });
      });
      return id;
    },

    updateTraveler(id, patch) {
      mutate('עדכון מטייל', (draft) => {
        const t = draft.travelers.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
      });
    },

    removeTraveler(id) {
      mutate('הסרת מטייל', (draft) => {
        draft.travelers = draft.travelers.filter((t) => t.id !== id);
        for (const e of draft.expenses) {
          if (e.paidById === id) e.paidById = undefined;
          e.splitBetween = e.splitBetween.filter((x) => x !== id);
        }
        for (const c of draft.checklists) {
          for (const item of c.items) if (item.assigneeId === id) item.assigneeId = undefined;
        }
      });
    },

    /* ----------------------------- days ---------------------------- */

    updateDay(id, patch) {
      mutate('עדכון יום', (draft) => {
        const d = draft.days.find((x) => x.id === id);
        if (d) Object.assign(d, patch);
        touchTrip(draft, d?.tripId);
      });
    },

    /* -------------------------- activities ------------------------- */

    addActivity(input) {
      const id = newId('act');
      mutate('הוספת פעילות', (draft) => {
        const maxOrder = draft.activities
          .filter((a) => a.dayId === input.dayId)
          .reduce((m, a) => Math.max(m, a.order), -1);
        draft.activities.push({ ...input, id, order: input.order ?? maxOrder + 1 });
        touchTrip(draft, input.tripId);
      });
      return id;
    },

    updateActivity(id, patch) {
      mutate('עדכון פעילות', (draft) => {
        const a = draft.activities.find((x) => x.id === id);
        if (a) Object.assign(a, patch);
        touchTrip(draft, a?.tripId);
      });
    },

    deleteActivity(id) {
      mutate('מחיקת פעילות', (draft) => {
        const activity = draft.activities.find((a) => a.id === id);
        draft.activities = draft.activities.filter((a) => a.id !== id);
        // A place that was scheduled from the board goes back to the board.
        if (activity?.placeId) {
          const place = draft.places.find((p) => p.id === activity.placeId);
          if (place) place.dayId = undefined;
        }
      });
    },

    moveActivity(id, dayId, startTime, order) {
      mutate('העברת פעילות', (draft) => {
        const a = draft.activities.find((x) => x.id === id);
        if (!a) return;
        a.dayId = dayId;
        if (startTime !== undefined) a.startTime = startTime || undefined;
        if (order !== undefined) a.order = order;
        if (a.placeId) {
          const place = draft.places.find((p) => p.id === a.placeId);
          if (place) place.dayId = dayId;
        }
      });
    },

    reorderActivities(dayId, orderedIds) {
      mutate('סידור מחדש', (draft) => {
        orderedIds.forEach((id, i) => {
          const a = draft.activities.find((x) => x.id === id && x.dayId === dayId);
          if (a) a.order = i;
        });
      });
    },

    /* ---------------------------- hotels --------------------------- */

    addHotel(input) {
      const id = newId('htl');
      mutate('הוספת מלון', (draft) => {
        draft.hotels.push({ ...input, id });
      });
      return id;
    },
    updateHotel(id, patch) {
      mutate('עדכון מלון', (draft) => {
        const h = draft.hotels.find((x) => x.id === id);
        if (h) Object.assign(h, patch);
      });
    },
    deleteHotel(id) {
      mutate('מחיקת מלון', (draft) => {
        draft.hotels = draft.hotels.filter((h) => h.id !== id);
        for (const d of draft.days) if (d.hotelId === id) d.hotelId = undefined;
        for (const e of draft.expenses) {
          if (e.linkedType === 'hotel' && e.linkedId === id) {
            e.linkedType = undefined;
            e.linkedId = undefined;
          }
        }
      });
    },

    /* --------------------------- flights --------------------------- */

    addFlight(input) {
      const id = newId('flt');
      mutate('הוספת טיסה', (draft) => {
        draft.flights.push({ ...input, id });
      });
      return id;
    },
    updateFlight(id, patch) {
      mutate('עדכון טיסה', (draft) => {
        const f = draft.flights.find((x) => x.id === id);
        if (f) Object.assign(f, patch);
      });
    },
    deleteFlight(id) {
      mutate('מחיקת טיסה', (draft) => {
        draft.flights = draft.flights.filter((f) => f.id !== id);
      });
    },

    /* ----------------------------- cars ---------------------------- */

    addCar(input) {
      const id = newId('car');
      mutate('הוספת רכב', (draft) => {
        draft.cars.push({ ...input, id });
      });
      return id;
    },
    updateCar(id, patch) {
      mutate('עדכון רכב', (draft) => {
        const c = draft.cars.find((x) => x.id === id);
        if (c) Object.assign(c, patch);
      });
    },
    deleteCar(id) {
      mutate('מחיקת רכב', (draft) => {
        draft.cars = draft.cars.filter((c) => c.id !== id);
      });
    },

    /* ---------------------------- places --------------------------- */

    addPlace(input) {
      const id = newId('plc');
      mutate('הוספת מקום', (draft) => {
        draft.places.push({ ...input, id, createdAt: new Date().toISOString() });
      });
      return id;
    },
    updatePlace(id, patch) {
      mutate('עדכון מקום', (draft) => {
        const p = draft.places.find((x) => x.id === id);
        if (p) Object.assign(p, patch);
      });
    },
    deletePlace(id) {
      mutate('מחיקת מקום', (draft) => {
        draft.places = draft.places.filter((p) => p.id !== id);
      });
    },

    placeToActivity(placeId, dayId, startTime) {
      const place = get().data.places.find((p) => p.id === placeId);
      if (!place) return null;
      const id = newId('act');
      mutate('הוספה למסלול', (draft) => {
        const maxOrder = draft.activities
          .filter((a) => a.dayId === dayId)
          .reduce((m, a) => Math.max(m, a.order), -1);
        draft.activities.push({
          id,
          tripId: place.tripId,
          dayId,
          title: place.name,
          category: place.category,
          startTime,
          durationMin: 90,
          address: place.address,
          location: place.location,
          price: place.price,
          currency: place.currency,
          notes: place.notes,
          url: place.url,
          image: place.image,
          placeId: place.id,
          order: maxOrder + 1,
        });
        const p = draft.places.find((x) => x.id === placeId);
        if (p) p.dayId = dayId;
      });
      return id;
    },

    /* --------------------------- expenses -------------------------- */

    addExpense(input) {
      const id = newId('exp');
      mutate('הוספת הוצאה', (draft) => {
        draft.expenses.push({ ...input, id, createdAt: new Date().toISOString() });
      });
      return id;
    },
    updateExpense(id, patch) {
      mutate('עדכון הוצאה', (draft) => {
        const e = draft.expenses.find((x) => x.id === id);
        if (e) Object.assign(e, patch);
      });
    },
    deleteExpense(id) {
      mutate('מחיקת הוצאה', (draft) => {
        draft.expenses = draft.expenses.filter((e) => e.id !== id);
      });
    },

    /* -------------------------- documents -------------------------- */

    addDocument(input) {
      const id = newId('doc');
      mutate('הוספת מסמך', (draft) => {
        draft.documents.push({ ...input, id, createdAt: new Date().toISOString() });
      });
      return id;
    },
    updateDocument(id, patch) {
      mutate('עדכון מסמך', (draft) => {
        const d = draft.documents.find((x) => x.id === id);
        if (d) Object.assign(d, patch);
      });
    },
    deleteDocument(id) {
      const doc = get().data.documents.find((d) => d.id === id);
      mutate('מחיקת מסמך', (draft) => {
        draft.documents = draft.documents.filter((d) => d.id !== id);
      });
      // The blob is only dropped once undo can no longer bring the row back.
      if (doc?.fileKey) {
        const key = doc.fileKey;
        setTimeout(() => {
          const stillReferenced = get().data.documents.some((d) => d.fileKey === key);
          if (!stillReferenced) void deleteBlob(key);
        }, 30_000);
      }
    },

    /* -------------------------- checklists ------------------------- */

    addChecklist(input) {
      const id = newId('chk');
      mutate('הוספת רשימה', (draft) => {
        draft.checklists.push({ ...input, id, createdAt: new Date().toISOString() });
      });
      return id;
    },
    updateChecklist(id, patch) {
      mutate('עדכון רשימה', (draft) => {
        const c = draft.checklists.find((x) => x.id === id);
        if (c) Object.assign(c, patch);
      });
    },
    deleteChecklist(id) {
      mutate('מחיקת רשימה', (draft) => {
        draft.checklists = draft.checklists.filter((c) => c.id !== id);
      });
    },
    addChecklistItem(checklistId, text) {
      mutate('הוספת פריט', (draft) => {
        const c = draft.checklists.find((x) => x.id === checklistId);
        if (c) c.items.push({ id: newId('chi'), text, done: false });
      });
    },
    toggleChecklistItem(checklistId, itemId) {
      // Ticking a box is high-frequency and trivially reversible — it doesn't
      // deserve a slot in the undo stack.
      mutate(null, (draft) => {
        const c = draft.checklists.find((x) => x.id === checklistId);
        const item = c?.items.find((i) => i.id === itemId);
        if (item) item.done = !item.done;
      });
    },
    updateChecklistItem(checklistId, itemId, patch) {
      mutate('עדכון פריט', (draft) => {
        const c = draft.checklists.find((x) => x.id === checklistId);
        const item = c?.items.find((i) => i.id === itemId);
        if (item) Object.assign(item, patch);
      });
    },
    deleteChecklistItem(checklistId, itemId) {
      mutate('מחיקת פריט', (draft) => {
        const c = draft.checklists.find((x) => x.id === checklistId);
        if (c) c.items = c.items.filter((i) => i.id !== itemId);
      });
    },

    /* --------------------------- sharing --------------------------- */

    addShare(input) {
      const id = newId('shr');
      mutate('שיתוף', (draft) => {
        draft.shares.push({ ...input, id, invitedAt: new Date().toISOString() });
      });
      return id;
    },
    updateShare(id, patch) {
      mutate('עדכון הרשאה', (draft) => {
        const s = draft.shares.find((x) => x.id === id);
        if (s) Object.assign(s, patch);
      });
    },
    removeShare(id) {
      mutate('ביטול שיתוף', (draft) => {
        draft.shares = draft.shares.filter((s) => s.id !== id);
      });
    },
  };
});

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

const TRAVELER_COLORS = [
  '#1d67f0',
  '#a1263f',
  '#11916b',
  '#db8629',
  '#7c5cf0',
  '#0aa2c0',
  '#d63f8c',
  '#64748b',
];

function blankFlight(
  tripId: ID,
  direction: 'outbound' | 'return',
  date: string,
  currency: CurrencyCode
): Flight {
  return {
    id: newId('flt'),
    tripId,
    direction,
    airline: '',
    flightNumber: '',
    date,
    from: { code: '', name: '' },
    to: { code: '', name: '' },
    currency,
  };
}

/**
 * Keeps `days` in step with the trip's dates: trims days that fell outside the
 * new range, appends new ones, and renumbers. Activities on a trimmed day are
 * moved to the last surviving day rather than silently deleted.
 */
function syncDays(draft: TripData, trip: Trip) {
  const wanted = eachDate(trip.startDate, trip.endDate);
  const existing = draft.days.filter((d) => d.tripId === trip.id);
  const byDate = new Map(existing.map((d) => [d.date, d]));

  const kept: Day[] = [];
  wanted.forEach((date, i) => {
    const hit = byDate.get(date);
    if (hit) {
      hit.index = i + 1;
      kept.push(hit);
      byDate.delete(date);
    } else {
      kept.push({
        id: newId('day'),
        tripId: trip.id,
        date,
        index: i + 1,
        title: `יום ${i + 1}`,
      });
    }
  });

  const orphanIds = new Set([...byDate.values()].map((d) => d.id));
  if (orphanIds.size > 0) {
    const fallback = kept[kept.length - 1]?.id;
    for (const a of draft.activities) {
      if (orphanIds.has(a.dayId) && fallback) a.dayId = fallback;
    }
  }

  draft.days = [...draft.days.filter((d) => d.tripId !== trip.id), ...kept];
}

/** Convenience for screens that need the trip length. */
export function tripLength(trip: Trip) {
  return daysBetweenInclusive(trip.startDate, trip.endDate);
}

export { addDays };
