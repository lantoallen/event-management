// Ticket codes are stored as 10 characters and shown as two groups of five.
export const formatTicketCode = (code: string) => `${code.slice(0, 5)}-${code.slice(5)}`;
