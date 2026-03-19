import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BubblesBgComponent } from './bubbles-bg/bubbles-bg.component';
import { PostofficesListComponent } from './postoffices-list/postoffices-list.component';
import { AtmListComponent } from './atm-list/atm-list.component'; // Import AtmListComponent
import { MascotPeekComponent } from './mascot-peek/mascot-peek.component';
import { GenericModuleModule } from '../../Modules/GenericComponents/generic-module.module';
import { PrimengModule } from '../Modules/primeng.module';
@NgModule({
  declarations: [BubblesBgComponent, PostofficesListComponent, AtmListComponent, MascotPeekComponent],
  imports: [ CommonModule, GenericModuleModule, PrimengModule ],
  exports: [ BubblesBgComponent, PostofficesListComponent, AtmListComponent, MascotPeekComponent ]
})
export class SharedComponentsModule { }
