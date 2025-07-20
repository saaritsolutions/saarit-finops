import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CustomerCreateComponent } from './components/customer-create/customer-create.component';

const routes: Routes = [
  { path: 'create-generic', component: CustomerCreateComponent },
  // Future: add list, view, edit routes here
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CustomerRoutingModule {}
