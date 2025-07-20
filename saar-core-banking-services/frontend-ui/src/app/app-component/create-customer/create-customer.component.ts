import { ChangeDetectionStrategy, Component, Input, input, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-create-customer',
  templateUrl: './create-customer.component.html',
  styleUrls: ['./create-customer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class CreateCustomerComponent implements OnInit {
 @Input() customerData:any;
 @Input() isReadOnly:boolean=false;
  customerForm: FormGroup;
  states: string[] = ['Kerala', 'Tamil Nadu', 'Karnataka', 'Maharashtra'];
  districts: { [key: string]: string[] } = {
    Kerala: ['Trivandrum', 'Kollam', 'Kochi'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
    Karnataka: ['Bangalore', 'Mysore'],
    Maharashtra: ['Mumbai', 'Pune']
  };
  filteredDistricts: string[] = [];

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private snackBar: MatSnackBar
  ) {
    this.customerForm = this.fb.group({
      customerNo: ['', Validators.required],
      category: ['Individual', Validators.required],
      name: ['', Validators.required],
      gender: ['M', Validators.required],
      dateOfBirth: ['', Validators.required],
      age: [{ value: 0, disabled: true }], // Calculated field
      address: this.fb.group({
        addressText: ['', Validators.required],
        state: ['Kerala', Validators.required],
        district: ['Trivandrum', Validators.required],
        pinCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
        phoneNumber: [null, [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
        alternatePhoneNumber: [null, Validators.pattern(/^[0-9]{10}$/)]
      }),
      aadharNumber: [''],
      panNumber: [''],
      kycDocs: this.fb.array([]),
      comments: [''],
      onHold: [false],
      status: ['Open', Validators.required],
      authStat: ['A', Validators.required],
      kycStatus: ['Verified', Validators.required],
      active: [true, Validators.required]
    });
  }

  ngOnInit(): void {
    this.updateDistricts('Kerala');
    if(this.isReadOnly)
      this.customerForm.disable();
  }

  updateDistricts(state: string): void {
    const addressControl = this.customerForm.get('address');
    if (addressControl) {
      const districts = this.districts[state] || [];
      this.filteredDistricts = districts;
      addressControl.get('district')?.setValue(districts[0]);
    }
  }
  // Update the form when input data changes
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customerData'] && changes['customerData'].currentValue) {
      this.customerForm.patchValue(this.customerData);
    }
  }
  addKycDoc(): void {
    this.kycDocs.push(
      this.fb.group({
        document: ['', Validators.required],
        status: ['', Validators.required],
        attachment: [null]
      })
    );
  }

  removeKycDoc(index: number): void {
    this.kycDocs.removeAt(index);
  }

  get kycDocs(): FormArray {
    return this.customerForm.get('kycDocs') as FormArray;
  }

  onFileChange(event: Event, doc: AbstractControl): void {
    const formGroup = doc as FormGroup;
    const input = event.target as HTMLInputElement;
    if (input?.files && input.files.length > 0) {
      formGroup.get('attachment')?.setValue(input.files[0]);
    }
  }

  onDateOfBirthChange(): void {
    const dobControl = this.customerForm.get('dateOfBirth');
    const ageControl = this.customerForm.get('age');

    if (dobControl?.value) {
      const dob = new Date(dobControl.value);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      ageControl?.setValue(age);
    }
  }

  checkInvalidFields(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      if (control instanceof FormGroup) {
        this.checkInvalidFields(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((group, index) => {
          if (group instanceof FormGroup) {
            console.log(`FormArray Group Index ${index}:`);
            this.checkInvalidFields(group);
          }
        });
      } else {
        if (control && control.invalid) {
          console.log(`Field "${key}" is invalid. Errors:`, control.errors);
        }
      }
    });
  }

  submitForm(): void {
    if (this.customerForm.invalid) {
      this.checkInvalidFields(this.customerForm);
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    const customerData = this.customerForm.value;

    this.customerService.createCustomer(customerData).subscribe(
      (response) => {
        this.snackBar.open('Customer created successfully!', 'Close', { duration: 3000 });
        this.customerForm.reset();
        this.kycDocs.clear();
        this.updateDistricts('Kerala');
      },
      (error) => {
        this.snackBar.open('Failed to create customer. Please try again.', 'Close', { duration: 3000 });
        console.error('Error creating customer:', error);
      }
    );
  }
  fillTestData(): void {
    
    this.customerForm.patchValue({
      customerNo: 'CUST001',
      name: 'John Doe',
      gender: 'M',
      dateOfBirth: '1985-01-01',
      age: 38,
      address: {
        addressText: '123 Main Street',
        state: 'Kerala',
        district: 'Trivandrum',
        pinCode: '695001',
        phoneNumber: '9876543210',
        alternatePhoneNumber: '9876500000',
      },
      comments: 'Test comment',
      onHold: false,
      active: true,
      authStat: 'A',
      kycStatus: 'Verified',
    });
  
    const kycArray = this.customerForm.get('kycDocs') as FormArray;
    kycArray.clear(); // Clear existing items
    kycArray.push(
      this.fb.group({
        document: 'Aadhar',
        status: 'Verified',
        attachment: null,
      })
    );
  }
  
}
