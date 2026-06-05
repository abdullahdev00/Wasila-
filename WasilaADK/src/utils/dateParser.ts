export function parseBookingDateToTimestamp(dateStr: string): number {
  const now = new Date();
  let targetDate = new Date();

  const lower = dateStr.toLowerCase();

  // 1. Determine day offset (today vs tomorrow)
  if (lower.includes('tomorrow') || lower.includes('kl') || lower.includes('kal')) {
    targetDate.setDate(now.getDate() + 1);
  } else if (lower.includes('today') || lower.includes('aaj')) {
    targetDate.setDate(now.getDate());
  }

  // 2. Extract hour and AM/PM
  let hours = 10; // default
  let minutes = 0;

  // Pattern: "10:00 AM" or "2:00 PM"
  const timeRegex = /(\d{1,2}):(\d{2})\s*(am|pm)/i;
  const match = lower.match(timeRegex);
  if (match) {
    hours = parseInt(match[1]);
    minutes = parseInt(match[2]);
    const ampm = match[3];
    if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
    if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
  } else {
    // Pattern: "4 bjy" or "4bjy" or "7 pm"
    const bjyRegex = /(\d{1,2})\s*(bjy|pm|am)/i;
    const bjyMatch = lower.match(bjyRegex);
    if (bjyMatch) {
      hours = parseInt(bjyMatch[1]);
      const marker = bjyMatch[2].toLowerCase();
      // If "bjy" or "pm" and it's afternoon (e.g. 4 bjy, 7 bjy), default to PM if hours < 12
      if (marker === 'bjy' || marker === 'pm') {
        if (hours < 12) {
          // If it's 9, 10, 11 "bjy", it's morning (AM)
          if (hours >= 9 && hours <= 11) {
            // keep as AM
          } else {
            hours += 12; // PM
          }
        }
      }
    }
  }

  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate.getTime();
}
