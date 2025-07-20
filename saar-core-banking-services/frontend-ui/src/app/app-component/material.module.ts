//todo cleanup
import 'hammerjs';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { DemoMaterialModule } from '../demo-material-module';
import { CdkTableModule } from '@angular/cdk/table';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MaterialRoutes } from './material.routing';


import { GridComponent } from './grid/grid.component';
// import { ListsComponent } from './lists/lists.component';
// import { MenuComponent } from './menu/menu.component';
// import { TabsComponent } from './tabs/tabs.component';
// import { StepperComponent } from './stepper/stepper.component';
// import { ExpansionComponent } from './expansion/expansion.component';
// import { ChipsComponent } from './chips/chips.component';
// import { ToolbarComponent } from './toolbar/toolbar.component';
// import { ProgressSnipperComponent } from './progress-snipper/progress-snipper.component';
// import { ProgressComponent } from './progress/progress.component';
// import {
//   DialogComponent,
//   DialogOverviewExampleDialogComponent
// } from './dialog/dialog.component';
// import { TooltipComponent } from './tooltip/tooltip.component';
// import { SnackbarComponent } from './snackbar/snackbar.component';
// import { SliderComponent } from './slider/slider.component';
// import { SlideToggleComponent } from './slide-toggle/slide-toggle.component';
import { SearchComponent } from './search/search.component';
import { EntityHomeComponent } from './entityhome/entityhome.component';
import { CreateCustomerComponent } from './create-customer/create-customer.component';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';

@NgModule({declarations: [SearchComponent,EntityHomeComponent,CreateCustomerComponent, GridComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(MaterialRoutes),
    DemoMaterialModule,
    HttpClientModule,
    FormsModule,
    MatTableModule,
    MatSortModule,
    ReactiveFormsModule,
    CdkTableModule,

  
   
    // ListsComponent,
    // MenuComponent,
    // TabsComponent,
    // StepperComponent,
    // ExpansionComponent,
    // ChipsComponent,
    // ToolbarComponent,
    // ProgressSnipperComponent,
    // ProgressComponent,
    // DialogComponent,
    // TooltipComponent,
    // SnackbarComponent,
    // SliderComponent,
    // SlideToggleComponent 
  ],
  providers: [],
})
export class MaterialComponentsModule {}
