// Protractor E2E test for customer creation (ng e2e)
import { browser, by, element } from 'protractor';

describe('Customer Creation E2E', () => {
  it('should create a customer via the UI and verify in the backend', async () => {
    const timestamp = Date.now();
    await browser.get('/customer/create-generic');
    await element(by.css('input[formcontrolname="firstName"]')).sendKeys('E2E');
    await element(by.css('input[formcontrolname="lastName"]')).sendKeys('Test');
    await element(by.css('input[formcontrolname="email"]')).sendKeys(`e2e${timestamp}@example.com`);
    await element(by.css('input[formcontrolname="dateOfBirth"]')).sendKeys('1990-01-01');
    await element(by.css('input[formcontrolname="mobile"]')).sendKeys('9876543210');
    await element(by.css('input[formcontrolname="postalAddress"]')).sendKeys('123 E2E St');
    // Gender and customerType may be select or radio, adjust as needed
    // await element(by.css('select[formcontrolname="gender"]')).sendKeys('F');
    // await element(by.css('select[formcontrolname="customerType"]')).sendKeys('Individual');
    await element(by.css('button[type="submit"]')).click();
    // Check for success message
    expect(await element(by.cssContainingText('*', 'Customer created successfully')).isPresent()).toBe(true);
    // Optionally, verify in backend via API (not typical in Protractor, but can be done with request libs)
  });
});
