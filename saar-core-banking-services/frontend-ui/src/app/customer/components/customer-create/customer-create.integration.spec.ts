import { TestBed } from '@angular/core/testing';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

describe('CustomerCreateComponent Integration Test', () => {
  let httpClient: HttpClient;
  let originalTimeout: number;

  beforeAll(() => {
    originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
  });

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientModule],
    }).compileComponents();
    httpClient = TestBed.inject(HttpClient);
  });

  it('should POST and GET customer from real backend', async () => {
    const timestamp = Date.now();
    const testEmail = `integration${timestamp}@example.com`;
    const newCustomer = {
      firstName: 'Integration',
      lastName: 'Test',
      email: testEmail,
      dateOfBirth: '1990-01-01T00:00:00Z',
      gender: 'F',
      customerType: 'Individual',
      postalAddress: '123 Integration St',
      mobile: '9876543210'
    };
    // POST
    const postResult = await firstValueFrom(
      httpClient.post<any>('http://localhost:5200/api/Customer', newCustomer)
    );
    expect(postResult).toBeTruthy();
    expect(postResult.email).toBe(testEmail);
    // GET
    const customers = await firstValueFrom(
      httpClient.get<any[]>('http://localhost:5200/api/Customer')
    );
    const found = customers.find(c => c.email === testEmail);
    expect(found).toBeTruthy();
  });
});
