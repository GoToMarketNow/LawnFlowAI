import { addDays, format, setHours, setMinutes, startOfDay } from "date-fns";

export interface SchedulingSlot {
  id: string;
  display: string;
  date: Date;
  startTime: string;
  endTime: string;
}

export interface SchedulingConfig {
  timezone?: string;
  windowDays?: number;
  maxSlots?: number;
  durationMinutes?: number;
}

export function getAvailableSlots(
  accountId: string,
  dateWindow: number = 7,
  config: SchedulingConfig = {}
): SchedulingSlot[] {
  const { maxSlots = 3 } = config;
  const slots: SchedulingSlot[] = [];
  const today = new Date();
  
  const slotPatterns = [
    { dayOffset: 1, hour: 9, label: "AM" },
    { dayOffset: 2, hour: 14, label: "PM" },
    { dayOffset: 3, hour: 10, label: "AM" },
    { dayOffset: 4, hour: 13, label: "PM" },
    { dayOffset: 5, hour: 9, label: "AM" },
    { dayOffset: 6, hour: 11, label: "AM" },
  ];
  
  for (const pattern of slotPatterns.slice(0, maxSlots)) {
    const slotDate = addDays(today, pattern.dayOffset);
    const dayName = format(slotDate, "EEE");
    
    const startHour = pattern.hour;
    const endHour = startHour + 2;
    
    const startTime = `${startHour}:00`;
    const endTime = `${endHour}:00`;
    
    const displayTime = pattern.label === "AM" 
      ? `${startHour}-${endHour > 12 ? endHour - 12 : endHour}${endHour >= 12 ? "pm" : "am"}`
      : `${startHour > 12 ? startHour - 12 : startHour}-${endHour > 12 ? endHour - 12 : endHour}pm`;
    
    slots.push({
      id: `slot_${pattern.dayOffset}_${startHour}`,
      display: `${dayName} ${displayTime}`,
      date: slotDate,
      startTime,
      endTime,
    });
  }
  
  return slots;
}

export function selectSlotByIndex(
  slots: SchedulingSlot[],
  index: number
): SchedulingSlot | null {
  if (index < 0 || index >= slots.length) {
    return null;
  }
  return slots[index];
}

export async function reserveSlot(
  sessionId: string,
  slot: SchedulingSlot
): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  return {
    success: true,
    reservationId,
  };
}

export async function confirmBooking(
  sessionId: string,
  reservationId: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  return {
    success: true,
    jobId,
  };
}

export function formatSlotsForDisplay(slots: SchedulingSlot[]): string[] {
  return slots.map(s => s.display);
}
