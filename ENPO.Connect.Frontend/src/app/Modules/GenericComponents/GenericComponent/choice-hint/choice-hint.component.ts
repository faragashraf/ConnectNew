import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-choice-hint',
  templateUrl: './choice-hint.component.html',
  styleUrls: ['./choice-hint.component.scss']
})
export class ChoiceHintComponent {
  @Input() isHidden: boolean = false;
}
