import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';

@Component({
  selector: 'app-create-publication-page',
  templateUrl: './create-publication-page.component.html',
  styleUrls: ['./create-publication-page.component.scss']
})
export class CreatePublicationPageComponent {
  constructor(
    private readonly router: Router,
    private readonly authObjectsService: AuthObjectsService
  ) { }

  backToList(): void {
    this.router.navigate(['/PublicationNew']);
  }

  onSaved(): void {
    if (this.authObjectsService.checkAuthFun('PublSuperAdminFunc')) {
      this.router.navigate(['/PublicationNew']);
      return;
    }

    if (this.authObjectsService.checkAuthFun('PublicationsCreatorFunc')) {
      this.router.navigate(['/Home']);
      return;
    }

    this.router.navigate(['/Home']);
  }

  onCancelled(): void {
    this.backToList();
  }
}
