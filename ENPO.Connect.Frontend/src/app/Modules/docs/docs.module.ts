import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocsRoutingModule } from './docs-routing.module';
import { DocsShellComponent } from './components/docs-shell/docs-shell.component';
import { DocsPageComponent } from './components/docs-page/docs-page.component';
import { DocsSidebarComponent } from './components/docs-sidebar/docs-sidebar.component';

@NgModule({
  declarations: [DocsShellComponent, DocsPageComponent, DocsSidebarComponent],
  imports: [CommonModule, DocsRoutingModule]
})
export class DocsModule {}
