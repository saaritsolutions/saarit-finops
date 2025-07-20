import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private baseUrl = 'http://localhost:5200/api/Customer'; // Replace with your backend URL

  constructor(private http: HttpClient) {}

  createCustomer(customerData: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    console.log('Customer Data:', JSON.stringify(customerData));
    return this.http.post(`${this.baseUrl}/create`, customerData,{headers});
  }

  /**
   * Search customers
   * @param searchParams Query parameters for search (e.g., name, category, etc.)
   */
  searchCustomers(searchParams?: any): Observable<any> {
    let params = new HttpParams();
    if (searchParams) {
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key]) {
          params = params.append(key, searchParams[key]);
        }
      });
    }
    return this.http.get(`${this.baseUrl}/search`, { params });
  }

  /**
   * Get customer details by customer number
   * @param customerNo Unique identifier of the customer
   */
  getCustomerByNo(customerNo: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${customerNo}`);
  }

  /**
   * Update an existing customer
   * @param customerNo Unique identifier of the customer to be updated
   * @param updatedData Updated customer object
   */
  updateCustomer(customerNo: string, updatedData: any): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.put(`${this.baseUrl}/${customerNo}`, updatedData, { headers });
  }

  /**
   * Delete a customer by customer number
   * @param customerNo Unique identifier of the customer to be deleted
   */
  deleteCustomer(customerNo: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${customerNo}`);
  }
}

