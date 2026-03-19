import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { MessageService } from 'primeng/api';
import { MsgsService } from '../../services/helper/msgs.service';
import { AuthObjectsService } from '../../services/helper/auth-objects.service';

@Component({
  selector: 'app-mascot-peek',
  templateUrl: './mascot-peek.component.html',
  styleUrls: ['./mascot-peek.component.scss']
})
export class MascotPeekComponent implements OnInit, OnDestroy {
  private _enabled = true;
  @Input() 
  set enabled(val: boolean) {
      if (this._enabled !== val) {
          this._enabled = val;
          this.handleEnabledChange();
      }
  }
  get enabled(): boolean {
      return this._enabled;
  }

  @Output() close = new EventEmitter<void>();

  @Input() minDelayMs = 7000;
  @Input() maxDelayMs = 16000;
  @Input() mobileScale = 0.75;
  @Input() desktopScale = 1.0;

  isVisible = false;
  isLooking = false;
  userDismissed = false;
  private timeoutId: any;
  
  // Current positioning state
  currentSideClass = ''; 
  currentPositionStyles: {[key: string]: string} = {};
  currentScale = 1;
  
  // Constants for safe zones
  private readonly MARGIN_X = 16; // Horizontal margin from edges (px)
  private readonly MASCOT_SIZE = 200; // Assumed square size (px)

    constructor(
      private cdr: ChangeDetectorRef,
      private messageService: MessageService,
      private msgsService: MsgsService,
      private authService: AuthObjectsService
    ) {}

  ngOnInit(): void {
    if (this.prefersReducedMotion()) {
        console.warn('MascotPeek: Reduced motion detected. Animation might be simplified.');
    }
    
    // Initial start if enabled
    if (this.enabled) {
      this.timeoutId = setTimeout(() => {
        this.startPeekCycle();
      }, 1000);
    }
  }

  private handleEnabledChange() {
      if (this.enabled) {
          // Reset dismissal state when re-enabled externally
          this.userDismissed = false;
          this.scheduleNextPeek();
      } else {
          this.hide();
          this.clearTimer();
      }
  }

  async dismiss() {
    // Ask the user whether they also want to disable Ramadan vibes
    const confirm = await this.msgsService.msgConfirm('هل تود إيقاف أجواء رمضان بالكامل أيضاً؟ (سيؤدي ذلك لإخفاء الزينة والشخصية)', 'نعم، أوقفها');

    // Always hide the mascot immediately
    this.userDismissed = true;
    this.hide();
    this.clearTimer();

    if (confirm) {
      // User opted to disable Ramadan globally
      this.authService.setRamadanPreference(false);
      // Notify parent or other listeners if needed
      this.close.emit();

      this.messageService.add({
        severity: 'info',
        summary: 'تم إيقاف أجواء رمضان',
        detail: 'تم إيقاف الزينة والشخصية. يمكنك إعادة التفعيل من الملف الشخصي.',
        life: 5000
      });
    } else {
      // User only dismissed the mascot for now
      this.messageService.add({
        severity: 'info',
        summary: 'تم إخفاء الشخصية',
        detail: 'يمكنك إعادة إظهارها من الملف الشخصي أو عند إعادة التفعيل.',
        life: 4000
      });
    }

    this.cdr.detectChanges();
  }

  private hide() {
    this.isVisible = false;
    this.isLooking = false;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private clearTimer() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private scheduleNextPeek() {
    if (!this.enabled || this.userDismissed) return;

    this.clearTimer();
    // Random delay between cycles: 9–18 seconds
    const delay = Math.floor(Math.random() * (18000 - 9000 + 1)) + 9000;
    this.timeoutId = setTimeout(() => {
      this.startPeekCycle();
    }, delay);
  }

  private startPeekCycle() {
    console.log('MascotPeek: Cycle attempting start...');
    if (this.userDismissed) {
        console.log('MascotPeek: User dismissed, aborting cycle.');
        return;
    }

    // 1. Setup Position
    this.randomizePosition();
    
    // 2. Animate In
    this.isVisible = true;
    console.log('MascotPeek: Showing at', this.currentPositionStyles);
    this.cdr.detectChanges(); 
    
    // 3. "Look" Phase
    // Increased duration: 6000ms base + random (Total ~6-7s)
    const lookDuration = 6000 + Math.random() * 1000; 

    // Chain timeouts so one ID tracks the active step
    this.timeoutId = setTimeout(() => {
        // If dismissed during wait, abort
        if (this.userDismissed) return;

        this.isLooking = true; 
        this.cdr.detectChanges();

        // Schedule Exit
        this.timeoutId = setTimeout(() => {
            if (this.userDismissed) return;

            this.isVisible = false;
            this.isLooking = false;
            console.log('MascotPeek: Hiding');
            this.cdr.detectChanges();
            
            // Schedule next cycle
            this.timeoutId = setTimeout(() => {
                this.scheduleNextPeek();
            }, 500); // Wait for exit transition

        }, lookDuration); 

    }, 600); 
  }

  private randomizePosition() {
    const isMobile = window.innerWidth < 768;
    this.currentScale = isMobile ? this.mobileScale : this.desktopScale;
    
    // Get viewport dimensions
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Determine safe zones dynamically
    let topSafe = 80; // Default fallback for navbar
    let bottomSafe = 80; // Default fallback for footer

    const navbar = document.querySelector('app-nav-bar');
    const footer = document.querySelector('.app-footer');

    if (navbar) {
        const rect = navbar.getBoundingClientRect();
        if (rect.height > 0) topSafe = rect.height + 20; // + buffer
    }

    if (footer) {
        const rect = footer.getBoundingClientRect();
        if (rect.height > 0) bottomSafe = rect.height + 20; // + buffer
    }

    // Calculate usable area
    // Y-Range: [topSafe ... vh - bottomSafe - MASCOT_SIZE_SCALED]
    const scaledSize = this.MASCOT_SIZE * this.currentScale;
    const minY = topSafe;
    const maxY = vh - bottomSafe - scaledSize;

    // If viewport is too small, just center vertically between safe zones or hide
    if (maxY < minY) {
        // Not enough space, fallback to center but might overlap
        this.setPosition(vw / 2 - scaledSize / 2, vh / 2 - scaledSize / 2);
        return;
    }

    // Horizontal Range: [MARGIN_X ... vw - MARGIN_X - scaledSize]
    const minX = this.MARGIN_X;
    const maxX = vw - this.MARGIN_X - scaledSize;

    // Generate valid position
    // We try to avoid the "Actions" area in top-right if possible (approx 200x100 area at top right)
    // But since we are strictly below navbar now, the top-right menu is usually inside navbar.
    // However, if there are floating actions, we should still be careful.
    
    let x = 0, y = 0;
    
    let valid = false;
    let tries = 0;
    
    while (!valid && tries < 10) {
        x = minX + Math.random() * (maxX - minX);
        y = minY + Math.random() * (maxY - minY);
        
        // Add any additional specific exclusion logic here if needed
        // For now, strict navbar/footer exclusion + margins is robust enough
        valid = true;
        tries++;
    }

    this.setPosition(x, y);
    this.currentSideClass = ''; 
  }

  private setPosition(x: number, y: number) {
      this.currentPositionStyles = {
        top: `${y}px`,
        left: `${x}px`,
        // We do NOT translate anymore because we calculated top/left for the top-left corner
        transform: `scale(${this.currentScale})`,
        transformOrigin: 'top left' // Ensure scaling doesn't shift position unexpectedly
    };
  }
}
