import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChildren } from '@angular/core';
import { trigger, style, transition, animate, query, stagger } from '@angular/animations';
import { AuthObjectsService } from '../../services/helper/auth-objects.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
  animations: [
    trigger('listStagger', [
      transition(':enter', [
        query('.stagger-item', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(80, [animate('420ms ease-out', style({ opacity: 1, transform: 'none' }))])
        ])
      ])
    ])
  ]
})

export class LandingComponent implements AfterViewInit, OnDestroy {
  slides = [
    { title: 'المنشورات', subtitle: 'أخبار ومنشورات', color: '#7B61FF', image: 'assets/imges/SlideShow/1-publications.png', icon: '', description: 'عرض المنشورات والدورات المستندية الرسمية', progress: 85 },
    { title: 'الموارد البشرية', subtitle: 'بيانات، إجازات، جزاءات', color: '#FFB020', image: 'assets/imges/SlideShow/2-hr.png', icon: '', description: 'تحديث بيانات الموظفين، إدارة الإجازات والسياسات', progress: 85 },
    { title: 'ماكينات الصراف الآلي', subtitle: 'دليل مواقع الصراف', color: '#06B6D4', image: 'assets/imges/SlideShow/3-atm.png', icon: '', description: 'دليل مواقع ماكينات الصرف الآلي وساعات التشغيل', progress: 65 },
    { title: 'مكاتب البريد', subtitle: 'دليل الخدمات', color: '#8B5CF6', image: 'assets/imges/SlideShow/4-post-office.png', icon: '', description: 'مواقع مكاتب البريد، ساعات العمل والخدمات المتوفرة', progress: 65 },
    { title: 'الرعاية الصحية', subtitle: 'طلبات العلاج', color: '#FF6B6B', image: 'assets/imges/SlideShow/5-healthcare.png', icon: '', description: 'طلب علاج أسري، طلب علاج شهري وموافقات طبية', progress: 10 },
    { title: 'تواصل', subtitle: 'قنوات الاتصال', color: '#2F9FFF', image: 'assets/imges/SlideShow/6-communication.png', icon: '', description: 'قنوات تواصل داخلية وخارجية وإشعارات', progress: 5 },
    { title: 'الصيف', subtitle: 'فعاليات الصيف', color: '#2F9FFF', image: 'assets/imges/SlideShow/7-summer.png', icon: '', description: 'فعاليات وأنشطة صيفية للموظفين', progress: 5 }
  ];

  iconImagesBySlideImage: Record<string, string> = {
    'assets/imges/SlideShow/1-publications.png': 'assets/imges/SlideShow/icons/publications.png',
    'assets/imges/SlideShow/2-hr.png': 'assets/imges/SlideShow/icons/hr.png',
    'assets/imges/SlideShow/3-atm.png': 'assets/imges/SlideShow/icons/atm.png',
    'assets/imges/SlideShow/4-post-office.png': 'assets/imges/SlideShow/icons/post-office.png',
    'assets/imges/SlideShow/5-healthcare.png': 'assets/imges/SlideShow/icons/healthcare.png',
    'assets/imges/SlideShow/6-communication.png': 'assets/imges/SlideShow/icons/communication.png',
    'assets/imges/SlideShow/7-summer.png': 'assets/imges/SlideShow/icons/summer.png'
  };

  marqueeDuration = '45s';

  newsList: string[] = [
  '📢 أهلاً بك في بوابة البريد المصري الداخلية – حيث التواصل أسهل وأسرع!',
  // '🚀 تم إطلاق لوحة التحكم الجديدة لتسهيل متابعة مهامك اليومية.',
  '🔔 تذكير: راجع إشعاراتك أولاً بأول للبقاء على اطلاع بجديد التحديثات.',
  '💬 دعمك متاح على مدار الساعة – لا تتردد في التواصل لأي استفسار.',
  // '🌟 نجاحك يبدأ من تواصلك! شارك أفكارك عبر نظام المقترحات الداخلي.',
  '📅 تابع آخر الأخبار والفعاليات الداخلية من خلال صفحة الإعلانات.',
  '🔒 نذكّرك بالحفاظ على سرية بيانات الدخول وعدم مشاركتها مع أي شخص.',
  '🎉 البريد المصري يرحب بانضمام زملائنا الجدد إلى فريق العمل!',
  '🏆 شكر وتقدير لكل من ساهم في تطوير خدمات البريد المصري.',
  '📈 نعمل معاً لتقديم تجربة رقمية أفضل لجميع موظفي البريد.'
  ];


  current = 0;
  slideTimer: any;
  isPaused = false;
  // global carousel tilt (for mouse parallax)
  rx = 0; // rotateX deg
  ry = 0; // rotateY deg
  // smoothed values for RAF
  private rafId: any;
  // touch swipe
  private touchStartX: number | null = null;

  // visibility / listeners
  private visibilityHandler = () => {
    if (document.hidden) this.pause(); else this.resume();
  };
  private keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

  @ViewChildren('anim') animItems!: QueryList<ElementRef>;

  private io?: IntersectionObserver;

  constructor(private host: ElementRef, public authObjectsService: AuthObjectsService) { }

  ngAfterViewInit(): void {
    // Slideshow autoplay (skips advancing when paused)
    this.slideTimer = setInterval(() => { if (!this.isPaused) this.next(); }, 5000);

    // IntersectionObserver for on-scroll animations
    this.io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) el.classList.add('in-view');
      });
    }, { threshold: 0.12 });

    this.animItems.forEach(i => this.io!.observe(i.nativeElement));

    // pre-load slideshow images to avoid layout shift when slides first appear
    this.preloadImages();

    // listen for visibility and keyboard
    document.addEventListener('visibilitychange', this.visibilityHandler);
    // host element keyboard handled via event listener to catch focus
    this.host.nativeElement.addEventListener('keydown', this.keydownHandler);
  }

  ngOnDestroy(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
    if (this.io) this.io.disconnect();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.host.nativeElement.removeEventListener('keydown', this.keydownHandler);
    cancelAnimationFrame(this.rafId);
  }

  next() { this.current = (this.current + 1) % this.slides.length; }
  prev() { this.current = (this.current - 1 + this.slides.length) % this.slides.length; }

  // Return a style object to position each slide in 3D space
  getSlideStyle(i: number) {
    const n = this.slides.length;
    let diff = i - this.current;
    if (diff > n / 2) diff -= n;
    if (diff < -n / 2) diff += n;

    const angle = diff * 50; // degrees between slides (slightly reduced angle for wider feel)
    const tz = diff === 0 ? 460 : 360; // Increased Z-distance for larger cards
    const abs = Math.abs(diff);
    const opacity = abs > 2 ? 0 : 1 - (abs * 0.25);
    const zIndex = 100 - abs;

    // Add small lateral offset and parallax based on global rotation
    const offsetX = Math.sin((angle * Math.PI) / 180) * 12;
    const parallaxX = -this.ry * (abs * 0.035);
    const parallaxY = this.rx * (abs * 0.025);

    return {
      transform: `translateX(${offsetX + parallaxX}px) translateY(${parallaxY}px) rotateY(${angle}deg) translateZ(${tz}px)`,
      opacity: `${opacity}`,
      zIndex: `${zIndex}`
    } as any;
  }

  getIconImage(slide: any) {
    if (!slide) return null;
    if (slide.iconImage) return slide.iconImage;
    return slide.image ? this.iconImagesBySlideImage[slide.image] : null;
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }

  // Flip state for touch/click devices
  flipped = new Set<number>();

  toggleFlip(i: number) {
    if (this.flipped.has(i)) this.flipped.delete(i);
    else this.flipped.add(i);
  }

  isFlipped(i: number) { return this.flipped.has(i); }

  // Mouse / touch handlers for parallax
  onMouseMove(ev: MouseEvent | TouchEvent, rect?: DOMRect) {
    let clientX: number, clientY: number;
    if ((ev as TouchEvent).touches) {
      const t = (ev as TouchEvent).touches[0];
      clientX = t.clientX; clientY = t.clientY;
    } else {
      clientX = (ev as MouseEvent).clientX; clientY = (ev as MouseEvent).clientY;
    }

    // compute relative to slideshow center
    const root = this.host.nativeElement.querySelector('.slideshow');
    if (!root) return;
    const r = root.getBoundingClientRect();
    const dx = (clientX - (r.left + r.width / 2)) / (r.width / 2); // -1..1
    const dy = (clientY - (r.top + r.height / 2)) / (r.height / 2); // -1..1

    // target angles
    const targetRy = dx * 12; // yaw
    const targetRx = -dy * 8; // pitch

    // smooth using RAF and sync CSS vars for parallax
    cancelAnimationFrame(this.rafId);
    const step = () => {
      this.ry += (targetRy - this.ry) * 0.12;
      this.rx += (targetRx - this.rx) * 0.12;
      // sync CSS variables for css-driven parallax
      const vp = this.host.nativeElement.querySelector('.carousel-viewport');
      if (vp && vp.style) {
        vp.style.setProperty('--rx', String(this.rx));
        vp.style.setProperty('--ry', String(this.ry));
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  onMouseLeave() {
    cancelAnimationFrame(this.rafId);
    // smooth reset
    const step = () => {
      this.ry += (0 - this.ry) * 0.14;
      this.rx += (0 - this.rx) * 0.14;
      if (Math.abs(this.ry) < 0.01 && Math.abs(this.rx) < 0.01) {
        this.ry = 0; this.rx = 0; return;
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  // keyboard navigation
  onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') { this.prev(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { this.next(); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Spacebar') { this.isPaused = !this.isPaused; e.preventDefault(); }
  }

  // touch handlers for swipe
  onTouchStart(ev: TouchEvent) {
    if (ev.touches && ev.touches[0]) this.touchStartX = ev.touches[0].clientX;
  }

  onTouchEnd(ev: TouchEvent) {
    if (this.touchStartX == null) return;
    const endX = (ev.changedTouches && ev.changedTouches[0]) ? ev.changedTouches[0].clientX : null;
    if (endX == null) { this.touchStartX = null; return; }
    const dx = endX - this.touchStartX;
    if (dx < -40) this.next();
    else if (dx > 40) this.prev();
    this.touchStartX = null;
  }

  // Preload slide images to stabilise layout and avoid flicker
  preloadImages() {
    this.slides.forEach(s => {
      if (s.image) {
        const img = new Image();
        img.src = s.image;
      }
    });
  }

  // trackBy fn for ngFor to keep DOM stable
  trackById(_: number, item: any) { return item.id; }

  // compute carousel-level style (applied to viewport)
  get carouselStyle() {
    return {
      transform: `rotateX(${this.rx}deg) rotateY(${this.ry}deg)`
    } as any;
  }

  // Smooth scroll with custom duration/easing
  scrollTo(el: HTMLElement) {
    if (!el) return;
    // Offset for fixed header if needed, here we assume direct target
    const targetY = el.getBoundingClientRect().top + window.scrollY; 
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 1200; // ms (slower than native)
    let startTime: number | null = null;

    const animateScroll = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = currentTime - startTime;
      
      // easeInOutCubic
      const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      if (progress < duration) {
        const val = startY + (distance * ease(progress / duration));
        window.scrollTo(0, val);
        requestAnimationFrame(animateScroll);
      } else {
        window.scrollTo(0, targetY);
      }
    };

    requestAnimationFrame(animateScroll);
  }
}
