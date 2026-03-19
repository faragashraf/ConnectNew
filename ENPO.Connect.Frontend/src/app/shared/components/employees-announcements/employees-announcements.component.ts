import { Component, ElementRef, OnInit, OnDestroy, AfterViewInit, ViewChildren, QueryList, HostListener } from '@angular/core';
import { trigger, transition, query, style, stagger, animate } from '@angular/animations';
import { Router } from '@angular/router';

@Component({
  selector: 'app-employees-announcements',
  templateUrl: './employees-announcements.component.html',
  styleUrls: ['./employees-announcements.component.scss'],
  animations: [
    trigger('listStagger', [
      transition(':enter', [
        query('.stagger-item', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(80, [animate('420ms ease-out', style({ opacity: 1, transform: 'none' }))])
        ], { optional: true })
      ])
    ])
  ]
})
export class EmployeesAnnouncementsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('anim') animItems!: QueryList<ElementRef>;
  private io?: IntersectionObserver;

  // Countdown
  daysRemaining = 0;
  private timer: any;
  launchDate = new Date('2026-04-01T00:00:00'); // Cairo time assumption handled via client local time relative to date

  // Marquee
  marqueeDuration = '45s';
  newsList: string[] = [
    '📢 المصايف ٢٠٢٦: استعدوا لصيف لا ينسى مع العروض الحصرية للعاملين.',
    '🌟 Connect: بوابتك الرقمية الجديدة للخدمات الداخلية - تجربة أسرع وأذكى.',
    '🔔 تذكير: آخر موعد لتحديث البيانات الوظيفية هو نهاية الشهر الحالي.',
    '🗓️ ترقبوا الإعلان عن تفاصيل الرحلات الصيفية وأماكن الحجز قريباً.',
    '💬 شاركنا رأيك في المنصة الجديدة عبر نموذج المقترحات.',
    '🎉 تهنئة خاصة للزملاء المتميزين في الأداء لهذا الربع السنوي.'
  ];

  // Section C: Portal Contents
  portalContents = [
    { id: 101, title: 'المنشورات',route:'', teaser: 'أخبار ومنشورات رسمية', icon: 'assets/imges/SlideShow/icons/publications.png', status: 'محدث', desc: 'اطلع على أحدث القرارات والتعاميم والمنشورات الرسمية فور صدورها.' },
    { id: 102, title: 'الموارد البشرية',route:'', teaser: 'بيانات، إجازات، جزاءات', icon: 'assets/imges/SlideShow/icons/hr.png', status: 'خدمة ذاتية', desc: 'إدارة شاملة لملفك الوظيفي، تقديم الإجازات، ومتابعة الطلبات.' },
    { id: 103, title: 'ماكينات الصراف',route:'ATMlIST', teaser: 'دليل المواقع', icon: 'assets/imges/SlideShow/icons/atm.png', status: 'خريطة', desc: 'دليل محدث لأماكن ماكينات الصراف الآلي التابعة للهيئة وساعات عملها.' },
    { id: 104, title: 'مكاتب البريد',route:'postoffices', teaser: 'دليل الخدمات', icon: 'assets/imges/SlideShow/icons/post-office.png', status: 'بحث', desc: 'ابحث عن أقرب مكتب بريد - مناطق توزيع - سفريات .... وتعرف على الخدمات المتاحة ومواعيد العمل.' },
    { id: 105, title: 'الرعاية الصحية',route:'', teaser: 'طلبات العلاج', icon: 'assets/imges/SlideShow/icons/healthcare.png', status: 'جديد', desc: 'قدم طلبات العلاج لك ولأسرتك وتابع الموافقات الطبية إلكترونياً.' },
    { id: 106, title: 'تواصل / Connect',route:'', teaser: 'قنوات الاتصال', icon: 'assets/imges/SlideShow/icons/communication.png', status: 'تفاعلي', desc: 'منصتك الموحدة للتواصل الداخلي وتلقي الإشعارات الهامة.' },
    { id: 107, title: 'الصيف',route:'', teaser: 'فعاليات ومصايف', icon: 'assets/imges/SlideShow/icons/summer.png', status: 'موسمي', desc: 'كل ما يخص مصايف 2026، الحجز، والاستعلام عن الأماكن المتاحة.' }
  ];

  // Flip state for cards
  flipped = new Set<number>();

  constructor(public router: Router) {}

  ngOnInit(): void {
    this.updateCountdown();
    this.timer = setInterval(() => this.updateCountdown(), 1000 * 60); // Update every minute
  }

  ngAfterViewInit(): void {
    this.io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
        }
      });
    }, { threshold: 0.1 });

    this.animItems.forEach(i => this.io?.observe(i.nativeElement));
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.io) this.io.disconnect();
  }

  private updateCountdown() {
    const now = new Date().getTime();
    const distance = this.launchDate.getTime() - now;
    
    if (distance < 0) {
      this.daysRemaining = 0;
    } else {
      this.daysRemaining = Math.floor(distance / (1000 * 60 * 60 * 24));
    }
  }

  toggleFlip(id: number) {
    if (this.flipped.has(id)) {
      this.flipped.delete(id);
    } else {
      this.flipped.add(id);
    }
  }

  isFlipped(id: number) {
    return this.flipped.has(id);
  }

  scrollTo(elementId: string) {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
