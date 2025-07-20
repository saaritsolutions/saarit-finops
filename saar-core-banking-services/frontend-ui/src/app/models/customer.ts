// src/app/models/customer.ts
export class Customer {
    constructor(
      public customerNo: string,
      public category: string,
      public name: string,
      public gender: string,
      public dateOfBirth: string,
      public age: number,
      public address: {
        addressText: string;
        state: string;
        district: string;
        pinCode: string;
        phoneNumber: string;
        alternatePhoneNumber: string;
      },
      public aadharNumber: string,
      public panNumber: string,
      public kycStatus: string,
      public comments: string,
      public onHold: boolean,
      public status: string,
      public active: boolean,
      public authStat: string
    ) {}
  
    // Add a method for age calculation
    calculateAge(): number {
      const dob = new Date(this.dateOfBirth);
      const diff = Date.now() - dob.getTime();
      const ageDate = new Date(diff);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    }
  }
  