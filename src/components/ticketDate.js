import {escapeText} from '../services/ticketsAdminService.js';
// Display source-local dates without converting their timezone or inventing hours.
export function ticketDate(value,hour='') {
 let date=String(value||'').trim(),time=String(hour||'').trim();
 const match=date.match(/^(.+?)\s+(\d{2}:\d{2}(?::\d{2})?)$/);
 if(match){date=match[1];if(!time)time=match[2];}
 return `<span class="ticket-date-day">${escapeText(date||'Sin registro')}</span>${time?`<span class="ticket-date-time">${escapeText(time)}</span>`:''}`;
}
