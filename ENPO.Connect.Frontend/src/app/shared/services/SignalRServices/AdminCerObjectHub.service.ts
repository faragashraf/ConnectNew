import { Injectable } from "@angular/core";
import { Observable, Subject, Subscription } from "rxjs";


export function assignSubscription(
  prevSubscription: Subscription | undefined,
  observable: Observable<any>,
  next: (value: any) => void,
  error?: (err: any) => void,
  complete?: () => void,
  onUnsubscribe?: (wasActive: boolean) => void
): Subscription {
  let wasActive = false;
  if (prevSubscription && !prevSubscription.closed) {
    wasActive = true;
    prevSubscription.unsubscribe();
    if (onUnsubscribe) {
      onUnsubscribe(wasActive);
    }
  }
  return observable.subscribe({ next, error, complete });
}

@Injectable({
    providedIn: 'root'
})
export class AdminCerObjectHubService {
    
    constructor() {
        // this.onReciveObject();
    }

    // onReciveObject() {
    //     this.signalRService.hubConnection.on('ReciveObject', (object: any) => {
    //         this.adminCerObject$.next(object)
    //         console.log('object', object);
    //     });

    // }
}