using System;
using System.Collections.Generic;

namespace CustomerService.Models
{
    public class Customer
    {
        public int CustomerId { get; set; }
        public string? Salutation { get; set; }
        public string? FirstName { get; set; }
        public string? MiddleName { get; set; }
        public string? LastName { get; set; }
        public string? FatherOrHusbandName { get; set; }
        public string? PostalAddress { get; set; }
        public string? Telephone { get; set; }
        public string? Mobile { get; set; }
        public string? Email { get; set; }
        public DateTime DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? PAN { get; set; }
        public string? Passport { get; set; }
        public string? DrivingLicense { get; set; }
        public string? VoterId { get; set; }
        public string? UID { get; set; }
        public string? IntroducerAccountNumber { get; set; }
        public string? CustomerType { get; set; }
        public string? CreatedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public string? ApprovalStatus { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ApprovedAt { get; set; }
        // Navigation properties for microservice: remove or refactor as needed
    }
}
