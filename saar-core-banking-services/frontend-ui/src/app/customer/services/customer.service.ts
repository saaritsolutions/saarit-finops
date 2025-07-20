import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Customer } from '../models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  // Use http://localhost:5200/api/Customer for direct API testing
  private apiUrl = 'http://localhost:5200/api/Customer';

  constructor(private http: HttpClient) {}

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${this.apiUrl}`, customer);
  }

  getCustomer(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/${id}`);
  }

  updateCustomer(id: number, customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(`${this.apiUrl}/${id}`, customer);
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.apiUrl}`);
  }
}
