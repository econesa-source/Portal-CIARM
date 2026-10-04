import { getMisSolicitudes } from './ticketsService.js';

export async function fetchUserTicketsAPI(email) {
  return await getMisSolicitudes(email);
}
