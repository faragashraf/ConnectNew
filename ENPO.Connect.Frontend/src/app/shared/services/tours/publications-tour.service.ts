import { Injectable } from '@angular/core';
import { TourDriverService } from './tour-driver.service';

@Injectable({
  providedIn: 'root'
})
export class PublicationsTourService {
  private tourKey = 'connect-publications-tour-completed-v1';

  constructor(private tourDriver: TourDriverService) { }

  public startTour(force: boolean = false) {
    if (!force && this.isTourCompleted()) {
      return;
    }
    this.runTour();
  }

  public forceStartTour() {
      this.startTour(true);
  }

  private runTour() {
    this.tourDriver.start({
      steps: [
        {
          element: '.sidebar-pane',
          popover: {
            title: 'القائمة الجانبية',
            description: 'استخدم هذه القائمة للتنقل بين تصنيفات المنشورات المختلفة.',
            side: 'left',
            align: 'start'
          }
        },
        {
          element: '.collapse-toggle',
          popover: {
            title: 'محددات البحث',
            description: 'يمكنك إظهار أو إخفاء نموذج البحث باستخدام هذا الزر لتوفير مساحة أكبر للعرض.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
            element: '.form-area',
            popover: {
                title: 'نموذج البحث',
                description: 'أدخل معايير البحث هنا لتصفية النتائج في الجدول.',
                side: 'bottom',
                align: 'center'
            }
        },
        {
          element: '.table-container',
          popover: {
            title: 'جدول البيانات',
            description: 'يعرض هذا الجدول نتائج البحث. يمكنك ترتيب الأعمدة، التصفية، أو اتخاذ إجراءات على الصفوف.',
            side: 'top',
            align: 'center'
          }
        }
      ],
      onDestroyed: () => {
        if (this.tourDriver.getActiveIndex() >= 2) {
           this.markTourCompleted();
        }
      }
    });
  }

  private isTourCompleted(): boolean {
    return localStorage.getItem(this.tourKey) === 'true';
  }

  private markTourCompleted() {
    localStorage.setItem(this.tourKey, 'true');
  }
}
