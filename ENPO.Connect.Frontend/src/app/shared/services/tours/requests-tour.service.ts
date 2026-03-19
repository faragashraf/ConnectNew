import { Injectable } from '@angular/core';
import { TourDriverService } from './tour-driver.service';

@Injectable({
  providedIn: 'root'
})
export class RequestsTourService {
  private tourRequestKey = 'connect-requests-tour-completed-v1';

  constructor(private tourDriver: TourDriverService) { }

  public forceStartTour() {
      this.startTour(true);
  }

  public startTour(force: boolean = false) {
    if (!force && localStorage.getItem(this.tourRequestKey) === 'true') {
      return;
    }

    // We assume the user is already on the page when this is called.
    this.tourDriver.start({
      steps: <any>[
        ...(document.getElementById('overLayTree') ? [
          {
            element: '#tour-tree-dropdown-btn',
            popover: {
              title: 'تصفية حسب النوع',
              description: 'اضغط هنا لفتح قائمة التصنيفات.',
              side: 'left',
              align: 'start',
              onNextClick: () => {
                const btn = document.getElementById('tour-tree-dropdown-btn');
                if (btn) btn.click();
                setTimeout(() => {
                  this.tourDriver.moveNext();
                }, 100);
              }
            }
          },
          {
            element: '.tree-overlay-container',
            popover: {
              title: 'شجرة التصنيفات',
              description: 'يمكنك اختيار التصنيف الفرعي من هذه القائمة.',
              side: 'left',
              align: 'start',
              onNextClick: () => {
                const btn = document.getElementById('tour-tree-dropdown-btn');
                const overlay = document.querySelector('.tree-overlay-container');
                if (btn && overlay) {
                  btn.click();
                }
                setTimeout(() => {
                  this.tourDriver.moveNext();
                }, 100);
              }
            },
            onHighlightStarted: (element?: Element) => {
              if (element) element.scrollIntoView({ block: 'center', inline: 'center' });
            }
          }] : [{
            element: '.radio-group',
            popover: {
              title: 'تصفية حسب النوع',
              description: 'يمكنك تصفية الطلبات المعروضة بناءً على نوع الطلب (مثل: شهادات، خطابات، إلخ) و اختيار النوع او الفئة الفرعية.',
              side: 'left',
              align: 'start'
            }
          }]),
        {
          element: '#tour-request-status-filter',
          popover: {
            title: 'تصفية حسب الحالة',
            description: 'استخدم هذا الشريط لعرض الطلبات بناءً على حالتها الحالية (جديد، جاري العمل، منتهي، إلخ).',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '#tour-mode-toggle',
          popover: {
            title: 'تبديل وضع العرض',
            description: 'يمكنك التبديل بين "الوضع العادي" لعرض البيانات المباشرة و"وضع الاستعلام" للبحث المتقدم. سنقوم بالنقر عليه الآن...',
            side: 'bottom',
            align: 'center',
            onNextClick: () => {
              // Using document.getElementById to ensure we have the fresh DOM element
              const container = document.getElementById('tour-mode-toggle');
              if (!container) {
                this.tourDriver.moveNext();
                return;
              }

              // Find inputs using the class name we saw in HTML: class="mode-radio"
              const inputs = container.querySelectorAll('input.mode-radio');
              // HTML structure: index 0 is Normal (false), index 1 is Search (true)
              const searchInput = inputs[1] as HTMLElement;

              // Click Search Mode to show the search fields
              if (searchInput) {
                searchInput.click();
              }

              // Wait for search fields to render then move next
              setTimeout(() => {
                this.tourDriver.moveNext();
              }, 200);
            }
          }
        },
        {
          element: '#tour-search-fields',
          popover: {
            title: 'حقل البحث',
            description: 'سنقوم باختيار الحقل الأول في القائمة.',
            side: 'bottom',
            align: 'start',
            onNextClick: () => {
              const dropdown = document.getElementById('tour-search-fields');
              if (dropdown) {
                const trigger = dropdown.querySelector('.p-dropdown-trigger') as HTMLElement;
                if (trigger) trigger.click();
              }
              setTimeout(() => {
                const items = document.querySelectorAll('.p-dropdown-item');
                if (items && items.length > 0) {
                  (items[0] as HTMLElement).click();
                }
                setTimeout(() => {
                  this.tourDriver.moveNext();
                }, 300);
              }, 300);
            }
          }
        },
        {
          element: '#tour-search-type',
          popover: {
            title: 'نوع المطابقة',
            description: 'سنقوم باختيار "يحتوي" للحصول على نتائج أدق.',
            side: 'bottom',
            align: 'center',
            onNextClick: () => {
              const dropdown = document.getElementById('tour-search-type');
              if (dropdown) {
                const trigger = dropdown.querySelector('.p-dropdown-trigger') as HTMLElement;
                if (trigger) trigger.click();
              }
              setTimeout(() => {
                const items = document.querySelectorAll('.p-dropdown-item');
                items.forEach((item) => {
                  if ((item as HTMLElement).innerText.trim() === 'يحتوي') {
                    (item as HTMLElement).click();
                  }
                });
                setTimeout(() => {
                  this.tourDriver.moveNext();
                }, 300);
              }, 300);
            }
          }
        },
        {
          element: '#tour-search-input',
          popover: {
            title: 'قيمة البحث',
            description: 'سنقوم بكتابة "111" كمثال للبحث.',
            side: 'bottom',
            align: 'center',
            onNextClick: () => {
              const container = document.getElementById('tour-search-input');
              if (container) {
                const input = container.querySelector('input');
                if (input) {
                  input.value = '111';
                  input.dispatchEvent(new Event('input'));
                }
              }
              setTimeout(() => {
                  this.tourDriver.moveNext();
              }, 200);
            }
          }
        },
        {
          element: '#tour-search-btn',
          popover: {
            title: 'تنفيذ البحث',
            description: 'اضغط هنا لعرض نتائج البحث.',
            side: 'bottom',
            align: 'end',
            onNextClick: () => {
              const btn = document.getElementById('tour-search-btn');
              if (btn) btn.click();

              setTimeout(() => {
                  this.tourDriver.moveNext();
              }, 1500);
            }
          }
        },
        {
          element: '#tour-mode-toggle',
          popover: {
            title: 'العودة للوضع العادي',
            description: 'سنقوم الآن بالعودة للقائمة الافتراضية للطلبات.',
            side: 'bottom',
            align: 'center',
            onNextClick: () => {
              // Start restore logic
              const container = document.getElementById('tour-mode-toggle');
              if (container) {
                const inputs = container.querySelectorAll('input.mode-radio');
                const normalInput = inputs[0] as HTMLElement;
                if (normalInput) {
                  normalInput.click();
                }
              }

              // Wait for normal view (table) to return
              setTimeout(() => {
                  this.tourDriver.moveNext();
              }, 100);
            }
          }
        },
        {
          element: '#tour-request-table',
          popover: {
            title: 'جدول الطلبات',
            description: 'يعرض هذا الجدول جميع الطلبات التي تطابق خيارات التصفية الخاصة بك. يمكنك النقر على السهم لتوسيع التفاصيل.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '.tour-row-toggler',
          popover: {
            title: 'عرض التفاصيل',
            description: 'اضغط على السهم الموجود بجانب أي طلب لعرض تفاصيله الكاملة. سنقوم بفتحه الآن...',
            side: 'left',
            align: 'center',
            onNextClick: (element?: Element) => {
              // Click the element to uncolapse row
              if (element) (element as HTMLElement).click();

              // Wait and move next to allow animation
              setTimeout(() => {
                  this.tourDriver.moveNext();
              }, 500);
            }
          }
        },
        {
          element: '.tour-details-tabs',
          popover: {
            title: 'تفاصيل الطلب',
            description: 'التبويب الأول يعرض البيانات الأساسية وتفاصيل النموذج الخاص بالطلب.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '.tour-details-tabs .p-tabview-nav li:nth-child(2)',
          popover: {
            title: 'سجل الردود',
            description: 'يعرض تاريخ العمليات والردود السابقة على هذا الطلب.',
            side: 'top',
            align: 'center',
            onNextClick: () => {
              const tab = document.querySelector('.tour-details-tabs .p-tabview-nav li:nth-child(2) a') as HTMLElement;
              if (tab) {
                tab.click();
                setTimeout(() => this.tourDriver.moveNext(), 100);
              } else {
                  this.tourDriver.moveNext();
              }
            }
          }
        },
        {
          element: '.tour-details-tabs .p-tabview-nav li:nth-child(3)',
          popover: {
            title: 'إضافة رد جديد',
            description: 'من هنا يمكنك إضافة رد أو توجيه الطلب لإدارة أخرى.',
            side: 'top',
            align: 'center',
            onNextClick: () => {
              const tab = document.querySelector('.tour-details-tabs .p-tabview-nav li:nth-child(3) a') as HTMLElement;
              if (tab) {
                tab.click();
                setTimeout(() => this.tourDriver.moveNext(), 100);
              } else {
                  this.tourDriver.moveNext();
              }
            }
          }
        },
        // {
        //   element: 'app-dropdown-tree',
        //   popover: {
        //     title: 'الجهة المرسل إليها',
        //     description: 'حدد الإدارة أو القسم المراد توجيه الطلب إليه من القائمة.',
        //     side: 'left',
        //      align: 'center',
        //     onNextClick: () => {
        //          // Open the dropdown
        //          const treeBtn = document.querySelector('app-dropdown-tree button') as HTMLElement;
        //          if(treeBtn) {
        //             treeBtn.click();
                    
        //             // Fix Overlay Z-Index to appear above Driver.js backdrop
        //             setTimeout(() => {
        //                 const overlays = document.querySelectorAll('.p-overlaypanel');
        //                 overlays.forEach((el) => {
        //                      (el as HTMLElement).style.zIndex = '100000005'; // Higher than driver.js (approx 100000000)
        //                 });
        //             }, 100);

        //             // Wait for overlay and select node at index 7
        //             setTimeout(() => {
        //                 // Use a more specific selector to avoid selecting hidden items if multiple trees exist
        //                 // and ensure the container is visible.
        //                 const treeContent = document.querySelector('.p-tree-container');
        //                 if (treeContent) {
        //                      const treeNodes = treeContent.querySelectorAll('.p-treenode-content');
        //                      if(treeNodes && treeNodes.length > 7) {
        //                           const targetNode = treeNodes[7] as HTMLElement;
        //                           if(targetNode) {
        //                               targetNode.click();
        //                           }
        //                      }
        //                 }
        //                  setTimeout(() => this.tourDriver.moveNext(), 600); // Increased delay
        //             }, 3000); // Increased delay to allow animation
        //          } else {
        //              this.tourDriver.moveNext();
        //          }
        //     }
        //   }
        // },
        {
          element: '#message',
          popover: {
            title: 'نص الرد',
            description: 'كتابة تفاصيل الرد أو التوجيه هنا. سنكتب نصاً تجريبياً.',
            side: 'top',
            align: 'center',
            onNextClick: () => {
              const textarea = document.getElementById('message') as HTMLTextAreaElement;
              if (textarea) {
                textarea.value = 'هذا نص رد تجريبي تم إنشاؤه بواسطة الجولة التعريفية.';
                textarea.dispatchEvent(new Event('input'));
              }
              setTimeout(() => this.tourDriver.moveNext(), 300);
            }
          }
        },
        {
          element: 'app-reply button[type="submit"]',
          popover: {
            title: 'تسجيل الرد',
            description: 'أخيراً، يتم الضغط هنا لحفظ وإرسال الرد. (لن نقوم بالتسجيل الفعلي الآن).',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '.tour-status-dropdown', onHighlightStarted: (element?: Element) => {
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, popover: {
            title: 'تغيير الحالة',
            description: 'يمكنك تغيير حالة الطلب من هنا (مثل القبول، الرفض، أو التحويل) إذا كان ذلك متاحاً.',
            side: 'top',
            align: 'center'
          }
        },
        {
          element: '#tour-requests-restart',
          popover: {
            title: 'إعادة الجولة',
            description: 'يمكنك دائمًا إعادة تشغيل هذه الجولة من خلال النقر هنا.',
            side: 'left',
            align: 'start'
          }
        }
      ],
      onDestroyed: () => {
        if (this.tourDriver.getActiveIndex() >= 4) {
             this.markTourCompleted();
        }
      }
    });
  }

  private markTourCompleted() {
    localStorage.setItem(this.tourRequestKey, 'true');
  }
}
