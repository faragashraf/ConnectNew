import { Component, OnInit } from '@angular/core';
import { SeasonalOccasionService, Occasion } from '../../../services/seasonal-occasion.service';

@Component({
  selector: 'app-seasonal-banner',
  templateUrl: './seasonal-banner.component.html',
  styleUrls: ['./seasonal-banner.component.scss']
})
export class SeasonalBannerComponent implements OnInit {

  activeOccasion: Occasion | null = null;
  isVisible = false;

  constructor(private seasonalService: SeasonalOccasionService) { }

  ngOnInit(): void {
    const today = new Date();
    // Use the logic to find if there is an active occasion
    this.activeOccasion = this.seasonalService.getActiveOccasion(today);
    
    if (this.activeOccasion) {
        this.isVisible = true;
    }
  }

  closeBanner() {
      this.isVisible = false;
  }
}
