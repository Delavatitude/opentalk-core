import {api} from "./client";
// Explicit endpoints: the sandbox retained the legacy deployed booking functions.
export const getAvailability = data => api.functions.invoke("getAvailabilityWithCalendars",data);
export const createBooking = data => api.functions.invoke("createBookingWithMeeting",data);
export const rescheduleBooking = data => api.functions.invoke("rescheduleBookingMultiCalendar",data);
export const cancelBooking = data => api.functions.invoke("cancelBookingMultiCalendar",data);

export const getBookingByToken = data => api.functions.invoke("getBookingByToken",data);
export const adminBookingActions = data => api.functions.invoke("adminBookingActions",data);
export const adminStats = data => api.functions.invoke("adminStats",data);
