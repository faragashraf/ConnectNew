import { Injectable } from '@angular/core';
import { driver, Driver, DriveStep, Config } from 'driver.js';

@Injectable({
  providedIn: 'root'
})
export class TourDriverService {
  public driverObj: Driver | null = null;
  private currentIndex = 0;
  
  constructor() { }

  public start(config: Config) {
    if (this.driverObj) {
      this.driverObj.destroy();
    }
    
    this.currentIndex = 0;

    const finalConfig: Config = {
      showProgress: true,
      progressText: '{{current}} من {{total}}',
      allowClose: true,
      animate: true,
      nextBtnText: 'التالي',
      prevBtnText: 'السابق',
      doneBtnText: 'إنهاء',
      ...config, // Override with specific tour config
      onHighlightStarted: (element?: Element, step?: DriveStep, options?: any) => {
         // Update internal index tracking
         if (this.driverObj) {
            this.currentIndex = this.driverObj.getActiveIndex() || 0;
         }

         this.fixOverlayZIndex();
         if (config.onHighlightStarted && step) {
            config.onHighlightStarted(element, step, options);
         }
      },
      onDestroyed: (element?: Element, step?: DriveStep, options?: any) => {
         if (config.onDestroyed && step) {
             config.onDestroyed(element, step, options);
         }
         setTimeout(() => { this.driverObj = null; }, 100);
      }
    };

    this.driverObj = driver(finalConfig);
    this.driverObj.drive();
  }

  public moveNext() {
      this.driverObj?.moveNext();
  }

  public getActiveIndex(): number {
      // Return the last known index if driver is null or destroyed
      return this.driverObj ? (this.driverObj.getActiveIndex() || this.currentIndex) : this.currentIndex;
  }
  
  public destroy() {
      this.driverObj?.destroy();
  }

  private fixOverlayZIndex() {
     setTimeout(() => {
        const overlays = document.querySelectorAll('.p-overlaypanel');
        overlays.forEach((el) => {
             (el as HTMLElement).style.zIndex = '100000005'; 
        });
    }, 100);
  }
}
