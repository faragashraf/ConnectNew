import { Directive, ElementRef, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';

@Directive({
  selector: '[appInViewport]'
})
export class InViewportDirective implements OnInit, OnDestroy {
  @Output() inViewport = new EventEmitter<void>();

  private observer: IntersectionObserver | null = null;

  constructor(private elementRef: ElementRef) { }

  ngOnInit(): void {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.inViewport.emit();
          this.observer?.disconnect();
          this.observer = null;
        }
      });
    }, {
      threshold: 0.15
    });

    this.observer.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
