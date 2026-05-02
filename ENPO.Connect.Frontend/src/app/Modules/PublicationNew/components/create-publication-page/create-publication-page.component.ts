import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-create-publication-page',
  templateUrl: './create-publication-page.component.html',
  styleUrls: ['./create-publication-page.component.scss']
})
export class CreatePublicationPageComponent {
  constructor(private readonly router: Router) { }

  backToList(): void {
    this.router.navigate(['/PublicationNew']);
  }

  onSaved(): void {
    this.backToList();
  }

  onCancelled(): void {
    this.backToList();
  }
}
