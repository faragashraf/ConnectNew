import { Component, Input } from '@angular/core';

export type SummerOwnerInfo = {
  name: string;
  fileNumber: string;
  nationalId: string;
  phone: string;
  extraPhone: string;
};

@Component({
  selector: 'app-summer-request-owner-card',
  templateUrl: './summer-request-owner-card.component.html',
  styleUrls: ['./summer-request-owner-card.component.scss']
})
export class SummerRequestOwnerCardComponent {
  @Input() title = 'بيانات صاحب الطلب';
  @Input() owner: SummerOwnerInfo | null = null;
}

