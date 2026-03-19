import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TourDriverService } from './tour-driver.service';
import { AuthObjectsService } from '../helper/auth-objects.service';

@Injectable({
  providedIn: 'root'
})
export class AppTourService {
  private tourKey = 'connect-app-tour-completed-v1';

  constructor(
    private tourDriver: TourDriverService,
    private authService: AuthObjectsService,
    private router: Router
  ) { }

  public startTour(force: boolean = false) {
    if (!force && this.isTourCompleted()) {
      return;
    }

    if (!this.router.url.includes('/Home')) {
        this.router.navigate(['/Home']).then(() => {
            setTimeout(() => this.runTour(), 800);
        });
    } else {
        this.runTour();
    }
  }

  public forceStartTour() {
      this.startTour(true);
  }

  private runTour() {
    this.tourDriver.start({
      steps: [
        {
          element: '#tour-app-logo',
          popover: {
            title: 'مرحباً بك في Connect',
            description: 'بوابتك الرقمية الموحدة لخدمات البريد المصري. هذه جولة سريعة لنعرفك على أهم الخصائص.<br><small class="text-muted">(اضغط ESC أو انقر خارج الصندوق للخروج)</small>',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '.p-megamenu-root-list',
          popover: {
            title: 'القائمة الرئيسية',
            description: 'يمكنك الوصول لجميع الخدمات والتطبيقات المصرح لك بها من هنا.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
            element: '.slideshow',
            popover: {
              title: 'محفظة الخدمات',
              description: 'استعرض خدماتنا القادمة والحالية من خلال محفظة الخدمات التفاعلية.',
              side: 'top',
              align: 'center'
            }
        },
        {
          element: '#tour-notification-bell',
          popover: {
            title: 'الإشعارات',
            description: 'تابع آخر التنبيهات والإشعارات والرسائل الواردة من النظام.',
            side: 'bottom',
            align: 'end'
          }
        },
        {
          element: '#tour-user-profile-pill',
          popover: {
            title: 'قائمة المستخدم',
            description: 'اضغط هنا للوصول لملفك الشخصي وإعدادات الحساب.',
            side: 'bottom',
            align: 'end'
          }
        },
        {
            element: '#tour-user-profile-pill',
            popover: {
                title: 'الملف الشخصي',
                description: 'سنقوم الآن بفتح ملفك الشخصي لشرح محتوياته.',
                side: 'bottom',
                align: 'end',
                onNextClick: () => {
                    this.authService.showUserProfile = true;
                    setTimeout(() => {
                        this.tourDriver.moveNext();
                    }, 300); 
                }
            }
        },
        {
            element: '.user-profile-content-wrapper',
            popover: {
                title: 'شاشة الملف الشخصي',
                description: 'تحتوي هذه الشاشة على بياناتك الوظيفية والشخصية وخيارات التحكم.',
                side: 'left',
                align: 'center'
            }
        },
        {
            element: '.profile-info',
            popover: {
                title: 'البيانات الأساسية',
                description: 'اسم المستخدم والمسمى الوظيفي الحالي والوحدات التنظيمية التابع لها.',
                side: 'bottom',
                align: 'start'
            }
        },
        {
            element: '.info-grid',
            popover: {
                title: 'تفاصيل الحساب',
                description: 'معلومات تفصيلية مثل البريد الإلكتروني، رقم الملف، وحالة التسجيل.',
                side: 'top',
                align: 'start'
            }
        },
        {
           element: '.tour-profile-settings',
           popover: {
               title: 'إعدادات التنبيهات',
               description: 'يمكنك التبديل بين نظام التنبيهات الحديث والقديم وتجربة التنبيهات المختلفة من هنا.',
               side: 'top',
               align: 'start'
           }
        },
        {
            element: '.password-section',
            popover: {
                title: 'أمان الحساب',
                description: 'متابعة صلاحية كلمة المرور وتاريخ انتهائها.',
                side: 'top',
                align: 'start'
            }
        },
        {
            element: '.profile-groups',
            popover: {
                title: 'المجموعات',
                description: 'المجموعات والصلاحيات التي تنتمي إليها داخل النظام. في حالة استخدام تسجيل الدخول التلقائي فقط',
                side: 'top',
                align: 'start'
            }
        },
        {
            element: '.logout-button',
            popover: {
                title: 'تسجيل الخروج',
                description: 'يمكنك تسجيل الخروج من النظام بأمان من هنا.',
                side: 'top',
                align: 'end'
            }
        }
      ],
      onDestroyed: () => {
        if (this.tourDriver.getActiveIndex() >= 9) {
           this.markTourCompleted();
        }
        if (this.authService.showUserProfile) {
             this.authService.showUserProfile = false;
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
