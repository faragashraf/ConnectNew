import { Injectable } from "@angular/core";
import { Subject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class WindowsNotificationService {
    PauseWindowsNotification$ = new Subject<boolean>();
    WindowsNotification: boolean = true
    // instructionVisible$ = new Subject<boolean>();
    requestNotificationPermission(): Promise<string> {
        return Notification.requestPermission();
    }
    constructor() {
        this.PauseWindowsNotification$.subscribe((value) => {
            this.WindowsNotification = value
        })
    }
    showNotification(body: string, _icon?: string, title?: string, options?: NotificationOptions): void {
        if (_icon == null) {
            _icon = 'assets/imges/Corresponding.png'
        }
        if (title == null)
            title = 'Connect | بوابتك للخدمات الداخلية'
        if ('Notification' in window && this.WindowsNotification) {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    if ('Notification' in window && Notification.permission === 'granted') {
                        const notification = new Notification((title as string), {
                            body: body,
                            icon: _icon,
                            // image:'assets/img/swb.png',
                            // tag:'Please Remember',
                        });

                        // You can also handle click events on the notification
                        notification.onclick = (event) => {
                        };
                    }
                    else{
                        // this.instructionVisible$.next(true)
                    }
                }
                else{
                    // this.instructionVisible$.next(true)
                }
            });
        }
    }
}