import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatCardModule } from '@angular/material/card';
import { CustomerCreateComponent } from './customer-create.component';
import { CustomerService } from '../../services/customer.service';
import { of, throwError } from 'rxjs';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

// Mock MatSnackBar to prevent overlay injection errors
class MockMatSnackBar {
  open() {
    return {
      afterDismissed: () => of({})
    };
  }
  dismiss() {}
}

describe('CustomerCreateComponent - API Connectivity Test', () => {
  let httpClient: HttpClient;
  let originalTimeout: number;

  // Increase Jasmine's default timeout
  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000; // 60 seconds
    console.log('Set Jasmine timeout to 60 seconds for API tests');
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    console.log('Reset Jasmine timeout to original value');
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: []
    }).compileComponents();

    httpClient = TestBed.inject(HttpClient);
  });

  // Direct API test
  it('should verify API connectivity', (done) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    
    console.log(`Starting API test with email: ${testEmail}`);
    
    // Test GET first
    httpClient.get('http://localhost:5200/api/Customer').subscribe({
      next: (data) => {
        console.log('GET API successful, found customers:', data);
        expect(data).toBeTruthy();
        
        // Now test POST
        const newCustomer = {
          firstName: 'Test',
          lastName: 'User',
          email: testEmail,
          dateOfBirth: '1990-01-01T00:00:00Z',
          gender: 'M',
          customerType: 'Individual',
          postalAddress: '123 Test St',
          mobile: '9876543210'
        };
        
        console.log('Posting new customer:', newCustomer);
        
        httpClient.post('http://localhost:5200/api/Customer', newCustomer).subscribe({
          next: (result) => {
            console.log('POST API successful, created customer:', result);
            expect(result).toBeTruthy();
            done();
          },
          error: (err) => {
            console.error('POST API failed:', err);
            fail('Error in POST API: ' + JSON.stringify(err));
            done();
          }
        });
      },
      error: (err) => {
        console.error('GET API failed:', err);
        fail('Error in GET API: ' + JSON.stringify(err));
        done();
      }
    });
  }, 30000); // 30-second timeout for this specific test
});
