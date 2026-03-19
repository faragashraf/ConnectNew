import { Injectable } from '@angular/core';
import { MsgsService } from './msgs.service';

@Injectable({
    providedIn: 'root'
})
export class SoundService {
    public isSoundEnabled: boolean = true;
    private audioContext: AudioContext | null = null;

    constructor(private msgsService: MsgsService) {
        const storedSound = localStorage.getItem('useAppSound');
        if (storedSound === null) {
            // Default to enabled when user has no stored preference
            this.isSoundEnabled = true;
            localStorage.setItem('useAppSound', 'true');
        } else {
            this.isSoundEnabled = storedSound === 'true';
        }

        // Initialize audio context now if enabled so click sounds can play immediately
        if (this.isSoundEnabled) {
            this.initAudioContext();
        }

        // Check if we just reloaded from a clear cache action
        this.checkClearCacheStatus();

        // Initialize global click listener
        this.initClickListener();
    }

    public setSoundStrategy(enabled: boolean) {
        this.isSoundEnabled = enabled;
        localStorage.setItem('useAppSound', String(enabled));
        if (enabled && !this.audioContext) {
            this.initAudioContext();
        }
    }

    public performClearCacheAndReload() {
        localStorage.setItem('hasClearedCache', 'true');
        (window.location as any).reload(true);
    }

    // Overload for when confirmation is already handled or custom logic
    public performReloadEx() {
        localStorage.setItem('hasClearedCache', 'true');
        (window.location as any).reload(true);
    }

    private checkClearCacheStatus() {
        const hasCleared = localStorage.getItem('hasClearedCache');
        if (hasCleared === 'true') {
            localStorage.removeItem('hasClearedCache');
            // Give the browser a moment to settle, then play the success sound
            setTimeout(() => {
                this.playClearCacheSuccessSound();
            }, 500);
        }
    }

    private initAudioContext() {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                this.audioContext = new AudioContext();
            }
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    }

    private initClickListener() {
        if (typeof window !== 'undefined') {
            window.addEventListener('click', () => {
                if (this.isSoundEnabled) {
                    this.playClickSound();
                }
            });
        }
    }

    private playClickSound() {
        if (!this.audioContext) {
            this.initAudioContext();
        }

        if (this.audioContext) {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => { });
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.05);
        }
    }

    public playClearCacheSuccessSound() {
        // Paper-ball SFX: short crumple rustle + whoosh sweep + soft thud
        if (!this.audioContext) this.initAudioContext();

        if (!this.isSoundEnabled || !this.audioContext) return;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => { });
        }

        const ctx = this.audioContext;
        const t0 = ctx.currentTime;

        // --- Crumple/rustle (short shaped noise) ---
        const crumpleDur = 0.18; // seconds
        const crumpleBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * crumpleDur), ctx.sampleRate);
        const cb = crumpleBuf.getChannelData(0);
        for (let i = 0; i < cb.length; i++) {
            // stronger at start, decays quickly to mimic crumpling
            cb[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / cb.length, 2.2);
        }
        const crumpleSrc = ctx.createBufferSource();
        crumpleSrc.buffer = crumpleBuf;
        const crumpleFilter = ctx.createBiquadFilter();
        crumpleFilter.type = 'highpass';
        crumpleFilter.frequency.setValueAtTime(700, t0);
        const crumpleGain = ctx.createGain();
        crumpleGain.gain.setValueAtTime(0.0, t0);
        crumpleGain.gain.linearRampToValueAtTime(0.16, t0 + 0.006);
        crumpleGain.gain.exponentialRampToValueAtTime(0.001, t0 + crumpleDur);

        // --- Whoosh (short bandpassed sweep) ---
        const whooshDur = 0.22;
        const whooshBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * whooshDur), ctx.sampleRate);
        const wb = whooshBuf.getChannelData(0);
        for (let i = 0; i < wb.length; i++) wb[i] = (Math.random() * 2 - 1) * (1 - i / wb.length) * 0.9;
        const whooshSrc = ctx.createBufferSource();
        whooshSrc.buffer = whooshBuf;
        const whooshFilter = ctx.createBiquadFilter();
        whooshFilter.type = 'bandpass';
        whooshFilter.frequency.setValueAtTime(3500, t0);
        whooshFilter.Q.setValueAtTime(1.2, t0);
        // sweep from high to mid
        whooshFilter.frequency.exponentialRampToValueAtTime(600, t0 + whooshDur);
        const whooshGain = ctx.createGain();
        whooshGain.gain.setValueAtTime(0.0, t0);
        whooshGain.gain.linearRampToValueAtTime(0.14, t0 + 0.004);
        whooshGain.gain.exponentialRampToValueAtTime(0.001, t0 + whooshDur);

        // --- Soft thud (low body) ---
        const thudOsc = ctx.createOscillator();
        thudOsc.type = 'sine';
        thudOsc.frequency.setValueAtTime(70, t0 + 0.03);
        const thudGain = ctx.createGain();
        thudGain.gain.setValueAtTime(0.0, t0);
        thudGain.gain.linearRampToValueAtTime(0.12, t0 + 0.04);
        thudGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);

        // Connect nodes
        crumpleSrc.connect(crumpleFilter);
        crumpleFilter.connect(crumpleGain);
        crumpleGain.connect(ctx.destination);

        whooshSrc.connect(whooshFilter);
        whooshFilter.connect(whooshGain);
        whooshGain.connect(ctx.destination);

        thudOsc.connect(thudGain);
        thudGain.connect(ctx.destination);

        // Start/stop
        crumpleSrc.start(t0);
        crumpleSrc.stop(t0 + crumpleDur);

        whooshSrc.start(t0 + 0.01);
        whooshSrc.stop(t0 + 0.01 + whooshDur);

        thudOsc.start(t0 + 0.03);
        thudOsc.stop(t0 + 0.28);
    }
}
