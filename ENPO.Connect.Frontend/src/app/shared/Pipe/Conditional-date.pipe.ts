// custom-date.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'ConditionalDate' })
export class ConditionalDate implements PipeTransform {
  
  transform(value: Date | string | null, format: 'short' | 'full' = 'full'): string | null {
    if (!value) return null;

    let date: Date;
    if (value instanceof Date) {
      // Directly use Date object from p-calendar
      date = value;
    } else {
      const [datePart, timePart] = value.split(' ');
      const separator = datePart?.includes('-') ? '-' : '/';

      // Try parsing as ISO string first
      date = new Date(value);

      if (isNaN(date.getTime())) {
        // Fall back to custom format parsing
        const [day, month, year] = datePart.split(separator);
        const [hours, minutes, seconds] = (timePart || '00:00:00').split(':');
        
        date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes),
          parseInt(seconds)
        );
      }
    }

    if (isNaN(date.getTime())) return null;

    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    
    if (format === 'short') {
      return formattedDate;
    }

    const formattedTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    return `${formattedDate} ${formattedTime}`;
  }
}

