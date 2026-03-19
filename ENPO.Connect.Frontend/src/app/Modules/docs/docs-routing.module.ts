import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocsShellComponent } from './components/docs-shell/docs-shell.component';
import { DocsPageComponent } from './components/docs-page/docs-page.component';

const routes: Routes = [
  {
    path: '',
    component: DocsShellComponent,
    children: [
      { path: ':lang/:page', component: DocsPageComponent },
      { path: '', component: DocsPageComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DocsRoutingModule {}
