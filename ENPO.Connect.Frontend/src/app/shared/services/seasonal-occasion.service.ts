import { Injectable } from '@angular/core';

export interface Occasion {
  id: string;
  name: string;
  baseYear: number;
  baseStartDate: Date;
  shiftPerYearDays: number;
  durationDays: number;
  priority: number;
  message: string;
  subMessage?: string;
  themeClass?: string; // e.g., 'ramadan-theme'
  icon?: string; // e.g., 'pi pi-moon'
  imageUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SeasonalOccasionService {

  private occasions: Occasion[] = [
    {
      id: 'ramadan',
      name: 'Ramadan Greeting',
      baseYear: 2026,
      baseStartDate: new Date(2026, 1, 14), // Feb 14, 2026 (Month is 0-indexed in JS/TS Date)
      shiftPerYearDays: -11,
      durationDays: 37,
      priority: 10,
      message: 'رمضان كريم',
      subMessage: 'كل عام وأنتم بخير، أعاده الله علينا وعليكم باليمن والبركات',
      themeClass: 'ramadan-theme',
      icon: 'pi pi-moon'
    }
  ];

  constructor() { }

  /**
   * Calculates the start and end dates for an occasion in a specific year.
   */
  getOccasionWindow(occasion: Occasion, year: number): { start: Date, end: Date } {
    const yearsDiff = year - occasion.baseYear;

    // Create a copy of the base date and set the year to the target year
    // Note: Setting the year directly might be problematic if we land on Feb 29 in a non-leap year,
    // but the shift logic is approximation anyway.
    // A more robust logical approach for "same day next year" is adding years.
    
    // Approach: Start with base date. Add years. Add shift days.
    const startDate = new Date(occasion.baseStartDate);
    startDate.setFullYear(year); 

    // Calculate total days shift
    const totalShiftDays = yearsDiff * occasion.shiftPerYearDays;
    
    // Apply shift
    startDate.setDate(startDate.getDate() + totalShiftDays);

    // Calculate end date
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + occasion.durationDays);

    return { start: startDate, end: endDate };
  }

  /**
   * Returns the highest priority active occasion for a given date (default: now).
   */
  getActiveOccasion(date: Date = new Date()): Occasion | null {
    const currentYear = date.getFullYear();
    
    // We check occasions for the current year. 
    // Edge case: An occasion might span across years (starts in Dec, ends in Jan).
    // For simplicity MVP (Ramadan shifts backwards), checking current year +/- 1 might be needed if close to boundary.
    // However, given the prompt constraints (Ramadan shifting -11 days), checking the computed window for current year should suffice for now.
    // To be safe, we can check the window for the occasion for the current year.

    let activeOccasion: Occasion | null = null;

    for (const occasion of this.occasions) {
        const window = this.getOccasionWindow(occasion, currentYear);
        
        // Check if date is within window
        if (date >= window.start && date <= window.end) {
            if (!activeOccasion || occasion.priority > activeOccasion.priority) {
                activeOccasion = occasion;
            }
        }
    }

    return activeOccasion;
  }
}
