import { Injectable } from '@angular/core';
import { AppTourService } from './tours/app-tour.service';
import { RequestsTourService } from './tours/requests-tour.service';
import { PublicationsTourService } from './tours/publications-tour.service';

@Injectable({
  providedIn: 'root'
})
export class TourService {

  constructor(
    private appTour: AppTourService,
    private requestsTour: RequestsTourService,
    private publicationsTour: PublicationsTourService
  ) { }

  public startTour() {
    this.appTour.startTour();
  }

  public forceStartTour() {
    this.appTour.forceStartTour();
  }

  // Requests Page Tour
  public forceStartRequestsTour() {
    this.requestsTour.forceStartTour();
  }

  public startRequestsTour() {
    this.requestsTour.startTour();
  }
  
  // Publications Tour
  public startPublicationsTour() {
      this.publicationsTour.startTour();
  }
  
  public forceStartPublicationsTour() {
      this.publicationsTour.forceStartTour();
  }
}
