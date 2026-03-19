import { Injectable } from '@angular/core';
import { NgxSpinnerService } from 'ngx-spinner';
import { BehaviorSubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class SpinnerService {
  private _spinnerLoading = new BehaviorSubject<string>('Loading...');
  public spinnerLoading$ = this._spinnerLoading.asObservable();

  constructor(private spinner: NgxSpinnerService) { }

  // Show the spinner with a dynamic message
  show(message: string = 'Loading...') {
    Promise.resolve().then(() => this._spinnerLoading.next(message));
    this.spinner.show();
  }

  hide() {
    this.spinner.hide();
    setTimeout(() => {
      Promise.resolve().then(() => this._spinnerLoading.next('Loading...'));
    }, 1000);
  }
}
