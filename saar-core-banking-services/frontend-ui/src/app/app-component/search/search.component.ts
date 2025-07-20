import { Component, OnInit,Input, EventEmitter, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CustomerService } from 'src/app/services/customer.service';


@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class SearchComponent implements OnInit {
  @Input() entityName: string = 'Entity'; // Default entity name
  @Output() searchResults = new EventEmitter<any[]>(); 
  query: string = ''; // Current query input
  tokens:string[]=[];
  suggestions: string[] = []; // Suggestions for autocomplete
  results: Array<Record<string, any>> = []; // Search results

  // Mock entity data
  entity: {
    name: string;
    attributes: string[];
    mockData: Array<Record<string, any>>;
  } = {
    name: 'Address',
    attributes: ['address', 'country', 'state', 'district', 'phone_no'],
    mockData: [
      {
        address: '123 Main St',
        country: 'USA',
        state: 'CA',
        district: 'LA',
        phone_no: 1234567890,
      },
      {
        address: '456 Elm St',
        country: 'India',
        state: 'Kerala',
        district: 'Kochi',
        phone_no: 9876543210,
      },
    ],
  };

  operators: string[] = ['=', '!=', '>', '<', 'contains'];
 
constructor(  private customerService: CustomerService,
  private snackBar: MatSnackBar
){

}

 
  ngOnInit(): void {}

  // Handle changes in the query input
  onQueryChange(): void {
    this.tokens = this.query.trim().split(/\s+/); // Split query into tokens
    const lastToken: string = this.tokens[this.tokens.length - 1] || '';

    if (this.tokens.length === 1) {
      // Suggest attributes (keys)
      this.suggestions = this.entity.attributes.filter((attr) =>
        attr.startsWith(lastToken)
      );
    } else if (this.tokens.length === 2) {
      // Suggest operators
      this.suggestions = this.operators.filter((op) =>
        op.startsWith(lastToken)
      );
    } else if (this.tokens.length === 3) {
      // Suggest values based on the attribute
      const key: string = this.tokens[0];
      if (this.entity.attributes.includes(key)) {
        this.suggestions = Array.from(
          new Set(
            this.entity.mockData
              .map((item) =>
                item[key]?.toString().startsWith(lastToken)
                  ? item[key].toString()
                  : ''
              )
              .filter((val) => val) // Remove empty suggestions
          )
        );
      } else {
        this.suggestions = [];
      }
    } else {
      // No suggestions for more than 3 tokens
      this.suggestions = [];
    }
  }

  // Append the selected suggestion to the query
  onSuggestionSelect(suggestion: string): void {
    //const tokens: string[] = ['']; // Split the query into tokens
    this.tokens[this.tokens.length - 1] = suggestion; // Replace the last token with the suggestion
    this.query = this.tokens.join(' ') + ' '; // Rebuild the query and add a trailing space
    this.suggestions = []; // Clear suggestions after selection
  }

  // Perform the search operation
  onSearch(): void {
    const tokens: string[] = this.query.trim().split(/\s+/); // Split and trim the query
    // if (tokens.length !== 3) {
    //   alert('Invalid query format. Expected: key operator value');
    //   return;

   // const [key, operator, value] = tokens;

    // // Validate the key and operator
    // if (!this.entity.attributes.includes(key)) {
    //   alert(`Invalid key: ${key}`);
    //   return;
    // }
    // if (!this.operators.includes(operator)) {
    //   alert(`Invalid operator: ${operator}`);
    //   return;
    // }

    this.customerService.searchCustomers( this.query).subscribe(
      (response) => {
        console.log(response);
        this.snackBar.open('Customer searched successfully!', 'Close', { duration: 3000 });
        this.searchResults.emit(response);
      },
      (error) => {
        this.snackBar.open('Failed to create customer. Please try again.', 'Close', { duration: 3000 });
        console.error('Error creating customer:', error);
      }
    );
  }
}
