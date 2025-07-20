import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import * as XLSX from 'xlsx';
import { Customer } from '../../models/customer'; // Replace with the actual path to your model

@Component({
  selector: 'app-grid',
  templateUrl: './grid.component.html',
  styleUrls: ['./grid.component.scss']
})
export class GridComponent implements OnInit {
  @Input() dataSource = new MatTableDataSource<any>(); // Accept data as input
  @Output() editRecord = new EventEmitter<any>(); 
  @Output() viewRecord = new EventEmitter<any>(); 
  displayedColumns: string[] = ['customerNo', 'category', 'name', 'gender', 'dateOfBirth', 'status', 'actions'];
 // dataSource = new MatTableDataSource<Customer>();
  expandedElement: Customer | null = null;
  isExpandedRow = (row: any) => this.expandedElement === row;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Dummy Data
 dummyData: Customer[] = Array.from({ length: 20 }, (_, index) => 
    new Customer(
      `CUST00${index + 1}`,
      index % 2 === 0 ? 'Retail' : 'Corporate',
      `Customer ${index + 1}`,
      index % 3 === 0 ? 'M' : index % 3 === 1 ? 'F' : 'O',
      `1990-01-${(index % 28) + 1}`,
      30 + index % 10,
      {
        addressText: `123 Street ${index + 1}`,
        state: 'Kerala',
        district: 'Kochi',
        pinCode: `68${index + 1}00${index}`,
        phoneNumber: `98765432${index + 10}`,
        alternatePhoneNumber: `98765000${index}`
      },
      `12341234123${index}`,
      `ABCDE123${index}`,
      index % 2 === 0 ? 'Verified' : 'Pending',
      'Sample customer data',
      index % 5 === 0,
      index % 2 === 0 ? 'Active' : 'Inactive',
      index % 2 === 0,
      'A'
    )
  );

  ngOnInit(): void {
  //  this.dataSource = new MatTableDataSource(this.dummyData);

  }
  
  ngAfterViewInit():void{
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  toggleExpand(row: Customer): void {
    this.expandedElement = this.expandedElement === row ? null : row;
    this.viewRecord.emit(row);
  }

  editRow(row: Customer): void {
    console.log('Edit row:', row);
    this.editRecord.emit(row);
  }

  deleteRow(row: Customer): void {
    const index = this.dummyData.findIndex((data) => data.customerNo === row.customerNo);
    if (index > -1) {
      this.dummyData.splice(index, 1);
      this.dataSource.data = [...this.dummyData];
    }
  }

  exportTable(): void {
    const worksheet = XLSX.utils.json_to_sheet(this.dataSource.filteredData);
    const workbook = { Sheets: { data: worksheet }, SheetNames: ['data'] };
    XLSX.writeFile(workbook, 'customer-data.xlsx');
  }
}
