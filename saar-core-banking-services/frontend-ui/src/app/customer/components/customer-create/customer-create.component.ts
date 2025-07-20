import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer.model';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-customer-create',
  templateUrl: './customer-create.component.html',
  styleUrls: ['./customer-create.component.scss']
})
export class CustomerCreateComponent implements OnInit {
  @Input() customerData?: any;
  @Input() isReadOnly: boolean = false;
  
  customerForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder, 
    private customerService: CustomerService,
    private snackBar: MatSnackBar
  ) {
    this.customerForm = this.fb.group({
      salutation: ['Mr'],
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      middleName: [''],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      fatherOrHusbandName: [''],
      postalAddress: ['', [Validators.required, Validators.minLength(5)]],
      addressText: [''], // Added for compatibility with tests/templates
      telephone: [''],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.email]],
      dateOfBirth: ['', Validators.required],
      gender: ['M', Validators.required],
      pan: ['', Validators.pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/)],
      passport: [''],
      drivingLicense: [''],
      voterId: [''],
      uid: ['', Validators.pattern(/^[0-9]{12}$/)],
      introducerAccountNumber: [''],
      customerType: ['Individual', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.customerData) {
      this.customerForm.patchValue(this.customerData);
    }
    
    if (this.isReadOnly) {
      this.customerForm.disable();
    }
  }

  submitForm(): void {
    if (this.customerForm.invalid) {
      this.markFormGroupTouched(this.customerForm);
      this.snackBar.open('Please fill in all required fields correctly', 'Close', {
        duration: 3000,
        panelClass: ['warning-snackbar']
      });
      return;
    }
    
    this.isSubmitting = true;
    const formValue = this.customerForm.value;
    
    // Ensure dateOfBirth is in UTC format for PostgreSQL
    if (formValue.dateOfBirth) {
      // If it's just a date string without time (YYYY-MM-DD), append time in UTC format
      if (typeof formValue.dateOfBirth === 'string' && !formValue.dateOfBirth.includes('T')) {
        formValue.dateOfBirth = `${formValue.dateOfBirth}T00:00:00Z`;
      } else if (formValue.dateOfBirth instanceof Date) {
        // If it's a Date object, convert to ISO string (which is UTC)
        formValue.dateOfBirth = formValue.dateOfBirth.toISOString();
      }
    }
    
    const customer: Customer = formValue;
    
    this.customerService.createCustomer(customer).subscribe({
      next: (response) => {
        this.snackBar.open('Customer created successfully!', 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });
        this.resetForm();
      },
      error: (error) => {
        this.snackBar.open('Error creating customer: ' + (error.message || 'Unknown error'), 'Close', {
          duration: 5000,
          horizontalPosition: 'end',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
        this.isSubmitting = false;
      }
    });
  }
  
  resetForm(): void {
    this.customerForm.reset({
      salutation: 'Mr',
      gender: 'M',
      customerType: 'Individual'
    });
    this.isSubmitting = false;
  }
  
  // Helper method to mark all controls as touched
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}
