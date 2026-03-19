import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainAdminLayoutComponent } from './components/main-admin-layout/main-admin-layout.component';
import { ViewMainDataComponent } from './components/view-mail-data/view-main-data.component';
import { AddEditPublicationComponent } from './shared/add-edit-publication/add-edit-publication.component';

const routes: Routes = [
  {
    path: 'mainLayOut',
    component: MainAdminLayoutComponent  },
  {
    path: 'FullPublication',
    component: ViewMainDataComponent
  },
  {
    path: 'All-Publication',
    component: ViewMainDataComponent
  },
  {
    path: 'All-District',
    component: ViewMainDataComponent
  },
  {
    path: 'All-Category',
    component: ViewMainDataComponent
  },
  {
    path: 'All-Main-Services',
    component: ViewMainDataComponent
  },
  {
    path: 'All-Document',
    component: ViewMainDataComponent
  },
  {
    path: 'All-Sector',
    component: ViewMainDataComponent
  },
  {
    path: 'AddNew',
    component: AddEditPublicationComponent
  },
  {
    path: 'AddNewDocumentTypes',
    component: AddEditPublicationComponent
  },
  {
    path: 'AddNewDistricts',
    component: AddEditPublicationComponent
  },
  {
    path: 'AddNewCategories',
    component: AddEditPublicationComponent
  },
  {
    path: 'AddNewMainServices',
    component: AddEditPublicationComponent
  },
  {
    path: 'AddNewPublicationTypes',
    component: AddEditPublicationComponent
  },
  {
    path: 'AddNewSectors',
    component: AddEditPublicationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicationsRoutingModule { }
