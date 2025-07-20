import { Component, OnInit,ChangeDetectorRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { CustomerCreateComponent } from '../../customer/components/customer-create/customer-create.component';

@Component({
  selector: 'app-entity-home',
  templateUrl: './entityhome.component.html',
  styleUrls: ['./entityhome.component.scss'],
})
export class EntityHomeComponent implements OnInit {
  entityName: string = ''; // Store the entity name (e.g., Customer, Investor)
  newEntity: { name: string; email: string } = { name: '', email: '' };
  gridData: MatTableDataSource<any> = new MatTableDataSource(); // Initialize as MatTableDataSource
  editRecord:any;
  isReadOnly:boolean=true;

  dynamicTabs: { title: string; content: any }[] = [];
  selectedTabIndex: number = 0;
  constructor(private route: ActivatedRoute,private cdr: ChangeDetectorRef) {}
  


  ngOnInit(): void {
    // Get the entity name from the route parameter
    this.route.paramMap.subscribe((params) => {
      this.entityName = params.get('entity') || 'Entity'; // Default to 'Entity'
    });
    console.log(this.isReadOnly);
  }

  onCreateEntity(): void {
    console.log(`${this.entityName} Created:`, this.newEntity);
    alert(`${this.entityName} "${this.newEntity.name}" created successfully!`);
    this.newEntity = { name: '', email: '' }; // Reset the form
  }
  onSearchResults(results: any[]): void {
    this.gridData.data = results;
  }
  onEditRecord(results: any):void{
    this.editRecord=results;
    this.openCreateCustomerTab(this.editRecord.customerNo);
    this.isReadOnly=false;
    console.log(this.isReadOnly);
  }
  onViewRecord(results: any):void{
    this.editRecord=results;
    this.openCreateCustomerTab(this.editRecord.customerNo);
    this.isReadOnly=true;
    console.log(this.isReadOnly);
  }
  /**
   * Open a new "Create Customer" tab.
   */
  openCreateCustomerTab(id:string): void {
    const newTab = { title: 'Create Customer'+id, content: CustomerCreateComponent }

    // Check if the tab is already open
    const existingTabIndex = this.dynamicTabs.findIndex(tab => tab.title === newTab.title);
    if (existingTabIndex >= 0) {
      this.selectedTabIndex = existingTabIndex + 1; // Focus the existing tab
    } else {
      this.dynamicTabs.push(newTab); // Add new tab to dynamicTabs array
      this.selectedTabIndex = this.dynamicTabs.length; // Focus the newly added tab
    }
  }

  /**
   * Close a tab by index.
   * @param index The index of the tab to close.
   */
  closeTab(index: number): void {
    this.dynamicTabs.splice(index, 1);
    // Adjust selected index if closing the currently selected tab
    if (this.selectedTabIndex >= this.dynamicTabs.length + 1) {
      this.selectedTabIndex = this.dynamicTabs.length;
    }
  }


onTabChange(event: number): void {
  this.selectedTabIndex = event;
  this.cdr.detectChanges(); // Force re-evaluation of styles
}
}
