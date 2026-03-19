import { Component, Input, OnChanges, SimpleChanges, AfterViewInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-bubbles-bg',
  templateUrl: './bubbles-bg.component.html',
  styleUrls: ['./bubbles-bg.component.scss']
})
export class BubblesBgComponent implements OnChanges, AfterViewInit, OnDestroy {
  /**
   * palette: array of CSS color strings (used to tint bubbles). Example: ['rgba(85,160,255,0.6)', 'rgba(240,120,200,0.5)']
   * You can also set `paletteId` to a named palette (see built-in map) instead of providing array.
   */
  @Input() palette: string[] | null = null;
  // allow any named palette id (keys from paletteMap)
  @Input() paletteId: string | null = 'default';

  /** density: number of bubbles to render (clamped 1..20) */
  @Input() density = 7;

  /** speed multiplier: 0.5 (slower) .. 2 (faster). Default 1 */
  @Input() speed = 1;

  /** overall scale for bubble sizes: 0.5 .. 2 */
  @Input() scale = 1;

  /** disable animations (useful for reduced-motion or tests) */
  @Input() disableAnimations = false;
  /** show built-in control panel */
  @Input() showControls = false;

  // toggle button fixed to bottom-left by design; remove configurable input to simplify API

  bubbles: Array<{ left: string; top?: string; size: string; color: string; delay: number; floatDur: number; riseDur: number; floatName: string; dx?: string; dy?: string; shimmerDur?: number }> = [];

  // current applied speed (used to compute playbackRate deltas)
  private currentSpeed = 1;

  // built-in palette map
  private paletteMap: Record<string, string[]> = {
    default: [
      'rgba(85,160,255,0.62)',
      'rgba(70,230,200,0.56)',
      'rgba(240,120,200,0.54)',
      'rgba(150,120,255,0.56)',
      'rgba(255,200,120,0.52)',
      'rgba(130,240,180,0.5)',
      'rgba(135,205,255,0.5)'
    ],
    brand: [
      'rgba(13,110,253,0.6)',
      'rgba(59,130,246,0.5)',
      'rgba(99,102,241,0.45)'
    ],
    calm: [
      'rgba(120,170,200,0.5)',
      'rgba(160,200,190,0.45)',
      'rgba(200,220,210,0.4)'
    ],
    sunset: [
      'rgba(255,120,90,0.62)',
      'rgba(255,150,105,0.56)',
      'rgba(255,180,120,0.52)',
      'rgba(255,200,140,0.48)',
      'rgba(240,140,170,0.46)',
      'rgba(220,100,150,0.44)',
      'rgba(200,80,130,0.40)',
      'rgba(170,100,180,0.36)'
    ],
    ocean: [
      'rgba(3,169,244,0.62)',
      'rgba(0,188,212,0.55)',
      'rgba(3,155,229,0.5)',
      'rgba(0,122,204,0.45)'
    ],
    forest: [
      'rgba(34,139,34,0.6)',
      'rgba(46,125,50,0.52)',
      'rgba(85,160,80,0.48)'
    ],
    rose: [
      'rgba(255,102,178,0.6)',
      'rgba(255,153,204,0.55)',
      'rgba(255,204,229,0.5)'
    ],
    neon: [
      'rgba(0,255,170,0.7)',
      'rgba(255,0,120,0.65)',
      'rgba(120,0,255,0.6)'
    ],
    dusk: [
      'rgba(64,48,101,0.62)',
      'rgba(120,80,140,0.56)',
      'rgba(200,120,160,0.5)'
    ],
    aurora: [
      'rgba(34,255,200,0.6)',
      'rgba(120,200,255,0.55)',
      'rgba(180,120,255,0.5)'
    ]
  };

  // expose palette keys for template or programmatic use
  availablePalettes = Object.keys(this.paletteMap);

  onPaletteChange(id: string) {
    this.paletteId = (id as any) || 'default';
    // if user selects a built-in palette, clear custom palette
    this.palette = null;
    this.buildBubbles();
    setTimeout(() => this.attachListeners(), 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // If only speed changed, adjust playbackRate smoothly without rebuilding
    const keys = Object.keys(changes || {});
    if (changes['speed'] && keys.length === 1) {
      this.updatePlaybackRate(changes['speed'].currentValue);
      return;
    }
    // otherwise rebuild bubbles
    this.buildBubbles();
  }

   buildBubbles() {
  // increase requested density by 50% for richer effect, then clamp to 1..20
  const requested = Math.round((this.density || 7) * 1.5);
  const count = Math.max(1, Math.min(20, requested));
    const palette = this.resolvePalette();
    const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    this.bubbles = new Array(count).fill(null).map((_, i) => {
      // fully random placement across the full document content area (px)
      const baseSize = 50 + Math.round(Math.random() * 200); // 50-250px
      const size = Math.round(baseSize * Math.max(0.5, Math.min(2, this.scale))) + 'px';
      const leftPx = Math.round(Math.random() * Math.max(0, docW - baseSize));
      const topPx = Math.round(Math.random() * Math.max(0, docH - baseSize));
      const color = palette[Math.floor(Math.random() * palette.length)];
      const delay = Math.round(Math.random() * 1200) / 1000; // 0..1.2s
      const floatDur = (4 + Math.random() * 14) / Math.max(0.1, this.speed); // ~4..18s scaled
      const shimmerDur = 3 + Math.random() * 2.5; // 3..5.5s
      // dx/dy movement deltas in px so bubbles can cross full document
      const dxPx = Math.round((Math.random() * docW - docW / 2));
      const dyPx = Math.round((Math.random() * docH - docH / 2));
      const dx = dxPx + 'px';
      const dy = dyPx + 'px';
      return { left: leftPx + 'px', top: topPx + 'px', size, color, delay, floatDur, riseDur: floatDur, floatName: '', dx, dy, shimmerDur } as any;
    });
  }

  private resolvePalette(): string[] {
    if (this.palette && this.palette.length) return this.palette;
    const id = this.paletteId || 'default';
    return this.paletteMap[id] || this.paletteMap['default'];
  }

  // initial build
  constructor() {
    this.currentSpeed = this.speed || 1;
    this.buildBubbles();
  }

  // control panel state and handlers
  panelOpen = false;

  togglePanel() { this.panelOpen = !this.panelOpen; }
  setDensity(v: number) { this.density = v; this.buildBubbles(); }
  setSpeed(v: number) { this.speed = v; this.updatePlaybackRate(v); }
  setScale(v: number) { this.scale = v; this.buildBubbles(); }

  /** Smoothly update playbackRate on existing Web Animations */
  private updatePlaybackRate(newSpeed: number) {
    try {
      const rate = (newSpeed || 1) / (this.currentSpeed || 1);
      // apply to all animations if present
      const applied = (this as any)._animations || [];
      if (applied.length) {
        applied.forEach((anim: Animation) => {
          try { anim.playbackRate = (anim.playbackRate || 1) * rate; } catch (e) {}
        });
        this.currentSpeed = newSpeed || 1;
        return;
      }
    } catch (e) {
      // ignore and fallback
    }
    // fallback: rebuild bubbles with new speed
    this.currentSpeed = newSpeed || 1;
    this.buildBubbles();
    setTimeout(() => this.attachListeners(), 50);
  }

  private _listeners: Array<{ el: Element; handler: EventListener }> = [];
  private _animations: Animation[] = [];

  ngAfterViewInit(): void {
    // attach listeners after view renders
    setTimeout(() => this.attachListeners(), 60);
  }

  ngOnDestroy(): void {
    // remove any listeners
    this._listeners.forEach(l => l.el.removeEventListener('animationiteration', l.handler));
    this._listeners = [];
    // cancel animations
    this._animations.forEach(a => { try { a.cancel(); } catch (e) {} });
    this._animations = [];
  }

  private attachListeners() {
    // remove old listeners
    this._listeners.forEach(l => l.el.removeEventListener('animationiteration', l.handler));
    this._listeners = [];

    const container = document.querySelector('.bubbles-bg');
    if (!container) return;
    const nodes = Array.from(container.querySelectorAll('.bubble')) as Element[];
    // cancel previous animations
    this._animations.forEach(a => { try { a.cancel(); } catch (e) {} });
    this._animations = [];

    nodes.forEach((el) => {
      // read index to map to bubbles array
      const idxAttr = el.getAttribute('data-idx');
      const idx = idxAttr ? parseInt(idxAttr, 10) : -1;
      const bubble = (idx >= 0 && this.bubbles[idx]) ? this.bubbles[idx] : null;
      // set shimmer duration and delay for CSS shimmer
      const shimmerDur = bubble ? (bubble.shimmerDur || 3.8) : 3.8;
      const delay = bubble ? (bubble.delay || 0) : 0;
      (el as HTMLElement).style.setProperty('--shimmerDur', shimmerDur + 's');
      (el as HTMLElement).style.animationDelay = delay + 's';

      // create a Web Animation to move the bubble smoothly
      try {
        const dx = bubble && bubble.dx ? bubble.dx : '0px';
        const dy = bubble && bubble.dy ? bubble.dy : '0px';
        const floatDur = bubble ? (bubble.floatDur || 10) : 10;
        const keyframes: Keyframe[] = [
          { transform: 'translate3d(0,0,0)' },
          { transform: `translate3d(calc(${dx} / 3), calc(${dy} / 3), 0)` },
          { transform: `translate3d(${dx}, ${dy}, 0)` }
        ];
        const animation = (el as HTMLElement).animate(keyframes, {
          duration: Math.max(500, Math.round(floatDur * 1000)),
          iterations: Infinity,
          direction: 'alternate',
          easing: 'ease-in-out'
        });
        // apply current speed to playbackRate
        try { animation.playbackRate = this.currentSpeed || this.speed || 1; } catch (e) {}
        this._animations.push(animation);
      } catch (e) {
        // fallback: rely on CSS vars
      }
    });
  }
}
