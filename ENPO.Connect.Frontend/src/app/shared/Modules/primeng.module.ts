import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CheckboxModule } from 'primeng/checkbox'
import { TreeModule } from 'primeng/tree'
import { ToastModule } from 'primeng/toast';
import { ContextMenuModule } from 'primeng/contextmenu';
import { InputNumberModule } from 'primeng/inputnumber';
import { SidebarModule } from 'primeng/sidebar';
import { AvatarModule } from 'primeng/avatar';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CalendarModule } from 'primeng/calendar';
import { MenubarModule } from 'primeng/menubar';
import { TableModule } from 'primeng/table';
import { TieredMenuModule } from 'primeng/tieredmenu';
import { PanelMenuModule } from 'primeng/panelmenu';
import { DialogModule } from 'primeng/dialog';
import { ToolbarModule } from 'primeng/toolbar';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabViewModule } from 'primeng/tabview';
import { AccordionModule } from 'primeng/accordion';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PasswordModule } from 'primeng/password';
import { KeyFilterModule } from 'primeng/keyfilter';
import { Steps, StepsModule } from 'primeng/steps';
import { MultiSelectModule } from 'primeng/multiselect';
import { StyleClassModule } from 'primeng/styleclass';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ListboxModule } from 'primeng/listbox';
import { BadgeModule } from 'primeng/badge';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ChipsModule } from 'primeng/chips';
import { FileUploadModule } from 'primeng/fileupload';
import { TagModule } from 'primeng/tag';
import { VirtualScrollerModule } from 'primeng/virtualscroller';
import { ProgressBarModule } from 'primeng/progressbar';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { OverlayModule } from 'primeng/overlay';
import { MegaMenuModule } from 'primeng/megamenu';
import { MenuModule } from 'primeng/menu';
import { ChartModule } from 'primeng/chart';
import { DragDropModule } from 'primeng/dragdrop'; // <-- Add this
import { FieldsetModule } from 'primeng/fieldset';
import { SplitterModule } from 'primeng/splitter';
import { TreeTableModule } from 'primeng/treetable';
import { InputSwitchModule } from 'primeng/inputswitch';


const PrimeNg = [
  CommonModule,
  TableModule,
  PaginatorModule,
  DropdownModule,
  MultiSelectModule,
  ButtonModule,
  CheckboxModule,
  ProgressSpinnerModule,
  DragDropModule,
  TreeModule,
  ToastModule,
  ContextMenuModule,
  InputNumberModule,
  SidebarModule,
  AvatarModule,
  RadioButtonModule,
  CalendarModule,
  MenubarModule,
  TieredMenuModule,
  PanelMenuModule,
  DialogModule,
  ToolbarModule,
  DynamicDialogModule,
  ConfirmDialogModule,
  TabViewModule,
  AccordionModule,
  InputTextModule,
  InputTextareaModule,
  PasswordModule,
  KeyFilterModule,
  StepsModule,
  StyleClassModule,
  AutoCompleteModule,
  ListboxModule,
  BadgeModule,
  ToggleButtonModule,
  SelectButtonModule,
  ChipsModule,
  TagModule,
  FileUploadModule,
  VirtualScrollerModule,
  ProgressBarModule,
  OverlayPanelModule,
  OverlayModule,
  ConfirmDialogModule ,
  MegaMenuModule ,
  MenuModule,
  ChartModule,
  FieldsetModule,
  SplitterModule,
  TreeTableModule,
  InputSwitchModule
]
@NgModule({
  declarations: [],
  imports: [PrimeNg],
  exports: [PrimeNg],
})
export class PrimengModule { }
