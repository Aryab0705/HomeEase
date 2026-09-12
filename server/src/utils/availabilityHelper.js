const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_NAMES_FROM_GET_DAY = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const getDefaultSchedule = () => [
  { day: "Monday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Tuesday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Wednesday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Thursday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Friday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Saturday", enabled: true, start: "09:00", end: "18:00" },
  { day: "Sunday", enabled: false, start: "09:00", end: "18:00" },
];

/**
 * Normalizes availability structure and ensures schedule & specificDates are present.
 */
function ensureAvailabilityStructure(raw = {}) {
  const isAvailable = raw.isAvailable !== false;
  const emergencyAvailability = Boolean(raw.emergencyAvailability);
  const workingDays = Array.isArray(raw.workingDays) && raw.workingDays.length > 0
    ? raw.workingDays
    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const defaultHours = raw.workingHours || { start: "09:00", end: "18:00" };

  let schedule = Array.isArray(raw.schedule) && raw.schedule.length > 0 ? raw.schedule : null;
  if (!schedule) {
    schedule = DAYS_OF_WEEK.map((day) => ({
      day,
      enabled: workingDays.includes(day),
      start: defaultHours.start || "09:00",
      end: defaultHours.end || "18:00",
    }));
  }

  const specificDates = Array.isArray(raw.specificDates) ? raw.specificDates : [];

  return {
    isAvailable,
    emergencyAvailability,
    workingDays: schedule.filter((s) => s.enabled).map((s) => s.day),
    workingHours: defaultHours,
    schedule,
    specificDates,
  };
}

/**
 * Validates whether a provider is available on a specific date and time slot.
 *
 * @param {Object} provider - Provider document/object
 * @param {string|Date} scheduledDate - e.g. '2026-09-15' or ISO Date string
 * @param {Object|string} [scheduledTimeSlot] - { start: '10:00', end: '12:00' } or '10:00'
 * @returns {{ available: boolean, message?: string, dayOfWeek?: string, workingHours?: { start: string, end: string } }}
 */
function checkProviderAvailability(provider, scheduledDate, scheduledTimeSlot) {
  if (!provider) {
    return { available: false, message: "Provider not found." };
  }

  const availability = provider.availability || {};

  // 1. Overall isAvailable flag
  if (availability.isAvailable === false) {
    return { available: false, message: "Provider is currently marked as unavailable." };
  }

  if (!scheduledDate) {
    return { available: false, message: "Scheduled date is required." };
  }

  let yyyyMmDd = "";
  let dayOfWeek = "";

  if (typeof scheduledDate === "string") {
    const trimmed = scheduledDate.trim().split("T")[0]; // YYYY-MM-DD
    const parts = trimmed.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [y, m, d] = parts;
      const localDate = new Date(y, m - 1, d);
      dayOfWeek = DAY_NAMES_FROM_GET_DAY[localDate.getDay()];
      yyyyMmDd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (!yyyyMmDd) {
    const d = new Date(scheduledDate);
    if (isNaN(d.getTime())) {
      return { available: false, message: "Invalid scheduled date format." };
    }
    yyyyMmDd = d.toISOString().split("T")[0];
    dayOfWeek = DAY_NAMES_FROM_GET_DAY[d.getDay()];
  }

  // 2. Specific Dates override (holidays, leaves, or custom working days)
  // "A specific unavailable date must override the normal working-day schedule."
  const specificDates = availability.specificDates || [];
  const specificEntry = specificDates.find((s) => s.date === yyyyMmDd);

  let isWorking = false;
  let dayStart = "09:00";
  let dayEnd = "18:00";

  if (specificEntry) {
    if (!specificEntry.isAvailable) {
      const reasonText = specificEntry.reason ? ` (${specificEntry.reason})` : "";
      return {
        available: false,
        message: `Provider is not available on ${yyyyMmDd}${reasonText}. Please choose another date.`,
      };
    }
    // Specific date is marked explicitly available
    isWorking = true;
    dayStart = specificEntry.start || "09:00";
    dayEnd = specificEntry.end || "18:00";
  } else {
    // 3. Normal weekly schedule
    const schedule = availability.schedule || [];
    const dayItem = schedule.find((s) => s.day === dayOfWeek);

    if (dayItem) {
      isWorking = Boolean(dayItem.enabled);
      dayStart = dayItem.start || "09:00";
      dayEnd = dayItem.end || "18:00";
    } else if (availability.workingDays && availability.workingDays.length > 0) {
      isWorking = availability.workingDays.includes(dayOfWeek);
      dayStart = availability.workingHours?.start || "09:00";
      dayEnd = availability.workingHours?.end || "18:00";
    } else {
      isWorking = true;
    }

    if (!isWorking) {
      return {
        available: false,
        message: `Provider does not work on ${dayOfWeek}s. Please choose a working day.`,
      };
    }
  }

  // 4. Working hours validation
  if (scheduledTimeSlot) {
    const reqStart =
      typeof scheduledTimeSlot === "string"
        ? scheduledTimeSlot
        : scheduledTimeSlot.start;
    const reqEnd =
      typeof scheduledTimeSlot === "object" ? scheduledTimeSlot.end : null;

    if (reqStart) {
      const cleanStart = reqStart.trim().slice(0, 5);
      if (cleanStart < dayStart || cleanStart > dayEnd) {
        return {
          available: false,
          message: `Requested start time (${cleanStart}) is outside provider's working hours for ${dayOfWeek} (${dayStart} - ${dayEnd}).`,
        };
      }
    }

    if (reqEnd) {
      const cleanEnd = reqEnd.trim().slice(0, 5);
      if (cleanEnd > dayEnd) {
        return {
          available: false,
          message: `Requested end time (${cleanEnd}) is outside provider's working hours for ${dayOfWeek} (${dayStart} - ${dayEnd}).`,
        };
      }
      if (reqStart && cleanEnd <= reqStart.trim().slice(0, 5)) {
        return {
          available: false,
          message: "End time must be after start time.",
        };
      }
    }
  }

  return {
    available: true,
    dayOfWeek,
    workingHours: { start: dayStart, end: dayEnd },
  };
}

module.exports = {
  DAYS_OF_WEEK,
  DAY_NAMES_FROM_GET_DAY,
  getDefaultSchedule,
  ensureAvailabilityStructure,
  checkProviderAvailability,
};
