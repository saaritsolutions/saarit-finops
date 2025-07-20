import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { SpinnerComponent } from 'src/app/shared/spinner.component';
import { CreateCustomerComponent } from './create-customer.component';
import { CustomerService } from '../../customer/services/customer.service';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule, FormBuilder } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('CreateCustomerComponent', () => {
  let component: CreateCustomerComponent;
  let fixture: ComponentFixture<CreateCustomerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        CreateCustomerComponent,
        SpinnerComponent
      ],
      imports: [
        HttpClientTestingModule,
        MatCardModule,
        MatTabsModule,
        MatFormFieldModule,
        MatInputModule,
        MatRadioModule,
        MatSelectModule,
        MatOptionModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatIconModule,
        MatSlideToggleModule,
        BrowserAnimationsModule,
        ReactiveFormsModule,
        FormsModule,
        CommonModule
      ],
      providers: [
        CustomerService,
        FormBuilder
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CreateCustomerComponent);
    component = fixture.componentInstance;
    // Patch the form with required addressText value
    component.customerForm.patchValue({
      address: { addressText: 'Test Address', state: 'Kerala', district: 'Trivandrum', pinCode: '123456', phoneNumber: '1234567890' },
      onHold: false,
      active: true
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show name required error', () => {
    const nameControl = component.customerForm.get('name');
    nameControl?.setValue('');
    nameControl?.markAsTouched();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Name is required');
  });
});
